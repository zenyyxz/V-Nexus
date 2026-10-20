#include "vnexus/inbound/mixed_inbound.hpp"
#include "vnexus/common/log.hpp"
#include <array>

namespace vnexus::inbound {

MixedInbound::MixedInbound(
    asio::io_context& ioc,
    config::InboundConfig config,
    sniff::CompositeSniffer sniffer,
    DispatchHandler dispatcher
) : ioc_(ioc),
    config_(std::move(config)),
    sniffer_(std::move(sniffer)),
    dispatcher_(std::move(dispatcher)),
    acceptor_(ioc) {
    // Create delegates for protocol parsing
    socks5_inbound_ = std::make_shared<Socks5Inbound>(ioc_, config_, sniffer_, dispatcher_);
    http_inbound_ = std::make_shared<HttpInbound>(ioc_, config_, sniffer_, dispatcher_);
}

void MixedInbound::start() {
    asio::ip::tcp::endpoint ep(asio::ip::make_address(config_.listen), config_.listen_port);
    acceptor_.open(ep.protocol());
    acceptor_.set_option(asio::ip::tcp::acceptor::reuse_address(true));
    acceptor_.bind(ep);
    acceptor_.listen();

    VN_INFO("[inbound-mixed] '{}' (SOCKS5 + HTTP) listening on {}:{}",
            config_.tag, config_.listen, config_.listen_port);
    do_accept();
}

void MixedInbound::stop() {
    std::error_code ec;
    acceptor_.close(ec);
}

void MixedInbound::do_accept() {
    acceptor_.async_accept(
        [this](std::error_code ec, asio::ip::tcp::socket socket) {
            if (!ec) {
                probe_and_dispatch(std::move(socket));
            }
            if (acceptor_.is_open()) {
                do_accept();
            }
        });
}

void MixedInbound::probe_and_dispatch(asio::ip::tcp::socket socket) {
    auto sock_ptr = std::make_shared<asio::ip::tcp::socket>(std::move(socket));
    auto byte_buf = std::make_shared<std::array<uint8_t, 1>>();

    sock_ptr->async_read_some(asio::buffer(*byte_buf),
        [this, sock_ptr, byte_buf](std::error_code ec, size_t length) mutable {
            if (ec || length == 0) return;

            uint8_t first_byte = (*byte_buf)[0];
            std::vector<uint8_t> initial_data = {first_byte};

            if (first_byte == 0x05) {
                // SOCKS5 protocol detected
                socks5_inbound_->handle_accepted_socket(std::move(*sock_ptr), std::move(initial_data));
            } else {
                // HTTP / HTTPS CONNECT protocol detected
                http_inbound_->handle_accepted_socket(std::move(*sock_ptr), std::move(initial_data));
            }
        });
}

} // namespace vnexus::inbound
