#include "vnexus/config/config.hpp"
#include <nlohmann/json.hpp>
#include <fstream>
#include <sstream>
#include <stdexcept>

using json = nlohmann::json;

namespace vnexus::config {

namespace {
template <typename T>
T get_field_or(const json& j, const std::string& key, const T& default_val) {
    if (j.contains(key) && !j[key].is_null()) {
        try {
            return j[key].get<T>();
        } catch (...) {
            return default_val;
        }
    }
    return default_val;
}
} // namespace

Config Config::load_from_file(const std::string& path) {
    std::ifstream file(path);
    if (!file.is_open()) {
        throw std::runtime_error("Failed to open configuration file: " + path);
    }
    std::stringstream buffer;
    buffer << file.rdbuf();
    return load_from_json_string(buffer.str());
}

Config Config::load_from_json_string(const std::string& json_str) {
    Config cfg;
    json j;
    try {
        j = json::parse(json_str);
    } catch (const json::parse_error& e) {
        throw std::runtime_error("JSON parse error: " + std::string(e.what()));
    }

    // Log section
    if (j.contains("log") && j["log"].is_object()) {
        cfg.log.level = get_field_or(j["log"], "level", std::string("info"));
        cfg.log.output = get_field_or(j["log"], "output", std::string(""));
        cfg.log.timestamp = get_field_or(j["log"], "timestamp", true);
    }

    // Inbounds
    if (j.contains("inbounds") && j["inbounds"].is_array()) {
        for (const auto& in_j : j["inbounds"]) {
            InboundConfig in_cfg;
            in_cfg.type = get_field_or(in_j, "type", std::string("mixed"));
            in_cfg.tag = get_field_or(in_j, "tag", in_cfg.type + "-in");
            in_cfg.listen = get_field_or(in_j, "listen", std::string("127.0.0.1"));
            in_cfg.listen_port = get_field_or(in_j, "listen_port", static_cast<uint16_t>(10808));
            in_cfg.sniff = get_field_or(in_j, "sniff", true);
            in_cfg.sniff_override_destination = get_field_or(in_j, "sniff_override_destination", true);
            in_cfg.sniff_timeout_ms = get_field_or(in_j, "sniff_timeout_ms", 300u);

            if (in_j.contains("sniff_protocols") && in_j["sniff_protocols"].is_array()) {
                in_cfg.sniff_protocols = in_j["sniff_protocols"].get<std::vector<std::string>>();
            }

            if (in_cfg.type == "tun") {
                in_cfg.tun.interface_name = get_field_or(in_j, "interface_name", std::string("zen-tun"));
                in_cfg.tun.mtu = get_field_or(in_j, "mtu", 1400u);
                in_cfg.tun.auto_route = get_field_or(in_j, "auto_route", true);
                in_cfg.tun.strict_route = get_field_or(in_j, "strict_route", true);
                in_cfg.tun.stack = get_field_or(in_j, "stack", std::string("system"));

                if (in_j.contains("address")) {
                    if (in_j["address"].is_array() && !in_j["address"].empty()) {
                        in_cfg.tun.address = in_j["address"][0].get<std::string>();
                    } else if (in_j["address"].is_string()) {
                        in_cfg.tun.address = in_j["address"].get<std::string>();
                    }
                }

                if (in_j.contains("route_exclude_address") && in_j["route_exclude_address"].is_array()) {
                    in_cfg.tun.route_exclude_address = in_j["route_exclude_address"].get<std::vector<std::string>>();
                }
            }
            cfg.inbounds.push_back(in_cfg);
        }
    }

    // Outbounds
    if (j.contains("outbounds") && j["outbounds"].is_array()) {
        for (const auto& out_j : j["outbounds"]) {
            OutboundConfig out_cfg;
            out_cfg.type = get_field_or(out_j, "type", std::string("vless"));
            out_cfg.tag = get_field_or(out_j, "tag", out_cfg.type);

            if (out_cfg.type == "vless") {
                out_cfg.server = get_field_or(out_j, "server", std::string(""));
                out_cfg.server_port = get_field_or(out_j, "server_port", static_cast<uint16_t>(443));
                out_cfg.uuid_str = get_field_or(out_j, "uuid", std::string(""));
                out_cfg.network = get_field_or(out_j, "network", std::string("tcp"));

                if (!out_cfg.uuid_str.empty()) {
                    auto parsed_uuid = UUID::from_string(out_cfg.uuid_str);
                    if (!parsed_uuid) {
                        throw std::runtime_error("Invalid UUID in outbound '" + out_cfg.tag + "': " + out_cfg.uuid_str);
                    }
                    out_cfg.uuid = parsed_uuid;
                }

                if (out_j.contains("tls") && out_j["tls"].is_object()) {
                    const auto& tls_j = out_j["tls"];
                    out_cfg.tls.enabled = get_field_or(tls_j, "enabled", false);
                    out_cfg.tls.server_name = get_field_or(tls_j, "server_name", out_cfg.server);
                    out_cfg.tls.insecure = get_field_or(tls_j, "insecure", false);
                    if (tls_j.contains("alpn") && tls_j["alpn"].is_array()) {
                        out_cfg.tls.alpn = tls_j["alpn"].get<std::vector<std::string>>();
                    }
                }
            }
            cfg.outbounds.push_back(out_cfg);
        }
    }

    // Route
    if (j.contains("route") && j["route"].is_object()) {
        const auto& r_j = j["route"];
        cfg.route.final_outbound = get_field_or(r_j, "final", std::string("proxy"));

        if (r_j.contains("rules") && r_j["rules"].is_array()) {
            for (const auto& rule_j : r_j["rules"]) {
                RuleConfig rule;
                rule.outbound = get_field_or(rule_j, "outbound", std::string(""));
                
                if (rule_j.contains("domain_suffix") && rule_j["domain_suffix"].is_array()) {
                    rule.domain_suffix = rule_j["domain_suffix"].get<std::vector<std::string>>();
                }
                if (rule_j.contains("domain_keyword") && rule_j["domain_keyword"].is_array()) {
                    rule.domain_keyword = rule_j["domain_keyword"].get<std::vector<std::string>>();
                }
                if (rule_j.contains("domain_full") && rule_j["domain_full"].is_array()) {
                    rule.domain_full = rule_j["domain_full"].get<std::vector<std::string>>();
                }
                if (rule_j.contains("ip_cidr") && rule_j["ip_cidr"].is_array()) {
                    rule.ip_cidr = rule_j["ip_cidr"].get<std::vector<std::string>>();
                }
                if (rule_j.contains("port") && rule_j["port"].is_array()) {
                    rule.port = rule_j["port"].get<std::vector<uint16_t>>();
                }
                if (rule_j.contains("protocol") && rule_j["protocol"].is_array()) {
                    rule.protocol = rule_j["protocol"].get<std::vector<std::string>>();
                }
                cfg.route.rules.push_back(rule);
            }
        }
    }

    cfg.validate();
    return cfg;
}

void Config::validate() const {
    if (inbounds.empty()) {
        throw std::runtime_error("Configuration error: At least one inbound must be specified.");
    }
    if (outbounds.empty()) {
        throw std::runtime_error("Configuration error: At least one outbound must be specified.");
    }

    for (const auto& out : outbounds) {
        if (out.type == "vless") {
            if (out.server.empty()) {
                throw std::runtime_error("Configuration error: Outbound '" + out.tag + "' is missing server address.");
            }
            if (!out.uuid.has_value()) {
                throw std::runtime_error("Configuration error: Outbound '" + out.tag + "' has invalid or missing UUID.");
            }
        }
    }
}

} // namespace vnexus::config
