#include <catch2/catch_all.hpp>
#include "vnexus/outbound/vmess_outbound.hpp"
#include "vnexus/common/uuid.hpp"

TEST_CASE("VMess FNV1a Checksum", "[vmess]") {
    SECTION("Empty input") {
        uint32_t hash = vnexus::outbound::VmessOutbound::fnv1a(nullptr, 0);
        REQUIRE(hash == 2166136261u);
    }

    SECTION("Deterministic hashing") {
        std::vector<uint8_t> data = {0x01, 0x02, 0x03, 0x04};
        uint32_t h1 = vnexus::outbound::VmessOutbound::fnv1a(data.data(), data.size());
        uint32_t h2 = vnexus::outbound::VmessOutbound::fnv1a(data.data(), data.size());
        REQUIRE(h1 == h2);
        REQUIRE(h1 != 0);
    }
}

TEST_CASE("VMess Auth ID Computation", "[vmess]") {
    auto uuid = *vnexus::UUID::from_string("c4bd98c1-b83c-4b32-a086-40f67a7ec3ff");
    int64_t ts = 1700000000;

    auto auth1 = vnexus::outbound::VmessOutbound::compute_auth_id(uuid, ts);
    auto auth2 = vnexus::outbound::VmessOutbound::compute_auth_id(uuid, ts);
    REQUIRE(auth1 == auth2);
    REQUIRE(auth1.size() == 16);

    // Different timestamp produces different auth ID
    auto auth3 = vnexus::outbound::VmessOutbound::compute_auth_id(uuid, ts + 1);
    REQUIRE(auth1 != auth3);
}

TEST_CASE("VMess Request Header Serialization", "[vmess]") {
    auto uuid = *vnexus::UUID::from_string("27848739-7e62-4138-9fd3-098a63964b6b");
    uint8_t v_byte = 0x5A;
    int64_t ts = 1700000000;

    SECTION("IPv4 Destination") {
        vnexus::EndpointAddress ep{
            .type = vnexus::AddressType::IPv4,
            .host = "1.1.1.1",
            .port = 443
        };

        auto hdr = vnexus::outbound::VmessOutbound::build_request_header(
            uuid, ep, v_byte, vnexus::outbound::VmessSecurity::None, vnexus::NetworkCommand::TCP, ts
        );

        // Header must be at least 16 (auth) + 1 (ver) + 16 (iv) + 16 (key) + 1 (v) + 1 (opt) + 1 (sec) + 1 (res) + 1 (cmd) + 2 (port) + 1 (addr_type) + 4 (ipv4) + 4 (fnv1a)
        REQUIRE(hdr.size() >= 16 + 1 + 16 + 16 + 1 + 1 + 1 + 1 + 1 + 2 + 1 + 4 + 4);

        // Auth ID is first 16 bytes
        auto expected_auth = vnexus::outbound::VmessOutbound::compute_auth_id(uuid, ts);
        REQUIRE(std::equal(hdr.begin(), hdr.begin() + 16, expected_auth.begin()));

        // Command header starts at offset 16
        REQUIRE(hdr[16] == 0x01); // Version 1
        REQUIRE(hdr[16 + 33] == v_byte); // V byte
        REQUIRE(hdr[16 + 34] == 0x01);   // Opt chunk streaming
        REQUIRE((hdr[16 + 35] & 0x0F) == static_cast<uint8_t>(vnexus::outbound::VmessSecurity::None));
        REQUIRE(hdr[16 + 37] == 0x01); // Command TCP
        REQUIRE(hdr[16 + 38] == 0x01); // Port 443 high byte
        REQUIRE(hdr[16 + 39] == 0xBB); // Port 443 low byte
        REQUIRE(hdr[16 + 40] == 0x01); // IPv4 type
        REQUIRE(hdr[16 + 41] == 1);
        REQUIRE(hdr[16 + 42] == 1);
        REQUIRE(hdr[16 + 43] == 1);
        REQUIRE(hdr[16 + 44] == 1);
    }

    SECTION("Domain Destination") {
        std::string domain = "example.com";
        vnexus::EndpointAddress ep{
            .type = vnexus::AddressType::Domain,
            .host = domain,
            .port = 80
        };

        auto hdr = vnexus::outbound::VmessOutbound::build_request_header(
            uuid, ep, v_byte, vnexus::outbound::VmessSecurity::None, vnexus::NetworkCommand::TCP, ts
        );

        REQUIRE(hdr[16] == 0x01); // Version 1
        REQUIRE(hdr[16 + 38] == 0x00); // Port 80 high byte
        REQUIRE(hdr[16 + 39] == 80);   // Port 80 low byte
        REQUIRE(hdr[16 + 40] == 0x02); // Domain type
        REQUIRE(hdr[16 + 41] == domain.size());

        std::string extracted(hdr.begin() + 16 + 42, hdr.begin() + 16 + 42 + domain.size());
        REQUIRE(extracted == domain);
    }
}
