use std::io::{BufRead, BufReader};
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use tauri::{AppHandle, Emitter, Manager, State};

// Windows constant for hiding console window
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub struct XrayProcess {
    pub child: Mutex<Option<Child>>,
}

#[derive(Clone, serde::Serialize)]
struct LogPayload {
    level: String,
    message: String,
}

fn get_xray_binary_path(app: &AppHandle) -> PathBuf {
    let mut check_paths = vec![];

    // 1. Prod: Tauri Resource Dir
    if let Ok(res_dir) = app.path().resource_dir() {
        check_paths.push(res_dir.join("resources").join("xray").join("xray.exe"));
        // Some setups might flatten it?
        check_paths.push(res_dir.join("xray.exe"));
    }

    // 2. Dev: Relative to CWD (Project Root)
    check_paths.push(PathBuf::from("resources/xray/xray.exe"));

    // 3. Dev: Relative to src-tauri (if CWD is src-tauri)
    check_paths.push(PathBuf::from("../resources/xray/xray.exe"));

    for path in check_paths {
        if path.exists() {
            // Return absolute path to avoid ambiguity
            return std::fs::canonicalize(&path).unwrap_or(path);
        }
    }

    // Fallback
    PathBuf::from("xray.exe")
}

fn get_xray_assets_path(app: &AppHandle) -> PathBuf {
    let mut check_paths = vec![];

    // 1. Prod
    if let Ok(res_dir) = app.path().resource_dir() {
        check_paths.push(res_dir.join("resources").join("xray"));
    }

    // 2. Dev
    check_paths.push(PathBuf::from("resources/xray"));
    check_paths.push(PathBuf::from("../resources/xray"));

    for path in check_paths {
        if path.exists() {
            return std::fs::canonicalize(&path).unwrap_or(path);
        }
    }

    PathBuf::from(".")
}

#[tauri::command]
pub async fn start_xray(
    app: AppHandle,
    state: State<'_, XrayProcess>,
    config_path: String,
) -> Result<String, String> {
    let mut child_lock = state.child.lock().map_err(|e| e.to_string())?;

    if child_lock.is_some() {
        // Already running, stop it first? Or return error?
        // Let's stop it
        if let Some(mut child) = child_lock.take() {
            let _ = child.kill();
        }
    }

    let xray_path = get_xray_binary_path(&app);
    let asset_path = get_xray_assets_path(&app);

    // Verify existence (Simple check)
    // Verify existence (Simple check)
    if !xray_path.exists() {
        println!("Warning: Xray binary not found at {:?}", xray_path);
    }

    println!("Starting Xray: {:?}", xray_path);

    let mut cmd = Command::new(xray_path);
    cmd.arg("run");
    cmd.arg("-c");
    cmd.arg(&config_path);

    // Set environment variable for assets
    cmd.env("XRAY_LOCATION_ASSET", &asset_path);

    // Hide Window
    cmd.creation_flags(CREATE_NO_WINDOW);

    // Pipe output
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn Xray: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    // Stream logs
    let app_handle_out = app.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(msg) = line {
                let _ = app_handle_out.emit(
                    "xray-log",
                    LogPayload {
                        level: "INFO".into(),
                        message: msg,
                    },
                );
            }
        }
    });

    let app_handle_err = app.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(msg) = line {
                let _ = app_handle_err.emit(
                    "xray-log",
                    LogPayload {
                        level: "ERROR".into(),
                        message: msg,
                    },
                );
            }
        }
    });

    *child_lock = Some(child);

    Ok("Xray started".into())
}

#[tauri::command]
pub async fn stop_xray(state: State<'_, XrayProcess>) -> Result<String, String> {
    let mut child_lock = state.child.lock().map_err(|e| e.to_string())?;

    if let Some(mut child) = child_lock.take() {
        child
            .kill()
            .map_err(|e| format!("Failed to kill process: {}", e))?;
            
        // FORCE KILL (Safety Net)
        let _ = Command::new("taskkill")
            .args(&["/F", "/IM", "xray.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
            
        Ok("Xray stopped".into())
    } else {
        Ok("Xray was not running".into())
    }
}

#[tauri::command]
pub fn is_xray_running(state: State<'_, XrayProcess>) -> bool {
    // Check if child is Some
    let child_lock = state.child.lock().unwrap();
    child_lock.is_some()
}

#[tauri::command]
pub async fn get_xray_stats(app: AppHandle) -> Result<serde_json::Value, String> {
    // 1. Get Xray Binary Path
    let xray_path = get_xray_binary_path(&app);

    // 2. Run API Command in background thread (non-blocking)
    let output_result = tauri::async_runtime::spawn_blocking(move || {
        Command::new(xray_path)
            .args(&["api", "statsquery", "--server=127.0.0.1:10085"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
    })
    .await;

    // Handle JoinError
    let output = output_result
        .map_err(|e| format!("Task join error: {}", e))?
        .map_err(|e| format!("Command exec error: {}", e))?;

    let mut uploaded: i64 = 0;
    let mut downloaded: i64 = 0;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);

        // Parse as JSON
        if let Ok(json_output) = serde_json::from_str::<serde_json::Value>(&stdout) {
            if let Some(stats) = json_output.get("stat").and_then(|s| s.as_array()) {
                for stat in stats {
                    let name = stat.get("name").and_then(|n| n.as_str()).unwrap_or("");
                    let value = stat.get("value").and_then(|v| v.as_i64()).unwrap_or(0);

                    if name == "outbound>>>proxy>>>traffic>>>uplink" {
                        uploaded += value;
                    } else if name == "outbound>>>proxy>>>traffic>>>downlink" {
                        downloaded += value;
                    }
                }
            }
        }
    }

    Ok(serde_json::json!({
        "uploaded": uploaded,
        "downloaded": downloaded
    }))
}
