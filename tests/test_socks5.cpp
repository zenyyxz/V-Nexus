#include <catch2/catch_all.hpp>
#include "vnexus/common/net.hpp"
#include "vnexus/common/types.hpp"

TEST_CASE("Network and Endpoint Parsing", "[net]") {
    SECTION("Parse domain:port") {
        auto ep = vnexus::net::parse_endpoint("example.com:443");
        REQUIRE(ep.host == "example.com");
        REQUIRE(ep.port == 443);
        REQUIRE(ep.type == vnexus::AddressType::Domain);
        REQUIRE(ep.to_string() == "example.com:443");
    }

    SECTION("Parse IPv4:port") {
        auto ep = vnexus::net::parse_endpoint("192.168.1.1:8080");
        REQUIRE(ep.host == "192.168.1.1");
        REQUIRE(ep.port == 8080);
        REQUIRE(ep.type == vnexus::AddressType::IPv4);
        REQUIRE(ep.to_string() == "192.168.1.1:8080");
    }

    SECTION("Parse IPv6:port in brackets") {
        auto ep = vnexus::net::parse_endpoint("[2001:db8::1]:80");
        REQUIRE(ep.host == "2001:db8::1");
        REQUIRE(ep.port == 80);
        REQUIRE(ep.type == vnexus::AddressType::IPv6);
        REQUIRE(ep.to_string() == "[2001:db8::1]:80");
    }

    SECTION("Domain suffix matching") {
        REQUIRE(vnexus::net::match_domain_suffix("sub.domain.com", ".com"));
        REQUIRE(vnexus::net::match_domain_suffix("sub.domain.com", "domain.com"));
        REQUIRE(vnexus::net::match_domain_suffix("sub.domain.com", ".domain.com"));
        REQUIRE_FALSE(vnexus::net::match_domain_suffix("fakecom.org", ".com"));
    }

    SECTION("Domain keyword matching") {
        REQUIRE(vnexus::net::match_domain_keyword("cdn.mytracker.net", "tracker"));
        REQUIRE(vnexus::net::match_domain_keyword("VIDEO.GOOGLE.COM", "google"));
        REQUIRE_FALSE(vnexus::net::match_domain_keyword("apple.com", "google"));
    }
}
