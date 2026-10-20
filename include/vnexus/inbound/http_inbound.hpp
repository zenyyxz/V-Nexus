#pragma once

#include "vnexus/inbound/inbound.hpp"
#include <asio.hpp>
#include <memory>
#include <atomic>

namespace vnexus::inbound {

class HttpInbound : public IInbound, public std::enable_shared_from_this<HttpInbound> {
public:
    HttpInbound(
        asio::io_context& ioc,
        config::InboundConfig config,
        sniff::CompositeSniffer sniffer,
        DispatchHandler dispatcher
    );

    void start() override;
    void stop() override;
    [[nodiscard]] std::string_view tag() const override { return config_.tag; }
    [[nodiscard]] uint16_t listen_port() const override { return config_.listen_port; }

    void handle_accepted_socket(asio::ip::tcp::socket socket, std::vector<uint8_t> initial_data = {});

private:
    void do_accept();

    asio::io_context& ioc_;
    config::InboundConfig config_;
    sniff::CompositeSniffer sniffer_;
    DispatchHandler dispatcher_;
    asio::ip::tcp::acceptor acceptor_;
    std::atomic<uint64_t> session_counter_{1};
};

} // namespace vnexus::inbound
