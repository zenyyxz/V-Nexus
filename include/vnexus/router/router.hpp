#pragma once

#include "vnexus/config/config.hpp"
#include "vnexus/common/types.hpp"
#include <string>
#include <vector>

namespace vnexus::router {

class Router {
public:
    explicit Router(config::RouteConfig config);

    [[nodiscard]] std::string route(const SessionContext& session) const;

private:
    config::RouteConfig config_;
    
    [[nodiscard]] bool match_rule(const config::RuleConfig& rule, const SessionContext& session) const;
    [[nodiscard]] static bool match_cidr(const std::string& ip_str, const std::string& cidr);
};

} // namespace vnexus::router
