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
            std::string server;
            int server_port = 443;
            std::string uuid;
            TransportType transport;
            VPNProtocol protocol;

            std::string tunInterfaceName = "vnexus-tun";
            int mtu = 1400;
            std::string tunStack = "system";
            bool tun_mode = false;
            bool strict_route = true;

            LogLevel logLevel;
            bool logTimeStamp = true;
        };

    } // namespace Core
} // namespace VNexus