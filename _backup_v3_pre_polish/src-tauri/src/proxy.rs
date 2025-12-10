use std::os::windows::process::CommandExt;
use std::process::Command;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[tauri::command]
pub fn set_system_proxy(enable: bool, port: u16) -> Result<String, String> {
    if enable {
        // 1. Set ProxyServer
        let proxy_server = format!("127.0.0.1:{}", port);
        let _ = run_reg_command(
            "add",
            &[
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
                "/v",
                "ProxyServer",
                "/t",
                "REG_SZ",
                "/d",
                &proxy_server,
                "/f",
            ],
        )?;

        // 2. Set ProxyEnable = 1
        let _ = run_reg_command(
            "add",
            &[
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
                "/v",
                "ProxyEnable",
                "/t",
                "REG_DWORD",
                "/d",
                "1",
                "/f",
            ],
        )?;

        Ok("System Proxy Enabled".into())
    } else {
        // Set ProxyEnable = 0
        let _ = run_reg_command(
            "add",
            &[
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
                "/v",
                "ProxyEnable",
                "/t",
                "REG_DWORD",
                "/d",
                "0",
                "/f",
            ],
        )?;
        Ok("System Proxy Disabled".into())
    }
}

fn run_reg_command(op: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd = Command::new("reg");
    cmd.arg(op);
    cmd.args(args);
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output().map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
