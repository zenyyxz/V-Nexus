#include <catch2/catch_all.hpp>
#include "vnexus/outbound/vless_outbound.hpp"
#include "vnexus/common/uuid.hpp"

TEST_CASE("UUID parsing and formatting", "[uuid]") {
    SECTION("Valid standard UUID") {
        std::string str = "27848739-7e62-4138-9fd3-098a63964b6b";
        auto uuid = vnexus::UUID::from_string(str);
        REQUIRE(uuid.has_value());
        REQUIRE(uuid->to_string() == str);
    }

    SECTION("UUID without hyphens") {
        std::string str = "278487397e6241389fd3098a63964b6b";
        auto uuid = vnexus::UUID::from_string(str);
        REQUIRE(uuid.has_value());
        REQUIRE(uuid->to_string() == "27848739-7e62-4138-9fd3-098a63964b6b");
    }

    SECTION("Invalid UUID strings") {
        REQUIRE_FALSE(vnexus::UUID::from_string("not-a-uuid").has_value());
        REQUIRE_FALSE(vnexus::UUID::from_string("27848739-7e62-4138-9fd3").has_value());
        REQUIRE_FALSE(vnexus::UUID::from_string("27848739-7e62-4138-9fd3-098a63964b6b-extra").has_value());
        REQUIRE_FALSE(vnexus::UUID::from_string("zzzzzzzz-7e62-4138-9fd3-098a63964b6b").has_value());
    }

    SECTION("Random UUID generation") {
        auto u1 = vnexus::UUID::generate_random();
        auto u2 = vnexus::UUID::generate_random();
        REQUIRE(u1 != u2);
        REQUIRE(u1.to_string().size() == 36);
        REQUIRE(u1.bytes()[6] >> 4 == 4); // UUID v4
    }
}

TEST_CASE("VLESS Request Header Serialization", "[vless]") {
    auto uuid = *vnexus::UUID::from_string("27848739-7e62-4138-9fd3-098a63964b6b");

    SECTION("IPv4 Destination") {
        vnexus::EndpointAddress ep{
            .type = vnexus::AddressType::IPv4,
            .host = "1.1.1.1",
            .port = 443
        };

        auto hdr = vnexus::outbound::VlessOutbound::build_request_header(uuid, ep);
        REQUIRE(hdr.size() == 1 + 16 + 1 + 1 + 2 + 1 + 4);
        REQUIRE(hdr[0] == 0x00); // Version
        
        // UUID bytes
        REQUIRE(hdr[1] == 0x27);
        REQUIRE(hdr[2] == 0x84);

        REQUIRE(hdr[17] == 0x00); // Addons len
        REQUIRE(hdr[18] == 0x01); // Command TCP
        REQUIRE(hdr[19] == 0x01); // Port 443 high byte
        REQUIRE(hdr[20] == 0xBB); // Port 443 low byte
        REQUIRE(hdr[21] == 0x01); // IPv4 type
        REQUIRE(hdr[22] == 1);
        REQUIRE(hdr[23] == 1);
        REQUIRE(hdr[24] == 1);
        REQUIRE(hdr[25] == 1);
    }

    SECTION("Domain Destination") {
        std::string domain = "example.com";
        vnexus::EndpointAddress ep{
            .type = vnexus::AddressType::Domain,
            .host = domain,
            .port = 80
        };

        auto hdr = vnexus::outbound::VlessOutbound::build_request_header(uuid, ep);
        REQUIRE(hdr[0] == 0x00);
        REQUIRE(hdr[17] == 0x00);
        REQUIRE(hdr[18] == 0x01);
        REQUIRE(hdr[19] == 0x00); // Port 80 high byte
        REQUIRE(hdr[20] == 80);   // Port 80 low byte
        REQUIRE(hdr[21] == 0x02); // Domain type
        REQUIRE(hdr[22] == domain.size());

        std::string extracted(hdr.begin() + 23, hdr.begin() + 23 + domain.size());
        REQUIRE(extracted == domain);
    }

    SECTION("IPv6 Destination") {
        vnexus::EndpointAddress ep{
            .type = vnexus::AddressType::IPv6,
            .host = "2001:db8::1",
            .port = 8443
        };

        auto hdr = vnexus::outbound::VlessOutbound::build_request_header(uuid, ep);
        REQUIRE(hdr[21] == 0x03); // IPv6 type
        REQUIRE(hdr.size() == 1 + 16 + 1 + 1 + 2 + 1 + 16);
    }
}
