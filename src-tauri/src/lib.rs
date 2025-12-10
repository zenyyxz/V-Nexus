use std::sync::Mutex;
use tauri::Manager;
use std::os::windows::process::CommandExt;

mod config;
mod proxy;
mod tray;
mod tun;
mod utils;
mod xray;

#[tauri::command]
fn get_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(xray::XrayProcess {
            child: Mutex::new(None),
        })
        .manage(tun::TunProcess {
            child: Mutex::new(None),
            server_ip: Mutex::new(None),
            default_gateway: Mutex::new(None),
        })
        .setup(|app| {
            // SAFETY: Emergency Cleanup on Startup
            // This fixes "Kill Switch Lockout" if the app crashed previously.
            tun::emergency_cleanup(app.handle());

            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;

            // Initialize Autostart
            app.handle().plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                Some(vec![]),
            ))?;

            // Initialize Updater
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            // Initialize Process
            app.handle().plugin(tauri_plugin_process::init())?;

            // Initialize Clipboard
            app.handle()
                .plugin(tauri_plugin_clipboard_manager::init())?;

            // Initialize Tray
            tray::create_tray(app.handle())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            xray::start_xray,
            xray::stop_xray,
            xray::is_xray_running,
            xray::get_xray_stats,
            get_version,
            tun::start_tun,
            tun::stop_tun,
            config::generate_config,
            proxy::set_system_proxy,
            utils::tcp_ping,
            utils::icmp_ping,
            utils::http_ping,
            utils::check_is_admin,
            utils::check_run_as_admin_configured,
            utils::set_run_as_admin,
            utils::get_memory_usage,
            utils::restart_as_admin,
            utils::capture_screen,
            utils::resolve_hostname
        ])
        .build(tauri::generate_context!())
        .expect("error building tauri application")
        .run(|app_handle, event| {
            match event {
                tauri::RunEvent::ExitRequested { .. } => {
                    cleanup_processes(app_handle);
                }
                // WindowEvent::CloseRequested case removed to allow app to exit on close
                _ => {}
            }
        });
}

fn cleanup_processes(app: &tauri::AppHandle) {
    // Cleanup Xray
    if let Ok(mut child_lock) = app.state::<xray::XrayProcess>().child.lock() {
        if let Some(mut child) = child_lock.take() {
            println!("Killing Xray process handle...");
            let _ = child.kill();
        }
    }
    // FORCE KILL Xray (Safety Net)
    let _ = std::process::Command::new("taskkill")
        .args(&["/F", "/IM", "xray.exe"])
        .creation_flags(0x08000000)
        .output();

    // Cleanup Tun
    if let Ok(mut child_lock) = app.state::<tun::TunProcess>().child.lock() {
        if let Some(mut child) = child_lock.take() {
            println!("Killing Tun process handle...");
            let _ = child.kill();
        }
    }
    // FORCE KILL Tun2Socks (Safety Net)
    let _ = std::process::Command::new("taskkill")
        .args(&["/F", "/IM", "tun2socks-windows-amd64.exe"])
        .creation_flags(0x08000000)
        .output();

    // Cleanup Routes (Using the public run_command from tun module)
    // We must clean up the bypass route and the TUN gateway
    if let Ok(mut ip_lock) = app.state::<tun::TunProcess>().server_ip.lock() {
        if let Some(ip) = ip_lock.take() {
            println!("Cleaning up routes on exit for server: {}", ip);
            // 1. Delete Bypass Route
            let _ = tun::run_command("route", &["delete", &ip]);

            // 2. Delete TUN Gateway Override
            let _ = tun::run_command(
                "route",
                &["delete", "0.0.0.0", "mask", "0.0.0.0", "10.0.0.1"],
            );
        }
    }
}
