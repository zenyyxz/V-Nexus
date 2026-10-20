#include "vnexus/inbound/http_inbound.hpp"
#include "vnexus/common/log.hpp"
#include "vnexus/common/net.hpp"
#include <string_view>
#include <sstream>

namespace vnexus::inbound {

namespace {

class HttpSession : public std::enable_shared_from_this<HttpSession> {
public:
    HttpSession(
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
        buffer_(std::move(initial_data)) {}

    void start() {
        read_header();
    }

private:
    void read_header() {
        auto self = shared_from_this();
        // Check if header is already complete
        std::string_view current(reinterpret_cast<const char*>(buffer_.data()), buffer_.size());
        if (current.find("\r\n\r\n") != std::string_view::npos || current.find("\n\n") != std::string_view::npos) {
            parse_request();
            return;
        }

        auto temp_buf = std::make_shared<std::vector<uint8_t>>(2048);
        socket_.async_read_some(asio::buffer(*temp_buf),
            [this, self, temp_buf](std::error_code ec, size_t length) {
                if (ec || length == 0) return;
                buffer_.insert(buffer_.end(), temp_buf->begin(), temp_buf->begin() + length);
                read_header();
            });
    }

    void parse_request() {
        std::string_view text(reinterpret_cast<const char*>(buffer_.data()), buffer_.size());
        auto line_end = text.find("\r\n");
        if (line_end == std::string_view::npos) line_end = text.find('\n');
        if (line_end == std::string_view::npos) return;

        std::string_view req_line = text.substr(0, line_end);
        
        std::istringstream iss{std::string(req_line)};
        std::string method, uri, version;
        iss >> method >> uri >> version;

        if (method == "CONNECT") {
            // HTTPS tunnel
            EndpointAddress dest = net::parse_endpoint(uri, 443);
            auto self = shared_from_this();

            static const std::string established = "HTTP/1.1 200 Connection Established\r\n\r\n";
            asio::async_write(socket_, asio::buffer(established),
                [this, self, dest](std::error_code ec, size_t /*wlen*/) {
                    if (ec) return;

                    auto session = std::make_shared<SessionContext>();
                    session->id = session_id_;
                    session->inbound_tag = cfg_.tag;
                    std::error_code ep_ec;
                    session->client_endpoint = socket_.remote_endpoint(ep_ec);
                    session->original_destination = dest;
                    session->target_destination = dest;

                    VN_DEBUG("[session #{}] HTTP CONNECT established for {}", session->id, dest.to_string());

                    // Now sniffer will inspect the incoming TLS ClientHello over the tunnel!
                    process_and_sniff_session(
                        ioc_, session, std::move(socket_), cfg_, sniffer_, dispatcher_
                    );
                });
        } else {
            // Plain HTTP request: find Host: header
            EndpointAddress dest;
            dest.port = 80;
            dest.type = AddressType::Domain;

            size_t host_pos = text.find("\r\nHost: ");
            if (host_pos == std::string_view::npos) host_pos = text.find("\nhost: ");
            if (host_pos == std::string_view::npos) host_pos = text.find("\r\nhost: ");
            if (host_pos == std::string_view::npos) host_pos = text.find("\nHost: ");

            if (host_pos != std::string_view::npos) {
                auto start = text.find(' ', host_pos) + 1;
                auto end = text.find("\r\n", start);
                if (end == std::string_view::npos) end = text.find('\n', start);
                if (end != std::string_view::npos) {
                    dest = net::parse_endpoint(text.substr(start, end - start), 80);
                }
            }

            if (dest.host.empty()) {
                // Try from URI
                if (uri.starts_with("http://")) {
                    auto host_start = 7;
                    auto path_start = uri.find('/', host_start);
                    std::string host_part = (path_start == std::string::npos) 
                        ? uri.substr(host_start) 
                        : uri.substr(host_start, path_start - host_start);
                    dest = net::parse_endpoint(host_part, 80);
                }
            }

            if (dest.host.empty()) {
                VN_WARN("[http] could not determine destination from request");
                return;
            }

            auto session = std::make_shared<SessionContext>();
            session->id = session_id_;
            session->inbound_tag = cfg_.tag;
            std::error_code ep_ec;
            session->client_endpoint = socket_.remote_endpoint(ep_ec);
            session->original_destination = dest;
            session->target_destination = dest;
            session->sniffed_domain = dest.host;
            session->sniffed_protocol = "http";
            session->sniff_successful = true;

            dispatcher_(session, std::move(socket_), std::move(buffer_));
        }
    }

    asio::io_context& ioc_;
    uint64_t session_id_;
    asio::ip::tcp::socket socket_;
    config::InboundConfig cfg_;
    const sniff::CompositeSniffer& sniffer_;
    DispatchHandler dispatcher_;
    std::vector<uint8_t> buffer_;
};

} // namespace

HttpInbound::HttpInbound(
    asio::io_context& ioc,
    config::InboundConfig config,
    sniff::CompositeSniffer sniffer,
    DispatchHandler dispatcher
) : ioc_(ioc),
    config_(std::move(config)),
    sniffer_(std::move(sniffer)),
    dispatcher_(std::move(dispatcher)),
    acceptor_(ioc) {}

void HttpInbound::start() {
    asio::ip::tcp::endpoint ep(asio::ip::make_address(config_.listen), config_.listen_port);
    acceptor_.open(ep.protocol());
    acceptor_.set_option(asio::ip::tcp::acceptor::reuse_address(true));
    acceptor_.bind(ep);
    acceptor_.listen();

    VN_INFO("[inbound-http] '{}' listening on {}:{}", config_.tag, config_.listen, config_.listen_port);
    do_accept();
}

void HttpInbound::stop() {
    std::error_code ec;
    acceptor_.close(ec);
}

void HttpInbound::do_accept() {
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

void HttpInbound::handle_accepted_socket(asio::ip::tcp::socket socket, std::vector<uint8_t> initial_data) {
    uint64_t id = session_counter_.fetch_add(1);
    auto session = std::make_shared<HttpSession>(
        ioc_, id, std::move(socket), config_, sniffer_, dispatcher_, std::move(initial_data)
    );
    session->start();
}

} // namespace vnexus::inbound
