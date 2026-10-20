#include "vnexus/inbound/inbound.hpp"
#include "vnexus/common/log.hpp"
#include <chrono>

namespace vnexus::inbound {

namespace {

class SniffSessionState : public std::enable_shared_from_this<SniffSessionState> {
public:
    SniffSessionState(
        asio::io_context& ioc,
        std::shared_ptr<SessionContext> session,
        asio::ip::tcp::socket socket,
        const config::InboundConfig& cfg,
        const sniff::CompositeSniffer& sniffer,
        DispatchHandler dispatcher
    ) : timer_(ioc),
        session_(std::move(session)),
        socket_(std::move(socket)),
        cfg_(cfg),
        sniffer_(sniffer),
        dispatcher_(std::move(dispatcher)),
        buffer_(4096) {}

    void start() {
        session_->sniff_attempted = true;
        auto self = shared_from_this();

        timer_.expires_after(std::chrono::milliseconds(cfg_.sniff_timeout_ms));
        timer_.async_wait([this, self](std::error_code ec) {
            if (!ec) {
                // Timeout fired before data read
                VN_DEBUG("[session #{}] sniff timer expired, continuing with original destination", session_->id);
                std::error_code cancel_ec;
                socket_.cancel(cancel_ec);
            }
        });

        socket_.async_read_some(asio::buffer(buffer_),
            [this, self](std::error_code ec, size_t length) {
                timer_.cancel();

                if (completed_) return;
                completed_ = true;

                std::vector<uint8_t> payload;
                if (!ec && length > 0) {
                    payload.assign(buffer_.begin(), buffer_.begin() + length);
                    auto res = sniffer_.sniff(payload);
                    if (res.success) {
                        session_->sniff_successful = true;
                        session_->sniffed_domain = res.domain;
                        session_->sniffed_protocol = res.protocol;

                        VN_INFO("[session #{}] [sniff] detected domain '{}' (protocol: '{}')",
                                session_->id, res.domain, res.protocol);

                        if (cfg_.sniff_override_destination) {
                            session_->target_destination.host = res.domain;
                            session_->target_destination.type = AddressType::Domain;
                            session_->destination_overridden = true;
                            VN_INFO("[session #{}] [sniff] overridden target destination to '{}'",
                                    session_->id, session_->target_destination.to_string());
                        }
                    } else {
                        VN_DEBUG("[session #{}] [sniff] payload received ({} bytes) but could not extract SNI/Host",
                                 session_->id, length);
                    }
                }

                dispatcher_(session_, std::move(socket_), std::move(payload));
            });
    }

private:
    asio::steady_timer timer_;
    std::shared_ptr<SessionContext> session_;
    asio::ip::tcp::socket socket_;
    config::InboundConfig cfg_;
    const sniff::CompositeSniffer& sniffer_;
    DispatchHandler dispatcher_;
    std::vector<uint8_t> buffer_;
    bool completed_{false};
};

} // namespace

void process_and_sniff_session(
    asio::io_context& ioc,
    std::shared_ptr<SessionContext> session,
    asio::ip::tcp::socket socket,
    const config::InboundConfig& cfg,
    const sniff::CompositeSniffer& sniffer,
    DispatchHandler dispatcher
) {
    if (!cfg.sniff) {
        dispatcher(session, std::move(socket), {});
        return;
    }

    auto state = std::make_shared<SniffSessionState>(
        ioc, std::move(session), std::move(socket), cfg, sniffer, std::move(dispatcher)
    );
    state->start();
}

} // namespace vnexus::inbound
