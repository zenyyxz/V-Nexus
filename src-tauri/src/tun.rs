
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};

// Windows constant for hiding console window
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub struct TunProcess {
    pub child: Mutex<Option<Child>>,
    pub server_ip: Mutex<Option<String>>,
    pub default_gateway: Mutex<Option<String>>,
}

// Helper to run command
pub fn run_command(cmd: &str, args: &[&str]) -> Result<String, String> {
    println!("[Tun] Running: {} {:?}", cmd, args);
    let output = Command::new(cmd)
        .args(args)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Failed to execute {}: {}", cmd, e))?;

    if !output.status.success() {
        // Netsh often prints errors to STDOUT, not STDERR. Capture both.
        return Err(format!(
            "Command failed: STDOUT: {} || STDERR: {}",
            String::from_utf8_lossy(&output.stdout).trim(),
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn get_tun2socks_path(app: &AppHandle) -> PathBuf {
    let mut check_paths = vec![];
    let exe_name = "tun2socks-windows-amd64.exe";

    if let Ok(res_dir) = app.path().resource_dir() {
        check_paths.push(res_dir.join("resources").join("tun2socks").join(exe_name));
        check_paths.push(res_dir.join(exe_name));
    }

    // Dev paths
    check_paths.push(PathBuf::from("resources").join("tun2socks").join(exe_name));
    check_paths.push(
        PathBuf::from("../resources")
            .join("tun2socks")
            .join(exe_name),
    );

    for path in check_paths {
        if path.exists() {
            return std::fs::canonicalize(&path).unwrap_or(path);
        }
    }

    PathBuf::from(exe_name)
}

fn get_default_gateway() -> Result<String, String> {
    // Premium Gateway Detection: Use PowerShell for robust, object-based routing table inspection.
    // This mimics the reliability of the node 'default-gateway' package used in V2.
    // Command: Get-NetRoute for 0.0.0.0/0, exclude unrelated interfaces, sort by Metric.
    let ps_cmd = "Get-NetRoute -DestinationPrefix \"0.0.0.0/0\" -AddressFamily IPv4 | \
                  Where-Object { \
                    $_.NextHop -ne \"0.0.0.0\" -and \
                    $_.InterfaceAlias -notmatch \"tun\" -and \
                    $_.InterfaceAlias -notmatch \"TAP\" -and \
                    $_.InterfaceAlias -notmatch \"V-Nexus\" \
                  } | \
                  Sort-Object -Property RouteMetric | \
                  Select-Object -First 1 -ExpandProperty NextHop";

    let output = Command::new("powershell")
        .args(&["-NoProfile", "-Command", ps_cmd])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Failed to execute PowerShell for Gateway detection: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "PowerShell Gateway detection failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    let gateway = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if gateway.is_empty() {
        return Err("Gateway detection returned empty result.".into());
    }

    // Additional validation to ensure it looks like an IP
    if !gateway.contains('.') {
        return Err(format!("Invalid Gateway IP detected: {}", gateway));
    }

    Ok(gateway)
}

// PREMIUM FEATURE: Smart Polling
fn wait_for_interface(interface_name: &str, timeout_ms: u64) -> Result<(), String> {
    let start = Instant::now();
    let timeout = Duration::from_millis(timeout_ms);

    while start.elapsed() < timeout {
        // Check if interface exists via netsh
        // "netsh interface ip show config name=tun0" returns proper output if exists
        let output = Command::new("netsh")
            .args(&[
                "interface",
                "ip",
                "show",
                "config",
                &format!("name={}", interface_name),
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        if let Ok(out) = output {
            if out.status.success() {
                return Ok(());
            }
        }

        thread::sleep(Duration::from_millis(200));
    }

    Err(format!(
        "Interface {} did not appear within {}ms",
        interface_name, timeout_ms
    ))
}

#[derive(Clone, serde::Serialize)]
struct LogPayload {
    level: String,
    message: String,
}

// Helper to emit logs
fn emit_log(app: &AppHandle, level: &str, msg: &str) {
    let _ = app.emit(
        "xray-log",
        LogPayload {
            level: level.to_string(),
            message: msg.to_string(),
        },
    );
    // Also print to stdout for debugging
    println!("[{}] {}", level, msg);
}

#[tauri::command]
pub async fn start_tun(
    app: AppHandle,
    state: State<'_, TunProcess>,
    server_ip: String,
    proxy_port: u16,
    kill_switch: bool,
    dns_servers: Option<Vec<String>>,
) -> Result<String, String> {
    // 1. Detect Physical Gateway (Robust)
    let gateway = match get_default_gateway() {
        Ok(gw) => gw,
        Err(e) => {
            emit_log(&app, "ERROR", &format!("[Tun] Failed to detect gateway: {}", e));
            return Err(e);
        }
    };
    emit_log(&app, "INFO", &format!("[Tun] Physical Gateway detected: {}", gateway));
    
    // Store for kill switch restoration
    *state.default_gateway.lock().unwrap() = Some(gateway.clone());

    // 2. Lock and Clean State
    {
        let child_lock = state.child.lock().map_err(|e| e.to_string())?;
        if child_lock.is_some() {
            return Err("Tun is already running".into());
        }
    }

    // 3. Clean Old Routes (Step 2/9 in Prototype)
    // Clean potential stale routes to Server and Default
    let _ = run_command("route", &["delete", &server_ip]);
    let _ = run_command("route", &["delete", "0.0.0.0", "mask", "0.0.0.0", "10.0.0.1"]); // Old TUN GW
    let _ = run_command("route", &["delete", "0.0.0.0", "mask", "0.0.0.0", "10.4.2.1"]); // Default T2S GW

    // 4. Add Bypass Route (Step 3/9 in Prototype)
    // "route add <SERVER_IP> mask 255.255.255.255 <PHYSICAL_GW> metric 5"
    // This allows VPN traffic to exit via physical interface without looping.
    emit_log(&app, "INFO", &format!("[Tun] Adding Bypass Route: {} -> {}", server_ip, gateway));
    if let Err(e) = run_command(
        "route",
        &[
            "add",
            &server_ip,
            "mask",
            "255.255.255.255",
            &gateway,
            "metric",
            "5",
        ],
    ) {
        emit_log(&app, "ERROR", &format!("[Tun] Failed to add bypass route: {}", e));
        return Err(format!("Failed to add bypass route: {}", e));
    }

    // 3.5 KILL SWITCH (Firewall Based)
    // V2 used Windows Firewall to block all non-VPN traffic.
    // We add firewall rules to Allow VPN Server, Allow LAN, Allow DNS, Block All Else.
    if kill_switch {
        emit_log(&app, "INFO", "[Tun] Enabling Firewall Kill Switch...");
        
        // 1. Block All Outbound
        let _ = run_command("netsh", &["advfirewall", "firewall", "add", "rule", "name=V-Nexus_KS_Block", "dir=out", "action=block", "enable=yes"]);
        
        // 2. Allow VPN Server (Bypass) - MUST use Resolved IP
        let cmd_allow_server = format!("netsh advfirewall firewall add rule name=V-Nexus_KS_AllowVPN dir=out action=allow remoteip={} enable=yes", server_ip);
        let _ = run_command("cmd", &["/C", &cmd_allow_server]);
        
        // 3. Allow LAN
        let _ = run_command("netsh", &["advfirewall", "firewall", "add", "rule", "name=V-Nexus_KS_Lan", "dir=out", "action=allow", "remoteip=192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,127.0.0.1", "enable=yes"]);
        
        // 4. Allow DNS (UDP 53)
        let _ = run_command("netsh", &["advfirewall", "firewall", "add", "rule", "name=V-Nexus_KS_DNS", "dir=out", "action=allow", "protocol=UDP", "remoteport=53", "enable=yes"]);
    }

    // 5. Start Tun2Socks (Step 5/9)
    let tun_path = get_tun2socks_path(&app);
    let interface_name = "tun0";
    let tun_ip = "10.0.0.2";
    let tun_gw = "10.0.0.1";
    let tun_mask = "255.255.255.0";

    let proxy_url = format!("socks5://127.0.0.1:{}", proxy_port);
    let dev_url = format!("tun://{}", interface_name);

    emit_log(&app, "INFO", "[Tun] Spawning Tun2Socks...");
    let mut cmd = Command::new(tun_path);
    cmd.arg("-device").arg(&dev_url);
    cmd.arg("-proxy").arg(&proxy_url);
    cmd.arg("-loglevel").arg("info");
    cmd.creation_flags(CREATE_NO_WINDOW);

    // Pipe output for logging
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| {
        // Cleanup route if fail
        let _ = run_command("route", &["delete", &server_ip]);
        format!("Failed to spawn Tun2Socks: {}", e)
    })?;

    // Capture Output
    if let Some(stdout) = child.stdout.take() {
        use std::io::{BufRead, BufReader};
        let app_handle_out = app.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(msg) = line {
                    emit_log(&app_handle_out, "INFO", &format!("[Tun2Socks] {}", msg));
                }
            }
        });
    }
    if let Some(stderr) = child.stderr.take() {
        use std::io::{BufRead, BufReader};
        let app_handle_err = app.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(msg) = line {
                    // Wintun/Netstack often print init info to stderr.
                    // We attempt to guess if it's a real error.
                    let lower = msg.to_lowercase();
                    let level = if lower.contains("error") || lower.contains("fatal") || lower.contains("panic") || lower.contains("fail") {
                        "ERROR"
                    } else {
                        "INFO"
                    };
                    emit_log(&app_handle_err, level, &format!("[Tun2Socks] {}", msg));
                }
            }
        });
    }

    *state.child.lock().unwrap() = Some(child);
    *state.server_ip.lock().unwrap() = Some(server_ip.clone());

    // 6. WAIT for Interface (Premium Polling)
    emit_log(&app, "INFO", &format!("[Tun] Waiting for interface {}...", interface_name));
    if let Err(e) = wait_for_interface(interface_name, 5000) {
        // Cleanup if failed
        // We can't async call stop_tun easily here, so minimal cleanup
        // Real stop will happen via UI calling stop_tun
        return Err(e);
    }

    // SAFETY SLEEP: Windows interfaces can be "visible" but not "writable" immediately.
    // Batch file used timeout /t 3. V2 used min 500ms.
    // We add 1 second purely for stability.
    emit_log(&app, "INFO", "[Tun] Interface found. Stabilizing for 1s...");
    thread::sleep(Duration::from_millis(1000));

    // 7. Configure IP (Run via CMD for robustness - Step 6/9)
    // Using the EXACT command string from the verified batch file
    let cmd_string = format!(
        "netsh interface ip set address name=\"{}\" static {} {} gateway={} gwmetric=1",
        interface_name, tun_ip, tun_mask, tun_gw
    );

    emit_log(&app, "INFO", &format!("[Tun] Configuring IP via CMD: {}", cmd_string));
    if let Err(e) = run_command("cmd", &["/C", &cmd_string]) {
        return Err(format!("Failed to set IP: {}", e));
    }

    // 8. Configure DNS (Step 7/9)
    let dns_list = if let Some(servers) = dns_servers {
        if servers.is_empty() {
             "'1.1.1.1', '1.0.0.1'".to_string()
        } else {
            servers.iter().map(|s| format!("'{}'", s)).collect::<Vec<_>>().join(", ")
        }
    } else {
        "'1.1.1.1', '1.0.0.1'".to_string()
    };

    let ps_cmd = format!(
        "Set-DnsClientServerAddress -InterfaceAlias '{}' -ServerAddresses ({})",
        interface_name, dns_list
    );
    if let Err(e) = run_command(
        "powershell",
        &["-ExecutionPolicy", "Bypass", "-Command", &ps_cmd],
    ) {
        return Err(format!("Failed to set DNS: {}", e));
    }

    emit_log(&app, "INFO", "Tun Mode Started Successfully");
    Ok("Tun Mode Started Successfully".into())
}

#[tauri::command]
pub async fn stop_tun(app: AppHandle, state: State<'_, TunProcess>) -> Result<String, String> {
    emit_log(&app, "INFO", "Stopping Tun Mode...");
    let mut child_lock = state.child.lock().map_err(|e| e.to_string())?;

    // 1. Kill Process
    if let Some(mut child) = child_lock.take() {
        let _ = child.kill();
        emit_log(&app, "INFO", "Tun process killed.");
    }
    // FORCE KILL (Safety Net)
    let _ = Command::new("taskkill")
        .args(&["/F", "/IM", "tun2socks-windows-amd64.exe"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    // 2. Cleanup Route
    let mut ip_lock = state.server_ip.lock().unwrap();
    if let Some(ip) = ip_lock.take() {
        let msg = format!("[Tun] Cleaning up bypass route for {}", ip);
        emit_log(&app, "INFO", &msg);
        let _ = run_command("route", &["delete", &ip]);
    }

    // 3. Disable Kill Switch (Firewall)
    let rules = vec![
        "V-Nexus_KS_Block",
        "V-Nexus_KS_AllowVPN",
        "V-Nexus_KS_Lan",
        "V-Nexus_KS_DNS"
    ];
    for rule in rules {
        let _ = run_command("netsh", &["advfirewall", "firewall", "delete", "rule", &format!("name={}", rule)]);
    }
    emit_log(&app, "INFO", "[Tun] Kill switch rules removed.");

    // 4. Restore Default Gateway (If we deleted it or if it was overridden)
    // Since we moved to Firewall Kill Switch, we might not need this, but it's safe to check.
    let mut gw_lock = state.default_gateway.lock().unwrap();
    if let Some(_gw) = gw_lock.take() {
        // println!("[Tun] Restoring default gateway state: {}", gw); // No-op really
    }

    emit_log(&app, "INFO", "Tun Stopped Successfully.");
    Ok("Tun Stopped".into())
}

pub fn emergency_cleanup(app: &AppHandle) {
    println!("[Tun] Running Startup Emergency Cleanup...");
    
    // 1. Force Kill Tun2Socks
    let _ = Command::new("taskkill")
        .args(&["/F", "/IM", "tun2socks-windows-amd64.exe"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    // 2. Blindly Delete Firewall Rules (Kill Switch)
    let rules = vec![
        "V-Nexus_KS_Block",
        "V-Nexus_KS_AllowVPN",
        "V-Nexus_KS_Lan",
        "V-Nexus_KS_DNS"
    ];
    for rule in rules {
        let _ = run_command("netsh", &["advfirewall", "firewall", "delete", "rule", &format!("name={}", rule)]);
    }

    // 3. Delete Stale Tun Route (if exists)
    let _ = run_command(
        "route",
        &["delete", "0.0.0.0", "mask", "0.0.0.0", "10.0.0.1"],
    );
     // Also the legacy mapped one just in case
    let _ = run_command("route", &["delete", "0.0.0.0", "mask", "0.0.0.0", "10.4.2.1"]);

    println!("[Tun] Emergency Cleanup Complete.");
}
