#include "vnexus/common/uuid.hpp"
#include <openssl/rand.h>
#include <iomanip>
#include <sstream>
#include <cctype>

namespace vnexus {

namespace {
int hex_val(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}
} // namespace

std::optional<UUID> UUID::from_string(std::string_view str) {
    Bytes bytes{};
    size_t byte_idx = 0;
    int high_nibble = -1;

    for (char c : str) {
        if (c == '-') continue;
        int val = hex_val(c);
        if (val < 0) return std::nullopt;

        if (high_nibble < 0) {
            high_nibble = val;
        } else {
            if (byte_idx >= 16) return std::nullopt; // too long
            bytes[byte_idx++] = static_cast<uint8_t>((high_nibble << 4) | val);
            high_nibble = -1;
        }
    }

    if (byte_idx != 16 || high_nibble != -1) {
        return std::nullopt;
    }

    return UUID(bytes);
}

UUID UUID::generate_random() {
    Bytes b{};
    RAND_bytes(b.data(), static_cast<int>(b.size()));
    // Set version 4
    b[6] = static_cast<uint8_t>((b[6] & 0x0F) | 0x40);
    // Set variant RFC 4122
    b[8] = static_cast<uint8_t>((b[8] & 0x3F) | 0x80);
    return UUID(b);
}

std::string UUID::to_string() const {
    char buf[37];
    std::snprintf(buf, sizeof(buf),
        "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
        bytes_[0], bytes_[1], bytes_[2], bytes_[3],
        bytes_[4], bytes_[5],
        bytes_[6], bytes_[7],
        bytes_[8], bytes_[9],
        bytes_[10], bytes_[11], bytes_[12], bytes_[13], bytes_[14], bytes_[15]);
    return std::string(buf);
}

} // namespace vnexus
