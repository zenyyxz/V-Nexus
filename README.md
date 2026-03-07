# V-Nexus (V2Ray Client)

A modern, fast, and cross-platform V2Ray client built with Flutter, C++, and `sing-box`.

## Features
- **Dashboard**: Quick connect/disconnect with beautiful UI and animations.
- **Profiles**: Add and manage Vless/Vmess/Shadowsocks nodes.
- **Settings**: Toggle system proxy, tun mode, and routing rules.
- **Native Backend**: High performance C++ backend for managing `sing-box` child process and Linux system proxy (`gsettings`).

## Setup and Running

### 1. Requirements
- Flutter SDK
- `sing-box` binary installed and accessible in your system `PATH`.
- CMake and a C++ compiler (GCC/Clang) for the native backend.

### 2. Compile Native Backend
```bash
cd native_backend
mkdir build && cd build
cmake .. && make
```

### 3. Run Flutter Application
```bash
flutter run -d linux
```
