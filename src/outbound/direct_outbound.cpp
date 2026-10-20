#include "vnexus/outbound/direct_outbound.hpp"
#include "vnexus/common/log.hpp"

namespace vnexus::outbound {

DirectOutbound::DirectOutbound(asio::io_context& ioc, std::string tag)
    : ioc_(ioc), tag_(std::move(tag)), resolver_(ioc) {}

void DirectOutbound::dispatch(
    std::shared_ptr<SessionContext> session,
    asio::ip::tcp::socket client_socket,
    std::vector<uint8_t> initial_payload
) {
    auto target_host = session->target_destination.host;
    auto target_port = std::to_string(session->target_destination.port);

    VN_DEBUG("[outbound-direct] resolving target {}:{}", target_host, target_port);

    auto resolver = std::make_shared<asio::ip::tcp::resolver>(ioc_);
    resolver->async_resolve(target_host, target_port,
        [this, session, client_sock = std::make_shared<asio::ip::tcp::socket>(std::move(client_socket)),
         initial_data = std::move(initial_payload), resolver](
            std::error_code ec, asio::ip::tcp::resolver::results_type endpoints) mutable {
            if (ec) {
                VN_WARN("[outbound-direct] DNS resolve failed for {}: {}", session->target_destination.to_string(), ec.message());
                return;
            }

            auto remote_sock = std::make_shared<asio::ip::tcp::socket>(ioc_);
            asio::async_connect(*remote_sock, endpoints,
                [session, client_sock, remote_sock, data = std::move(initial_data)](
                    std::error_code connect_ec, const asio::ip::tcp::endpoint& connected_ep) mutable {
                    if (connect_ec) {
                        VN_WARN("[outbound-direct] connect to {} failed: {}", session->target_destination.to_string(), connect_ec.message());
                        return;
                    }
                    VN_DEBUG("[outbound-direct] connected to {}", connected_ep.address().to_string());
                    start_relay(session, std::move(*client_sock), std::move(*remote_sock), std::move(data));
                });
        });
}

} // namespace vnexus::outbound
