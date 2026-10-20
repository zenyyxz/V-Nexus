#pragma once

#include "vnexus/outbound/outbound.hpp"

namespace vnexus::outbound {

class BlockOutbound : public IOutbound {
public:
    explicit BlockOutbound(std::string tag = "block") : tag_(std::move(tag)) {}

    [[nodiscard]] std::string_view tag() const override { return tag_; }
    [[nodiscard]] std::string_view type() const override { return "block"; }

    void dispatch(
        std::shared_ptr<SessionContext> session,
        asio::ip::tcp::socket client_socket,
        std::vector<uint8_t> initial_payload
    ) override;

private:
    std::string tag_;
};

} // namespace vnexus::outbound
