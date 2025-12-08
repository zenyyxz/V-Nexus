use std::process::{Command, Child, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use std::path::PathBuf;
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

pub struct XrayState {
    pub process: Mutex<Option<Child>>,
}

impl XrayState {
    pub fn new() -> Self {
        Self {
            process: Mutex::new(None),
        }
    }
}

fn get_xray_path(app: &AppHandle) -> Result<(PathBuf, PathBuf), String> {
    let resource_dir = app.path().resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    // In dev: resources/xray/xray.exe (relative to cwd)
    // In prod: resource_dir/xray/xray.exe
    
    // Check production path first
    let prod_bin = resource_dir.join("xray").join("xray.exe");
    let prod_assets = resource_dir.join("xray");

    if prod_bin.exists() {
        return Ok((prod_bin, prod_assets));
    }

    // Check dev path (current dir/resources/xray)
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    let dev_bin = cwd.join("resources").join("xray").join("xray.exe");
    let dev_assets = cwd.join("resources").join("xray");

    if dev_bin.exists() {
        return Ok((dev_bin, dev_assets));
    }

    Err("Xray binary not found".to_string())
}

#[tauri::command]
pub fn start_xray(
    app: AppHandle,
    state: State<'_, XrayState>,
    config_path: String,
) -> Result<String, String> {
    let mut process_guard = state.process.lock().map_err(|e| e.to_string())?;

    if process_guard.is_some() {
        // Already running, verify if alive
        // For simplicity, we just stop and restart or return error.
        // Let's stop and restart to be safe.
        if let Some(mut child) = process_guard.take() {
            let _ = child.kill();
        }
    }

    let (bin_path, asset_path) = get_xray_path(&app)?;

    let child = Command::new(&bin_path)
        .arg("run")
        .arg("-c")
        .arg(&config_path)
        .env("XRAY_LOCATION_ASSET", &asset_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW) 
        .spawn()
        .map_err(|e| format!("Failed to spawn Xray: {}", e))?;

    *process_guard = Some(child);

    Ok("Xray started successfully".to_string())
}

#[tauri::command]
pub fn stop_xray(state: State<'_, XrayState>) -> Result<String, String> {
    let mut process_guard = state.process.lock().map_err(|e| e.to_string())?;

    if let Some(mut child) = process_guard.take() {
        child.kill().map_err(|e| e.to_string())?;
        Ok("Xray stopped".to_string())
    } else {
        Ok("Xray was not running".to_string())
    }
}
