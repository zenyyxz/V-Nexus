#pragma once

#include "vnexus/outbound/outbound.hpp"
#include "vnexus/config/config.hpp"
#include "vnexus/common/uuid.hpp"
#include <asio.hpp>
#include <asio/ssl.hpp>
#include <memory>
#include <vector>
#include <array>
#include <cstdint>

namespace vnexus::outbound {

enum class VmessSecurity : uint8_t {
    Aes128Cfb = 0x00,
    None = 0x01,
    Aes128Gcm = 0x02,
    ChaCha20Poly1305 = 0x03
};

class VmessOutbound : public IOutbound {
public:
    VmessOutbound(asio::io_context& ioc, config::OutboundConfig config);

    [[nodiscard]] std::string_view tag() const override { return config_.tag; }
    [[nodiscard]] std::string_view type() const override { return "vmess"; }

    void dispatch(
        std::shared_ptr<SessionContext> session,
        asio::ip::tcp::socket client_socket,
        std::vector<uint8_t> initial_payload
    ) override;

    // Helper: Compute FNV-1a 32-bit hash (used in VMess header checksum)
    static uint32_t fnv1a(const uint8_t* data, size_t len);

    // Helper: Compute VMess 16-byte user auth token (HMAC-MD5 of UTC timestamp)
    static std::array<uint8_t, 16> compute_auth_id(const UUID& uuid, int64_t timestamp_seconds);

    // Helper to serialize VMess request header
    static std::vector<uint8_t> build_request_header(
        const UUID& uuid,
        const EndpointAddress& destination,
        uint8_t v_byte,
        VmessSecurity security = VmessSecurity::None,
        NetworkCommand cmd = NetworkCommand::TCP,
        int64_t timestamp_seconds = 0
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
