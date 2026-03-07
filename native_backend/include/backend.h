#ifndef BACKEND_H
#define BACKEND_H

#if defined(_WIN32)
#define FFI_EXPORT __declspec(dllexport)
#else
#define FFI_EXPORT __attribute__((visibility("default"))) __attribute__((used))
#endif

extern "C" {
FFI_EXPORT const char *get_backend_version();
// Start sing-box using a config file path. Returns PID or error code.
FFI_EXPORT int start_singbox(const char *config_json_path);
// Stop sing-box given its PID
FFI_EXPORT int stop_singbox(int pid);
// Set system proxy (only Linux GNOME implemented for now)
FFI_EXPORT int enable_system_proxy(const char *ip, int port);
// Disable system proxy
FFI_EXPORT int disable_system_proxy();
}

#endif // BACKEND_H
