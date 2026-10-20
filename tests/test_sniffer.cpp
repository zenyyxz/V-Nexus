#include <catch2/catch_all.hpp>
#include "vnexus/sniff/tls_sniffer.hpp"
#include "vnexus/sniff/http_sniffer.hpp"
#include "vnexus/sniff/sniffer.hpp"

namespace {

std::vector<uint8_t> create_tls_client_hello(const std::string& sni) {
    std::vector<uint8_t> body;

    // Client Version: TLS 1.2 (0x0303)
    body.push_back(0x03);
    body.push_back(0x03);

    // Random: 32 bytes
    for (int i = 0; i < 32; ++i) body.push_back(static_cast<uint8_t>(i));

    // Session ID: 0 length
    body.push_back(0x00);

    // Cipher Suites: 2 bytes len + 2 bytes suite
    body.push_back(0x00);
    body.push_back(0x02);
    body.push_back(0x13);
    body.push_back(0x01);

    // Compression Methods: 1 byte len + 1 byte (null compression)
    body.push_back(0x01);
    body.push_back(0x00);

    // Extensions
    std::vector<uint8_t> exts;
    // SNI extension: type 0x0000
    exts.push_back(0x00);
    exts.push_back(0x00);

    uint16_t sni_len = static_cast<uint16_t>(sni.size());
    uint16_t list_len = sni_len + 3;
    uint16_t ext_len = list_len + 2;

    exts.push_back(static_cast<uint8_t>(ext_len >> 8));
    exts.push_back(static_cast<uint8_t>(ext_len & 0xFF));

    exts.push_back(static_cast<uint8_t>(list_len >> 8));
    exts.push_back(static_cast<uint8_t>(list_len & 0xFF));

    // Name type 0: host_name
    exts.push_back(0x00);
    exts.push_back(static_cast<uint8_t>(sni_len >> 8));
    exts.push_back(static_cast<uint8_t>(sni_len & 0xFF));
    exts.insert(exts.end(), sni.begin(), sni.end());

    // Append extensions length to body
    uint16_t total_exts_len = static_cast<uint16_t>(exts.size());
    body.push_back(static_cast<uint8_t>(total_exts_len >> 8));
    body.push_back(static_cast<uint8_t>(total_exts_len & 0xFF));
    body.insert(body.end(), exts.begin(), exts.end());

    // Handshake header
    std::vector<uint8_t> packet;
    // Record header: 0x16 0x03 0x01 (TLS Handshake)
    packet.push_back(0x16);
    packet.push_back(0x03);
    packet.push_back(0x01);

    size_t handshake_len = body.size() + 4; // 1 byte type + 3 bytes len
    size_t record_len = handshake_len;

    packet.push_back(static_cast<uint8_t>(record_len >> 8));
    packet.push_back(static_cast<uint8_t>(record_len & 0xFF));

    // Handshake: 0x01 ClientHello
    packet.push_back(0x01);
    packet.push_back(static_cast<uint8_t>((body.size() >> 16) & 0xFF));
    packet.push_back(static_cast<uint8_t>((body.size() >> 8) & 0xFF));
    packet.push_back(static_cast<uint8_t>(body.size() & 0xFF));

    packet.insert(packet.end(), body.begin(), body.end());
    return packet;
}

} // namespace

TEST_CASE("TLS SNI Sniffer correctly extracts SNI from ClientHello", "[sniffer][tls]") {
    vnexus::sniff::TlsSniffer sniffer;

    SECTION("Valid ClientHello with google.com") {
        auto pkt = create_tls_client_hello("google.com");
        auto res = sniffer.sniff(pkt);
        REQUIRE(res.success);
        REQUIRE(res.protocol == "tls");
        REQUIRE(res.domain == "google.com");
        REQUIRE(res.port == 443);
    }

    SECTION("Valid ClientHello with subdomain") {
        auto pkt = create_tls_client_hello("chat.openai.com");
        auto res = sniffer.sniff(pkt);
        REQUIRE(res.success);
        REQUIRE(res.protocol == "tls");
        REQUIRE(res.domain == "chat.openai.com");
    }

    SECTION("Corrupted or incomplete data") {
        std::vector<uint8_t> short_pkt = {0x16, 0x03, 0x01};
        auto res = sniffer.sniff(short_pkt);
        REQUIRE_FALSE(res.success);
    }

    SECTION("Non-TLS packet") {
        std::vector<uint8_t> random_bytes = {0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09};
        auto res = sniffer.sniff(random_bytes);
        REQUIRE_FALSE(res.success);
    }
}

TEST_CASE("HTTP Host Sniffer correctly extracts host", "[sniffer][http]") {
    vnexus::sniff::HttpSniffer sniffer;

    SECTION("Standard HTTP GET with Host") {
        std::string req = "GET /index.html HTTP/1.1\r\nHost: example.org\r\nUser-Agent: curl/7.88.1\r\n\r\n";
        std::vector<uint8_t> buf(req.begin(), req.end());
        auto res = sniffer.sniff(buf);
        REQUIRE(res.success);
        REQUIRE(res.protocol == "http");
        REQUIRE(res.domain == "example.org");
        REQUIRE(res.port == 80);
    }

    SECTION("HTTP POST with custom port in Host") {
        std::string req = "POST /api/v1 HTTP/1.1\r\nHost: api.service.io:8080\r\nContent-Length: 0\r\n\r\n";
        std::vector<uint8_t> buf(req.begin(), req.end());
        auto res = sniffer.sniff(buf);
        REQUIRE(res.success);
        REQUIRE(res.protocol == "http");
        REQUIRE(res.domain == "api.service.io");
        REQUIRE(res.port == 8080);
    }

    SECTION("Case insensitive host header") {
        std::string req = "GET / HTTP/1.1\r\nhost: lowercase.com\r\n\r\n";
        std::vector<uint8_t> buf(req.begin(), req.end());
        auto res = sniffer.sniff(buf);
        REQUIRE(res.success);
        REQUIRE(res.domain == "lowercase.com");
    }
}

TEST_CASE("Composite Sniffer dispatches between TLS and HTTP", "[sniffer][composite]") {
    vnexus::sniff::CompositeSniffer sniffer;

    auto tls_pkt = create_tls_client_hello("github.com");
    auto res_tls = sniffer.sniff(tls_pkt);
    REQUIRE(res_tls.success);
    REQUIRE(res_tls.protocol == "tls");
    REQUIRE(res_tls.domain == "github.com");

    std::string http_req = "GET / HTTP/1.1\r\nHost: news.ycombinator.com\r\n\r\n";
    std::vector<uint8_t> http_buf(http_req.begin(), http_req.end());
    auto res_http = sniffer.sniff(http_buf);
    REQUIRE(res_http.success);
    REQUIRE(res_http.protocol == "http");
    REQUIRE(res_http.domain == "news.ycombinator.com");
}
