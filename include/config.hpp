#pragma once

#include <cstdint>
#include <string>

namespace VNexus {
    namespace Core {

        enum class TransportType : uint8_t {
            TCP, // 0
            UDP, // 1
            WS,
            Quic
        };

        enum class LogLevel : uint8_t {
            INFO,
            WARNING,
            ERROR
        };

        enum class VPNProtocol : uint8_t {
            VLESS,
            VMESS,
            SHADOWSOCKS
        };

        struct ConfigAttributes {
            std::string server = "sg-vnexus.lahirux.dev";
            std::string server_ip = "161.118.248.52"; // this is a major weakness. we need to figure out a way to use signbox engine to resolve this ip without hardcoding this shit.
            int server_port = 443;
            std::string uuid = "8e22839b-d2d5-40da-bab6-6bde61104c4d";
            TransportType transportType = TransportType::TCP;
            VPNProtocol vpnProtocol = VPNProtocol::VLESS;

            bool tls_enabled = true;
            bool allowInSecure = true;
            std::string SNI = "aka.ms";

            std::string tunInterfaceName = "vnexus-tun";
            int mtu = 1400;
            std::string tunStack = "system";
            // bool tun_mode = false;
            bool strict_route = true;

            LogLevel logLevel = LogLevel::INFO;
            bool logTimeStamps = false;
            std::string logFilePath = "/tmp/vnexus/vnexus.log";

            std::string listen = "127.0.0.1";
            int listen_port = 53;

        };

    } // namespace Core
} // namespace VNexus