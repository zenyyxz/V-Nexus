#include "vnexus/outbound/block_outbound.hpp"
#include "vnexus/common/log.hpp"

namespace vnexus::outbound {

void BlockOutbound::dispatch(
    std::shared_ptr<SessionContext> session,
    asio::ip::tcp::socket client_socket,
    std::vector<uint8_t> /*initial_payload*/
) {
    VN_INFO("[session #{}] BLOCKED connection to {}", session->id, session->target_destination.to_string());
    std::error_code ec;
    client_socket.shutdown(asio::ip::tcp::socket::shutdown_both, ec);
    client_socket.close(ec);
}

} // namespace vnexus::outbound
