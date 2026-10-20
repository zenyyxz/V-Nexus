# Codebase Architecture and File Reference

This document provides a comprehensive overview of the vnexus-engine architecture, detailing the purpose and implementation of each file across the project.

---

## Architecture Overview

vnexus-engine is an asynchronous, high-performance VPN and proxy routing engine written in C++20 using standalone Asio and OpenSSL. It captures local network traffic either via an operating system TUN device (`/dev/net/tun`) or via a local SOCKS5/HTTP proxy port, inspects outgoing TCP connections to extract TLS Server Name Indication (SNI) or HTTP Host headers, applies rule-based routing, and encapsulates packets into outbound tunnels such as VLESS v0 or VMess over TCP or TLS.

### Traffic Flow Diagram

```
+-----------------------------------------------------------------------------------+
|                                  INBOUND LAYER                                    |
|                                                                                   |
|  [Kernel TUN /dev/net/tun]                [Local SOCKS5 / HTTP Proxy 127.0.0.1]   |
|        (zen-tun)                                    (mixed-in: 10808)             |
|            |                                                |                     |
|      handle_packet()                              MixedInbound                    |
|       /          \                                  /          \                  |
|   UDP:53        TCP (SYN/ACK/Data)            SOCKS5Inbound   HttpInbound         |
|      |                    |                         \          /                  |
|  FakeIP DNS       TunTcpConnection                   process_and_sniff_session()  |
|  (198.18.x.x)             |                                       |               |
|                           +-------------------+-------------------+               |
+-----------------------------------------------|-----------------------------------+
                                                v
+-----------------------------------------------------------------------------------+
|                                 SNIFFING LAYER                                    |
|                                                                                   |
|                                CompositeSniffer                                   |
|                                /              \                                   |
|                         TlsSniffer        HttpSniffer                             |
|                    (RFC 6066 / ClientHello) (Host: header)                        |
|                                       |                                           |
+---------------------------------------|-------------------------------------------+
                                        v
+-----------------------------------------------------------------------------------+
|                                  ROUTER LAYER                                     |
|                                                                                   |
|                                 Router::route()                                   |
|                    Matches: Domain, CIDR, Port, Protocol                          |
|                                       |                                           |
+---------------------------------------|-------------------------------------------+
                                        v
+-----------------------------------------------------------------------------------+
|                                 OUTBOUND LAYER                                    |
|                                                                                   |
|         +-------------------+-------------------+-------------------+             |
|         |                   |                   |                   |             |
|   VlessOutbound       VmessOutbound       DirectOutbound      BlockOutbound       |
|    (TCP / TLS)         (TCP / TLS)         (System DNS)         (Drop RST)        |
|         |                   |                   |                                 |
|         v                   v                   v                                 |
|      Upstream            Upstream            Direct                               |
|    VLESS Server        VMess Server         Internet                              |
+-----------------------------------------------------------------------------------+
```

---

## Complete File-by-File Index

### Root and Build System

- **`CMakeLists.txt`**
  Defines the build configuration for the entire project. Requires C++20 standard (`-std=c++20`). Detects external dependencies via CMake package modules (`OpenSSL`, `nlohmann_json`, `fmt`, `spdlog`, `Threads`, and optional `Catch2`). Defines the static library target `vnexus_core`, the CLI executable `vnexus`, and the unit test suite executable `vnexus_tests`. Configures standalone Asio macros (`ASIO_STANDALONE`, `ASIO_NO_DEPRECATED`).

- **`config.json`**
  The active runtime configuration file. Specifies log settings (level, file path, timestamp), TUN inbound parameters (interface name `zen-tun`, address `172.20.0.1/30`, auto routing, excluded server routes, sniffing protocols), mixed inbound proxy (`127.0.0.1:10808`), outbound tunnels (VLESS with TLS SNI spoofing), and routing rules.

- **`configs/config.sample.json`**
  Annotated template configuration file showing all available settings for TUN, Mixed inbound, VLESS outbound, VMess outbound, Direct outbound, Block outbound, and routing rules based on IP CIDR, domain suffixes, and domain keywords.

---

### Command Line Interface

- **`cmd/main.cpp`**
  Application entry point. Responsibilities include:
  - Command-line argument parsing (e.g. `--config path/to/config.json`).
  - Loading and validating configuration files before starting background subsystems.
  - Setting up system signal handling (`SIGINT`, `SIGTERM`) using `asio::signal_set` for clean shutdown.
  - Initializing file and console logging sinks.
  - Instantiating `vnexus::Engine` and running its primary `asio::io_context` event loop.

---

### Engine Orchestration

- **`include/vnexus/engine.hpp`**
  Header defining the central `vnexus::Engine` class. Contains lifecycle methods (`start()`, `run()`, `stop()`), containers for registered inbounds (`std::vector<std::shared_ptr<IInbound>>`) and outbounds (`std::unordered_map<std::string, std::shared_ptr<IOutbound>>`), and routing references.

- **`src/engine.cpp`**
  Implementation of `Engine`. Wires inbound dispatch callbacks to outbound instances through the router. When an inbound produces a new session with an initial payload and destination, `handle_dispatch()` queries `Router::route()`, locates the corresponding outbound by tag, and hands off the socket for tunneling.

---

### Common Infrastructure

- **`include/vnexus/common/types.hpp`**
  Core domain models and structures:
  - `AddressType`: Enum for IPv4, IPv6, and Domain name destination targets.
  - `EndpointAddress`: Represents host and port pairs with conversion methods (`to_string()`).
  - `NetworkCommand`: TCP (`0x01`) and UDP (`0x02`) command identifiers.
  - `SessionContext`: Holds connection metadata across layers (session ID, inbound tag, outbound tag, client endpoint, original destination, sniffed domain, traffic byte counters).
  - `SniffResult`: Outcome of an SNI or HTTP host sniffing operation.

- **`include/vnexus/common/uuid.hpp` & `src/common/uuid.cpp`**
  RFC 4122 standard UUID v4 implementation:
  - Parses UUID strings formatted with or without hyphens into standard 16-byte raw byte arrays.
  - Provides binary serialization and string formatting.
  - Generates cryptographically secure random UUIDs using OpenSSL `RAND_bytes`.
  - Used for VLESS and VMess client identification and authentication.

- **`include/vnexus/common/net.hpp` & `src/common/net.cpp`**
  Network helper functions for endianness translation, IP address parsing, and binary address validation.

- **`include/vnexus/common/log.hpp` & `src/common/log.cpp`**
  High-performance logging infrastructure built on `spdlog`:
  - Supports multiple concurrent sinks: standard console (`stdout_color_sink_mt`) and rotating file sink (`basic_file_sink_mt`).
  - Implements log macros: `VN_TRACE`, `VN_DEBUG`, `VN_INFO`, `VN_WARN`, `VN_ERROR`, and `VN_CRITICAL`.
  - Flushes immediately on trace/debug for real-time debugging without buffering delays.

---

### Configuration Subsystem

- **`include/vnexus/config/config.hpp` & `src/config/config.cpp`**
  Strongly-typed C++ structs matching the JSON configuration file:
  - `LogConfig`: Log level, file output target, timestamp toggle.
  - `TunConfig`: Device name, address, MTU, route exclusion addresses, auto-routing flags.
  - `InboundConfig`: Type (tun, mixed, socks5, http), listen address, port, sniffing settings.
  - `TlsConfig`: Enabled flag, server name (SNI), insecure skip verify toggle, ALPN protocol list.
  - `OutboundConfig`: Type (vless, vmess, direct, block), server host, port, UUID, network mode, VMess security/alter_id settings, TLS configuration.
  - `RouteConfig` & `RuleConfig`: Route rules based on domain suffixes, keywords, full domains, CIDR ranges, ports, and protocols.
  - Parses configuration files and validates schema invariants.

---

### Sniffing Subsystem

- **`include/vnexus/sniff/sniffer.hpp` & `src/sniff/sniffer.cpp`**
  Defines the abstract `ISniffer` interface and the `CompositeSniffer` aggregator:
  - `CompositeSniffer` chains multiple protocol detectors (TLS, HTTP) into a single call.
  - Iterates through registered sniffers until one successfully extracts a valid domain name.

- **`include/vnexus/sniff/tls_sniffer.hpp` & `src/sniff/tls_sniffer.cpp`**
  RFC 6066 / RFC 8446 TLS ClientHello SNI extractor:
  - Validates TLS Record layer headers (`ContentType = 0x16`, `Version >= 0x0301`).
  - Traverses Handshake layer, Session ID length, Cipher Suites vector, and Compression Methods.
  - Parses the TLS Extensions block to locate Extension Type `0x0000` (Server Name Indication).
  - Extracts the UTF-8 server hostname without requiring private keys or TLS decryption.

- **`include/vnexus/sniff/http_sniffer.hpp` & `src/sniff/http_sniffer.cpp`**
  Plaintext HTTP parser:
  - Identifies HTTP request methods (`GET`, `POST`, `CONNECT`, `PUT`, `DELETE`, `HEAD`, `OPTIONS`).
  - Scans HTTP headers for case-insensitive `Host:` header and extracts target hostname and optional port.

---

### Inbound Subsystem

- **`include/vnexus/inbound/inbound.hpp` & `src/inbound/inbound.cpp`**
  Base abstractions for all proxy listeners:
  - `IInbound`: Virtual interface defining `start()`, `stop()`, `tag()`, and `listen_port()`.
  - `DispatchHandler`: Function callback type invoked when a connection is ready to route.
  - `process_and_sniff_session()`: Asynchronously buffers initial data from a client socket with a configurable timeout timer to allow SNI/Host sniffing before routing.

- **`include/vnexus/inbound/tun_inbound.hpp` & `src/inbound/tun_inbound.cpp`**
  Virtual Linux TUN network device inbound:
  - Opens `/dev/net/tun` and configures `IFF_TUN | IFF_NO_PI` via `ioctl(TUNSETIFF)`.
  - Bridges the kernel file descriptor to Asio via `asio::posix::stream_descriptor`.
  - **Embedded FakeIP Engine**: Intercepts UDP port 53 DNS queries, maps queried domain names to virtual IP addresses within `198.18.0.0/15`, and returns synthetic DNS responses instantly.
  - **Userspace TCP Engine (`TunTcpConnection`)**: Tracks per-connection TCP state (SYN, ESTABLISHED, FIN, RST), assigns dynamic sequence/acknowledgment numbers, retransmits SYN-ACKs, and chunks upstream responses into MTU-sized IP/TCP packets.
  - **Socketpair Relay**: Connects each active TUN TCP flow to the engine dispatcher via a local non-blocking `socketpair(AF_UNIX, SOCK_STREAM)` without loopback port consumption.
  - **Automated Routing**: Detects the default physical network interface and gateway, adds direct bypass routes for the VPN server, installs default split routes (`0.0.0.0/1`, `128.0.0.0/1`, `198.18.0.0/15`) pointing to the TUN interface, redirects `/etc/resolv.conf`, and safely restores all changes upon termination.

- **`include/vnexus/inbound/mixed_inbound.hpp` & `src/inbound/mixed_inbound.cpp`**
  Dual-protocol proxy listener:
  - Listens on a single port (e.g. `127.0.0.1:10808`).
  - Reads the first byte of incoming connections: if `0x05`, hands over connection to `Socks5Inbound`; otherwise hands over to `HttpInbound`.

- **`include/vnexus/inbound/socks5_inbound.hpp` & `src/inbound/socks5_inbound.cpp`**
  RFC 1928 compliant SOCKS5 inbound proxy:
  - Negotiates authentication (`0x00` NO_AUTH).
  - Handles `CONNECT` requests for IPv4, IPv6, and Domain destination formats.
  - Performs SNI sniffing on the initial data payload before routing.

- **`include/vnexus/inbound/http_inbound.hpp` & `src/inbound/http_inbound.cpp`**
  HTTP proxy inbound:
  - Supports both HTTP `CONNECT` tunneling (for HTTPS) and standard plaintext HTTP proxying.
  - Extracts destinations, replies with `HTTP/1.1 200 Connection Established`, and forwards traffic.

---

### Outbound Subsystem

- **`include/vnexus/outbound/outbound.hpp` & `src/outbound/outbound.cpp`**
  Outbound interfaces and generic stream relay:
  - `IOutbound`: Pure virtual base interface defining `dispatch()`, `tag()`, and `type()`.
  - `SocketRelay`: Asynchronous bidirectional byte pipe between a client socket and an unencrypted remote socket.

- **`include/vnexus/outbound/vless_outbound.hpp` & `src/outbound/vless_outbound.cpp`**
  VLESS v0 protocol client implementation:
  - Serializes standard VLESS v0 binary request headers: version (`0x00`), 16-byte UUID, addons length (`0x00`), command (`0x01` TCP), port, address type, address bytes.
  - Connects directly to server IP addresses without DNS resolution delays.
  - Supports TLS encryption using OpenSSL (`asio::ssl::stream`) with custom SNI spoofing and ALPN.
  - `SslSocketRelay`: Asynchronous bidirectional stream relay with inline VLESS response header stripping and immediate concurrent client-to-remote streaming.

- **`include/vnexus/outbound/vmess_outbound.hpp` & `src/outbound/vmess_outbound.cpp`**
  VMess protocol client implementation:
  - Computes 16-byte HMAC-MD5 user authentication tokens based on UTC timestamp.
  - Builds VMess command headers containing version (`0x01`), 16-byte random IV, 16-byte random Key, response verification byte (V), chunk streaming options, security type, command, destination address, and FNV-1a checksum.
  - Implements 2-byte length-prefixed chunk streaming.
  - `VmessSslRelay`: Manages concurrent bidirectional streaming, validates the response header verification byte (V), strips command headers, and un-frames response chunks.

- **`include/vnexus/outbound/direct_outbound.hpp` & `src/outbound/direct_outbound.cpp`**
  Direct internet access outbound:
  - Resolves target hostnames asynchronously and connects directly over plaintext TCP without proxy encapsulation.

- **`include/vnexus/outbound/block_outbound.hpp` & `src/outbound/block_outbound.cpp`**
  Traffic blocker outbound:
  - Closes incoming connections immediately to reject connections matching blocked rules (e.g. ad domains, telemetry).

---

### Routing Subsystem

- **`include/vnexus/router/router.hpp` & `src/router/router.cpp`**
  Rule-based routing engine:
  - Evaluates outgoing sessions against an ordered list of criteria:
    - Domain suffix matching (e.g. `.local`, `.lan`).
    - Domain keyword matching (e.g. `tracking`, `ads`).
    - Exact domain matching.
    - IPv4 CIDR range checking (e.g. `127.0.0.0/8`, `192.168.0.0/16`, `161.118.248.52/32`).
    - Port matching.
    - Protocol matching (`tls`, `http`).
  - Returns the tag of the matched outbound, or falls back to the configured `final_outbound`.

---

### Test Suite

- **`tests/test_main.cpp`**
  Test runner entrypoint defining Catch2 test context (`Catch2WithMain`).

- **`tests/test_sniffer.cpp`**
  Unit tests validating TLS ClientHello SNI extraction and HTTP Host header parsing against synthetic packet buffers.

- **`tests/test_vless.cpp`**
  Unit tests validating RFC 4122 UUID parsing/formatting, validation rules, and binary VLESS v0 request header serialization across IPv4, domain, and IPv6 destinations.

- **`tests/test_vmess.cpp`**
  Unit tests validating FNV-1a 32-bit checksumming, HMAC-MD5 authentication token generation across timestamps, and VMess command header serialization.

- **`tests/test_socks5.cpp`**
  Unit tests verifying SOCKS5 protocol handshake, authentication negotiation, and connect request message parsing.

- **`tests/test_router.cpp`**
  Unit tests verifying CIDR IP parsing, subnet containment checks, domain rule matching priority, and default route fallback logic.

- **`tests/test_e2e.py`**
  Integration script executing live SOCKS5 connection establishment and verifying real-time SNI sniffing over active sockets.
