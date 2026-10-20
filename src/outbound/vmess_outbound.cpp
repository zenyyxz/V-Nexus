#include "vnexus/outbound/vmess_outbound.hpp"
#include "vnexus/common/log.hpp"
#include "vnexus/common/net.hpp"

#include <openssl/hmac.h>
#include <openssl/evp.h>
#include <openssl/rand.h>
#include <openssl/ssl.h>
#include <endian.h>
#include <array>
#include <chrono>

namespace vnexus::outbound {

namespace {

class VmessSslRelay : public std::enable_shared_from_this<VmessSslRelay> {
public:
    VmessSslRelay(std::shared_ptr<SessionContext> session,
                  asio::ip::tcp::socket client,
                  std::shared_ptr<asio::ssl::stream<asio::ip::tcp::socket>> remote,
                  uint8_t expected_v)
        : session_(std::move(session)),
          client_(std::move(client)),
          remote_(std::move(remote)),
          expected_v_(expected_v) {}

    void start() {
        do_read_client();
        do_read_remote();
    }

private:
    void do_read_client() {
        auto self = shared_from_this();
        client_.async_read_some(asio::buffer(client_buf_),
            [this, self](std::error_code ec, size_t length) {
                if (!ec && length > 0) {
                    session_->bytes_up += length;
                    
                    // Frame chunk: [length (2B Big Endian)][data]
                    std::vector<uint8_t> chunk(2 + length);
                    chunk[0] = static_cast<uint8_t>((length >> 8) & 0xFF);
                    chunk[1] = static_cast<uint8_t>(length & 0xFF);
                    std::memcpy(&chunk[2], client_buf_.data(), length);

                    auto chunk_buf = std::make_shared<std::vector<uint8_t>>(std::move(chunk));
                    asio::async_write(*remote_, asio::buffer(*chunk_buf),
                        [this, self, chunk_buf](std::error_code write_ec, size_t /*wlen*/) {
                            if (!write_ec) {
                                do_read_client();
                            } else {
                                close();
                            }
                        });
                } else {
                    close();
                }
            });
    }

    void do_read_remote() {
        auto self = shared_from_this();
        remote_->async_read_some(asio::buffer(remote_buf_),
            [this, self](std::error_code ec, size_t length) {
                if (!ec && length > 0) {
                    size_t offset = 0;
                    if (!vmess_resp_header_parsed_) {
                        // VMess Response: [V (1B)][Option (1B)][Command (1B)][Command length (1B)]...
                        if (length >= 4) {
                            uint8_t v = remote_buf_[0];
                            uint8_t cmd_len = remote_buf_[3];
                            size_t hdr_len = 4 + cmd_len;
                            if (v == expected_v_ && length >= hdr_len) {
                                offset = hdr_len;
                                vmess_resp_header_parsed_ = true;
                                VN_DEBUG("[vmess-relay #{}] validated response header (V=0x{:02x})", session_->id, v);
                            } else {
                                vmess_resp_header_parsed_ = true;
                                offset = std::min(length, static_cast<size_t>(4));
                            }
                        } else {
                            vmess_resp_header_parsed_ = true;
                            offset = 0;
                        }
                    }

                    // Strip chunk framing if present
                    size_t payload_len = length - offset;
                    const uint8_t* payload_ptr = remote_buf_.data() + offset;

                    if (payload_len >= 2) {
                        uint16_t chunk_size = (static_cast<uint16_t>(payload_ptr[0]) << 8) | payload_ptr[1];
                        if (chunk_size <= payload_len - 2) {
                            payload_ptr += 2;
                            payload_len = chunk_size;
                        }
                    }

                    if (payload_len > 0) {
                        session_->bytes_down += payload_len;
                        asio::async_write(client_, asio::buffer(payload_ptr, payload_len),
                            [this, self](std::error_code write_ec, size_t /*wlen*/) {
                                if (!write_ec) {
                                    do_read_remote();
                                } else {
                                    close();
                                }
                            });
                    } else {
                        do_read_remote();
                    }
                } else {
                    close();
                }
            });
    }

    void close() {
        if (closed_) return;
        closed_ = true;

        std::error_code ec;
        client_.shutdown(asio::ip::tcp::socket::shutdown_both, ec);
        client_.close(ec);

        remote_->async_shutdown([remote = remote_](std::error_code /*ec*/) {
            std::error_code close_ec;
            remote->lowest_layer().close(close_ec);
        });

        VN_INFO("[session #{}] closed. Up: {} bytes, Down: {} bytes",
                session_->id, session_->bytes_up, session_->bytes_down);
    }

    std::shared_ptr<SessionContext> session_;
    asio::ip::tcp::socket client_;
    std::shared_ptr<asio::ssl::stream<asio::ip::tcp::socket>> remote_;
    uint8_t expected_v_{0};
    std::array<uint8_t, 16384> client_buf_{};
    std::array<uint8_t, 16384> remote_buf_{};
    bool closed_{false};
    bool vmess_resp_header_parsed_{false};
};

} // namespace

VmessOutbound::VmessOutbound(asio::io_context& ioc, config::OutboundConfig config)
    : ioc_(ioc), config_(std::move(config)) {
    if (config_.tls.enabled) {
        ssl_ctx_ = std::make_unique<asio::ssl::context>(asio::ssl::context::tls_client);
        if (config_.tls.insecure) {
            ssl_ctx_->set_verify_mode(asio::ssl::verify_none);
        } else {
            ssl_ctx_->set_default_verify_paths();
            ssl_ctx_->set_verify_mode(asio::ssl::verify_peer);
        }
    }
}

uint32_t VmessOutbound::fnv1a(const uint8_t* data, size_t len) {
    uint32_t hash = 2166136261u;
    for (size_t i = 0; i < len; ++i) {
        hash ^= data[i];
        hash *= 16777619u;
    }
    return hash;
}

std::array<uint8_t, 16> VmessOutbound::compute_auth_id(const UUID& uuid, int64_t timestamp_seconds) {
    std::array<uint8_t, 16> auth{};
    uint64_t t = htobe64(static_cast<uint64_t>(timestamp_seconds));
    unsigned int len = 16;
    HMAC(EVP_md5(), uuid.bytes().data(), 16,
         reinterpret_cast<const unsigned char*>(&t), 8,
         auth.data(), &len);
    return auth;
}

std::vector<uint8_t> VmessOutbound::build_request_header(
    const UUID& uuid,
    const EndpointAddress& destination,
    uint8_t v_byte,
    VmessSecurity security,
    NetworkCommand cmd,
    int64_t timestamp_seconds
) {
    if (timestamp_seconds == 0) {
        timestamp_seconds = std::chrono::duration_cast<std::chrono::seconds>(
            std::chrono::system_clock::now().time_since_epoch()
        ).count();
    }

    std::vector<uint8_t> header;
    header.reserve(128);

    // 1. Auth ID (16 bytes): HMAC-MD5(UUID, timestamp)
    auto auth_id = compute_auth_id(uuid, timestamp_seconds);
    header.insert(header.end(), auth_id.begin(), auth_id.end());

    // 2. Command Header
    std::vector<uint8_t> cmd_hdr;
    cmd_hdr.reserve(64);

    cmd_hdr.push_back(0x01); // Version 1

    // IV (16 bytes)
    std::array<uint8_t, 16> iv{};
    RAND_bytes(iv.data(), 16);
    cmd_hdr.insert(cmd_hdr.end(), iv.begin(), iv.end());

    // Key (16 bytes)
    std::array<uint8_t, 16> key{};
    RAND_bytes(key.data(), 16);
    cmd_hdr.insert(cmd_hdr.end(), key.begin(), key.end());

    cmd_hdr.push_back(v_byte); // Response authentication V
    cmd_hdr.push_back(0x01);   // Option (Standard chunk streaming)

    // Security & padding length
    uint8_t sec_byte = static_cast<uint8_t>(security);
    uint8_t pad_len = 0;
    cmd_hdr.push_back((pad_len << 4) | (sec_byte & 0x0F));
    cmd_hdr.push_back(0x00); // Reserved

    // Command (0x01 = TCP)
    cmd_hdr.push_back(static_cast<uint8_t>(cmd));

    // Port (Big Endian)
    cmd_hdr.push_back(static_cast<uint8_t>(destination.port >> 8));
    cmd_hdr.push_back(static_cast<uint8_t>(destination.port & 0xFF));

    // Address Type and Address
    std::error_code ec;
    auto v4 = asio::ip::make_address_v4(destination.host, ec);
    if (!ec) {
        cmd_hdr.push_back(0x01); // IPv4
        auto bytes = v4.to_bytes();
        cmd_hdr.insert(cmd_hdr.end(), bytes.begin(), bytes.end());
    } else {
        auto v6 = asio::ip::make_address_v6(destination.host, ec);
        if (!ec) {
            cmd_hdr.push_back(0x03); // IPv6
            auto bytes = v6.to_bytes();
            cmd_hdr.insert(cmd_hdr.end(), bytes.begin(), bytes.end());
        } else {
            cmd_hdr.push_back(0x02); // Domain
            cmd_hdr.push_back(static_cast<uint8_t>(destination.host.size()));
            cmd_hdr.insert(cmd_hdr.end(), destination.host.begin(), destination.host.end());
        }
    }

    // FNV1a Checksum of preceding Command Header bytes
    uint32_t checksum = fnv1a(cmd_hdr.data(), cmd_hdr.size());
    cmd_hdr.push_back(static_cast<uint8_t>((checksum >> 24) & 0xFF));
    cmd_hdr.push_back(static_cast<uint8_t>((checksum >> 16) & 0xFF));
    cmd_hdr.push_back(static_cast<uint8_t>((checksum >> 8) & 0xFF));
    cmd_hdr.push_back(static_cast<uint8_t>(checksum & 0xFF));

    // Combine Auth ID + Command Header
    header.insert(header.end(), cmd_hdr.begin(), cmd_hdr.end());
    return header;
}

void VmessOutbound::dispatch(
    std::shared_ptr<SessionContext> session,
    asio::ip::tcp::socket client_socket,
    std::vector<uint8_t> initial_payload
) {
    if (config_.tls.enabled) {
        dispatch_tls(std::move(session), std::move(client_socket), std::move(initial_payload));
    } else {
        dispatch_tcp(std::move(session), std::move(client_socket), std::move(initial_payload));
    }
}

void VmessOutbound::dispatch_tcp(
    std::shared_ptr<SessionContext> session,
    asio::ip::tcp::socket client_socket,
    std::vector<uint8_t> initial_payload
) {
    auto client_sock = std::make_shared<asio::ip::tcp::socket>(std::move(client_socket));
    auto remote_sock = std::make_shared<asio::ip::tcp::socket>(ioc_);

    auto do_connect = [this, session, client_sock, remote_sock, payload = std::move(initial_payload)](
                          const asio::ip::tcp::endpoint& ep) mutable {
        VN_INFO("[vmess-tcp #{}] connecting to {}:{} (target: {})...",
                session->id, ep.address().to_string(), ep.port(), session->target_destination.to_string());

        remote_sock->async_connect(ep,
            [this, session, client_sock, remote_sock, payload = std::move(payload), ep](
                std::error_code connect_ec) mutable {
                if (connect_ec) {
                    VN_WARN("[vmess-tcp #{}] connect to {} failed: {}", session->id, ep.address().to_string(), connect_ec.message());
                    return;
                }

                uint8_t v_byte = 0x55;
                auto header = build_request_header(*config_.uuid, session->target_destination, v_byte, VmessSecurity::None);

                if (!payload.empty()) {
                    header.push_back(static_cast<uint8_t>((payload.size() >> 8) & 0xFF));
                    header.push_back(static_cast<uint8_t>(payload.size() & 0xFF));
                    header.insert(header.end(), payload.begin(), payload.end());
                }

                auto send_buf = std::make_shared<std::vector<uint8_t>>(std::move(header));
                asio::async_write(*remote_sock, asio::buffer(*send_buf),
                    [session, client_sock, remote_sock, send_buf](std::error_code write_ec, size_t wlen) mutable {
                        if (write_ec) {
                            VN_WARN("[vmess-tcp #{}] failed writing VMess header: {}", session->id, write_ec.message());
                            return;
                        }
                        VN_INFO("[vmess-tcp #{}] sent VMess request ({} bytes), starting relay", session->id, wlen);
                        start_relay(session, std::move(*client_sock), std::move(*remote_sock));
                    });
            });
    };

    std::error_code addr_ec;
    auto ip = asio::ip::make_address(config_.server, addr_ec);
    if (!addr_ec) {
        do_connect(asio::ip::tcp::endpoint(ip, config_.server_port));
    } else {
        auto resolver = std::make_shared<asio::ip::tcp::resolver>(ioc_);
        resolver->async_resolve(config_.server, std::to_string(config_.server_port),
            [session, do_connect, resolver](std::error_code ec, asio::ip::tcp::resolver::results_type endpoints) mutable {
                if (ec) {
                    VN_WARN("[vmess-tcp #{}] DNS resolve failed for server: {}", session->id, ec.message());
                    return;
                }
                do_connect(*endpoints.begin());
            });
    }
}

void VmessOutbound::dispatch_tls(
    std::shared_ptr<SessionContext> session,
    asio::ip::tcp::socket client_socket,
    std::vector<uint8_t> initial_payload
) {
    auto client_sock = std::make_shared<asio::ip::tcp::socket>(std::move(client_socket));
    auto remote_ssl = std::make_shared<asio::ssl::stream<asio::ip::tcp::socket>>(ioc_, *ssl_ctx_);

    // Set SNI
    std::string sni = config_.tls.server_name.empty() ? config_.server : config_.tls.server_name;
    SSL_set_tlsext_host_name(remote_ssl->native_handle(), sni.c_str());

    auto do_connect = [this, session, client_sock, remote_ssl, payload = std::move(initial_payload)](
                          const asio::ip::tcp::endpoint& ep) mutable {
        VN_INFO("[vmess-tls #{}] connecting to {}:{} (target: {})...",
                session->id, ep.address().to_string(), ep.port(), session->target_destination.to_string());

        remote_ssl->lowest_layer().async_connect(ep,
            [this, session, client_sock, remote_ssl, payload = std::move(payload), ep](
                std::error_code connect_ec) mutable {
                if (connect_ec) {
                    VN_WARN("[vmess-tls #{}] TCP connect to {} failed: {}", session->id, ep.address().to_string(), connect_ec.message());
                    return;
                }

                VN_INFO("[vmess-tls #{}] TCP connected to {}, starting TLS handshake...", session->id, ep.address().to_string());

                remote_ssl->async_handshake(asio::ssl::stream_base::client,
                    [this, session, client_sock, remote_ssl, data_bytes = std::move(payload)](std::error_code hs_ec) mutable {
                        if (hs_ec) {
                            VN_WARN("[vmess-tls #{}] TLS handshake failed: {}", session->id, hs_ec.message());
                            return;
                        }

                        VN_INFO("[vmess-tls #{}] TLS handshake completed, sending VMess header...", session->id);

                        uint8_t v_byte = 0xA5;
                        auto header = build_request_header(*config_.uuid, session->target_destination, v_byte, VmessSecurity::None);

                        if (!data_bytes.empty()) {
                            header.push_back(static_cast<uint8_t>((data_bytes.size() >> 8) & 0xFF));
                            header.push_back(static_cast<uint8_t>(data_bytes.size() & 0xFF));
                            header.insert(header.end(), data_bytes.begin(), data_bytes.end());
                        }

                        auto send_buf = std::make_shared<std::vector<uint8_t>>(std::move(header));
                        asio::async_write(*remote_ssl, asio::buffer(*send_buf),
                            [session, client_sock, remote_ssl, send_buf, v_byte](std::error_code write_ec, size_t wlen) mutable {
                                if (write_ec) {
                                    VN_WARN("[vmess-tls #{}] failed writing VMess header: {}", session->id, write_ec.message());
                                    return;
                                }

                                VN_INFO("[vmess-tls #{}] sent VMess request ({} bytes), starting relay", session->id, wlen);

                                auto relay = std::make_shared<VmessSslRelay>(
                                    session, std::move(*client_sock), remote_ssl, v_byte
                                );
                                relay->start();
                            });
                    });
            });
    };

    std::error_code addr_ec;
    auto ip = asio::ip::make_address(config_.server, addr_ec);
    if (!addr_ec) {
        do_connect(asio::ip::tcp::endpoint(ip, config_.server_port));
    } else {
        auto resolver = std::make_shared<asio::ip::tcp::resolver>(ioc_);
        resolver->async_resolve(config_.server, std::to_string(config_.server_port),
            [session, do_connect, resolver](std::error_code ec, asio::ip::tcp::resolver::results_type endpoints) mutable {
                if (ec) {
                    VN_WARN("[vmess-tls #{}] DNS resolve failed for server: {}", session->id, ec.message());
                    return;
                }
                do_connect(*endpoints.begin());
            });
    }
}

} // namespace vnexus::outbound
