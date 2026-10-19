#include "config_serializer.hpp"
#include <nlohmann/json.hpp>
#include <fstream>

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
            nlohmann::json j;
            
            // still under development.

        }
    }
}


