#pragma once
#include <nlohmann/json.hpp>
#include <string>
#include <vector>
#include <fstream>
#include <iostream>
#include <cstdio>
#include <arpa/inet.h>
#include <algorithm>

using json = nlohmann::json;

namespace Vpn {
    /**
     * @brief Represents a VPN Profile (VLESS)
     */
    struct Profile {
        std::string name;
        std::string server;
        int port;
        std::string uuid;
        std::string sni;
        bool active = false;

        json to_json() const {
            return {{"name", name}, {"server", server}, {"port", port}, {"uuid", uuid}, {"sni", sni}, {"active", active}};
        }

        static Profile from_json(const json& j) {
            // Handle transition from legacy shell-script based profiles
            if (j.contains("content")) {
                return {"Legacy-Profile", "0.0.0.0", 443, "", "aka.ms", false};
            }
            return {
                j.value("name", "Unknown"), 
                j.value("server", "0.0.0.0"), 
                j.value("port", 443), 
                j.value("uuid", ""), 
                j.value("sni", "aka.ms"), 
                j.value("active", false)
            };
        }
    };

    /**
     * @brief Manages the sing-box JSON configuration generation
     */
    struct Config {
        std::string server_ip = "161.118.248.52";
        int server_port = 443;
        std::string uuid = "c4bd98c1-b83c-4b32-a086-40f67a7ec3ff";
        std::string sni = "aka.ms";
        int mtu = 1400; // 1400 is safer for most mobile networks
        std::string tun_stack = "system";
        bool strict_route = true;

        /**
         * @brief Checks if a string is a valid IPv4 address
         */
        bool is_ip(const std::string& host) const {
            struct sockaddr_in sa;
            return inet_pton(AF_INET, host.c_str(), &(sa.sin_addr)) != 0;
        }

        /**
         * @brief Loads the current state from an existing config.json to preserve UI changes
         */
        void load_from_json(const std::string& path) {
            std::ifstream f(path);
            if (!f.is_open()) return;
            try {
                json j = json::parse(f);
                if (j.contains("outbounds")) {
                    for (auto& out : j["outbounds"]) {
                        if (out.value("tag", "") == "proxy") {
                            server_ip = out.value("server", server_ip);
                            server_port = out.value("server_port", server_port);
                            uuid = out.value("uuid", uuid);
                            if (out.contains("tls")) {
                                sni = out["tls"].value("server_name", sni);
                            }
                        }
                    }
                }
            } catch (...) {}
        }

        /**
         * @brief The core "Zero Data" configuration generator.
         * This creates a sing-box config optimized for environments where 
         * standard DNS is blocked but certain SNIs (like aka.ms) are free.
         */
        json generate_singbox_json() const {
            json j = json::object();
            
            j["log"] = {
                {"level", "info"},
                {"output", "/home/zenyyxz/dotfiles/vpn/arch-vpn/box.log"},
                {"timestamp", true}
            };

            json dns_servers = json::array();
            
            // 1. Remote DNS: Used for all general traffic once the tunnel is up.
            dns_servers.push_back({
                {"tag", "dns-remote"},
                {"type", "https"},
                {"server", "1.1.1.1"},
                {"server_port", 443},
                {"detour", "proxy"}
            });

            // 2. Bootstrap DNS: CRITICAL for Zero Data. Uses local system DNS 
            // but detours through 'direct'. This allows resolving the VPN 
            // server domain using the ISP's free DNS lane.
            dns_servers.push_back({
                {"tag", "dns-bootstrap"},
                {"type", "local"}
            });

            // 3. FakeIP: Speeds up connection by returning a fake IP immediately.
            dns_servers.push_back({
                {"tag", "dns-fakeip"},
                {"type", "fakeip"},
                {"inet4_range", "198.18.0.0/15"},
                {"inet6_range", "fc00::/18"}
            });

            json dns_rules = json::array();
            
            // BOOTSTRAP RULE: The server domain itself MUST resolve via local DNS
            dns_rules.push_back({
                {"domain", json::array({server_ip})},
                {"server", "dns-bootstrap"}
            });

            // GENERAL RULE: Use FakeIP for everything else
            dns_rules.push_back({
                {"query_type", json::array({"A", "AAAA"})},
                {"server", "dns-fakeip"},
                {"rewrite_ttl", 1}
            });

            j["dns"] = {
                {"servers", dns_servers},
                {"rules", dns_rules},
                {"final", "dns-remote"},
                {"strategy", "prefer_ipv4"},
                {"independent_cache", true}
            };

            // Don't route local traffic or the server IP (if hardcoded) through the tunnel
            json route_exclude = json::array({"127.0.0.0/8"});
            if (is_ip(server_ip)) {
                route_exclude.push_back(server_ip + "/32");
            }

            j["inbounds"] = json::array();
            j["inbounds"].push_back({
                {"type", "tun"},
                {"tag", "tun-in"},
                {"interface_name", "zen-tun"},

                {"address", json::array({"172.19.0.1/30"})},
                {"mtu", mtu},
                {"auto_route", true},
                {"strict_route", strict_route},
                {"stack", tun_stack},
                {"route_exclude_address", route_exclude}
            });

            // Internal DNS inbound for sing-box to handle system queries
            j["inbounds"].push_back({
                {"type", "direct"},
                {"tag", "dns-in"},
                {"listen", "127.0.0.1"},
                {"listen_port", 53}
            });

            j["outbounds"] = json::array();
            
            // The VLESS Proxy Outbound
            j["outbounds"].push_back({
                {"type", "vless"},
                {"tag", "proxy"},
                {"server", server_ip},
                {"server_port", server_port},
                {"uuid", uuid},
                {"tls", {
                    {"enabled", true},
                    {"server_name", sni}, // SNI Spoofing (aka.ms)
                    {"insecure", true}
                }}
            });

            j["outbounds"].push_back({
                {"tag", "direct"},
                {"type", "direct"}
            });

            json route_rules = json::array();
            
            // Hijack all DNS traffic to internal resolver
            route_rules.push_back({{"protocol", "dns"}, {"action", "hijack-dns"}});
            route_rules.push_back({{"port", 53}, {"action", "hijack-dns"}});
            
            // LOOP PREVENTION: Traffic to the VPN server MUST go 'direct'
            // otherwise it will try to enter its own tunnel.
            route_rules.push_back({
                {"domain", json::array({server_ip})},
                {"action", "route"},
                {"outbound", "direct"}
            });
            if (is_ip(server_ip)) {
                route_rules.push_back({
                    {"ip_cidr", json::array({server_ip + "/32"})},
                    {"action", "route"},
                    {"outbound", "direct"}
                });
            }

            // Sniffing: Allows identifying traffic types (TLS/HTTP) for better routing
            route_rules.push_back({
                {"inbound", json::array({"tun-in"})},
                {"action", "sniff"},
                {"protocol", json::array({"http", "tls", "quic"})}
            });

            j["route"] = {
                {"rules", route_rules},
                {"auto_detect_interface", true},
                {"final", "proxy"},
                {"default_domain_resolver", "dns-bootstrap"} // Required for 1.13+
            };

            return j;
        }

        void save(const std::string& path) const {
            std::ofstream f(path);
            f << generate_singbox_json().dump(2);
        }
    };

    /**
     * @brief Manages profile saving, loading, and VLESS link parsing
     */
    class ProfileManager {
    private:
        std::string path;
        std::vector<Profile> profiles;

    public:
        ProfileManager(const std::string& p) : path(p) { load(); }
        
        void load() {
            std::ifstream f(path);
            if (!f.is_open()) return;
            try {
                json j = json::parse(f);
                profiles.clear();
                for (auto& item : j) profiles.push_back(Profile::from_json(item));
            } catch (...) {}
        }

        void save() {
            json j = json::array();
            for (auto& p : profiles) j.push_back(p.to_json());
            std::ofstream f(path);
            f << j.dump(2);
        }

        const std::vector<Profile>& get_profiles() { return profiles; }

        /**
         * @brief Decodes URL-encoded strings (for profile names in fragments)
         */
        static std::string url_decode(const std::string& str) {
            std::string res;
            for (size_t i = 0; i < str.length(); ++i) {
                if (str[i] == '%' && i + 2 < str.length()) {
                    int value;
                    sscanf(str.substr(i + 1, 2).c_str(), "%x", &value);
                    res += (char)value;
                    i += 2;
                } else if (str[i] == '+') res += ' ';
                else res += str[i];
            }
            return res;
        }

        /**
         * @brief Parses a vless:// URL and adds it to the profiles
         */
        bool add_vless(const std::string& link) {
            try {
                if (link.find("vless://") != 0) return false;
                size_t uuid_end = link.find('@');
                if (uuid_end == std::string::npos) return false;
                std::string uuid = link.substr(8, uuid_end - 8);
                
                size_t host_start = uuid_end + 1;
                size_t host_end = link.find(':', host_start);
                size_t port_end = link.find_first_of("?#", host_start);
                
                std::string host; int port = 443;
                if (host_end != std::string::npos && (port_end == std::string::npos || host_end < port_end)) {
                    host = link.substr(host_start, host_end - host_start);
                    port = std::stoi(link.substr(host_end + 1, (port_end == std::string::npos ? link.size() : port_end) - host_end - 1));
                } else host = link.substr(host_start, (port_end == std::string::npos ? link.size() : port_end) - host_start);
                
                std::string sni = "aka.ms";
                size_t q = link.find('?');
                if (q != std::string::npos) {
                    size_t s = link.find("sni=", q);
                    if (s != std::string::npos) {
                        size_t end = std::min(link.find('#', s), link.find('&', s));
                        sni = link.substr(s + 4, end - (s + 4));
                    }
                }
                
                std::string name = "Imported-" + std::to_string(time(nullptr));
                size_t n = link.find('#');
                if (n != std::string::npos) name = url_decode(link.substr(n + 1));
                
                profiles.push_back({name, host, port, uuid, sni, false});
                save(); 
                return true;
            } catch (...) { return false; }
        }

        void remove(const std::string& name) {
            profiles.erase(std::remove_if(profiles.begin(), profiles.end(), [&](const Profile& p) { return p.name == name; }), profiles.end());
            save();
        }

        Profile* get(const std::string& name) {
            for (auto& p : profiles) if (p.name == name) return &p;
            return nullptr;
        }

        void set_active(const std::string& name) {
            for (auto& p : profiles) p.active = (p.name == name);
            save();
        }
    };
}
