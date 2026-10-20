#include "config_serializer.hpp"
#include <nlohmann/json.hpp>
#include <fstream>
#include <iostream>

using json = nlohmann::json;

namespace VNexus {
    namespace Core {
        std::string toString(TransportType transport) {
            switch(transport) {
                case TransportType::TCP: return "tcp";
                case TransportType::UDP: return "udp";
                case TransportType::WS: return "websocket";
                case TransportType::Quic: return "quic";
            }
            return "tcp"; // fallback
        }

        std::string toString(LogLevel logLevel) {
            switch(logLevel) {
                case LogLevel::INFO: return "info";
                case LogLevel::WARNING: return "warning";
                case LogLevel::ERROR: return "error";
            }
            return "info";
        }

        std::string toString(VPNProtocol protocol) {
            switch(protocol) {
                case VPNProtocol::VLESS: return "vless";
                case VPNProtocol::VMESS: return "vmess";
                case VPNProtocol::SHADOWSOCKS: return "shadowsocks";
            }
            return "vless";
        }

        std::string GenerateSingBoxConfig(const ConfigAttributes &config) {
            // parent object
            json j;
            
            j["dns"]["final"] = "dns-remote";
            j["dns"]["independent_cache"] = true;
            
            // rules objects
            json rule1;
            rule1["domain"] = {config.server};
            rule1["server"] = "dns-bootstrap";

            json rule2;
            rule2["query_type"] = {"A", "AAAA"};
            rule2["rewrite_ttl"] = 1;
            rule2["server"] = "dns-fakeip";

            j["dns"]["rules"] = json::array({rule1, rule2});
            
            // servers object
            json server1;
            server1["detour"] = "proxy";
            server1["server"] = "1.1.1.1";
            server1["server_port"] = 443;
            server1["tag"] = "dns-remote";
            server1["type"] = "https";

            json server2;
            server2["tag"] = "dns-bootstrap";
            server2["type"] = "local";

            json server3;
            server3["inet4_range"] = "198.18.0.0/15";
            server3["inet6_range"] = "fc00::/18";
            server3["tag"] = "dns-fakeip";
            server3["type"] = "fakeip";

            j["dns"]["servers"] = json::array({server1, server2, server3});
            j["dns"]["strategy"] = "prefer_ipv4";

            json inbound1;
            inbound1["address"] = {"172.19.0.1/30"};
            inbound1["auto_route"] = true;
            inbound1["interface_name"] = config.tunInterfaceName;
            inbound1["mtu"] = config.mtu;
            inbound1["route_exclude_address"] = {"127.0.0.0/8", config.server_ip + "/32"};
            inbound1["stack"] = config.tunStack;
            inbound1["strict_route"] = config.strict_route;
            inbound1["tag"] = "tun-in";
            inbound1["type"] = "tun";

            json inbound2;
            inbound2["listen"] = config.listen;
            inbound2["listen_port"] = config.listen_port;
            inbound2["tag"] = "dns-in";
            inbound2["type"] = "direct";

            j["inbounds"] = json::array({inbound1, inbound2});

            j["log"]["level"] = toString(config.logLevel);
            j["log"]["output"] = config.logFilePath;
            j["log"]["timestamp"] = config.logTimeStamps;

            json outbound1;
            outbound1["server"] = config.server;
            outbound1["server_port"] = config.server_port;
            outbound1["tag"] = "proxy";
            outbound1["tls"]["enabled"] = config.tls_enabled;
            outbound1["tls"]["insecure"] = config.allowInSecure;
            outbound1["tls"]["server_name"] = config.SNI;
            outbound1["type"] = toString(config.vpnProtocol);
            outbound1["uuid"] = config.uuid;

            json outbound2;
            outbound2["tag"] = "direct";
            outbound2["type"] = "direct";

            j["outbounds"] = json::array({outbound1, outbound2});

            j["route"]["auto_detect_interface"] = true;
            j["route"]["default_domain_resolver"] = "dns-bootstrap";
            j["route"]["final"] = "proxy";

            json routeRule1;
            routeRule1["action"] = "hijack-dns";
            routeRule1["protocol"] = "dns";

            json routeRule2;
            routeRule2["action"] = "hijack-dns";
            routeRule2["port"] = 53;

            json routeRule3;
            routeRule3["action"] = "route";
            routeRule3["domain"] = {config.server};
            routeRule3["outbound"] = "direct";

            json routeRule4;
            routeRule4["action"] = "route";
            routeRule4["ip_cidr"] = {config.server_ip + "/32"};
            routeRule4["outbound"] = "direct";

            json routeRule5;
            routeRule5["action"] = "sniff";
            routeRule5["inbound"] = {"tun-in"};
            routeRule5["protocol"] = {"http", "tls", "quic"};

            j["route"]["rules"] = json::array({routeRule1, routeRule2, routeRule3, routeRule4, routeRule5});

            return j.dump(4);
        }

        bool SaveConfigFile(const ConfigAttributes &config, const std::string &filepath) {
            std::ofstream file("config.json");

            if (!file.is_open()) {
                std::cerr << "File couldn't be opened.\n";
            }
            file << GenerateSingBoxConfig(config);
            file.close();
            return true;
        }
    }
}

