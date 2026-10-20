#pragma once

#include "vnexus/outbound/outbound.hpp"
#include "vnexus/config/config.hpp"
#include "vnexus/common/uuid.hpp"
#include <asio.hpp>
#include <asio/ssl.hpp>
#include <memory>

namespace vnexus::outbound {

class VlessOutbound : public IOutbound {
public:
    VlessOutbound(asio::io_context& ioc, config::OutboundConfig config);

    [[nodiscard]] std::string_view tag() const override { return config_.tag; }
    [[nodiscard]] std::string_view type() const override { return "vless"; }

    void dispatch(
        std::shared_ptr<SessionContext> session,
        asio::ip::tcp::socket client_socket,
        std::vector<uint8_t> initial_payload
    ) override;

    // Helper to serialize VLESS request header
    static std::vector<uint8_t> build_request_header(
        const UUID& uuid,
        const EndpointAddress& destination,
        NetworkCommand cmd = NetworkCommand::TCP
    );

private:
    void dispatch_tcp(
        std::shared_ptr<SessionContext> session,
        asio::ip::tcp::socket client_socket,
        std::vector<uint8_t> initial_payload
    );

    void dispatch_tls(
        std::shared_ptr<SessionContext> session,
        asio::ip::tcp::socket client_socket,
        std::vector<uint8_t> initial_payload
    );

    asio::io_context& ioc_;
    config::OutboundConfig config_;
    std::unique_ptr<asio::ssl::context> ssl_ctx_;
};

} // namespace vnexus::outbound
