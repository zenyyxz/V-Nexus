#include "vnexus/inbound/tun_inbound.hpp"
#include "vnexus/common/log.hpp"
#include "vnexus/common/net.hpp"

#include <sys/ioctl.h>
#include <fcntl.h>
#include <unistd.h>
#include <net/if.h>
#include <linux/if.h>
#include <linux/if_tun.h>
#include <arpa/inet.h>

#include <cstring>
#include <cstdlib>
#include <array>
#include <sstream>
#include <deque>
#include <chrono>
#if defined(__linux__)
#include <malloc.h>
#endif

namespace vnexus::inbound {

namespace {

// RFC 1071 Internet Checksum
uint16_t compute_checksum(const uint8_t* data, size_t len, uint32_t initial_sum = 0) {
    uint32_t sum = initial_sum;
    for (size_t i = 0; i < len; i += 2) {
        if (i + 1 < len) {
            sum += (static_cast<uint32_t>(data[i]) << 8) | data[i + 1];
        } else {
            sum += static_cast<uint32_t>(data[i]) << 8;
        }
    }
    while (sum >> 16) {
        sum = (sum & 0xFFFF) + (sum >> 16);
    }
    return static_cast<uint16_t>(~sum);
}

uint16_t tcp_checksum(uint32_t src_ip, uint32_t dst_ip, const uint8_t* tcp_hdr_and_payload, size_t len) {
    // Pseudo header: src(4), dst(4), zero(1), proto(1)=6, len(2)
    uint32_t sum = 0;
    sum += (src_ip >> 16) & 0xFFFF;
    sum += src_ip & 0xFFFF;
    sum += (dst_ip >> 16) & 0xFFFF;
    sum += dst_ip & 0xFFFF;
    sum += 6; // IPPROTO_TCP
    sum += static_cast<uint32_t>(len);

    return compute_checksum(tcp_hdr_and_payload, len, sum);
}

uint16_t udp_checksum(uint32_t src_ip, uint32_t dst_ip, const uint8_t* udp_hdr_and_payload, size_t len) {
    uint32_t sum = 0;
    sum += (src_ip >> 16) & 0xFFFF;
    sum += src_ip & 0xFFFF;
    sum += (dst_ip >> 16) & 0xFFFF;
    sum += dst_ip & 0xFFFF;
    sum += 17; // IPPROTO_UDP
    sum += static_cast<uint32_t>(len);

    uint16_t res = compute_checksum(udp_hdr_and_payload, len, sum);
    return res == 0 ? 0xFFFF : res;
}

std::string parse_dns_qname(const uint8_t* data, size_t len, size_t& offset) {
    std::string domain;
    while (offset < len) {
        uint8_t label_len = data[offset++];
        if (label_len == 0) break;
        if (offset + label_len > len) return "";
        if (!domain.empty()) domain += ".";
        domain.append(reinterpret_cast<const char*>(&data[offset]), label_len);
        offset += label_len;
    }
    return domain;
}

} // namespace

// =========================================================================
// TunTcpConnection Implementation
// =========================================================================

class TunTcpConnection : public std::enable_shared_from_this<TunTcpConnection> {
public:
    enum class State {
        SYN_RECEIVED,
        ESTABLISHED,
        CLOSING,
        CLOSED
    };

    TunTcpConnection(
        TunInbound& tun,
        asio::io_context& ioc,
        uint64_t session_id,
        TunTcpKey key,
        uint32_t initial_client_seq,
        std::string target_domain,
        const config::InboundConfig& cfg,
        const sniff::CompositeSniffer& sniffer,
        DispatchHandler dispatcher
    ) : tun_(tun),
        ioc_(ioc),
        session_id_(session_id),
        key_(key),
        client_seq_(initial_client_seq + 1), // +1: SYN consumes a seq number
        my_isn_(0x12345678 ^ (initial_client_seq & 0xFFFFFF)),
        my_seq_(my_isn_ + 1),
        target_domain_(std::move(target_domain)),
        cfg_(cfg),
        sniffer_(sniffer),
        dispatcher_(std::move(dispatcher)),
        last_activity_(std::chrono::steady_clock::now()) {}

    bool is_idle(std::chrono::seconds timeout) const {
        return (std::chrono::steady_clock::now() - last_activity_) > timeout;
    }

    State state() const { return state_; }

    void handle_packet(const uint8_t* tcp_hdr, size_t /*tcp_len*/, const uint8_t* payload, size_t payload_len) {
        last_activity_ = std::chrono::steady_clock::now();
        uint8_t flags = tcp_hdr[13];
        uint32_t seq  = (static_cast<uint32_t>(tcp_hdr[4]) << 24) |
                        (static_cast<uint32_t>(tcp_hdr[5]) << 16) |
                        (static_cast<uint32_t>(tcp_hdr[6]) << 8)  |
                        tcp_hdr[7];

        if (flags & 0x04) { // RST
            close();
            return;
        }

        if (flags & 0x01) { // FIN
            client_seq_ = seq + 1; // FIN consumes a seq number
            send_tcp_packet(0x11); // FIN | ACK
            my_seq_++;
            close();
            return;
        }

        if ((flags & 0x02) && state_ == State::SYN_RECEIVED) {
            // Client retransmitted SYN, re-send SYN-ACK
            send_syn_ack();
            return;
        }

        if (state_ == State::SYN_RECEIVED) {
            if (flags & 0x10) { // ACK — three-way handshake complete
                state_ = State::ESTABLISHED;
                VN_DEBUG("[tun-session #{}] ESTABLISHED {}:{} -> {}:{}",
                         session_id_, 
                         asio::ip::address_v4(key_.src_ip).to_string(), key_.src_port,
                         asio::ip::address_v4(key_.dst_ip).to_string(), key_.dst_port);
            }
        }

        if (payload_len > 0 && state_ == State::ESTABLISHED) {
            client_seq_ = seq + static_cast<uint32_t>(payload_len);
            send_tcp_packet(0x10); // ACK

            // Accumulate data until we can dispatch
            if (!dispatched_) {
                initial_payload_.insert(initial_payload_.end(), payload, payload + payload_len);

                // Try SNI sniff
                auto res = sniffer_.sniff(initial_payload_);
                if (res.success) {
                    VN_INFO("[tun-session #{}] SNI sniffed: '{}' ({})",
                            session_id_, res.domain, res.protocol);
                }

                // Dispatch immediately — we have at least the first data chunk
                do_dispatch(res);
            } else if (pipe_write_sock_) {
                enqueue_pipe_write(payload, payload_len);
            }
        }
    }

    void send_syn_ack() {
        uint32_t saved = my_seq_;
        my_seq_ = my_isn_;
        send_tcp_packet(0x12); // SYN | ACK
        my_seq_ = saved;
    }

    void close() {
        if (state_ == State::CLOSED) return;
        state_ = State::CLOSED;
        if (pipe_write_sock_) {
            std::error_code ec;
            pipe_write_sock_->close(ec);
        }
        tun_.remove_connection(key_);
    }

private:
    // -----------------------------------------------------------------------
    // Dispatch: open a real AF_UNIX socketpair, hand one end to the outbound
    // dispatcher as a tcp::socket (fd-level assignment), use the other end as
    // our pipe to write application data into the outbound and read replies.
    // -----------------------------------------------------------------------
    void do_dispatch(const SniffResult& sniff_res) {
        dispatched_ = true;

        // Create a real unix stream socketpair
        int sv[2];
        if (::socketpair(AF_UNIX, SOCK_STREAM | SOCK_NONBLOCK, 0, sv) < 0) {
            VN_ERROR("[tun-session #{}] socketpair failed: {}", session_id_, strerror(errno));
            close();
            return;
        }

        // sv[0] → we keep as write pipe to outbound / read pipe from outbound
        // sv[1] → handed to the dispatcher as a fake tcp::socket
        pipe_write_sock_ = std::make_unique<asio::ip::tcp::socket>(ioc_);
        std::error_code ec;
        pipe_write_sock_->assign(asio::ip::tcp::v4(), sv[0], ec);
        if (ec) {
            ::close(sv[0]); ::close(sv[1]);
            VN_ERROR("[tun-session #{}] assign sv[0] failed: {}", session_id_, ec.message());
            close();
            return;
        }

        asio::ip::tcp::socket dispatcher_sock(ioc_);
        dispatcher_sock.assign(asio::ip::tcp::v4(), sv[1], ec);
        if (ec) {
            ::close(sv[1]);
            VN_ERROR("[tun-session #{}] assign sv[1] failed: {}", session_id_, ec.message());
            close();
            return;
        }

        // Build session context
        auto session = std::make_shared<SessionContext>();
        session->id          = session_id_;
        session->inbound_tag = cfg_.tag;
        session->client_endpoint = asio::ip::tcp::endpoint(
            asio::ip::address_v4(key_.src_ip), key_.src_port);

        EndpointAddress dest;
        dest.port = key_.dst_port;
        if (sniff_res.success && !sniff_res.domain.empty() && cfg_.sniff_override_destination) {
            dest.host                      = sniff_res.domain;
            dest.type                      = AddressType::Domain;
            session->destination_overridden = true;
            session->sniffed_domain        = sniff_res.domain;
            session->sniffed_protocol      = sniff_res.protocol;
            session->sniff_successful      = true;
        } else if (!target_domain_.empty()) {
            dest.host = target_domain_;
            dest.type = AddressType::Domain;
        } else {
            dest.host = asio::ip::address_v4(key_.dst_ip).to_string();
            dest.type = AddressType::IPv4;
        }
        session->original_destination = dest;
        session->target_destination   = dest;

        VN_INFO("[tun-session #{}] Dispatching to '{}:{}'",
                session_id_, dest.host, dest.port);

        // Start reading replies from the outbound and sending them as TCP packets
        do_read_from_pipe();

        // Hand the other end to the dispatcher (VLESS outbound) along with the initial payload
        dispatcher_(session, std::move(dispatcher_sock), std::move(initial_payload_));
    }

    void enqueue_pipe_write(const uint8_t* payload, size_t payload_len) {
        if (!pipe_write_sock_ || !pipe_write_sock_->is_open() || payload_len == 0) return;
        bool write_in_progress = !pipe_write_queue_.empty();
        pipe_write_queue_.emplace_back(payload, payload + payload_len);
        if (!write_in_progress) {
            do_pipe_write();
        }
    }

    void do_pipe_write() {
        if (pipe_write_queue_.empty() || !pipe_write_sock_ || !pipe_write_sock_->is_open()) return;
        auto self = shared_from_this();
        asio::async_write(*pipe_write_sock_, asio::buffer(pipe_write_queue_.front()),
            [this, self](std::error_code ec, size_t /*wlen*/) {
                if (ec) {
                    close();
                    return;
                }
                if (!pipe_write_queue_.empty()) {
                    pipe_write_queue_.pop_front();
                }
                if (!pipe_write_queue_.empty()) {
                    do_pipe_write();
                }
            });
    }

    // Read data flowing back from the outbound and inject into TUN as TCP packets
    void do_read_from_pipe() {
        if (!pipe_write_sock_) return;
        auto self = shared_from_this();
        pipe_write_sock_->async_read_some(asio::buffer(read_buf_),
            [this, self](std::error_code ec, size_t len) {
                if (!ec && len > 0) {
                    last_activity_ = std::chrono::steady_clock::now();
                    // Chunk into MSS-sized TCP data packets
                    size_t off = 0;
                    while (off < len) {
                        size_t chunk = std::min(static_cast<size_t>(1360), len - off);
                        send_tcp_packet(0x18, &read_buf_[off], chunk); // PSH | ACK
                        my_seq_ += static_cast<uint32_t>(chunk);
                        off += chunk;
                    }
                    do_read_from_pipe();
                } else {
                    if (ec && ec != asio::error::eof && ec != asio::error::operation_aborted) {
                        VN_DEBUG("[tun-session #{}] pipe read error: {}", session_id_, ec.message());
                    }
                    send_tcp_packet(0x11); // FIN | ACK
                    my_seq_++;
                    close();
                }
            });
    }

    void send_tcp_packet(uint8_t flags, const uint8_t* payload = nullptr, size_t payload_len = 0) {
        size_t total_len = 20 + 20 + payload_len;
        if (total_len > 1600) return;

        uint8_t pkt[1600];
        std::memset(pkt, 0, 40);

        // IPv4 header
        pkt[0]  = 0x45;
        pkt[2]  = static_cast<uint8_t>(total_len >> 8);
        pkt[3]  = static_cast<uint8_t>(total_len & 0xFF);
        pkt[6]  = 0x40; // DF
        pkt[8]  = 64;   // TTL
        pkt[9]  = 6;    // TCP

        // Source = server (dst_ip:dst_port), Destination = client (src_ip:src_port)
        pkt[12] = static_cast<uint8_t>(key_.dst_ip >> 24);
        pkt[13] = static_cast<uint8_t>((key_.dst_ip >> 16) & 0xFF);
        pkt[14] = static_cast<uint8_t>((key_.dst_ip >> 8) & 0xFF);
        pkt[15] = static_cast<uint8_t>(key_.dst_ip & 0xFF);

        pkt[16] = static_cast<uint8_t>(key_.src_ip >> 24);
        pkt[17] = static_cast<uint8_t>((key_.src_ip >> 16) & 0xFF);
        pkt[18] = static_cast<uint8_t>((key_.src_ip >> 8) & 0xFF);
        pkt[19] = static_cast<uint8_t>(key_.src_ip & 0xFF);

        uint16_t ip_csum = compute_checksum(pkt, 20);
        pkt[10] = static_cast<uint8_t>(ip_csum >> 8);
        pkt[11] = static_cast<uint8_t>(ip_csum & 0xFF);

        // TCP header
        pkt[20] = static_cast<uint8_t>(key_.dst_port >> 8);
        pkt[21] = static_cast<uint8_t>(key_.dst_port & 0xFF);
        pkt[22] = static_cast<uint8_t>(key_.src_port >> 8);
        pkt[23] = static_cast<uint8_t>(key_.src_port & 0xFF);

        pkt[24] = static_cast<uint8_t>(my_seq_ >> 24);
        pkt[25] = static_cast<uint8_t>((my_seq_ >> 16) & 0xFF);
        pkt[26] = static_cast<uint8_t>((my_seq_ >> 8) & 0xFF);
        pkt[27] = static_cast<uint8_t>(my_seq_ & 0xFF);

        pkt[28] = static_cast<uint8_t>(client_seq_ >> 24);
        pkt[29] = static_cast<uint8_t>((client_seq_ >> 16) & 0xFF);
        pkt[30] = static_cast<uint8_t>((client_seq_ >> 8) & 0xFF);
        pkt[31] = static_cast<uint8_t>(client_seq_ & 0xFF);

        pkt[32] = 0x50; // data offset 5 (20 bytes)
        pkt[33] = flags;
        pkt[34] = 0xFF; // window high (65535)
        pkt[35] = 0xFF; // window low

        if (payload && payload_len > 0) {
            std::memcpy(&pkt[40], payload, payload_len);
        }

        uint16_t tcp_csum = tcp_checksum(key_.dst_ip, key_.src_ip, &pkt[20], 20 + payload_len);
        pkt[36] = static_cast<uint8_t>(tcp_csum >> 8);
        pkt[37] = static_cast<uint8_t>(tcp_csum & 0xFF);

        tun_.write_packet(pkt, total_len);
    }

    TunInbound&              tun_;
    asio::io_context&        ioc_;
    uint64_t                 session_id_;
    TunTcpKey                key_;
    uint32_t                 client_seq_{0};
    uint32_t                 my_isn_{100000};
    uint32_t                 my_seq_{100000};
    std::string              target_domain_;
    config::InboundConfig    cfg_;
    const sniff::CompositeSniffer& sniffer_;
    DispatchHandler          dispatcher_;

    State                    state_{State::SYN_RECEIVED};
    bool                     dispatched_{false};
    std::vector<uint8_t>     initial_payload_;
    std::unique_ptr<asio::ip::tcp::socket> pipe_write_sock_;
    std::array<uint8_t, 16384> read_buf_{};
    std::chrono::steady_clock::time_point last_activity_{std::chrono::steady_clock::now()};
    std::deque<std::vector<uint8_t>> pipe_write_queue_;
};

// =========================================================================
// TunInbound Implementation
// =========================================================================


TunInbound::TunInbound(
    asio::io_context& ioc,
    config::InboundConfig config,
    sniff::CompositeSniffer sniffer,
    DispatchHandler dispatcher
) : ioc_(ioc),
    config_(std::move(config)),
    sniffer_(std::move(sniffer)),
    dispatcher_(std::move(dispatcher)),
    read_buffer_(65536),
    cleanup_timer_(ioc) {}

TunInbound::~TunInbound() {
    stop();
}

void TunInbound::start() {
    open_tun_device();
    if (config_.tun.auto_route) {
        configure_routing();
    }
    start_cleanup_timer();
    do_read();
}

void TunInbound::stop() {
    cleanup_timer_.cancel();
    std::error_code ec;

    {
        std::lock_guard<std::mutex> lock(tcp_mutex_);
        tcp_sessions_.clear();
    }

    if (routes_configured_) {
        restore_routing();
    }
    if (tun_stream_ && tun_stream_->is_open()) {
        tun_stream_->close(ec);
    }
    if (tun_fd_ >= 0) {
        ::close(tun_fd_);
        tun_fd_ = -1;
    }
}

void TunInbound::open_tun_device() {
    tun_fd_ = ::open("/dev/net/tun", O_RDWR | O_NONBLOCK);
    if (tun_fd_ < 0) {
        throw std::runtime_error("Failed to open /dev/net/tun: " + std::string(strerror(errno)) +
                                 " (Did you run with sudo or grant CAP_NET_ADMIN?)");
    }

    struct ifreq ifr{};
    std::memset(&ifr, 0, sizeof(ifr));
    ifr.ifr_flags = IFF_TUN | IFF_NO_PI;
    std::strncpy(ifr.ifr_name, config_.tun.interface_name.c_str(), IFNAMSIZ - 1);

    if (::ioctl(tun_fd_, TUNSETIFF, reinterpret_cast<void*>(&ifr)) < 0) {
        ::close(tun_fd_);
        tun_fd_ = -1;
        throw std::runtime_error("ioctl(TUNSETIFF) failed on " + config_.tun.interface_name +
                                 ": " + std::string(strerror(errno)));
    }

    tun_stream_ = std::make_unique<asio::posix::stream_descriptor>(ioc_, tun_fd_);

    // Configure interface IP and MTU via ip command
    std::string dev = config_.tun.interface_name;
    std::string ip_addr = config_.tun.address.empty() ? "172.19.0.1/30" : config_.tun.address;
    uint32_t mtu = config_.tun.mtu == 0 ? 1400 : config_.tun.mtu;

    std::string cmd1 = "ip addr add " + ip_addr + " dev " + dev;
    std::string cmd2 = "ip link set dev " + dev + " mtu " + std::to_string(mtu) + " up";

    VN_INFO("[inbound-tun] Configuring interface: {}", cmd1);
    (void)::system(cmd1.c_str());
    VN_INFO("[inbound-tun] Bringing interface UP: {}", cmd2);
    (void)::system(cmd2.c_str());
}

void TunInbound::configure_routing() {
    std::string dev = config_.tun.interface_name;

    // Detect default gateway
    FILE* fp = popen("ip route show default", "r");
    if (fp) {
        char line[256];
        if (fgets(line, sizeof(line), fp)) {
            std::istringstream iss(line);
            std::string def, via, gw, d, out_dev;
            iss >> def >> via >> gw >> d >> out_dev;
            if (via == "via") {
                default_gw_ = gw;
                default_dev_ = out_dev;
                VN_INFO("[inbound-tun] Detected default gateway {} on {}", default_gw_, default_dev_);
            }
        }
        pclose(fp);
    }

    // Exclude VPN server IP / routes to prevent looping
    if (!default_gw_.empty() && !default_dev_.empty()) {
        for (const auto& exclude : config_.tun.route_exclude_address) {
            std::string cmd = "ip route replace " + exclude + " via " + default_gw_ + " dev " + default_dev_;
            VN_INFO("[inbound-tun] Adding bypass route: {}", cmd);
            (void)::system(cmd.c_str());
        }
    }

    // Add 0.0.0.0/1, 128.0.0.0/1 and FakeIP 198.18.0.0/15 routes to zen-tun
    std::string r1 = "ip route replace 0.0.0.0/1 dev " + dev;
    std::string r2 = "ip route replace 128.0.0.0/1 dev " + dev;
    std::string r3 = "ip route replace 198.18.0.0/15 dev " + dev;

    VN_INFO("[inbound-tun] Adding default VPN routes to {}", dev);
    (void)::system(r1.c_str());
    (void)::system(r2.c_str());
    (void)::system(r3.c_str());

    // Point system DNS to the TUN device FakeIP handler (backup existing resolv.conf)
    std::string ip_only = config_.tun.address;
    auto slash = ip_only.find('/');
    if (slash != std::string::npos) ip_only = ip_only.substr(0, slash);
    if (ip_only.empty()) ip_only = "172.19.0.1";

    VN_INFO("[inbound-tun] Configuring system DNS to use TUN FakeIP resolver ({})", ip_only);
    (void)::system("cp -L /etc/resolv.conf /tmp/resolv.conf.vnexus.bak 2>/dev/null");
    std::string dns_cmd = "echo -e 'nameserver " + ip_only + "\nnameserver 1.1.1.1' > /etc/resolv.conf 2>/dev/null";
    (void)::system(dns_cmd.c_str());

    routes_configured_ = true;
}

void TunInbound::restore_routing() {
    std::string dev = config_.tun.interface_name;
    VN_INFO("[inbound-tun] Restoring system routes and DNS...");

    std::string r1 = "ip route del 0.0.0.0/1 dev " + dev + " 2>/dev/null";
    std::string r2 = "ip route del 128.0.0.0/1 dev " + dev + " 2>/dev/null";
    std::string r3 = "ip route del 198.18.0.0/15 dev " + dev + " 2>/dev/null";
    (void)::system(r1.c_str());
    (void)::system(r2.c_str());
    (void)::system(r3.c_str());

    if (!default_gw_.empty() && !default_dev_.empty()) {
        for (const auto& exclude : config_.tun.route_exclude_address) {
            std::string cmd = "ip route del " + exclude + " 2>/dev/null";
            (void)::system(cmd.c_str());
        }
    }

    // Restore resolv.conf
    (void)::system("if [ -f /tmp/resolv.conf.vnexus.bak ]; then cp /tmp/resolv.conf.vnexus.bak /etc/resolv.conf && rm -f /tmp/resolv.conf.vnexus.bak; fi 2>/dev/null");

    routes_configured_ = false;
}

void TunInbound::do_read() {
    if (!tun_stream_ || !tun_stream_->is_open()) return;

    auto self = shared_from_this();
    tun_stream_->async_read_some(asio::buffer(read_buffer_),
        [this, self](std::error_code ec, size_t length) {
            if (!ec && length > 0) {
                std::vector<uint8_t> pkt(read_buffer_.begin(), read_buffer_.begin() + length);
                handle_packet(std::move(pkt));
                do_read();
            } else if (ec != asio::error::operation_aborted) {
                VN_WARN("[inbound-tun] Read error: {}", ec.message());
            }
        });
}

void TunInbound::write_packet(const uint8_t* data, size_t len) {
    if (tun_fd_ < 0 || !data || len == 0) return;
    ssize_t n = ::write(tun_fd_, data, len);
    if (n < 0 && (errno != EAGAIN && errno != EWOULDBLOCK)) {
        VN_DEBUG("[inbound-tun] Packet write error: {}", strerror(errno));
    }
}

void TunInbound::write_packet(std::vector<uint8_t> packet) {
    write_packet(packet.data(), packet.size());
}

void TunInbound::start_cleanup_timer() {
    cleanup_timer_.expires_after(std::chrono::seconds(15));
    cleanup_timer_.async_wait([this, self = shared_from_this()](std::error_code ec) {
        if (!ec) {
            cleanup_stale_sessions();
            start_cleanup_timer();
        }
    });
}

void TunInbound::cleanup_stale_sessions() {
    std::vector<std::shared_ptr<TunTcpConnection>> to_close;
    {
        std::lock_guard<std::mutex> lock(tcp_mutex_);
        auto it = tcp_sessions_.begin();
        while (it != tcp_sessions_.end()) {
            if (!it->second || it->second->state() == TunTcpConnection::State::CLOSED ||
                it->second->is_idle(std::chrono::seconds(60))) {
                to_close.push_back(it->second);
                it = tcp_sessions_.erase(it);
            } else {
                ++it;
            }
        }
    }

    for (auto& conn : to_close) {
        if (conn) {
            conn->close();
        }
    }

#if defined(__linux__)
    malloc_trim(0);
#endif
}

void TunInbound::remove_connection(const TunTcpKey& key) {
    std::lock_guard<std::mutex> lock(tcp_mutex_);
    tcp_sessions_.erase(key);
}

std::string TunInbound::get_or_create_fakeip(const std::string& domain) {
    std::lock_guard<std::mutex> lock(fakeip_mutex_);
    auto it = domain_to_fakeip_.find(domain);
    if (it != domain_to_fakeip_.end()) {
        return it->second;
    }

    uint32_t ip_num = next_fakeip_++;
    // Range 198.18.0.2 - 198.19.255.254
    if (next_fakeip_ >= 0xC613FFFE) {
        next_fakeip_ = 0xC6120002;
    }

    asio::ip::address_v4 addr(ip_num);
    std::string ip_str = addr.to_string();

    domain_to_fakeip_[domain] = ip_str;
    fakeip_to_domain_[ip_str] = domain;
    return ip_str;
}

std::string TunInbound::get_domain_for_fakeip(const std::string& ip) {
    std::lock_guard<std::mutex> lock(fakeip_mutex_);
    auto it = fakeip_to_domain_.find(ip);
    if (it != fakeip_to_domain_.end()) {
        return it->second;
    }
    return "";
}

void TunInbound::handle_packet(std::vector<uint8_t> packet) {
    if (packet.size() < 20) return;
    if ((packet[0] >> 4) != 4) return; // Only IPv4 for now

    size_t ip_hdr_len = (packet[0] & 0x0F) * 4;
    if (packet.size() < ip_hdr_len) return;

    uint8_t protocol = packet[9];

    VN_TRACE("[inbound-tun] Received packet: proto={} len={}", protocol, packet.size());

    if (protocol == 1) { // ICMP
        handle_icmp(packet, ip_hdr_len);
    } else if (protocol == 17) { // UDP
        // Check dst port 53 for DNS, otherwise ignore
        if (packet.size() > ip_hdr_len + 3) {
            uint16_t dst_port = (static_cast<uint16_t>(packet[ip_hdr_len + 2]) << 8) | packet[ip_hdr_len + 3];
            if (dst_port == 53) {
                handle_dns(packet, ip_hdr_len);
            }
        }
    } else if (protocol == 6) { // TCP
        handle_tcp(packet, ip_hdr_len);
    }
}

void TunInbound::handle_icmp(std::vector<uint8_t>& packet, size_t ip_hdr_len) {
    if (packet.size() < ip_hdr_len + 8) return;

    uint8_t type = packet[ip_hdr_len];
    if (type == 8) { // Echo Request
        // Change to Echo Reply (Type 0)
        packet[ip_hdr_len] = 0;

        // Swap src and dst IP
        std::swap_ranges(packet.begin() + 12, packet.begin() + 16, packet.begin() + 16);

        // Recompute ICMP Checksum
        packet[ip_hdr_len + 2] = 0;
        packet[ip_hdr_len + 3] = 0;
        uint16_t icmp_csum = compute_checksum(&packet[ip_hdr_len], packet.size() - ip_hdr_len);
        packet[ip_hdr_len + 2] = static_cast<uint8_t>(icmp_csum >> 8);
        packet[ip_hdr_len + 3] = static_cast<uint8_t>(icmp_csum & 0xFF);

        // Recompute IP Checksum
        packet[10] = 0;
        packet[11] = 0;
        uint16_t ip_csum = compute_checksum(packet.data(), ip_hdr_len);
        packet[10] = static_cast<uint8_t>(ip_csum >> 8);
        packet[11] = static_cast<uint8_t>(ip_csum & 0xFF);

        write_packet(std::move(packet));
    }
}

void TunInbound::handle_dns(std::vector<uint8_t>& packet, size_t ip_hdr_len) {
    if (packet.size() < ip_hdr_len + 8 + 12) return;

    const uint8_t* udp = &packet[ip_hdr_len];
    uint16_t dst_port = (static_cast<uint16_t>(udp[2]) << 8) | udp[3];
    if (dst_port != 53) return; // Only process DNS queries

    uint16_t src_port = (static_cast<uint16_t>(udp[0]) << 8) | udp[1];
    const uint8_t* dns = udp + 8;
    size_t dns_len = packet.size() - ip_hdr_len - 8;

    uint16_t tx_id = (static_cast<uint16_t>(dns[0]) << 8) | dns[1];
    uint16_t qd_count = (static_cast<uint16_t>(dns[4]) << 8) | dns[5];

    if (qd_count < 1) return;

    size_t q_offset = 12;
    std::string domain = parse_dns_qname(dns, dns_len, q_offset);
    if (domain.empty() || q_offset + 4 > dns_len) return;

    [[maybe_unused]] uint16_t qtype = (static_cast<uint16_t>(dns[q_offset]) << 8) | dns[q_offset + 1];
    q_offset += 4; // Skip QTYPE and QCLASS

    // Build DNS Response
    std::vector<uint8_t> resp_dns;
    resp_dns.reserve(256);

    // DNS Header
    resp_dns.push_back(static_cast<uint8_t>(tx_id >> 8));
    resp_dns.push_back(static_cast<uint8_t>(tx_id & 0xFF));
    resp_dns.push_back(0x81); // QR=1, AA=0, TC=0, RD=1
    resp_dns.push_back(0x80); // RA=1, Z=0, RCODE=0
    resp_dns.push_back(0x00); resp_dns.push_back(0x01); // QDCOUNT: 1
    resp_dns.push_back(0x00); resp_dns.push_back(0x01); // ANCOUNT: 1
    resp_dns.push_back(0x00); resp_dns.push_back(0x00); // NSCOUNT: 0
    resp_dns.push_back(0x00); resp_dns.push_back(0x00); // ARCOUNT: 0

    // Copy Question section
    resp_dns.insert(resp_dns.end(), dns + 12, dns + q_offset);

    // Answer section
    std::string fake_ip_str = get_or_create_fakeip(domain);
    asio::ip::address_v4 fake_addr = asio::ip::make_address_v4(fake_ip_str);
    auto ip_bytes = fake_addr.to_bytes();

    resp_dns.push_back(0xC0); resp_dns.push_back(0x0C); // Name pointer to QNAME (0x0C = 12)
    resp_dns.push_back(0x00); resp_dns.push_back(0x01); // TYPE A
    resp_dns.push_back(0x00); resp_dns.push_back(0x01); // CLASS IN
    resp_dns.push_back(0x00); resp_dns.push_back(0x00);
    resp_dns.push_back(0x00); resp_dns.push_back(0x01); // TTL: 1 sec
    resp_dns.push_back(0x00); resp_dns.push_back(0x04); // RDLENGTH: 4
    resp_dns.insert(resp_dns.end(), ip_bytes.begin(), ip_bytes.end());

    // Build UDP + IP Packet
    size_t total_resp_len = 20 + 8 + resp_dns.size();
    std::vector<uint8_t> resp_pkt(total_resp_len, 0);

    // IPv4 Header
    resp_pkt[0] = 0x45;
    resp_pkt[2] = static_cast<uint8_t>(total_resp_len >> 8);
    resp_pkt[3] = static_cast<uint8_t>(total_resp_len & 0xFF);
    resp_pkt[8] = 64;  // TTL
    resp_pkt[9] = 17;  // UDP

    // Swap IPs
    std::memcpy(&resp_pkt[12], &packet[16], 4);
    std::memcpy(&resp_pkt[16], &packet[12], 4);

    uint16_t ip_csum = compute_checksum(resp_pkt.data(), 20);
    resp_pkt[10] = static_cast<uint8_t>(ip_csum >> 8);
    resp_pkt[11] = static_cast<uint8_t>(ip_csum & 0xFF);

    // UDP Header
    resp_pkt[20] = static_cast<uint8_t>(dst_port >> 8);
    resp_pkt[21] = static_cast<uint8_t>(dst_port & 0xFF);
    resp_pkt[22] = static_cast<uint8_t>(src_port >> 8);
    resp_pkt[23] = static_cast<uint8_t>(src_port & 0xFF);

    uint16_t udp_len = static_cast<uint16_t>(8 + resp_dns.size());
    resp_pkt[24] = static_cast<uint8_t>(udp_len >> 8);
    resp_pkt[25] = static_cast<uint8_t>(udp_len & 0xFF);

    std::memcpy(&resp_pkt[28], resp_dns.data(), resp_dns.size());

    uint32_t src_ip = (static_cast<uint32_t>(resp_pkt[12]) << 24) |
                      (static_cast<uint32_t>(resp_pkt[13]) << 16) |
                      (static_cast<uint32_t>(resp_pkt[14]) << 8) |
                      resp_pkt[15];
    uint32_t dst_ip = (static_cast<uint32_t>(resp_pkt[16]) << 24) |
                      (static_cast<uint32_t>(resp_pkt[17]) << 16) |
                      (static_cast<uint32_t>(resp_pkt[18]) << 8) |
                      resp_pkt[19];

    uint16_t udp_csum = udp_checksum(src_ip, dst_ip, &resp_pkt[20], udp_len);
    resp_pkt[26] = static_cast<uint8_t>(udp_csum >> 8);
    resp_pkt[27] = static_cast<uint8_t>(udp_csum & 0xFF);

    VN_DEBUG("[inbound-tun] DNS FakeIP '{}' -> {}", domain, fake_ip_str);
    write_packet(std::move(resp_pkt));
}

void TunInbound::handle_tcp(std::vector<uint8_t>& packet, size_t ip_hdr_len) {
    if (packet.size() < ip_hdr_len + 20) return;

    const uint8_t* tcp = &packet[ip_hdr_len];
    uint16_t src_port = (static_cast<uint16_t>(tcp[0]) << 8) | tcp[1];
    uint16_t dst_port = (static_cast<uint16_t>(tcp[2]) << 8) | tcp[3];
    uint8_t flags = tcp[13];

    // Extract IPs as network-ordered 32-bit value for consistency with inet_ntoa
    uint32_t src_ip_n = (static_cast<uint32_t>(packet[12]) << 24) |
                        (static_cast<uint32_t>(packet[13]) << 16) |
                        (static_cast<uint32_t>(packet[14]) << 8) |
                        packet[15];
    uint32_t dst_ip_n = (static_cast<uint32_t>(packet[16]) << 24) |
                        (static_cast<uint32_t>(packet[17]) << 16) |
                        (static_cast<uint32_t>(packet[18]) << 8) |
                        packet[19];

    // Build human-readable IPs for lookup (host order for asio::ip::address_v4)
    asio::ip::address_v4 src_addr(src_ip_n);
    asio::ip::address_v4 dst_addr(dst_ip_n);

    VN_DEBUG("[inbound-tun] TCP flags=0x{:02x} {}:{} -> {}:{}", 
             flags,
             src_addr.to_string(), src_port,
             dst_addr.to_string(), dst_port);

    TunTcpKey key{
        .src_ip = src_ip_n,
        .src_port = src_port,
        .dst_ip = dst_ip_n,
        .dst_port = dst_port
    };

    size_t tcp_hdr_len = ((tcp[12] >> 4) & 0x0F) * 4;
    if (tcp_hdr_len < 20 || packet.size() < ip_hdr_len + tcp_hdr_len) return;

    const uint8_t* payload = tcp + tcp_hdr_len;
    size_t payload_len = packet.size() - ip_hdr_len - tcp_hdr_len;

    std::shared_ptr<TunTcpConnection> session;
    {
        std::lock_guard<std::mutex> lock(tcp_mutex_);
        auto it = tcp_sessions_.find(key);
        if (it != tcp_sessions_.end()) {
            session = it->second;
        }
    }

    if (!session) {
        // If SYN packet, create new session
        if ((flags & 0x02) && !(flags & 0x10)) {
            uint32_t initial_client_seq = (static_cast<uint32_t>(tcp[4]) << 24) |
                                          (static_cast<uint32_t>(tcp[5]) << 16) |
                                          (static_cast<uint32_t>(tcp[6]) << 8) |
                                          tcp[7];

            std::string domain = get_domain_for_fakeip(dst_addr.to_string());

            VN_INFO("[inbound-tun] New TCP session: {}:{} -> {}:{} domain='{}'",
                    src_addr.to_string(), src_port,
                    dst_addr.to_string(), dst_port,
                    domain.empty() ? dst_addr.to_string() : domain);

            uint64_t id = session_counter_.fetch_add(1);
            session = std::make_shared<TunTcpConnection>(
                *this, ioc_, id, key, initial_client_seq, domain, config_, sniffer_, dispatcher_
            );

            {
                std::lock_guard<std::mutex> lock(tcp_mutex_);
                tcp_sessions_[key] = session;
            }

            session->send_syn_ack();
        } else {
            VN_DEBUG("[inbound-tun] TCP non-SYN packet for unknown session, dropping");
        }
    } else {
        session->handle_packet(tcp, tcp_hdr_len, payload, payload_len);
    }
}

} // namespace vnexus::inbound
