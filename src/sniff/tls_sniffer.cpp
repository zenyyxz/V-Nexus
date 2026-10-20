#include "vnexus/sniff/tls_sniffer.hpp"
#include <cctype>

namespace vnexus::sniff {

namespace {
bool is_valid_domain_char(char c) {
    return std::isalnum(static_cast<unsigned char>(c)) || c == '.' || c == '-' || c == '_';
}

bool is_valid_domain(std::string_view domain) {
    if (domain.empty() || domain.size() > 253) return false;
    for (char c : domain) {
        if (!is_valid_domain_char(c)) return false;
    }
    return true;
}
} // namespace

SniffResult TlsSniffer::sniff(std::span<const uint8_t> buffer) const {
    SniffResult res;
    res.protocol = "tls";
    res.port = 443;

    // TLS Record Header: 5 bytes
    // Byte 0: 0x16 (Handshake)
    // Bytes 1-2: Version (0x0301, 0x0302, 0x0303, etc.)
    // Bytes 3-4: Record Length
    if (buffer.size() < 5) {
        return res;
    }

    if (buffer[0] != 0x16 || buffer[1] != 0x03) {
        return res; // Not a TLS handshake record
    }

    // Handshake header at byte 5
    // Byte 5: Handshake Type (0x01 = ClientHello)
    // Bytes 6-8: Handshake Length (24-bit uint)
    if (buffer.size() < 9) {
        return res;
    }

    if (buffer[5] != 0x01) {
        return res; // Not ClientHello
    }

    size_t handshake_len = (static_cast<size_t>(buffer[6]) << 16) |
                           (static_cast<size_t>(buffer[7]) << 8) |
                           static_cast<size_t>(buffer[8]);

    size_t total_avail = buffer.size();
    size_t handshake_end = std::min(total_avail, static_cast<size_t>(9 + handshake_len));

    // Client Version: 2 bytes (bytes 9-10)
    // Random: 32 bytes (bytes 11-42)
    size_t offset = 43;
    if (offset >= handshake_end) return res;

    // Session ID
    uint8_t session_id_len = buffer[offset++];
    offset += session_id_len;
    if (offset + 2 > handshake_end) return res;

    // Cipher Suites
    uint16_t cipher_suites_len = (static_cast<uint16_t>(buffer[offset]) << 8) | buffer[offset + 1];
    offset += 2 + cipher_suites_len;
    if (offset + 1 > handshake_end) return res;

    // Compression Methods
    uint8_t compression_methods_len = buffer[offset++];
    offset += compression_methods_len;

    // Check if extensions exist
    if (offset + 2 > handshake_end) return res;

    uint16_t extensions_len = (static_cast<uint16_t>(buffer[offset]) << 8) | buffer[offset + 1];
    offset += 2;

    size_t extensions_end = std::min(handshake_end, offset + extensions_len);

    // Parse extensions
    while (offset + 4 <= extensions_end) {
        uint16_t ext_type = (static_cast<uint16_t>(buffer[offset]) << 8) | buffer[offset + 1];
        uint16_t ext_len = (static_cast<uint16_t>(buffer[offset + 2]) << 8) | buffer[offset + 3];
        offset += 4;

        if (offset + ext_len > extensions_end) {
            break;
        }

        // Extension 0x0000: server_name (RFC 6066)
        if (ext_type == 0x0000) {
            if (ext_len < 2) break;

            uint16_t server_name_list_len = (static_cast<uint16_t>(buffer[offset]) << 8) | buffer[offset + 1];
            size_t list_offset = offset + 2;
            size_t list_end = std::min(offset + ext_len, list_offset + server_name_list_len);

            while (list_offset + 3 <= list_end) {
                uint8_t name_type = buffer[list_offset++];
                uint16_t name_len = (static_cast<uint16_t>(buffer[list_offset]) << 8) | buffer[list_offset + 1];
                list_offset += 2;

                if (list_offset + name_len > list_end) {
                    break;
                }

                // Name type 0: host_name
                if (name_type == 0x00) {
                    std::string sni(reinterpret_cast<const char*>(&buffer[list_offset]), name_len);
                    if (is_valid_domain(sni)) {
                        res.success = true;
                        res.domain = std::move(sni);
                        return res;
                    }
                }
                list_offset += name_len;
            }
        }

        offset += ext_len;
    }

    return res;
}

} // namespace vnexus::sniff
