#include "vnexus/engine.hpp"
#include "vnexus/common/log.hpp"
#include "vnexus/inbound/socks5_inbound.hpp"
#include "vnexus/inbound/http_inbound.hpp"
#include "vnexus/inbound/mixed_inbound.hpp"
#include "vnexus/inbound/tun_inbound.hpp"
#include "vnexus/outbound/direct_outbound.hpp"
#include "vnexus/outbound/block_outbound.hpp"
#include "vnexus/outbound/vless_outbound.hpp"

namespace vnexus {

Engine::Engine(config::Config config)
    : config_(std::move(config)),
      ioc_(),
      work_guard_(std::make_unique<asio::executor_work_guard<asio::io_context::executor_type>>(ioc_.get_executor())),
      router_(std::make_unique<router::Router>(config_.route)) {
    log::set_level(config_.log.level);
    init_outbounds();
    init_inbounds();
}

Engine::~Engine() {
    stop();
}

void Engine::init_outbounds() {
    for (const auto& out_cfg : config_.outbounds) {
        if (out_cfg.type == "direct") {
            outbounds_[out_cfg.tag] = std::make_shared<outbound::DirectOutbound>(ioc_, out_cfg.tag);
        } else if (out_cfg.type == "block") {
            outbounds_[out_cfg.tag] = std::make_shared<outbound::BlockOutbound>(out_cfg.tag);
        } else if (out_cfg.type == "vless") {
            outbounds_[out_cfg.tag] = std::make_shared<outbound::VlessOutbound>(ioc_, out_cfg);
        } else {
            VN_WARN("[engine] unknown outbound type '{}' for tag '{}'", out_cfg.type, out_cfg.tag);
        }
    }

    // Ensure fallback direct and block outbounds exist if not defined
    if (outbounds_.find("direct") == outbounds_.end()) {
        outbounds_["direct"] = std::make_shared<outbound::DirectOutbound>(ioc_, "direct");
    }
    if (outbounds_.find("block") == outbounds_.end()) {
        outbounds_["block"] = std::make_shared<outbound::BlockOutbound>("block");
    }
}

void Engine::init_inbounds() {
    auto dispatcher = [this](
        std::shared_ptr<SessionContext> session,
        asio::ip::tcp::socket client_socket,
        std::vector<uint8_t> initial_payload
    ) {
        handle_dispatch(std::move(session), std::move(client_socket), std::move(initial_payload));
    };

    for (const auto& in_cfg : config_.inbounds) {
        sniff::CompositeSniffer sniffer(in_cfg.sniff_protocols);
        if (in_cfg.type == "socks5") {
            inbounds_.push_back(std::make_shared<inbound::Socks5Inbound>(ioc_, in_cfg, std::move(sniffer), dispatcher));
        } else if (in_cfg.type == "http") {
            inbounds_.push_back(std::make_shared<inbound::HttpInbound>(ioc_, in_cfg, std::move(sniffer), dispatcher));
        } else if (in_cfg.type == "mixed") {
            inbounds_.push_back(std::make_shared<inbound::MixedInbound>(ioc_, in_cfg, std::move(sniffer), dispatcher));
        } else if (in_cfg.type == "tun") {
            inbounds_.push_back(std::make_shared<inbound::TunInbound>(ioc_, in_cfg, std::move(sniffer), dispatcher));
        } else {
            VN_WARN("[engine] unknown inbound type '{}' for tag '{}'", in_cfg.type, in_cfg.tag);
        }
    }
}

void Engine::handle_dispatch(
    std::shared_ptr<SessionContext> session,
    asio::ip::tcp::socket client_socket,
    std::vector<uint8_t> initial_payload
) {
    // 1. Evaluate routing
    std::string target_outbound = router_->route(*session);
    session->outbound_tag = target_outbound;

    VN_INFO("[engine] Session #{} -> {}", session->id, session->info());

    // 2. Locate target outbound
    auto it = outbounds_.find(target_outbound);
    if (it == outbounds_.end()) {
        VN_ERROR("[engine] outbound '{}' not found for session #{}, dropping connection", target_outbound, session->id);
        std::error_code ec;
        client_socket.shutdown(asio::ip::tcp::socket::shutdown_both, ec);
        client_socket.close(ec);
        return;
    }

    // 3. Dispatch to outbound
    it->second->dispatch(std::move(session), std::move(client_socket), std::move(initial_payload));
}

void Engine::start() {
    if (running_) return;
    running_ = true;

    for (auto& in : inbounds_) {
        in->start();
    }
    VN_INFO("[engine] vnexus-engine successfully started with {} inbounds and {} outbounds",
            inbounds_.size(), outbounds_.size());
}

void Engine::run() {
    start();
    ioc_.run();
}

void Engine::stop() {
    if (!running_) return;
    running_ = false;

    for (auto& in : inbounds_) {
        in->stop();
    }
    work_guard_.reset();
    ioc_.stop();
    VN_INFO("[engine] vnexus-engine stopped");
}

} // namespace vnexus
