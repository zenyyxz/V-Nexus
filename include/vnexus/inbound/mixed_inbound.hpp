#pragma once

#include "vnexus/inbound/inbound.hpp"
#include "vnexus/inbound/socks5_inbound.hpp"
#include "vnexus/inbound/http_inbound.hpp"
#include <asio.hpp>
#include <memory>

namespace vnexus::inbound {

class MixedInbound : public IInbound, public std::enable_shared_from_this<MixedInbound> {
public:
    MixedInbound(
        asio::io_context& ioc,
        config::InboundConfig config,
        sniff::CompositeSniffer sniffer,
        DispatchHandler dispatcher
    );

    void start() override;
    void stop() override;
    [[nodiscard]] std::string_view tag() const override { return config_.tag; }
    [[nodiscard]] uint16_t listen_port() const override { return config_.listen_port; }

private:
    void do_accept();
    void probe_and_dispatch(asio::ip::tcp::socket socket);

    asio::io_context& ioc_;
    config::InboundConfig config_;
    sniff::CompositeSniffer sniffer_;
    DispatchHandler dispatcher_;
    asio::ip::tcp::acceptor acceptor_;
    std::shared_ptr<Socks5Inbound> socks5_inbound_;
    std::shared_ptr<HttpInbound> http_inbound_;
};

} // namespace vnexus::inbound
