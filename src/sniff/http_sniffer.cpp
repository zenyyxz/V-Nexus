#include "vnexus/sniff/http_sniffer.hpp"
#include <string_view>
#include <algorithm>
#include <cctype>

namespace vnexus::sniff {

namespace {
bool starts_with_ci(std::string_view str, std::string_view prefix) {
    if (str.size() < prefix.size()) return false;
    return std::equal(prefix.begin(), prefix.end(), str.begin(), [](char a, char b) {
        return std::tolower(static_cast<unsigned char>(a)) == std::tolower(static_cast<unsigned char>(b));
    });
}

bool is_http_method(std::string_view s) {
    static const char* methods[] = {
        "GET ", "POST ", "HEAD ", "PUT ", "DELETE ", "OPTIONS ", "CONNECT ", "PATCH ", "TRACE "
    };
    for (const char* m : methods) {
        if (s.starts_with(m)) return true;
    }
    return false;
}
} // namespace

SniffResult HttpSniffer::sniff(std::span<const uint8_t> buffer) const {
    SniffResult res;
    res.protocol = "http";
    res.port = 80;

    if (buffer.size() < 10) return res;

    std::string_view text(reinterpret_cast<const char*>(buffer.data()), buffer.size());
    if (!is_http_method(text)) {
        return res;
    }

    // Search for "Host:" case-insensitively
    size_t pos = 0;
    while (pos < text.size()) {
        auto next_line = text.find('\n', pos);
        std::string_view line = (next_line == std::string_view::npos) 
            ? text.substr(pos) 
            : text.substr(pos, next_line - pos);

        if (!line.empty() && line.back() == '\r') {
            line.remove_suffix(1);
        }

        // Empty line means end of HTTP headers
        if (line.empty()) {
            break;
        }

        if (starts_with_ci(line, "host:")) {
            auto val = line.substr(5);
            // Trim whitespace
            while (!val.empty() && (val.front() == ' ' || val.front() == '\t')) val.remove_prefix(1);
            while (!val.empty() && (val.back() == ' ' || val.back() == '\t')) val.remove_suffix(1);

            if (!val.empty()) {
                // Check if port is attached: example.com:8080 or [::1]:8080
                uint16_t port = 80;
                std::string host;
                if (val.front() == '[') {
                    auto close_brk = val.find(']');
                    if (close_brk != std::string_view::npos) {
                        host = std::string(val.substr(1, close_brk - 1));
                        if (close_brk + 1 < val.size() && val[close_brk + 1] == ':') {
                            port = static_cast<uint16_t>(std::stoul(std::string(val.substr(close_brk + 2))));
                        }
                    } else {
                        host = std::string(val);
                    }
                } else {
                    auto colon = val.rfind(':');
                    if (colon != std::string_view::npos) {
                        host = std::string(val.substr(0, colon));
                        try {
                            port = static_cast<uint16_t>(std::stoul(std::string(val.substr(colon + 1))));
                        } catch (...) {
                            port = 80;
                        }
                    } else {
                        host = std::string(val);
                    }
                }

                res.success = true;
                res.domain = std::move(host);
                res.port = port;
                return res;
            }
        }

        if (next_line == std::string_view::npos) break;
        pos = next_line + 1;
    }

    return res;
}

} // namespace vnexus::sniff
