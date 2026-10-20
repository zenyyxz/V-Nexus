# Configuration Guide

This guide describes how to write and customize `config.json` for NexusFlow.

---

## Configuration Overview

NexusFlow reads its runtime parameters from a single JSON file. The configuration is divided into four main sections:

1. **`log`**: Controls log severity level, log file output, and timestamps.
2. **`inbounds`**: Defines how traffic enters the engine (TUN interface or proxy ports) and configures SNI/Host sniffing.
3. **`outbounds`**: Defines where traffic is forwarded (VLESS, VMess, Direct, Block).
4. **`route`**: Defines rule-based routing to direct traffic to specific outbounds.

---

## 1. The `log` Section

Configures the logging subsystem powered by spdlog.

```json
{
  "log": {
    "level": "info",
    "output": "vnexus.log",
    "timestamp": true
  }
}
```

### Fields

- **`level`** *(string, optional, default: `"info"`)*:
  Minimum log level to emit. Available values in ascending order of severity:
  - `"trace"`: Emits raw network packet lengths, TCP flags, and low-level state transitions.
  - `"debug"`: Emits TCP connection details, DNS FakeIP mappings, and rule evaluation matches.
  - `"info"`: Emits startup messages, interface configurations, new sessions, SNI sniffed domains, and shutdown events.
  - `"warn"`: Emits non-fatal warnings (DNS lookup timeouts, disconnects).
  - `"error"`: Emits connection failures, socket errors, and configuration issues.
  - `"critical"`: Emits fatal engine errors.
- **`output`** *(string, optional, default: `""`)*:
  Path to write log output on disk. If specified, logs are written to this file while simultaneously displaying on the standard terminal. If omitted or empty, logs are printed to console only.
- **`timestamp`** *(boolean, optional, default: `true`)*:
  Whether each log entry should be prefixed with an ISO timestamp (`[YYYY-MM-DD HH:MM:SS.mmm]`).

---

## 2. The `inbounds` Section

An array of inbound listeners. NexusFlow supports four inbound types: `tun`, `mixed`, `socks5`, and `http`.

### TUN Inbound (`type: "tun"`)

Captures all system network traffic by creating a virtual kernel TUN device.

```json
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
  ],
  "sniff_timeout_ms": 300
}
```

#### TUN Fields

- **`tag`** *(string, required)*:
  A unique identifier for this inbound (e.g. `"tun-in"`).
- **`interface_name`** *(string, optional, default: `"zen-tun"`)*:
  Name of the virtual network interface created in the Linux kernel.
- **`address`** *(array of strings, optional, default: `["172.20.0.1/30"]`)*:
  IPv4 subnet assigned to the TUN device. Use a subnet that does not conflict with existing network adapters.
- **`mtu`** *(integer, optional, default: `1400`)*:
  Maximum Transmission Unit in bytes. 1400 is recommended to accommodate VPN and TLS encapsulation overhead.
- **`auto_route`** *(boolean, optional, default: `true`)*:
  Automatically configures Linux routing tables on startup (`0.0.0.0/1`, `128.0.0.0/1`, `198.18.0.0/15`) and points `/etc/resolv.conf` to the built-in FakeIP DNS resolver. All routes and DNS settings are restored when the engine stops.
- **`strict_route`** *(boolean, optional, default: `true`)*:
  Prevents routing leakage through default gateways.
- **`route_exclude_address`** *(array of strings, optional)*:
  Subnets and IP addresses routed directly through the physical gateway rather than through the TUN interface.
  **Important**: Always include loopback (`"127.0.0.0/8"`) and your remote VPN server IP (`"<server-ip>/32"`) to prevent infinite routing loops.

#### Sniffing Fields (Applies to all inbounds)

- **`sniff`** *(boolean, optional, default: `true`)*:
  Enables inspection of the initial packet payload to extract domain names.
- **`sniff_override_destination`** *(boolean, optional, default: `true`)*:
  When a domain name is sniffed via TLS SNI or HTTP `Host:`, replaces the original IP address (such as a FakeIP) with the domain name before forwarding to the outbound tunnel.
- **`sniff_protocols`** *(array of strings, optional, default: `["tls", "http"]`)*:
  Protocols to inspect. Supports `"tls"` (RFC 6066 ClientHello SNI) and `"http"` (`Host:` header).
- **`sniff_timeout_ms`** *(integer, optional, default: `300`)*:
  Maximum milliseconds to wait for the client to transmit its initial handshake before falling back to the original destination address.

---

### Mixed Inbound (`type: "mixed"`)

Listens on a local TCP port and automatically detects whether an incoming connection is SOCKS5 or HTTP proxy traffic.

```json
{
  "type": "mixed",
  "tag": "mixed-in",
  "listen": "127.0.0.1",
  "listen_port": 10808,
  "sniff": true,
  "sniff_override_destination": true
}
```

#### Mixed Fields

- **`listen`** *(string, optional, default: `"127.0.0.1"`)*:
  IPv4 address to bind the proxy listener.
- **`listen_port`** *(integer, required)*:
  Port number to listen for proxy connections (e.g. `10808`).

---

### Standalone SOCKS5 and HTTP Inbounds

If you prefer dedicated ports for each proxy protocol:

```json
{
  "type": "socks5",
  "tag": "socks-in",
  "listen": "127.0.0.1",
  "listen_port": 1080,
  "sniff": true
},
{
  "type": "http",
  "tag": "http-in",
  "listen": "127.0.0.1",
  "listen_port": 8080,
  "sniff": true
}
```

---

## 3. The `outbounds` Section

An array of outbound endpoints. Supported types are `vless`, `vmess`, `direct`, and `block`.

### VLESS Outbound (`type: "vless"`)

VLESS v0 protocol client with support for plain TCP or TLS encapsulation.

```json
{
  "type": "vless",
  "tag": "proxy-vless",
  "server": "161.118.248.52",
  "server_port": 443,
  "uuid": "c4bd98c1-b83c-4b32-a086-40f67a7ec3ff",
  "network": "tcp",
  "tls": {
    "enabled": true,
    "server_name": "aka.ms",
    "insecure": true
  }
}
```

#### VLESS Fields

- **`tag`** *(string, required)*:
  Unique identifier referenced in routing rules.
- **`server`** *(string, required)*:
  IP address or hostname of the VLESS server. If an IP address is specified, the engine connects directly without DNS resolution overhead.
- **`server_port`** *(integer, optional, default: `443`)*:
  Port number of the VLESS service.
- **`uuid`** *(string, required)*:
  Standard UUID v4 identifying your client account on the server.
- **`network`** *(string, optional, default: `"tcp"`)*:
  Transport network protocol (`"tcp"`).
- **`tls`** *(object, optional)*:
  - **`enabled`** *(boolean)*: Activates TLS encryption.
  - **`server_name`** *(string)*: Sets the Server Name Indication (SNI) transmitted in the TLS ClientHello. Useful for zero-rated ISP bypass (e.g. `"aka.ms"`).
  - **`insecure`** *(boolean, optional, default: `false`)*: Set to `true` to skip TLS server certificate validation (useful with self-signed certificates).
  - **`alpn`** *(array of strings, optional)*: Application-Layer Protocol Negotiation list (e.g. `["h2", "http/1.1"]`). Leave empty unless your server explicitly mandates it.

---

### VMess Outbound (`type: "vmess"`)

VMess protocol client with HMAC-MD5 user authentication, FNV-1a checksumming, length-prefixed chunk streaming, and TLS.

```json
{
  "type": "vmess",
  "tag": "proxy-vmess",
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
}
```

#### VMess Fields

- **`alter_id`** *(integer, optional, default: `0`)*:
  Number of alternate IDs. Modern VMess configurations use `0` (AEAD authentication).
- **`security`** *(string, optional, default: `"auto"`)*:
  Inner payload encryption method:
  - `"auto"`: Automatically selects encryption.
  - `"none"`: No payload encryption (recommended when transport TLS is enabled).
  - `"aes-128-gcm"`: AES-128 Galois/Counter Mode.
  - `"chacha20-poly1305"`: ChaCha20 stream cipher with Poly1305 MAC.

---

### Direct Outbound (`type: "direct"`)

Bypasses the VPN and connects directly to the target host via the local network.

```json
{
  "type": "direct",
  "tag": "direct"
}
```

---

### Block Outbound (`type: "block"`)

Immediately terminates matching connections.

```json
{
  "type": "block",
  "tag": "block"
}
```

---

## 4. The `route` Section

Defines traffic dispatching policies.

```json
{
  "route": {
    "final": "proxy-vless",
    "rules": [
      {
        "ip_cidr": [
          "127.0.0.0/8",
          "10.0.0.0/8",
          "192.168.0.0/16",
          "172.16.0.0/12",
          "161.118.248.52/32"
        ],
        "outbound": "direct"
      },
      {
        "domain_suffix": [
          ".local",
          ".lan",
          ".internal"
        ],
        "outbound": "direct"
      },
      {
        "domain_keyword": [
          "telemetry",
          "tracking",
          "analytics"
        ],
        "outbound": "block"
      },
      {
        "port": [
          22
        ],
        "outbound": "direct"
      }
    ]
  }
}
```

### Fields

- **`final`** *(string, required)*:
  The fallback outbound tag used when no rules match incoming traffic (usually your primary VPN outbound tag).
- **`rules`** *(array of objects, optional)*:
  Rules evaluated sequentially from top to bottom. The first rule to match determines the outbound.

### Rule Criteria

A rule matches if all populated criteria in the rule evaluate to true:

- **`ip_cidr`** *(array of strings)*: Matches destination IPv4 addresses against CIDR prefixes (e.g. `"192.168.1.0/24"`).
- **`domain_suffix`** *(array of strings)*: Matches the end of the sniffed domain name (e.g. `".local"` matches `"printer.local"`).
- **`domain_keyword`** *(array of strings)*: Matches substring occurrences anywhere in the domain name (e.g. `"ads"` matches `"ads.example.com"`).
- **`domain_full`** *(array of strings)*: Matches exact domain names.
- **`port`** *(array of integers)*: Matches destination TCP ports (e.g. `[80, 443]`).
- **`protocol`** *(array of strings)*: Matches sniffed protocols (`"tls"` or `"http"`).
- **`outbound`** *(string, required)*: The outbound tag to handle the connection when this rule matches.

---

## Practical Configuration Examples

### Example 1: Full System TUN Mode with VLESS and Zero-Rated SNI Spoofing

Used to route all operating system traffic through a VLESS server over TLS with custom SNI (`aka.ms`) to bypass ISP restrictions:

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
      "sniff_override_destination": true
    }
  ],
  "outbounds": [
    {
      "type": "vless",
      "tag": "proxy",
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
      "type": "direct",
      "tag": "direct"
    }
  ],
  "route": {
    "rules": [
      {
        "ip_cidr": [
          "127.0.0.0/8",
          "192.168.0.0/16",
          "161.118.248.52/32"
        ],
        "outbound": "direct"
      }
    ],
    "final": "proxy"
  }
}
```

---

### Example 2: Lightweight Local SOCKS5 / HTTP Proxy with VMess

Used to provide a local proxy port (`127.0.0.1:10808`) for web browsers and individual applications:

```json
{
  "log": {
    "level": "info",
    "timestamp": true
  },
  "inbounds": [
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
      "type": "vmess",
      "tag": "proxy-vmess",
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
    }
  ],
  "route": {
    "final": "proxy-vmess"
  }
}
```

---

## Best Practices and Recommendations

1. **Avoid Subnet Overlaps**:
   If another VPN software is installed or previously created a TUN adapter with `172.19.0.1`, configure NexusFlow to use `172.20.0.1/30` or `10.10.0.1/30` in `tun.address` to prevent kernel routing conflicts.

2. **Always Exclude Server IP**:
   Under TUN mode with `auto_route: true`, ensure the remote server's IP address (e.g. `161.118.248.52/32`) is added to both `tun.route_exclude_address` and your routing `direct` rules. If omitted, packets bound for the VPN server will be routed into the TUN interface, creating a routing loop.

3. **Running Without Root**:
   Grant network administration capabilities to the executable to run TUN mode without invoking `sudo`:
   ```bash
   sudo setcap cap_net_admin,cap_net_raw+eip ./build/NexusFlow
   ./build/NexusFlow --config config.json
   ```
