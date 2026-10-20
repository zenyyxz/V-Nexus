#include <catch2/catch_all.hpp>
#include "vnexus/router/router.hpp"
#include "vnexus/config/config.hpp"

TEST_CASE("Router Rule Matching", "[router]") {
    vnexus::config::RouteConfig cfg;
    cfg.final_outbound = "proxy";

    vnexus::config::RuleConfig rule1;
    rule1.domain_suffix = {".local", ".lan", ".cn"};
    rule1.outbound = "direct";
    cfg.rules.push_back(rule1);

    vnexus::config::RuleConfig rule2;
    rule2.domain_keyword = {"adservice", "analytics"};
    rule2.outbound = "block";
    cfg.rules.push_back(rule2);

    vnexus::config::RuleConfig rule3;
    rule3.ip_cidr = {"192.168.0.0/16", "10.0.0.0/8", "127.0.0.0/8"};
    rule3.outbound = "direct";
    cfg.rules.push_back(rule3);

    vnexus::router::Router router(cfg);

    SECTION("Domain suffix match") {
        vnexus::SessionContext s1;
        s1.target_destination.host = "server.home.lan";
        s1.target_destination.port = 80;
        REQUIRE(router.route(s1) == "direct");

        vnexus::SessionContext s2;
        s2.target_destination.host = "baidu.cn";
        REQUIRE(router.route(s2) == "direct");
    }

    SECTION("Domain keyword match") {
        vnexus::SessionContext s;
        s.target_destination.host = "google-analytics.com";
        REQUIRE(router.route(s) == "block");
    }

    SECTION("IP CIDR match") {
        vnexus::SessionContext s1;
        s1.target_destination.host = "192.168.1.100";
        REQUIRE(router.route(s1) == "direct");

        vnexus::SessionContext s2;
        s2.target_destination.host = "10.200.1.5";
        REQUIRE(router.route(s2) == "direct");

        vnexus::SessionContext s3;
        s3.target_destination.host = "8.8.8.8";
        REQUIRE(router.route(s3) == "proxy"); // falls back to final
    }

    SECTION("Default final outbound") {
        vnexus::SessionContext s;
        s.target_destination.host = "cloudflare.com";
        REQUIRE(router.route(s) == "proxy");
    }
}
