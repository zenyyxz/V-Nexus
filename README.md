<div align="center">
  <img src="resources/icon.png" width="128" height="128" />
  <h1>V-Nexus</h1>
  <p>
    <b>The Modern, High-Performance V2Ray Client for Windows</b>
  </p>

  [![Version](https://img.shields.io/github/v/release/zenyyxz/V-Nexus?style=flat-square&color=blue)](https://github.com/zenyyxz/V-Nexus/releases)
  [![Platform](https://img.shields.io/badge/platform-Windows-lightgrey?style=flat-square&logo=windows)](https://github.com/zenyyxz/V-Nexus/releases)
  [![License](https://img.shields.io/github/license/zenyyxz/V-Nexus?style=flat-square)](LICENSE)
  [![Downloads](https://img.shields.io/github/downloads/zenyyxz/V-Nexus/total?style=flat-square&color=green)](https://github.com/zenyyxz/V-Nexus/releases)

</div>

---

**V-Nexus** is a next-generation GUI client for Xray Core, built on Electron and React. It is designed to provide a seamless, reliable, and aesthetically pleasing experience for users requiring censorship circumvention and secure tunneling on Windows.

> **Note**: This is the **Stable V2 (Electron)** branch. We are actively developing V3 (Tauri) for even better performance.

##  Key Features

| Feature | Description |
| :--- | :--- |
| **Global Proxy (TUN)** | Route all system traffic (Games, Spotify, Discord) through your proxy, not just browsers. |
| **Instant Connect** | Optimized polling engine ensures connection toggling is instant (0.5s). |
| **Smart Admin** | Native VBScript elevation handling ensures reliable Admin prompts only when necessary. |
| **Protocols** | Full support for **VMess**, **VLESS**, **Trojan**, and **Shadowsocks**. |
| **Monitoring** | Real-time traffic speed and server latency testing. |

## Download & Installation

1. Navigate to the **[Releases Page](https://github.com/zenyyxz/V-Nexus/releases)**.
2. Download the latest `V-Nexus Setup 2.0.0.exe`.
3. Run the installer.
    * *Note: You may see a SmartScreen warning as this is a community build. Click "Run Anyway" to proceed.*

## Quick Start

1. **Add Server**: Copy your `vmess://`, `vless://`, or subscription link.
2. **Paste**: Use the "Paste from Clipboard" button in the app.
3. **Connect**: Click the large central Connect button.
4. **Global Mode**: To route all traffic, go to Settings and enable **TUN Mode**.

## Technical Details

* **Core**: Xray-core (embedded)
* **Tech Stack**: Electron, React, TypeScript, TailwindCSS
* **Routing**: Tun2Socks integration for system-wide routing

## Roadmap (V3)

The future of V-Nexus is **Tauri**. We are migrating away from Electron to reduce app size and memory usage significantly.

* [x] V2 release (Stable)
* [ ] V3 Initialization (Rust/Tauri)

## Contributing

Contributions are welcome! Please submit a Pull Request or open an Issue if you find bugs.

## License

Distributed under the MIT License. See `LICENSE` for more information.

---
<div align="center">
  <sub>Developed with by <a href="https://github.com/zenyyxz">Lahiru Rashmika</a></sub>
</div>
