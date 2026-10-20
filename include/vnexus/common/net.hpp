#pragma once

#include "vnexus/common/types.hpp"
#include <string>
#include <string_view>
#include <optional>
#include <asio.hpp>

namespace vnexus::net {

bool is_ipv4(std::string_view host);
bool is_ipv6(std::string_view host);
bool is_ip_address(std::string_view host);

AddressType detect_address_type(std::string_view host);
EndpointAddress parse_endpoint(std::string_view host_port, uint16_t default_port = 80);

// Host matching utilities
bool match_domain_suffix(std::string_view domain, std::string_view suffix);
bool match_domain_keyword(std::string_view domain, std::string_view keyword);

} // namespace vnexus::net
