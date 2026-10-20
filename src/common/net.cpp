#include "vnexus/common/net.hpp"
#include <system_error>
#include <algorithm>

namespace vnexus::net {

bool is_ipv4(std::string_view host) {
    std::error_code ec;
    std::ignore = asio::ip::make_address_v4(host, ec);
    return !ec;
}

bool is_ipv6(std::string_view host) {
    std::error_code ec;
    std::ignore = asio::ip::make_address_v6(host, ec);
    return !ec;
}

bool is_ip_address(std::string_view host) {
    std::error_code ec;
    std::ignore = asio::ip::make_address(host, ec);
    return !ec;
}

AddressType detect_address_type(std::string_view host) {
    if (is_ipv4(host)) return AddressType::IPv4;
    if (is_ipv6(host)) return AddressType::IPv6;
    return AddressType::Domain;
}

EndpointAddress parse_endpoint(std::string_view host_port, uint16_t default_port) {
    EndpointAddress ep;
    ep.port = default_port;

    if (host_port.empty()) {
        return ep;
    }

    if (host_port.front() == '[') {
        // IPv6 bracket notation: [2001:db8::1]:443
        auto closing = host_port.find(']');
        if (closing != std::string_view::npos) {
            ep.host = std::string(host_port.substr(1, closing - 1));
            ep.type = AddressType::IPv6;
            if (closing + 1 < host_port.size() && host_port[closing + 1] == ':') {
                ep.port = static_cast<uint16_t>(std::stoul(std::string(host_port.substr(closing + 2))));
            }
            return ep;
        }
    }

    auto colon = host_port.rfind(':');
    if (colon != std::string_view::npos && host_port.find(':') == colon) {
        // Single colon, host:port
        ep.host = std::string(host_port.substr(0, colon));
        ep.port = static_cast<uint16_t>(std::stoul(std::string(host_port.substr(colon + 1))));
        ep.type = detect_address_type(ep.host);
    } else {
        // No colon or IPv6 without brackets
        ep.host = std::string(host_port);
        ep.type = detect_address_type(ep.host);
    }

    return ep;
}

bool match_domain_suffix(std::string_view domain, std::string_view suffix) {
    if (suffix.empty() || domain.empty()) return false;
    
    // Normalize suffix: ensure leading dot comparison or exact match
    if (suffix.front() == '.') {
        if (domain.size() < suffix.size()) return false;
        // Case-insensitive suffix match
        auto d_sub = domain.substr(domain.size() - suffix.size());
        return std::equal(d_sub.begin(), d_sub.end(), suffix.begin(), suffix.end(),
                          [](char a, char b) { return std::tolower(a) == std::tolower(b); });
    } else {
        if (domain.size() == suffix.size()) {
            return std::equal(domain.begin(), domain.end(), suffix.begin(), suffix.end(),
                              [](char a, char b) { return std::tolower(a) == std::tolower(b); });
        }
        if (domain.size() > suffix.size() && domain[domain.size() - suffix.size() - 1] == '.') {
            auto d_sub = domain.substr(domain.size() - suffix.size());
            return std::equal(d_sub.begin(), d_sub.end(), suffix.begin(), suffix.end(),
                              [](char a, char b) { return std::tolower(a) == std::tolower(b); });
        }
    }
    return false;
}

bool match_domain_keyword(std::string_view domain, std::string_view keyword) {
    if (keyword.empty() || domain.empty()) return false;
    auto it = std::search(
        domain.begin(), domain.end(),
        keyword.begin(), keyword.end(),
        [](char a, char b) { return std::tolower(a) == std::tolower(b); }
    );
    return it != domain.end();
}

} // namespace vnexus::net
