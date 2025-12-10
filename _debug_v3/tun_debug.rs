use std::env;
use std::io;
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;

// CONSTANTS (Matching init_tun_mode.bat)
const TUN_IP: &str = "10.0.0.2";
const TUN_GW: &str = "10.0.0.1";
const TUN_MASK: &str = "255.255.255.0";
const TUN_DNS: &str = "1.1.1.1,1.0.0.1";
const TUN_METRIC: &str = "1"; // Critical for hijacking traffic
const BYPASS_METRIC: &str = "5"; // Lower than default (25+) but higher than TUN (1)

fn main() {
    println!("=== V-Nexus TUN Prototype (V2 Logic) ===");
    
    // 0. Arguments
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        println!("Usage: tun_debug <SERVER_IP> [SOCKS_PORT]");
        println!("Example: tun_debug 161.118.248.52 10808");
        return;
    }
    let server_ip = &args[1];
    let socks_port = if args.len() > 2 { &args[2] } else { "10808" };

    println!("Target Server: {}", server_ip);
    println!("Socks Port: {}", socks_port);

    // 1. Terminate Existing
    println!("\n[1/9] Terminating existing processes...");
    let _ = Command::new("taskkill").args(&["/F", "/IM", "xray.exe"]).output();
    let _ = Command::new("taskkill").args(&["/F", "/IM", "tun2socks-windows-amd64.exe"]).output();
    thread::sleep(Duration::from_secs(1));

    // 2. Clean Routes
    println!("[2/9] Cleaning old routes...");
    run_cmd("route", &["delete", server_ip]);
    run_cmd("route", &["delete", "0.0.0.0", "mask", "0.0.0.0", TUN_GW]);
    // Also clean the standard one just in case
    run_cmd("route", &["delete", "0.0.0.0", "mask", "0.0.0.0", "10.4.2.1"]);

    // 3. Detect and Add Bypass Route
    println!("[3/9] Adding Physical Bypass Route...");
    let gateway = match get_physical_gateway() {
        Ok(gw) => gw,
        Err(e) => {
            eprintln!("CRITICAL ERROR: Failed to detect physical gateway: {}", e);
            return;
        }
    };
    println!("Detected Physical Gateway: {}", gateway);
    
    // Batch: route add 161.118... mask ... 192.168.8.1 metric 5
    if let Err(e) = run_cmd("route", &["add", server_ip, "mask", "255.255.255.255", &gateway, "metric", BYPASS_METRIC]) {
        eprintln!("Failed to add bypass route: {:?}", e);
    }

    // 4. Start Xray (Self-Contained)
    println!("[4/9] Starting Xray Core via test config...");
    // Config path: ../_backup_tun_debug/test-xray-socks.json
    // We assume running from src-tauri, so path is valid relative to project root or we find it
    let mut xray_path = std::env::current_dir().unwrap().join("resources/xray/xray.exe");
    if !xray_path.exists() {
        xray_path = std::env::current_dir().unwrap().join("../resources/xray/xray.exe");
    }
    
    let config_path = std::env::current_dir().unwrap().join("../_backup_tun_debug/test-xray-socks.json");
    
    if xray_path.exists() && config_path.exists() {
        println!("Spawning Xray: {:?} -c {:?}", xray_path, config_path);
        let xray_child = Command::new(&xray_path)
            .arg("run")
            .arg("-c")
            .arg(&config_path)
            .stdout(Stdio::null()) // Less noise
            .stderr(Stdio::inherit())
            .spawn();
            
        match xray_child {
            Ok(p) => {
                println!("Xray started (PID: {})", p.id());
                // Store to kill later? We rely on taskkill in step 1 or manual cleanup
            },
            Err(e) => eprintln!("Failed to start Xray: {}", e),
        }
        thread::sleep(Duration::from_secs(2));
    } else {
        println!("WARNING: Xray binary or config not found. Assuming external proxy.");
    }


    // 5. Start Tun2Socks
    println!("[5/9] Starting Tun2Socks...");
    let mut tun2socks_path = std::env::current_dir().unwrap().join("resources/tun2socks/tun2socks-windows-amd64.exe");
    if !tun2socks_path.exists() {
        // Try fallback path in src-tauri
        tun2socks_path = std::env::current_dir().unwrap().join("src-tauri/resources/tun2socks/tun2socks-windows-amd64.exe");
    }
    
    if !tun2socks_path.exists() {
        eprintln!("CRITICAL: Tun2Socks binary not found at {:?}", tun2socks_path);
        return;
    }

    // Command: tun2socks -device tun://tun0 -proxy socks5://127.0.0.1:10808
    let tun_child = Command::new(&tun2socks_path)
        .arg("-device").arg("tun://tun0")
        .arg("-proxy").arg(format!("socks5://127.0.0.1:{}", socks_port))
        .arg("-loglevel").arg("info")
        .stdout(Stdio::inherit()) // Show output directly
        .stderr(Stdio::inherit())
        .spawn();

    let mut tun_process = match tun_child {
        Ok(p) => p,
        Err(e) => {
            eprintln!("Failed to start Tun2Socks: {}", e);
            return;
        }
    };

    println!("Tun2Socks started (PID: {})", tun_process.id());
    thread::sleep(Duration::from_secs(3)); // Wait for interface

    // 6. Configure IP (Netsh)
    println!("[6/9] Configuring TUN Interface IP & Gateway...");
    // netsh interface ip set address name="tun0" static 10.0.0.2 255.255.255.0 gateway=10.0.0.1 gwmetric=1
    let ip_cmd = format!(
        "netsh interface ip set address name=\"tun0\" static {} {} gateway={} gwmetric={}",
        TUN_IP, TUN_MASK, TUN_GW, TUN_METRIC
    );
    if let Err(e) = run_cmd("cmd", &["/C", &ip_cmd]) {
        eprintln!("Failed to set IP: {:?}", e);
    }

    // 7. Configure DNS
    println!("[7/9] Configuring DNS...");
    // powershell -Command "Set-DnsClientServerAddress ..."
    let ps_dns = format!(
        "Set-DnsClientServerAddress -InterfaceAlias 'tun0' -ServerAddresses ('1.1.1.1', '1.0.0.1')"
    );
    if let Err(e) = run_cmd("powershell", &["-ExecutionPolicy", "Bypass", "-Command", &ps_dns]) {
        eprintln!("Failed to set DNS: {:?}", e);
    }

    println!("\n=== TUN INTERFACE UP ===");
    println!("Press ENTER to stop and clean up...");
    
    let mut input = String::new();
    let _ = io::stdin().read_line(&mut input);

    // CLEANUP
    println!("Stopping...");
    let _ = tun_process.kill();
    
    println!("Cleaning routes...");
    run_cmd("route", &["delete", server_ip]);
    run_cmd("route", &["delete", "0.0.0.0", "mask", "0.0.0.0", TUN_GW]);

    println!("Done.");
}

// Helpers
fn run_cmd(cmd: &str, args: &[&str]) -> Result<(), String> {
    println!("> {} {:?}", cmd, args);
    let status = Command::new(cmd)
        .args(args)
        .status()
        .map_err(|e| e.to_string())?;
    
    if !status.success() {
        return Err(format!("Exited with code {:?}", status.code()));
    }
    Ok(())
}

fn get_physical_gateway() -> Result<String, String> {
    // Robust PowerShell detection
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
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let gw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if gw.is_empty() || !gw.contains('.') {
        return Err("No valid gateway found".into());
    }
    Ok(gw)
}
