#pragma once

#include "vnexus/common/types.hpp"
#include <asio.hpp>
#include <memory>
#include <vector>
#include <span>

namespace vnexus::outbound {

class IOutbound {
public:
    virtual ~IOutbound() = default;
    [[nodiscard]] virtual std::string_view tag() const = 0;
    [[nodiscard]] virtual std::string_view type() const = 0;

    // Dispatches an established client connection with any initial buffered data
    virtual void dispatch(
        std::shared_ptr<SessionContext> session,
        asio::ip::tcp::socket client_socket,
        std::vector<uint8_t> initial_payload
    ) = 0;
};

// Bidirectional data pipe / relay helper
void start_relay(
    std::shared_ptr<SessionContext> session,
    asio::ip::tcp::socket client_sock,
    asio::ip::tcp::socket remote_sock,
    std::vector<uint8_t> initial_data = {}
);

} // namespace vnexus::outbound
