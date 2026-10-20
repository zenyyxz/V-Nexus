#pragma once

#include "vnexus/outbound/outbound.hpp"
#include <asio.hpp>

namespace vnexus::outbound {

class DirectOutbound : public IOutbound {
public:
    explicit DirectOutbound(asio::io_context& ioc, std::string tag = "direct");

    [[nodiscard]] std::string_view tag() const override { return tag_; }
    [[nodiscard]] std::string_view type() const override { return "direct"; }

    void dispatch(
        std::shared_ptr<SessionContext> session,
        asio::ip::tcp::socket client_socket,
        std::vector<uint8_t> initial_payload
    ) override;

private:
    asio::io_context& ioc_;
    std::string tag_;
    asio::ip::tcp::resolver resolver_;
};

} // namespace vnexus::outbound
