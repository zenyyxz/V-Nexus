#pragma once

#include "vnexus/inbound/inbound.hpp"
#include "vnexus/router/router.hpp"
#include <asio.hpp>
#include <asio/posix/stream_descriptor.hpp>
#include <memory>
#include <unordered_map>
#include <string>
#include <vector>
#include <atomic>
#include <mutex>

namespace vnexus::inbound {

struct TunTcpKey {
    uint32_t src_ip{0};
    uint16_t src_port{0};
    uint32_t dst_ip{0};
    uint16_t dst_port{0};

    bool operator==(const TunTcpKey& other) const {
        return src_ip == other.src_ip && src_port == other.src_port &&
               dst_ip == other.dst_ip && dst_port == other.dst_port;
    }
};

struct TunTcpKeyHash {
    size_t operator()(const TunTcpKey& k) const noexcept {
        size_t h1 = std::hash<uint32_t>{}(k.src_ip);
        size_t h2 = std::hash<uint16_t>{}(k.src_port);
        size_t h3 = std::hash<uint32_t>{}(k.dst_ip);
        size_t h4 = std::hash<uint16_t>{}(k.dst_port);
        return h1 ^ (h2 << 1) ^ (h3 << 2) ^ (h4 << 3);
    }
};

class TunTcpConnection;

class TunInbound : public IInbound, public std::enable_shared_from_this<TunInbound> {
public:
    TunInbound(
        asio::io_context& ioc,
        config::InboundConfig config,
        sniff::CompositeSniffer sniffer,
        DispatchHandler dispatcher
    );
    ~TunInbound() override;

    void start() override;
    void stop() override;
    [[nodiscard]] std::string_view tag() const override { return config_.tag; }
    [[nodiscard]] uint16_t listen_port() const override { return 0; }

    // Packet output to TUN interface
    void write_packet(const uint8_t* data, size_t len);
    void write_packet(std::vector<uint8_t> packet);

    // Remove finished TCP connection
    void remove_connection(const TunTcpKey& key);

private:
    void open_tun_device();
    void configure_routing();
    void restore_routing();
    void do_read();
    void handle_packet(std::vector<uint8_t> packet);

    void handle_icmp(std::vector<uint8_t>& packet, size_t ip_hdr_len);
    void handle_dns(std::vector<uint8_t>& packet, size_t ip_hdr_len);
    void handle_tcp(std::vector<uint8_t>& packet, size_t ip_hdr_len);

    // FakeIP helpers
    std::string get_or_create_fakeip(const std::string& domain);
    std::string get_domain_for_fakeip(const std::string& ip);

    asio::io_context& ioc_;
    config::InboundConfig config_;
    sniff::CompositeSniffer sniffer_;
    DispatchHandler dispatcher_;

    int tun_fd_{-1};
    std::unique_ptr<asio::posix::stream_descriptor> tun_stream_;
    std::vector<uint8_t> read_buffer_;

    std::string default_gw_;
    std::string default_dev_;
    bool routes_configured_{false};

    std::atomic<uint64_t> session_counter_{1};

    // FakeIP table
    std::mutex fakeip_mutex_;
    uint32_t next_fakeip_{0xC6120002}; // 198.18.0.2
    std::unordered_map<std::string, std::string> domain_to_fakeip_;
    std::unordered_map<std::string, std::string> fakeip_to_domain_;

    void start_cleanup_timer();
    void cleanup_stale_sessions();

    // TCP session table
    std::mutex tcp_mutex_;
    std::unordered_map<TunTcpKey, std::shared_ptr<TunTcpConnection>, TunTcpKeyHash> tcp_sessions_;
    asio::steady_timer cleanup_timer_;
};

} // namespace vnexus::inbound
