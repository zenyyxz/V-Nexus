#pragma once

#include <cstdint>
#include <string>
#include <string_view>
#include <optional>
#include <vector>
#include <variant>
#include <asio.hpp>

namespace vnexus {

enum class AddressType : uint8_t {
    IPv4 = 0x01,
    Domain = 0x02,
    IPv6 = 0x03
};

enum class NetworkCommand : uint8_t {
    TCP = 0x01,
    UDP = 0x02,
    MUX = 0x03
};

struct EndpointAddress {
    AddressType type{AddressType::Domain};
    std::string host;
    uint16_t port{0};

    [[nodiscard]] std::string to_string() const {
        if (type == AddressType::IPv6) {
            return "[" + host + "]:" + std::to_string(port);
        }
        return host + ":" + std::to_string(port);
    }

    bool operator==(const EndpointAddress& other) const = default;
};

struct SniffResult {
    bool success{false};
    std::string protocol; // "tls", "http", "quic"
    std::string domain;
    uint16_t port{0};
};

struct SessionContext {
    uint64_t id{0};
    std::string inbound_tag;
    std::string outbound_tag;
    asio::ip::tcp::endpoint client_endpoint;
    EndpointAddress original_destination;
    EndpointAddress target_destination;
    
    // Sniffing info
    bool sniff_attempted{false};
    bool sniff_successful{false};
    std::string sniffed_protocol;
    std::string sniffed_domain;
    bool destination_overridden{false};

    // Stats
    size_t bytes_up{0};
    size_t bytes_down{0};

    [[nodiscard]] std::string info() const {
        std::string res = "[" + inbound_tag + " -> " + outbound_tag + "] " +
                          client_endpoint.address().to_string() + ":" + std::to_string(client_endpoint.port()) +
                          " -> " + target_destination.to_string();
        if (destination_overridden) {
            res += " (sniffed " + sniffed_protocol + ": " + sniffed_domain + ")";
        }
        return res;
    }
};

} // namespace vnexus
