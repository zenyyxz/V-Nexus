# NexusFlow

NexusFlow is the networking engine behind the V-Nexus client.

High-performance C++20 VPN and proxy routing engine featuring deep SNI sniffing, native Linux TUN mode, and VLESS/VMess tunneling protocols.

---

## Overview

NexusFlow is a modular, high-throughput network engine built from scratch in modern C++20 using standalone Asio and OpenSSL. It captures system traffic through a virtual Linux TUN device or local proxy listeners, sniffs target hostnames from outgoing TLS/HTTP packets in real time, applies flexible routing rules, and routes traffic through encrypted tunnels.

---

## Features

- **SNI Sniffing and Destination Override**:
  - Full RFC 6066 / RFC 8446 TLS ClientHello Server Name Indication (SNI) parser.
  - HTTP 1.0/1.1 `Host:` header parser.
  - Dynamic destination overriding: transparently maps FakeIP addresses back to original domain names on the fly.
  - Zero-rated ISP bypass: supports custom TLS SNI spoofing (e.g. `aka.ms`) on outbound tunnels.

- **Outbound Protocols**:
  - **VLESS v0**: Lightweight, zero-overhead binary tunneling over TCP and TLS.
  - **VMess**: Standard V2Ray protocol supporting HMAC-MD5 user authentication, FNV-1a checksumming, length-prefixed chunk streaming, and TLS.
  - **Direct**: Native local network routing with async DNS resolution.
  - **Block**: Instant connection drop/rejection for ad blocking or telemetry restriction.

- **Native Linux TUN Mode**:
  - Direct kernel `/dev/net/tun` integration via `IFF_TUN | IFF_NO_PI`.
  - Embedded userspace TCP state machine tracking handshakes, dynamic sequence numbers, acknowledgments, and connection teardown.
  - Built-in FakeIP DNS engine (`198.18.0.0/15`) intercepting UDP port 53.
  - ICMP Echo responder allowing standard ping utilities through the tunnel.
  - Automated routing management: configures default split routes (`0.0.0.0/1`, `128.0.0.0/1`), bypasses the physical gateway for the VPN server IP, redirects system DNS, and cleanly restores routing tables on shutdown.

- **Mixed Proxy Inbound**:
  - Dual-protocol listener on a single port (e.g. `127.0.0.1:10808`).
  - Automatically identifies SOCKS5 (`0x05`) versus HTTP `CONNECT` / plaintext requests.

- **Rule-Based Routing**:
  - Flexible rule priorities based on domain suffix, domain keyword, exact domain, IPv4 CIDR blocks, destination ports, and sniffed protocols.

- **Reliability and Telemetry**:
  - Non-blocking Asio pipelines with concurrent bidirectional streaming.
  - Multi-sink logging system with simultaneous colored console and rotating file output (`spdlog`).

---

## Codebase Directory Structure

```
NexusFlow/
├── CMakeLists.txt              # CMake build configuration
├── README.md                   # Project documentation
├── config.json                 # Active runtime configuration
├── configs/
│   └── config.sample.json      # Annotated template configuration
├── docs/
│   └── CODEBASE.md             # Exhaustive file-by-file architectural guide
├── cmd/
│   └── main.cpp                # CLI entry point, argument parsing, signals
├── include/
│   └── vnexus/
│       ├── engine.hpp          # Central engine orchestrator
│       ├── common/             # Types, UUID, network helpers, logging
│       ├── config/             # Configuration schema and JSON parser
│       ├── inbound/            # TUN, Mixed, SOCKS5, HTTP inbounds
│       ├── outbound/           # VLESS, VMess, Direct, Block outbounds
│       ├── router/             # Rule evaluation and outbound routing
│       └── sniff/              # TLS SNI and HTTP Host sniffers
├── src/                        # Implementation files corresponding to include/
└── tests/                      # Catch2 unit and integration test suite
```

For an exhaustive description of every file and its exact responsibilities, consult [`docs/CODEBASE.md`](file:///home/zenyyxz/Documents/vnexus-engine/docs/CODEBASE.md).

---

## File Reference Summary

| Path | Description |
|---|---|
| `cmd/main.cpp` | CLI application entrypoint, signal handling (`SIGINT`, `SIGTERM`), and logging setup. |
| `include/vnexus/engine.hpp` / `src/engine.cpp` | Core orchestrator coordinating inbounds, outbounds, and routing rules. |
| `include/vnexus/common/types.hpp` | Domain types: `SessionContext`, `EndpointAddress`, `SniffResult`, `NetworkCommand`. |
| `include/vnexus/common/uuid.hpp` / `src/common/uuid.cpp` | RFC 4122 UUID v4 parser, generator, and binary serializer. |
| `include/vnexus/common/net.hpp` / `src/common/net.cpp` | Endianness, IP conversion, and socket helper functions. |
| `include/vnexus/common/log.hpp` / `src/common/log.cpp` | Multi-sink asynchronous logging engine backed by `spdlog`. |
| `include/vnexus/config/config.hpp` / `src/config/config.cpp` | Strongly-typed configuration model with JSON parser and validator. |
| `include/vnexus/sniff/sniffer.hpp` / `src/sniff/sniffer.cpp` | `ISniffer` interface and `CompositeSniffer` aggregation chain. |
| `include/vnexus/sniff/tls_sniffer.hpp` / `src/sniff/tls_sniffer.cpp` | RFC 6066 TLS ClientHello SNI extractor. |
| `include/vnexus/sniff/http_sniffer.hpp` / `src/sniff/http_sniffer.cpp` | Plaintext HTTP `Host:` header parser. |
| `include/vnexus/inbound/inbound.hpp` / `src/inbound/inbound.cpp` | `IInbound` interface and async sniff buffering mechanism. |
| `include/vnexus/inbound/tun_inbound.hpp` / `src/inbound/tun_inbound.cpp` | Linux TUN device handler, userspace TCP state machine, FakeIP DNS, and routing logic. |
| `include/vnexus/inbound/mixed_inbound.hpp` / `src/inbound/mixed_inbound.cpp` | Inbound listener that auto-detects SOCKS5 vs HTTP proxy connections. |
| `include/vnexus/inbound/socks5_inbound.hpp` / `src/inbound/socks5_inbound.cpp` | RFC 1928 SOCKS5 proxy server implementation. |
| `include/vnexus/inbound/http_inbound.hpp` / `src/inbound/http_inbound.cpp` | HTTP proxy server with CONNECT method support. |
| `include/vnexus/outbound/outbound.hpp` / `src/outbound/outbound.cpp` | `IOutbound` interface and generic asynchronous bidirectional byte relay. |
| `include/vnexus/outbound/vless_outbound.hpp` / `src/outbound/vless_outbound.cpp` | VLESS v0 protocol client with TCP/TLS transports and SNI spoofing. |
| `include/vnexus/outbound/vmess_outbound.hpp` / `src/outbound/vmess_outbound.cpp` | VMess protocol client with HMAC-MD5 authentication, FNV-1a hashing, and chunk streaming. |
| `include/vnexus/outbound/direct_outbound.hpp` / `src/outbound/direct_outbound.cpp` | Direct unproxied outbound using system resolver and standard TCP sockets. |
| `include/vnexus/outbound/block_outbound.hpp` / `src/outbound/block_outbound.cpp` | Outbound dropping matching connections immediately. |
| `include/vnexus/router/router.hpp` / `src/router/router.cpp` | Rule evaluation engine matching CIDR, domain, port, and protocol rules. |

---

## Build Requirements

- C++20 compliant compiler (`gcc` >= 11 or `clang` >= 13)
- `cmake` >= 3.20
- `ninja` or `make`
- `openssl` >= 1.1.1 / 3.x
- `nlohmann-json` >= 3.10
- `spdlog` >= 1.9
- `fmt` >= 8.0
- `catch2` >= 3.0 (optional, required for unit test suite)

### Arch Linux

```bash
sudo pacman -S base-devel cmake ninja openssl asio spdlog fmt nlohmann-json catch2
```

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install build-essential cmake ninja-build libssl-dev libasio-dev libspdlog-dev libfmt-dev nlohmann-json3-dev catch2
```

---

## Compilation

Build the core library, CLI application, and test suite:

```bash
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build -j$(nproc)
```

Run unit tests:

```bash
./build/vnexus_tests
```

All assertions should pass:
```
===============================================================================
All tests passed (111 assertions in 10 test cases)
```

---

## Configuration Guide

Configurations are written in JSON. Below is an example configuring both VLESS and VMess tunnels alongside TUN and Mixed inbounds:

```json
{
  "log": {
    "level": "info",
    "output": "vnexus.log",
    "timestamp": true
  },
  "inbounds": [
    {
      "type": "tun",
      "tag": "tun-in",
      "interface_name": "zen-tun",
      "address": [
        "172.20.0.1/30"
      ],
      "mtu": 1400,
      "auto_route": true,
      "strict_route": true,
      "route_exclude_address": [
        "127.0.0.0/8",
        "161.118.248.52/32"
      ],
      "sniff": true,
      "sniff_override_destination": true,
      "sniff_protocols": [
        "tls",
        "http"
      ]
    },
    {
      "type": "mixed",
      "tag": "mixed-in",
      "listen": "127.0.0.1",
      "listen_port": 10808,
      "sniff": true,
      "sniff_override_destination": true
    }
  ],
  "outbounds": [
    {
      "type": "vless",
      "tag": "vless-proxy",
      "server": "161.118.248.52",
      "server_port": 443,
      "uuid": "c4bd98c1-b83c-4b32-a086-40f67a7ec3ff",
      "network": "tcp",
      "tls": {
        "enabled": true,
        "server_name": "aka.ms",
        "insecure": true
      }
    },
    {
      "type": "vmess",
      "tag": "vmess-proxy",
      "server": "161.118.248.52",
      "server_port": 443,
      "uuid": "c4bd98c1-b83c-4b32-a086-40f67a7ec3ff",
      "alter_id": 0,
      "security": "auto",
      "network": "tcp",
      "tls": {
        "enabled": true,
        "server_name": "aka.ms",
        "insecure": true
      }
    },
    {
      "type": "direct",
      "tag": "direct"
    },
    {
      "type": "block",
      "tag": "block"
    }
  ],
  "route": {
    "rules": [
      {
        "ip_cidr": [
          "127.0.0.0/8",
          "161.118.248.52/32"
        ],
        "outbound": "direct"
      },
      {
        "domain_keyword": [
          "ads",
          "telemetry"
        ],
        "outbound": "block"
      }
    ],
    "final": "vless-proxy"
  }
}
```

---

## Execution

### Running with Sudo

TUN mode creates a virtual kernel interface and alters the routing table, requiring administrative privileges:

```bash
sudo ./build/NexusFlow --config config.json
```

### Running without Sudo (Linux Capabilities)

You can grant binary capabilities to run the TUN interface without invoking `sudo`:

```bash
sudo setcap cap_net_admin,cap_net_raw+eip ./build/NexusFlow
./build/NexusFlow --config config.json
```

### Graceful Termination

To stop the engine, send `SIGINT` (`Ctrl+C`) or `SIGTERM`. The engine automatically:
1. Deletes the split routing rules (`0.0.0.0/1`, `128.0.0.0/1`, `198.18.0.0/15`).
2. Restores `/etc/resolv.conf` from backup.
3. Closes all active TCP sessions and shuts down the TUN file descriptor.

---

## License

This project is licensed under the MIT License.
