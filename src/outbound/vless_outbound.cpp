#include "vnexus/outbound/vless_outbound.hpp"
#include "vnexus/common/log.hpp"
#include "vnexus/common/net.hpp"
#include <openssl/ssl.h>
#include <array>

namespace vnexus::outbound {

namespace {

class SslSocketRelay : public std::enable_shared_from_this<SslSocketRelay> {
public:
    SslSocketRelay(std::shared_ptr<SessionContext> session,
                   asio::ip::tcp::socket client,
                   std::shared_ptr<asio::ssl::stream<asio::ip::tcp::socket>> remote)
        : session_(std::move(session)),
          client_(std::move(client)),
          remote_(std::move(remote)) {}

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
                    asio::async_write(*remote_, asio::buffer(client_buf_.data(), length),
                        [this, self](std::error_code write_ec, size_t /*wlen*/) {
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
                    if (!vless_resp_header_parsed_) {
                        // VLESS server response: [Version(1B)][Addons length(1B)][Addons...][Target response payload]
                        if (length >= 2) {
                            uint8_t addons_len = remote_buf_[1];
                            size_t hdr_len = 2 + addons_len;
                            if (length >= hdr_len) {
                                offset = hdr_len;
                                vless_resp_header_parsed_ = true;
                                VN_DEBUG("[vless-relay #{}] stripped VLESS response header (addons_len={}), forwarding {} bytes",
                                         session_->id, addons_len, length - hdr_len);
                            } else {
                                vless_resp_header_parsed_ = true;
                                offset = length;
                            }
                        } else {
                            vless_resp_header_parsed_ = true;
                            offset = length;
                        }
                    }

                    size_t payload_len = length - offset;
                    if (payload_len > 0) {
                        session_->bytes_down += payload_len;
                        asio::async_write(client_, asio::buffer(remote_buf_.data() + offset, payload_len),
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
    std::array<uint8_t, 16384> client_buf_{};
    std::array<uint8_t, 16384> remote_buf_{};
    bool closed_{false};
    bool vless_resp_header_parsed_{false};
};

} // namespace

VlessOutbound::VlessOutbound(asio::io_context& ioc, config::OutboundConfig config)
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

std::vector<uint8_t> VlessOutbound::build_request_header(
    const UUID& uuid,
    const EndpointAddress& destination,
    NetworkCommand cmd
) {
    std::vector<uint8_t> header;
    header.reserve(64);

    // Byte 0: Version 0x00
    header.push_back(0x00);

    // Bytes 1-16: UUID
    const auto& uuid_bytes = uuid.bytes();
    header.insert(header.end(), uuid_bytes.begin(), uuid_bytes.end());

    // Byte 17: Proto Addons length (0x00)
    header.push_back(0x00);

    // Byte 18: Command (0x01 = TCP)
    header.push_back(static_cast<uint8_t>(cmd));

    // Bytes 19-20: Port (Big Endian)
    header.push_back(static_cast<uint8_t>(destination.port >> 8));
    header.push_back(static_cast<uint8_t>(destination.port & 0xFF));

    // Byte 21: Address Type and Address Payload
    std::error_code ec;
    auto v4 = asio::ip::make_address_v4(destination.host, ec);
    if (!ec) {
        header.push_back(0x01); // IPv4
        auto bytes = v4.to_bytes();
        header.insert(header.end(), bytes.begin(), bytes.end());
    } else {
        auto v6 = asio::ip::make_address_v6(destination.host, ec);
        if (!ec) {
            header.push_back(0x03); // IPv6
            auto bytes = v6.to_bytes();
            header.insert(header.end(), bytes.begin(), bytes.end());
        } else {
            // Domain
            header.push_back(0x02);
            header.push_back(static_cast<uint8_t>(destination.host.size()));
            header.insert(header.end(), destination.host.begin(), destination.host.end());
        }
    }

    return header;
}

void VlessOutbound::dispatch(
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

void VlessOutbound::dispatch_tcp(
    std::shared_ptr<SessionContext> session,
    asio::ip::tcp::socket client_socket,
    std::vector<uint8_t> initial_payload
) {
    auto resolver = std::make_shared<asio::ip::tcp::resolver>(ioc_);
    auto remote_sock = std::make_shared<asio::ip::tcp::socket>(ioc_);
    auto client_sock = std::make_shared<asio::ip::tcp::socket>(std::move(client_socket));

    resolver->async_resolve(config_.server, std::to_string(config_.server_port),
        [this, session, client_sock, remote_sock, data = std::move(initial_payload), resolver](
            std::error_code ec, asio::ip::tcp::resolver::results_type endpoints) mutable {
            if (ec) {
                VN_WARN("[vless-tcp] resolve failed for server {}: {}", config_.server, ec.message());
                return;
            }

            asio::async_connect(*remote_sock, endpoints,
                [this, session, client_sock, remote_sock, payload = std::move(data)](
                    std::error_code connect_ec, const asio::ip::tcp::endpoint& ep) mutable {
                    if (connect_ec) {
                        VN_WARN("[vless-tcp] connect to {} failed: {}", ep.address().to_string(), connect_ec.message());
                        return;
                    }

                    // Build VLESS request header
                    auto header = build_request_header(*config_.uuid, session->target_destination, session->command);
                    if (!payload.empty()) {
                        header.insert(header.end(), payload.begin(), payload.end());
                    }

                    auto send_buf = std::make_shared<std::vector<uint8_t>>(std::move(header));
                    asio::async_write(*remote_sock, asio::buffer(*send_buf),
                        [this, session, client_sock, remote_sock, send_buf](std::error_code write_ec, size_t /*wlen*/) mutable {
                            if (write_ec) {
                                VN_WARN("[vless-tcp] failed writing VLESS header: {}", write_ec.message());
                                return;
                            }

                            // Read VLESS response header (version 1B + addons_len 1B)
                            auto resp_hdr = std::make_shared<std::array<uint8_t, 2>>();
                            asio::async_read(*remote_sock, asio::buffer(*resp_hdr),
                                [session, client_sock, remote_sock, resp_hdr](std::error_code read_ec, size_t /*rlen*/) mutable {
                                    if (read_ec) {
                                        VN_WARN("[vless-tcp] failed reading server response: {}", read_ec.message());
                                        return;
                                    }

                                    uint8_t addons_len = (*resp_hdr)[1];
                                    if (addons_len > 0) {
                                        auto addons_buf = std::make_shared<std::vector<uint8_t>>(addons_len);
                                        asio::async_read(*remote_sock, asio::buffer(*addons_buf),
                                            [session, client_sock, remote_sock, addons_buf](std::error_code aec, size_t /*alen*/) mutable {
                                                if (!aec) {
                                                    start_relay(session, std::move(*client_sock), std::move(*remote_sock));
                                                }
                                            });
                                    } else {
                                        start_relay(session, std::move(*client_sock), std::move(*remote_sock));
                                    }
                                });
                        });
                });
        });
}

void VlessOutbound::dispatch_tls(
    std::shared_ptr<SessionContext> session,
    asio::ip::tcp::socket client_socket,
    std::vector<uint8_t> initial_payload
) {
    auto client_sock = std::make_shared<asio::ip::tcp::socket>(std::move(client_socket));
    auto remote_ssl = std::make_shared<asio::ssl::stream<asio::ip::tcp::socket>>(ioc_, *ssl_ctx_);

    // Set SNI
    std::string sni = config_.tls.server_name.empty() ? config_.server : config_.tls.server_name;
    SSL_set_tlsext_host_name(remote_ssl->native_handle(), sni.c_str());

    // Set ALPN if specified
    if (!config_.tls.alpn.empty()) {
        std::vector<unsigned char> alpn_wire;
        for (const auto& proto : config_.tls.alpn) {
            if (!proto.empty() && proto.size() <= 255) {
                alpn_wire.push_back(static_cast<unsigned char>(proto.size()));
                alpn_wire.insert(alpn_wire.end(), proto.begin(), proto.end());
            }
        }
        if (!alpn_wire.empty()) {
            SSL_set_alpn_protos(remote_ssl->native_handle(), alpn_wire.data(), static_cast<unsigned int>(alpn_wire.size()));
        }
    }

    auto do_connect = [this, session, client_sock, remote_ssl, payload = std::move(initial_payload)](
                          const asio::ip::tcp::endpoint& ep) mutable {
        VN_INFO("[vless-tls #{}] connecting to {}:{} (target: {})...",
                session->id, ep.address().to_string(), ep.port(), session->target_destination.to_string());

        remote_ssl->lowest_layer().async_connect(ep,
            [this, session, client_sock, remote_ssl, payload = std::move(payload), ep](
                std::error_code connect_ec) mutable {
                if (connect_ec) {
                    VN_WARN("[vless-tls #{}] TCP connect to {} failed: {}", session->id, ep.address().to_string(), connect_ec.message());
                    return;
                }

                VN_INFO("[vless-tls #{}] TCP connected to {}, starting TLS handshake...", session->id, ep.address().to_string());

                remote_ssl->async_handshake(asio::ssl::stream_base::client,
                    [this, session, client_sock, remote_ssl, data_bytes = std::move(payload)](std::error_code hs_ec) mutable {
                        if (hs_ec) {
                            VN_WARN("[vless-tls #{}] TLS handshake failed: {}", session->id, hs_ec.message());
                            return;
                        }

                        VN_INFO("[vless-tls #{}] TLS handshake completed, sending VLESS header (target: {})...",
                                session->id, session->target_destination.to_string());

                        // Build VLESS request header
                        auto header = build_request_header(*config_.uuid, session->target_destination, session->command);
                        if (!data_bytes.empty()) {
                            header.insert(header.end(), data_bytes.begin(), data_bytes.end());
                        }

                        auto send_buf = std::make_shared<std::vector<uint8_t>>(std::move(header));
                        asio::async_write(*remote_ssl, asio::buffer(*send_buf),
                            [session, client_sock, remote_ssl, send_buf](std::error_code write_ec, size_t wlen) mutable {
                                if (write_ec) {
                                    VN_WARN("[vless-tls #{}] failed writing VLESS header: {}", session->id, write_ec.message());
                                    return;
                                }

                                VN_INFO("[vless-tls #{}] sent VLESS request ({} bytes), starting bidirectional relay", session->id, wlen);

                                auto relay = std::make_shared<SslSocketRelay>(
                                    session, std::move(*client_sock), remote_ssl
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
                    VN_WARN("[vless-tls #{}] DNS resolve failed for server: {}", session->id, ec.message());
                    return;
                }
                do_connect(*endpoints.begin());
            });
    }
}

} // namespace vnexus::outbound
