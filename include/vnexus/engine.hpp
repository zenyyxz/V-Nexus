#pragma once

#include "vnexus/config/config.hpp"
#include "vnexus/inbound/inbound.hpp"
#include "vnexus/outbound/outbound.hpp"
#include "vnexus/router/router.hpp"
#include <asio.hpp>
#include <memory>
#include <unordered_map>
#include <vector>

namespace vnexus {

class Engine {
public:
    explicit Engine(config::Config config);
    ~Engine();

    void start();
    void run();
    void stop();

    [[nodiscard]] asio::io_context& io_context() { return ioc_; }

private:
    void init_outbounds();
    void init_inbounds();
    void handle_dispatch(
        std::shared_ptr<SessionContext> session,
        asio::ip::tcp::socket client_socket,
        std::vector<uint8_t> initial_payload
    );

    config::Config config_;
    asio::io_context ioc_;
    std::unique_ptr<asio::executor_work_guard<asio::io_context::executor_type>> work_guard_;
    std::unique_ptr<router::Router> router_;
    
    std::unordered_map<std::string, std::shared_ptr<outbound::IOutbound>> outbounds_;
    std::vector<std::shared_ptr<inbound::IInbound>> inbounds_;
    bool running_{false};
};

} // namespace vnexus
