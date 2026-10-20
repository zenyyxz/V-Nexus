#pragma once

#include "vnexus/common/types.hpp"
#include "vnexus/config/config.hpp"
#include "vnexus/sniff/sniffer.hpp"
#include <asio.hpp>
#include <memory>
#include <string_view>
#include <functional>
#include <atomic>

namespace vnexus::inbound {

using DispatchHandler = std::function<void(
    std::shared_ptr<SessionContext> session,
    asio::ip::tcp::socket client_socket,
    std::vector<uint8_t> initial_payload
)>;

class IInbound {
public:
    virtual ~IInbound() = default;
    virtual void start() = 0;
    virtual void stop() = 0;
    [[nodiscard]] virtual std::string_view tag() const = 0;
    [[nodiscard]] virtual uint16_t listen_port() const = 0;
};

// Performs SNI sniffing on an established proxy session and forwards to dispatcher
void process_and_sniff_session(
    asio::io_context& ioc,
    std::shared_ptr<SessionContext> session,
    asio::ip::tcp::socket socket,
    const config::InboundConfig& cfg,
    const sniff::CompositeSniffer& sniffer,
    DispatchHandler dispatcher
);

} // namespace vnexus::inbound
