#include "vnexus/outbound/outbound.hpp"
#include "vnexus/common/log.hpp"
#include <array>

namespace vnexus::outbound {

class SocketRelay : public std::enable_shared_from_this<SocketRelay> {
public:
    SocketRelay(std::shared_ptr<SessionContext> session,
                asio::ip::tcp::socket client,
                asio::ip::tcp::socket remote)
        : session_(std::move(session)),
          client_(std::move(client)),
          remote_(std::move(remote)) {}

    void start(std::vector<uint8_t> initial_data) {
        if (!initial_data.empty()) {
            auto self = shared_from_this();
            auto buf = std::make_shared<std::vector<uint8_t>>(std::move(initial_data));
            asio::async_write(remote_, asio::buffer(*buf),
                [this, self, buf](std::error_code ec, size_t length) {
                    if (ec) {
                        VN_DEBUG("[relay] error writing initial data: {}", ec.message());
                        close();
                        return;
                    }
                    session_->bytes_up += length;
                    start_pipes();
                });
        } else {
            start_pipes();
        }
    }

private:
    void start_pipes() {
        do_read_client();
        do_read_remote();
    }

    void do_read_client() {
        auto self = shared_from_this();
        client_.async_read_some(asio::buffer(client_buf_),
            [this, self](std::error_code ec, size_t length) {
                if (!ec && length > 0) {
                    session_->bytes_up += length;
                    asio::async_write(remote_, asio::buffer(client_buf_.data(), length),
                        [this, self](std::error_code write_ec, size_t /*wlen*/) {
                            if (!write_ec) {
                                do_read_client();
                            } else {
                                close();
                            }
                        });
                } else {
                    close();
                }
            });
    }

    void do_read_remote() {
        auto self = shared_from_this();
        remote_.async_read_some(asio::buffer(remote_buf_),
            [this, self](std::error_code ec, size_t length) {
                if (!ec && length > 0) {
                    session_->bytes_down += length;
                    asio::async_write(client_, asio::buffer(remote_buf_.data(), length),
                        [this, self](std::error_code write_ec, size_t /*wlen*/) {
                            if (!write_ec) {
                                do_read_remote();
                            } else {
                                close();
                            }
                        });
                } else {
                    close();
                }
            });
    }

    void close() {
        if (closed_) return;
        closed_ = true;

        std::error_code ec;
        client_.shutdown(asio::ip::tcp::socket::shutdown_both, ec);
        client_.close(ec);
        remote_.shutdown(asio::ip::tcp::socket::shutdown_both, ec);
        remote_.close(ec);

        VN_INFO("[session #{}] closed. Up: {} bytes, Down: {} bytes",
                session_->id, session_->bytes_up, session_->bytes_down);
    }

    std::shared_ptr<SessionContext> session_;
    asio::ip::tcp::socket client_;
    asio::ip::tcp::socket remote_;
    std::array<uint8_t, 32768> client_buf_{};
    std::array<uint8_t, 32768> remote_buf_{};
    bool closed_{false};
};

void start_relay(
    std::shared_ptr<SessionContext> session,
    asio::ip::tcp::socket client_sock,
    asio::ip::tcp::socket remote_sock,
    std::vector<uint8_t> initial_data
) {
    auto relay = std::make_shared<SocketRelay>(
        std::move(session), std::move(client_sock), std::move(remote_sock)
    );
    relay->start(std::move(initial_data));
}

} // namespace vnexus::outbound
