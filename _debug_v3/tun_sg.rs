use std::env;
use std::io::{self, Write};
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;

// CONSTANTS (V2 Logic)
const TUN_IP: &str = "10.0.0.2";
const TUN_GW: &str = "10.0.0.1";
const TUN_MASK: &str = "255.255.255.0";
const TUN_METRIC: &str = "1";
const BYPASS_METRIC: &str = "5";

fn main() {
    println!("=== V-Nexus SINGAPORE PROTOTYPE TEST ===");
    
    // Server Details from User
    let server_ip = "161.118.248.52"; 
    let socks_port = "10808";

    println!("Target Server: {}", server_ip);
    println!("SNI: aka.ms (ISP Bypass Mode)");

    // 1. Terminate Existing
    println!("\n[1/10] Terminating existing processes...");
    let _ = Command::new("taskkill").args(&["/F", "/IM", "xray.exe"]).output();
    let _ = Command::new("taskkill").args(&["/F", "/IM", "tun2socks-windows-amd64.exe"]).output();
    thread::sleep(Duration::from_secs(1));

    // 2. Clean Routes
    println!("[2/10] Cleaning old routes...");
    run_cmd("route", &["delete", server_ip]);
    run_cmd("route", &["delete", "0.0.0.0", "mask", "0.0.0.0", TUN_GW]);
    run_cmd("route", &["delete", "0.0.0.0", "mask", "0.0.0.0", "10.4.2.1"]);

    // 3. Detect and Add Bypass Route
    println!("[3/10] Adding Physical Bypass Route...");
    let gateway = match get_physical_gateway() {
        Ok(gw) => gw,
        Err(e) => {
            eprintln!("CRITICAL ERROR: Failed to detect physical gateway: {}", e);
            return;
        }
    };
    println!("Detected Physical Gateway: {}", gateway);
    
    // route add <SERVER_IP> mask 255.255.255.255 <PHYSICAL_GW> metric 5
    if let Err(e) = run_cmd("route", &["add", server_ip, "mask", "255.255.255.255", &gateway, "metric", BYPASS_METRIC]) {
        eprintln!("Failed to add bypass route: {:?}", e);
    }

    // 4. Start Xray (Singapore Config) - SEPARATE WINDOW (PowerShell Method)
    println!("[4/10] Starting Xray Core (New Window)...");
    let xray_path = std::env::current_dir().unwrap().join("resources/xray/xray.exe");
    let config_path = std::env::current_dir().unwrap().join("singapore.json");
    
    if xray_path.exists() && config_path.exists() {
        let xray_exe = xray_path.to_str().unwrap();
        let config_str = config_path.to_str().unwrap();
        let ps_cmd = format!("& '{}' run -c '{}'", xray_exe, config_str);

        // cmd /c start powershell -NoExit -Command ...
        let _ = Command::new("cmd")
            .args(&[
                "/C", "start", "powershell", 
                "-NoExit", 
                "-Command", &ps_cmd
            ])
            .spawn()
            .expect("Failed to spawn Xray");
        thread::sleep(Duration::from_secs(3));
    } else {
        eprintln!("CRITICAL: Xray binary or singapore.json not found!");
        return;
    }

    // 5. Start Tun2Socks - SEPARATE WINDOW (PowerShell Method)
    println!("[5/10] Starting Tun2Socks (New Window)...");
    let tun2socks_path = std::env::current_dir().unwrap().join("resources/tun2socks/tun2socks-windows-amd64.exe");
    
    if !tun2socks_path.exists() {
        eprintln!("CRITICAL: Tun2Socks binary not found at {:?}", tun2socks_path);
        return;
    }

    let exe_path = tun2socks_path.to_str().unwrap();
    // PowerShell escaping: single quotes for the path.
    // & 'C:\Path With Spaces\exe' -arg1 ...
    let ps_command = format!(
        "& '{}' -device tun://tun0 -proxy socks5://127.0.0.1:{} -loglevel info",
        exe_path, socks_port
    );

    // Launch a new PowerShell window that stays open (-NoExit)
    let _ = Command::new("cmd")
        .args(&[
            "/C", 
            "start", 
            "powershell",
            "-NoExit",
            "-Command", 
            &ps_command
        ])
        .spawn();

    println!("Tun2Socks launching in PowerShell window...");
    thread::sleep(Duration::from_secs(5));

    // 6. Configure IP (Netsh)
    println!("[6/10] Configuring TUN Interface IP & Gateway...");
    let ip_cmd = format!(
        "netsh interface ip set address name=\"tun0\" static {} {} gateway={} gwmetric={}",
        TUN_IP, TUN_MASK, TUN_GW, TUN_METRIC
    );
    if let Err(e) = run_cmd("cmd", &["/C", &ip_cmd]) {
        eprintln!("Failed to set IP: {:?}", e);
    }

    // 7. Configure DNS
    println!("[7/10] Configuring DNS...");
    let ps_dns = format!(
        "Set-DnsClientServerAddress -InterfaceAlias 'tun0' -ServerAddresses ('1.1.1.1', '1.0.0.1')"
    );
    if let Err(e) = run_cmd("powershell", &["-ExecutionPolicy", "Bypass", "-Command", &ps_dns]) {
        eprintln!("Failed to set DNS: {:?}", e);
    }

    println!("\n=== TUN INTERFACE UP - VERIFYING CONNECTION ===");
    thread::sleep(Duration::from_secs(4));

    // 8. VERIFICATION CURL
    println!("[8/10] Checking Region via ip-api.com (VERBOSE)...");
    println!("> curl -v http://ip-api.com/json");
    let curl_out = Command::new("curl")
        .args(&["-v", "http://ip-api.com/json"]) // Added -v for verbose
        .output();
        
    match curl_out {
        Ok(out) => {
            println!("--- CURL STDERR (Connection Info) ---");
            println!("{}", String::from_utf8_lossy(&out.stderr));
            println!("--- CURL STDOUT (Response Body) ---");
            let body = String::from_utf8_lossy(&out.stdout);
            println!("{}", body);
            
            if body.to_lowercase().contains("singapore") {
                println!("\nSUCCESS: REGION IS SINGAPORE! PROTOCOL VERIFIED.");
            } else {
                println!("\nWARNING: Region match failed or connection error.");
            }
        },
        Err(e) => eprintln!("Curl failed: {}", e),
    }
    
    // 9. Check Wait
    println!("\nPress ENTER to stop and clean up...");
    let mut input = String::new();
    let _ = io::stdin().read_line(&mut input);

    // CLEANUP
    println!("Stopping...");
    // Taskkill is safer since they are in separate windows now
    let _ = Command::new("taskkill").args(&["/F", "/IM", "xray.exe"]).output();
    let _ = Command::new("taskkill").args(&["/F", "/IM", "tun2socks-windows-amd64.exe"]).output();
    
    println!("Cleaning routes...");
    let _ = run_cmd("route", &["delete", server_ip]);
    let _ = run_cmd("route", &["delete", "0.0.0.0", "mask", "0.0.0.0", TUN_GW]);

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
