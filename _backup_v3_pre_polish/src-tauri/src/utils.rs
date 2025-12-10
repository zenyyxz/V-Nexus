use serde::Serialize;
use std::net::TcpStream;
use std::os::windows::process::CommandExt;
use std::time::{Duration, Instant};
use sysinfo::{MemoryRefreshKind, RefreshKind, System};
use tauri::command;

#[derive(Serialize)]
pub struct PingResult {
    pub latency: u128,
    pub success: bool,
}

#[command]
pub async fn check_is_admin() -> bool {
    // Simple check: "net session" requires admin.
    let output = std::process::Command::new("net")
        .arg("session")
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output();

    match output {
        Ok(out) => out.status.success(),
        Err(_) => false,
    }
}

#[command]
pub async fn tcp_ping(address: String, port: u16) -> PingResult {
    let start = Instant::now();
    let timeout = Duration::from_secs(5);

    // Combining address and port for connection
    let target = format!("{}:{}", address, port);

    // Using std::net::TcpStream with timeout logic
    // Note: Rust's std::net::TcpStream::connect_timeout is synchronous.
    // Since this is an async command, we should ideally wrap it in spawn_blocking
    // to avoid blocking the async runtime, although for short timeouts it might be okay.
    // Better to be safe.

    let result = tauri::async_runtime::spawn_blocking(move || {
        if let Ok(socket_addr_iter) = std::net::ToSocketAddrs::to_socket_addrs(&target) {
            for addr in socket_addr_iter {
                if TcpStream::connect_timeout(&addr, timeout).is_ok() {
                    return true;
                }
            }
        }
        false
    })
    .await;

    let success = result.unwrap_or(false);
    let latency = start.elapsed().as_millis();

    if success {
        PingResult {
            latency,
            success: true,
        }
    } else {
        PingResult {
            latency: 9999,
            success: false,
        }
    }
}

#[command]
pub async fn icmp_ping(address: String) -> PingResult {
    let start = Instant::now();

    // Windows Ping: -n 1 (count), -w 1000 (timeout ms)
    let output = tauri::async_runtime::spawn_blocking(move || {
        std::process::Command::new("ping")
            .args(&["-n", "1", "-w", "2000", &address])
            .output()
    })
    .await;

    match output {
        Ok(Ok(out)) => {
            let stdout = String::from_utf8_lossy(&out.stdout);

            // Check for success string (Windows specific)
            // "Reply from <IP>: bytes=32 time=45ms TTL=..."
            if out.status.success()
                && stdout.contains("Reply from")
                && !stdout.contains("Destination host unreachable")
            {
                let latency = start.elapsed().as_millis();
                // Parse exact time from output if possible?
                // Simple elapsed is fine for user feedback, or parsing "time=45ms"
                // Let's parse for better accuracy
                if let Some(start_idx) = stdout.find("time=") {
                    if let Some(end_idx) = stdout[start_idx..].find("ms") {
                        let time_str = &stdout[start_idx + 5..start_idx + end_idx];
                        if let Ok(ms) = time_str.parse::<u128>() {
                            return PingResult {
                                latency: ms,
                                success: true,
                            };
                        }
                    }
                }
                return PingResult {
                    latency,
                    success: true,
                };
            }
        }
        _ => {}
    }

    PingResult {
        latency: 9999,
        success: false,
    }
}

#[command]
pub async fn http_ping(url: String, proxy_url: Option<String>) -> PingResult {
    // Uses Curl to check "Real URL" latency
    // Can optionally use a proxy

    let output = tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = std::process::Command::new("curl");
        cmd.args(&["-o", "nul", "-s", "-w", "%{time_starttransfer}", &url]);

        // Timeout 5s
        cmd.args(&["-m", "5"]);

        if let Some(proxy) = proxy_url {
            cmd.args(&["-x", &proxy]);
        }

        cmd.output()
    })
    .await;

    match output {
        Ok(Ok(out)) => {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout); // seconds, e.g. "0.125"
                if let Ok(secs) = stdout.trim().parse::<f64>() {
                    let ms = (secs * 1000.0) as u128;
                    return PingResult {
                        latency: ms,
                        success: true,
                    };
                }
            }
        }
        _ => {}
    }

    PingResult {
        latency: 9999,
        success: false,
    }
}

#[command]
pub fn check_run_as_admin_configured() -> bool {
    // Check HKCU\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers
    let Ok(exe_path) = std::env::current_exe() else {
        return false;
    };
    let exe_str = exe_path.to_string_lossy().to_string();

    let output = std::process::Command::new("reg")
        .args(&[
            "query",
            "HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\AppCompatFlags\\Layers",
            "/v",
            &exe_str,
        ])
        .creation_flags(0x08000000)
        .output();

    match output {
        Ok(out) => {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout);
                return stdout.contains("RUNASADMIN");
            }
            false
        }
        Err(_) => false,
    }
}

#[command]
pub fn set_run_as_admin(enable: bool) -> Result<String, String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_str = exe_path.to_string_lossy().to_string();
    let key = "HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\AppCompatFlags\\Layers";

    if enable {
        // Add value: Path = "~ RUNASADMIN"
        let output = std::process::Command::new("reg")
            .args(&[
                "add",
                key,
                "/v",
                &exe_str,
                "/t",
                "REG_SZ",
                "/d",
                "~ RUNASADMIN",
                "/f",
            ])
            .creation_flags(0x08000000)
            .output()
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }
        Ok("Enabled Run as Admin".into())
    } else {
        // Delete value
        let _output = std::process::Command::new("reg")
            .args(&["delete", key, "/v", &exe_str, "/f"])
            .creation_flags(0x08000000)
            .output()
            .map_err(|e| e.to_string())?;

        Ok("Disabled Run as Admin".into())
    }
}

#[command]
pub fn get_memory_usage() -> Result<u64, String> {
    let mut sys = System::new_with_specifics(
        RefreshKind::nothing().with_memory(MemoryRefreshKind::nothing().with_ram()),
    );
    sys.refresh_memory();

    let used_memory = sys.used_memory();
    let total_memory = sys.total_memory();

    if total_memory == 0 {
        return Ok(0);
    }

    Ok((used_memory * 100) / total_memory)
}

#[command]
pub fn restart_as_admin() -> Result<String, String> {
    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    // Use powershell to start the process as admin
    // Note: We don't use CREATE_NO_WINDOW here because the UAC prompt needs to show up?
    // actually UAC is separate. But powershell might flash.
    // Let's try to hide the window.
    let output = std::process::Command::new("powershell")
        .args(&[
            "-NoProfile",
            "-Command",
            &format!(
                "Start-Process -FilePath '{}' -Verb RunAs",
                current_exe.to_string_lossy()
            ),
        ])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        std::process::exit(0);
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[command]
pub fn capture_screen() -> Result<String, String> {
    use base64::{engine::general_purpose, Engine as _};
    use image::ImageOutputFormat;
    use screenshots::Screen;
    use std::io::Cursor;

    let screens = Screen::all().map_err(|e| e.to_string())?;

    let screen = screens.first().ok_or("No screen found")?;

    let image = screen.capture().map_err(|e| e.to_string())?;

    // Convert to PNG bytes using Cursor
    let mut buf = Vec::new();
    let mut cursor = Cursor::new(&mut buf);
    image
        .write_to(&mut cursor, ImageOutputFormat::Png)
        .map_err(|e| e.to_string())?;

    let b64 = general_purpose::STANDARD.encode(&buf);

    Ok(format!("data:image/png;base64,{}", b64))
}

#[command]
pub fn resolve_hostname(hostname: String) -> Result<String, String> {
    use std::net::ToSocketAddrs;
    
    // Append port 80 just to satisfy to_socket_addrs
    let addr_str = format!("{}:80", hostname);
    let mut addrs = addr_str.to_socket_addrs().map_err(|e| e.to_string())?;
    
    // Get the first IPv4 address
    if let Some(addr) = addrs.find(|a| a.is_ipv4()) {
        Ok(addr.ip().to_string())
    } else {
        Err("No IPv4 address found".into())
    }
}
