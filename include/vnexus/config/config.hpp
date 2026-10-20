#pragma once

#include "vnexus/common/uuid.hpp"
#include <string>
#include <vector>
#include <optional>
#include <cstdint>

namespace vnexus::config {

struct LogConfig {
    std::string level{"info"};
    std::string output;
    bool timestamp{true};
};

struct TunConfig {
    std::string interface_name{"zen-tun"};
    std::string address{"172.19.0.1/30"};
    uint32_t mtu{1400};
    bool auto_route{true};
    bool strict_route{true};
    std::string stack{"system"};
    std::vector<std::string> route_exclude_address;
};

struct InboundConfig {
    std::string type{"mixed"}; // mixed, socks5, http, tun
    std::string tag{"inbound-default"};
    std::string listen{"127.0.0.1"};
    uint16_t listen_port{10808};
    
    // Sniffing configurations
    bool sniff{true};
    bool sniff_override_destination{true};
    std::vector<std::string> sniff_protocols{"tls", "http"};
    uint32_t sniff_timeout_ms{300};

    // TUN configuration
    TunConfig tun;
};

struct TlsConfig {
    bool enabled{false};
    std::string server_name; // SNI
    bool insecure{false};
    std::vector<std::string> alpn{"h2", "http/1.1"};
};

struct OutboundConfig {
    std::string type{"vless"}; // vless, direct, block
    std::string tag{"proxy"};
    
    // VLESS fields
    std::string server;
    uint16_t server_port{443};
    std::string uuid_str;
    std::optional<UUID> uuid;
    std::string network{"tcp"};
    TlsConfig tls;
};

struct RuleConfig {
    std::vector<std::string> domain_suffix;
    std::vector<std::string> domain_keyword;
    std::vector<std::string> domain_full;
    std::vector<std::string> ip_cidr;
    std::vector<uint16_t> port;
    std::vector<std::string> protocol;
    std::string outbound;
};

struct RouteConfig {
    std::vector<RuleConfig> rules;
    std::string final_outbound{"proxy"};
};

struct Config {
    LogConfig log;
    std::vector<InboundConfig> inbounds;
    std::vector<OutboundConfig> outbounds;
    RouteConfig route;

    static Config load_from_file(const std::string& path);
    static Config load_from_json_string(const std::string& json_str);
    void validate() const;
};

} // namespace vnexus::config
