# vnexus-engine

High-performance C++20 VPN & Proxy Engine with Deep SNI Sniffing, Native TUN Interface, and VLESS Protocol.

---

## Key Highlights

- **SNI Sniffing & Destination Override**:
  - Full RFC 6066 / RFC 8446 TLS ClientHello SNI parser.
  - HTTP 1.0/1.1 `Host:` parser.
  - Automatic destination overriding: replaces IP/FakeIP addresses with sniffed domains on the fly before dispatching to VLESS.
- **VLESS Outbound**:
  - Standard VLESS v0 protocol client implementation.
  - OpenSSL TLS transport with custom SNI (`server_name`), ALPN negotiation (`h2`, `http/1.1`), and insecure option.
- **Native Linux TUN Mode**:
  - Direct kernel `/dev/net/tun` integration.
  - Embedded userspace TCP/IP state machine.
  - Built-in FakeIP DNS engine (`198.18.0.0/15`).
  - ICMP Echo responder (ping works through the VPN).
  - Safe auto-routing: routes default traffic (`0.0.0.0/1`, `128.0.0.0/1`, `198.18.0.0/15`) through the TUN device while protecting the physical gateway and excluding the VPN server IP (`161.118.248.52/32`).
- **Mixed Inbound**:
  - Auto-detects SOCKS5 vs HTTP CONNECT on the same port (`127.0.0.1:10808`).

---

## Configuration

Your configuration is pre-configured in [`config.json`](file:///home/zenyyxz/Documents/vnexus-engine/config.json) with your VLESS server and TUN parameters:

```json
{
  "log": {
    "level": "info"
  },
  "inbounds": [
    {
      "type": "tun",
      "tag": "tun-in",
      "interface_name": "zen-tun",
      "address": ["172.19.0.1/30"],
      "mtu": 1400,
      "auto_route": true,
      "strict_route": true,
      "route_exclude_address": [
        "127.0.0.0/8",
        "161.118.248.52/32"
      ],
      "sniff": true,
      "sniff_override_destination": true,
      "sniff_protocols": ["tls", "http"]
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
      "tag": "proxy",
      "server": "161.118.248.52",
      "server_port": 443,
      "uuid": "c4bd98c1-b83c-4b32-a086-40f67a7ec3ff",
      "network": "tcp",
      "tls": {
        "enabled": true,
        "server_name": "aka.ms",
        "insecure": true,
        "alpn": ["h2", "http/1.1"]
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
        "ip_cidr": ["127.0.0.0/8", "161.118.248.52/32"],
        "outbound": "direct"
      }
    ],
    "final": "proxy"
  }
}
```

---

## How to Run

Because TUN mode creates a kernel virtual network interface and manages routing tables, launch with `sudo`:

```bash
sudo ./build/vnexus --config config.json
```

Or grant capabilities to run without sudo:

```bash
sudo setcap cap_net_admin,cap_net_raw+eip ./build/vnexus
./build/vnexus --config config.json
```

To stop gracefully: press `Ctrl+C`. The engine automatically restores routes and brings down the TUN interface.
