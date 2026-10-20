#include "vnexus/router/router.hpp"
#include "vnexus/common/net.hpp"
#include "vnexus/common/log.hpp"
#include <asio.hpp>
#include <algorithm>

namespace vnexus::router {

Router::Router(config::RouteConfig config) : config_(std::move(config)) {}

bool Router::match_cidr(const std::string& ip_str, const std::string& cidr) {
    std::error_code ec;
    auto addr = asio::ip::make_address_v4(ip_str, ec);
    if (ec) return false;

    auto slash = cidr.find('/');
    if (slash == std::string::npos) {
        auto target = asio::ip::make_address_v4(cidr, ec);
        return !ec && addr == target;
    }

    auto net_ip = asio::ip::make_address_v4(cidr.substr(0, slash), ec);
    if (ec) return false;

    unsigned short prefix_len = static_cast<unsigned short>(std::stoul(cidr.substr(slash + 1)));
    if (prefix_len > 32) return false;

    uint32_t mask = prefix_len == 0 ? 0 : (~0u << (32 - prefix_len));
    return (addr.to_uint() & mask) == (net_ip.to_uint() & mask);
}

bool Router::match_rule(const config::RuleConfig& rule, const SessionContext& session) const {
    const auto& host = session.target_destination.host;
    uint16_t port = session.target_destination.port;

    // Domain full match
    if (!rule.domain_full.empty()) {
        bool matched = false;
        for (const auto& d : rule.domain_full) {
            if (host == d) {
                matched = true;
                break;
            }
        }
        if (!matched) return false;
    }

    // Domain suffix match
    if (!rule.domain_suffix.empty()) {
        bool matched = false;
        for (const auto& suffix : rule.domain_suffix) {
            if (net::match_domain_suffix(host, suffix)) {
                matched = true;
                break;
            }
        }
        if (!matched) return false;
    }

    // Domain keyword match
    if (!rule.domain_keyword.empty()) {
        bool matched = false;
        for (const auto& kw : rule.domain_keyword) {
            if (net::match_domain_keyword(host, kw)) {
                matched = true;
                break;
            }
        }
        if (!matched) return false;
    }

    // Port match
    if (!rule.port.empty()) {
        bool matched = false;
        for (uint16_t p : rule.port) {
            if (p == port) {
                matched = true;
                break;
            }
        }
        if (!matched) return false;
    }

    // Protocol match (sniffed)
    if (!rule.protocol.empty()) {
        bool matched = false;
        for (const auto& proto : rule.protocol) {
            if (session.sniffed_protocol == proto) {
                matched = true;
                break;
            }
        }
        if (!matched) return false;
    }

    // IP CIDR match (if host is an IP)
    if (!rule.ip_cidr.empty()) {
        if (!net::is_ipv4(host)) {
            return false;
        }
        bool matched = false;
        for (const auto& cidr : rule.ip_cidr) {
            if (match_cidr(host, cidr)) {
                matched = true;
                break;
            }
        }
        if (!matched) return false;
    }

    return true;
}

std::string Router::route(const SessionContext& session) const {
    for (const auto& rule : config_.rules) {
        if (match_rule(rule, session)) {
            VN_DEBUG("[router] matched rule targeting outbound '{}'", rule.outbound);
            return rule.outbound;
        }
    }
    VN_DEBUG("[router] no rule matched, falling back to final outbound '{}'", config_.final_outbound);
    return config_.final_outbound;
}

} // namespace vnexus::router
