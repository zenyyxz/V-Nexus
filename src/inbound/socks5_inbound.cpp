#include "vnexus/inbound/socks5_inbound.hpp"
#include "vnexus/common/log.hpp"
#include "vnexus/common/net.hpp"
#include <array>

namespace vnexus::inbound {

namespace {

class Socks5Session : public std::enable_shared_from_this<Socks5Session> {
public:
    Socks5Session(
        asio::io_context& ioc,
        uint64_t session_id,
        asio::ip::tcp::socket socket,
        const config::InboundConfig& cfg,
        const sniff::CompositeSniffer& sniffer,
        DispatchHandler dispatcher,
        std::vector<uint8_t> initial_data
    ) : ioc_(ioc),
        session_id_(session_id),
        socket_(std::move(socket)),
        cfg_(cfg),
        sniffer_(sniffer),
        dispatcher_(std::move(dispatcher)),
        initial_data_(std::move(initial_data)) {}

    void start() {
        if (!initial_data_.empty()) {
            // Already received partial data
            process_greeting(initial_data_);
        } else {
            read_greeting();
        }
    }

private:
    void read_greeting() {
        auto self = shared_from_this();
        // SOCKS5 greeting: VER, NMETHODS
        auto buf = std::make_shared<std::vector<uint8_t>>(2);
        asio::async_read(socket_, asio::buffer(*buf),
            [this, self, buf](std::error_code ec, size_t /*len*/) {
                if (ec) return;
                process_greeting(*buf);
            });
    }

    void process_greeting(const std::vector<uint8_t>& data) {
        if (data.empty() || data[0] != 0x05) {
            VN_DEBUG("[socks5] invalid version: 0x{:02x}", data.empty() ? 0 : data[0]);
            return;
        }

        auto self = shared_from_this();
        if (data.size() < 2) {
            // Read nmethods
            auto nmethods_buf = std::make_shared<std::array<uint8_t, 1>>();
            asio::async_read(socket_, asio::buffer(*nmethods_buf),
                [this, self, nmethods_buf](std::error_code ec, size_t /*len*/) {
                    if (ec) return;
                    read_methods((*nmethods_buf)[0]);
                });
        } else {
            read_methods(data[1]);
        }
    }

    void read_methods(uint8_t nmethods) {
        auto self = shared_from_this();
        auto methods = std::make_shared<std::vector<uint8_t>>(nmethods);
        asio::async_read(socket_, asio::buffer(*methods),
            [this, self, methods](std::error_code ec, size_t /*len*/) {
                if (ec) return;
                // Accept NO AUTH (0x00)
                static const uint8_t auth_resp[2] = {0x05, 0x00};
                asio::async_write(socket_, asio::buffer(auth_resp),
                    [this, self](std::error_code write_ec, size_t /*wlen*/) {
                        if (write_ec) return;
                        read_request();
                    });
            });
    }

    void read_request() {
        auto self = shared_from_this();
        // Read VER(1), CMD(1), RSV(1), ATYP(1)
        auto req_hdr = std::make_shared<std::array<uint8_t, 4>>();
        asio::async_read(socket_, asio::buffer(*req_hdr),
            [this, self, req_hdr](std::error_code ec, size_t /*len*/) {
                if (ec) return;

                if ((*req_hdr)[0] != 0x05 || (*req_hdr)[1] != 0x01) {
                    // Only support CONNECT (0x01)
                    VN_DEBUG("[socks5] unsupported command: 0x{:02x}", (*req_hdr)[1]);
                    return;
                }

                uint8_t atyp = (*req_hdr)[3];
                if (atyp == 0x01) {
                    // IPv4: 4 bytes IP + 2 bytes port
                    read_ipv4();
                } else if (atyp == 0x03) {
                    // Domain: 1 byte len + domain + 2 bytes port
                    read_domain();
                } else if (atyp == 0x04) {
                    // IPv6: 16 bytes IP + 2 bytes port
                    read_ipv6();
                } else {
                    VN_DEBUG("[socks5] unsupported atyp: 0x{:02x}", atyp);
                }
            });
    }

    void read_ipv4() {
        auto self = shared_from_this();
        auto buf = std::make_shared<std::array<uint8_t, 6>>();
        asio::async_read(socket_, asio::buffer(*buf),
            [this, self, buf](std::error_code ec, size_t /*len*/) {
                if (ec) return;
                asio::ip::address_v4::bytes_type ip_bytes;
                std::copy_n(buf->begin(), 4, ip_bytes.begin());
                std::string ip = asio::ip::make_address_v4(ip_bytes).to_string();
                uint16_t port = (static_cast<uint16_t>((*buf)[4]) << 8) | (*buf)[5];

                EndpointAddress dest{
                    .type = AddressType::IPv4,
                    .host = ip,
                    .port = port
                };
                send_reply(dest);
            });
    }

    void read_domain() {
        auto self = shared_from_this();
        auto len_buf = std::make_shared<std::array<uint8_t, 1>>();
        asio::async_read(socket_, asio::buffer(*len_buf),
            [this, self, len_buf](std::error_code ec, size_t /*len*/) {
                if (ec) return;
                uint8_t domain_len = (*len_buf)[0];
                auto buf = std::make_shared<std::vector<uint8_t>>(domain_len + 2);
                asio::async_read(socket_, asio::buffer(*buf),
                    [this, self, buf, domain_len](std::error_code read_ec, size_t /*rlen*/) {
                        if (read_ec) return;
                        std::string domain(reinterpret_cast<const char*>(buf->data()), domain_len);
                        uint16_t port = (static_cast<uint16_t>((*buf)[domain_len]) << 8) | (*buf)[domain_len + 1];

                        EndpointAddress dest{
                            .type = AddressType::Domain,
                            .host = domain,
                            .port = port
                        };
                        send_reply(dest);
                    });
            });
    }

    void read_ipv6() {
        auto self = shared_from_this();
        auto buf = std::make_shared<std::array<uint8_t, 18>>();
        asio::async_read(socket_, asio::buffer(*buf),
            [this, self, buf](std::error_code ec, size_t /*len*/) {
                if (ec) return;
                asio::ip::address_v6::bytes_type ip_bytes;
                std::copy_n(buf->begin(), 16, ip_bytes.begin());
                std::string ip = asio::ip::make_address_v6(ip_bytes).to_string();
                uint16_t port = (static_cast<uint16_t>((*buf)[16]) << 8) | (*buf)[17];

                EndpointAddress dest{
                    .type = AddressType::IPv6,
                    .host = ip,
                    .port = port
                };
                send_reply(dest);
            });
    }

    void send_reply(EndpointAddress destination) {
        auto self = shared_from_this();
        // SOCKS5 reply: 0x05, 0x00, 0x00, 0x01, 0,0,0,0, 0,0 (10 bytes success)
        static const uint8_t reply[10] = {0x05, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00};
        asio::async_write(socket_, asio::buffer(reply),
            [this, self, dest = std::move(destination)](std::error_code ec, size_t /*wlen*/) {
                if (ec) return;

                auto session = std::make_shared<SessionContext>();
                session->id = session_id_;
                session->inbound_tag = cfg_.tag;
                std::error_code ep_ec;
                session->client_endpoint = socket_.remote_endpoint(ep_ec);
                session->original_destination = dest;
                session->target_destination = dest;

                VN_DEBUG("[session #{}] SOCKS5 connected, target: {}", session->id, dest.to_string());

                process_and_sniff_session(
                    ioc_, session, std::move(socket_), cfg_, sniffer_, dispatcher_
                );
            });
    }

    asio::io_context& ioc_;
    uint64_t session_id_;
    asio::ip::tcp::socket socket_;
    config::InboundConfig cfg_;
    const sniff::CompositeSniffer& sniffer_;
    DispatchHandler dispatcher_;
    std::vector<uint8_t> initial_data_;
};

} // namespace

Socks5Inbound::Socks5Inbound(
    asio::io_context& ioc,
    config::InboundConfig config,
    sniff::CompositeSniffer sniffer,
    DispatchHandler dispatcher
) : ioc_(ioc),
    config_(std::move(config)),
    sniffer_(std::move(sniffer)),
    dispatcher_(std::move(dispatcher)),
    acceptor_(ioc) {}

void Socks5Inbound::start() {
    asio::ip::tcp::endpoint ep(asio::ip::make_address(config_.listen), config_.listen_port);
    acceptor_.open(ep.protocol());
    acceptor_.set_option(asio::ip::tcp::acceptor::reuse_address(true));
    acceptor_.bind(ep);
    acceptor_.listen();

    VN_INFO("[inbound-socks5] '{}' listening on {}:{}", config_.tag, config_.listen, config_.listen_port);
    do_accept();
}

void Socks5Inbound::stop() {
    std::error_code ec;
    acceptor_.close(ec);
}

void Socks5Inbound::do_accept() {
    acceptor_.async_accept(
        [this](std::error_code ec, asio::ip::tcp::socket socket) {
            if (!ec) {
                handle_accepted_socket(std::move(socket));
            }
            if (acceptor_.is_open()) {
                do_accept();
            }
        });
}

void Socks5Inbound::handle_accepted_socket(asio::ip::tcp::socket socket, std::vector<uint8_t> initial_data) {
    uint64_t id = session_counter_.fetch_add(1);
    auto session = std::make_shared<Socks5Session>(
        ioc_, id, std::move(socket), config_, sniffer_, dispatcher_, std::move(initial_data)
    );
    session->start();
}

} // namespace vnexus::inbound
