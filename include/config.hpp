#pragma once

namespace VNexus {
    namespace Core {

        struct ConfigAttributes {
            std::string serverIP;
            int port = 443;
            std::string uuid;
            std::string transportType = "tcp";
            bool tunMode = false;
        };

        enum TransportType {
            TCP, // 0
            UDP, // 1
            WS,
            Quic
        }

    } // namespace Core
} // namespace VNexus