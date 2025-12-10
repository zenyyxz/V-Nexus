use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use std::fs::File;
use std::io::Write;
use tauri::AppHandle;
use tauri::Manager;
use tauri::Emitter;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub log_level: String,
    pub allow_insecure: bool,
    pub mux_enabled: bool,
    pub mux_concurrency: u32,
    pub dns_query_strategy: String,
    pub dns_disable_cache: bool,
    pub dns_disable_fallback: bool,
    pub selected_dns_server: String,
    pub custom_dns_servers: Vec<String>,
    pub proxy_type: String,
    pub custom_proxy_type: String, // 'http' | 'socks'
    pub custom_proxy_server: String,
    pub custom_proxy_port: u16,
    pub tun_mode: bool,
    pub socks_port: Option<u16>,
    pub http_port: Option<u16>,
    pub bypass_private_addresses: bool,
    pub bypass_cn_mainland: bool,
    pub bypass_bittorrent: bool,
    pub routing_mode: String,

    // Inbound Settings
    pub socks_auth_enabled: Option<bool>,
    pub socks_username: Option<String>,
    pub socks_password: Option<String>,
    pub socks_sniffing: Option<bool>,
    pub socks_dest_override_http: Option<bool>,
    pub socks_dest_override_tls: Option<bool>,

    pub http_auth_enabled: Option<bool>,
    pub http_username: Option<String>,
    pub http_password: Option<String>,
    pub http_sniffing: Option<bool>,
    pub http_dest_override_http: Option<bool>,
    pub http_dest_override_tls: Option<bool>,

    // Browser Forwarder
    pub browser_forwarder_address: Option<String>,
    pub browser_forwarder_port: Option<u16>,

    // Connection
    pub force_direct_connection: Option<bool>,

    // Forward Proxy
    pub forward_proxy_enabled: Option<bool>,
    pub forward_proxy_type: Option<String>,
    pub forward_proxy_host: Option<String>,
    pub forward_proxy_port: Option<u16>,
    pub forward_proxy_auth_enabled: Option<bool>,
    pub forward_proxy_username: Option<String>,
    pub forward_proxy_password: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub protocol: String,
    pub address: String,
    pub port: u16,
    pub uuid: String,
    pub password: Option<String>,
    pub alter_id: Option<u16>,
    pub security: Option<String>,
    pub encryption: Option<String>,
    pub flow: Option<String>,
    pub network: Option<String>,
    pub header_type: Option<String>,
    pub path: Option<String>,
    pub host: Option<String>,
    pub service_name: Option<String>,
    pub mode: Option<String>,
    pub tls: Option<String>,
    pub sni: Option<String>,
    pub allow_insecure: Option<bool>,
    pub alpn: Option<String>,
    pub fingerprint: Option<String>,
    pub public_key: Option<String>,
    pub short_id: Option<String>,
    pub spider_x: Option<String>,
    pub method: Option<String>,
    pub email: Option<String>,
}

fn generate_inbounds(settings: &AppSettings) -> Vec<Value> {
    let socks_port = settings.socks_port.unwrap_or(10808);
    let http_port = settings.http_port.unwrap_or(10809);
    println!("[Config] Generating config with SOCKS Port: {}, HTTP Port: {}", socks_port, http_port);

    // SOCKS Inbound
    let mut socks_settings = json!({
        "udp": true,
        "ip": "127.0.0.1"
    });

    if settings.socks_auth_enabled.unwrap_or(false) {
        socks_settings
            .as_object_mut()
            .unwrap()
            .insert("auth".to_string(), json!("password"));
        socks_settings.as_object_mut().unwrap().insert(
            "accounts".to_string(),
            json!([
                {
                    "user": settings.socks_username.as_deref().unwrap_or("user"),
                    "pass": settings.socks_password.as_deref().unwrap_or("pass")
                }
            ]),
        );
    } else {
        socks_settings
            .as_object_mut()
            .unwrap()
            .insert("auth".to_string(), json!("noauth"));
    }

    let mut socks_sniffing_overrides = Vec::new();
    if settings.socks_dest_override_http.unwrap_or(true) {
        socks_sniffing_overrides.push("http");
    }
    if settings.socks_dest_override_tls.unwrap_or(true) {
        socks_sniffing_overrides.push("tls");
    }

    let socks_inbound = json!({
        "tag": "socks-in",
        "port": socks_port,
        "listen": "127.0.0.1",
        "protocol": "socks",
        "settings": socks_settings,
        "sniffing": {
            "enabled": settings.socks_sniffing.unwrap_or(true),
            "destOverride": socks_sniffing_overrides
        }
    });

    // HTTP Inbound
    let mut http_settings = json!({
        "timeout": 360
    });

    if settings.http_auth_enabled.unwrap_or(false) {
        http_settings.as_object_mut().unwrap().insert(
            "accounts".to_string(),
            json!([
                {
                    "user": settings.http_username.as_deref().unwrap_or("user"),
                    "pass": settings.http_password.as_deref().unwrap_or("pass")
                }
            ]),
        );
    }

    let mut http_sniffing_overrides = Vec::new();
    if settings.http_dest_override_http.unwrap_or(true) {
        http_sniffing_overrides.push("http");
    }
    if settings.http_dest_override_tls.unwrap_or(true) {
        http_sniffing_overrides.push("tls");
    }

    let http_inbound = json!({
        "tag": "http-in",
        "port": http_port,
        "listen": "127.0.0.1",
        "protocol": "http",
        "settings": http_settings,
        "sniffing": {
            "enabled": settings.http_sniffing.unwrap_or(true),
            "destOverride": http_sniffing_overrides
        }
    });

    let mut inbounds = vec![
        socks_inbound,
        http_inbound,
        json!({
            "tag": "api",
            "port": 10085,
            "listen": "127.0.0.1",
            "protocol": "dokodemo-door",
            "settings": {
                "address": "127.0.0.1"
            }
        }),
    ];

    // Browser Forwarder
    if let (Some(addr), Some(port)) = (
        &settings.browser_forwarder_address,
        settings.browser_forwarder_port,
    ) {
        if !addr.is_empty() && port > 0 {
            inbounds.push(json!({
               "tag": "browser-forwarder",
               "port": port,
               "listen": addr,
               "protocol": "socks",
               "settings": {
                   "auth": "noauth",
                   "udp": true,
                   "ip": "127.0.0.1"
               }
            }));
        }
    }

    inbounds
}

fn generate_dns(settings: &AppSettings) -> Value {
    let mut servers = Vec::new();

    // Parse selected DNS server
    if settings.selected_dns_server.starts_with("DoU:") {
        if let Some(ip) = settings.selected_dns_server.split(':').nth(1) {
            if !ip.trim().is_empty() {
                servers.push(json!(ip.trim()));
            }
        }
    } else if settings.selected_dns_server.starts_with("DoH:") {
        let url = &settings.selected_dns_server[4..].trim();
        if !url.is_empty() {
            servers.push(json!(url));
        }
    }

    // Custom DNS
    for s in &settings.custom_dns_servers {
        if !s.trim().is_empty() {
            servers.push(json!(s));
        }
    }

    // Default Fallback
    if servers.is_empty() {
        servers.push(json!("1.1.1.1"));
        servers.push(json!("8.8.8.8"));
    }

    json!({
        "queryStrategy": settings.dns_query_strategy,
        "disableCache": settings.dns_disable_cache,
        "disableFallback": settings.dns_disable_fallback,
        "servers": servers
    })
}

fn generate_stream_settings(profile: &Profile, settings: &AppSettings) -> Value {
    let network = profile.network.as_deref().unwrap_or("tcp");
    let mut stream_settings = json!({
        "network": network
    });

    // Transport Settings
    match network {
        "tcp" => {
            if let Some(header_type) = &profile.header_type {
                stream_settings.as_object_mut().unwrap().insert(
                    "tcpSettings".to_string(),
                    json!({
                        "header": {
                            "type": header_type
                        }
                    }),
                );
            }
        }
        "ws" => {
            let mut ws_settings = json!({
                "path": profile.path.as_deref().unwrap_or("/")
            });
            if let Some(host) = &profile.host {
                ws_settings.as_object_mut().unwrap().insert(
                    "headers".to_string(),
                    json!({
                        "Host": host
                    }),
                );
            }
            stream_settings
                .as_object_mut()
                .unwrap()
                .insert("wsSettings".to_string(), ws_settings);
        }
        "h2" | "http" => {
            let host_arr = if let Some(host) = &profile.host {
                vec![host.clone()]
            } else {
                vec![]
            };
            stream_settings.as_object_mut().unwrap().insert(
                "httpSettings".to_string(),
                json!({
                    "host": host_arr,
                    "path": profile.path.as_deref().unwrap_or("/")
                }),
            );
        }
        "grpc" => {
            stream_settings.as_object_mut().unwrap().insert(
                "grpcSettings".to_string(),
                json!({
                    "serviceName": profile.service_name.as_deref().unwrap_or(""),
                    "multiMode": profile.mode.as_deref() == Some("multi")
                }),
            );
        }
        _ => {}
    }

    // TLS Settings
    let tls_type = profile.tls.as_deref().unwrap_or("");
    if tls_type == "tls" {
        stream_settings
            .as_object_mut()
            .unwrap()
            .insert("security".to_string(), json!("tls"));
        let mut tls_settings = json!({
            "serverName": profile.sni.as_deref().or(profile.host.as_deref()).or(Some(&profile.address)),
            "allowInsecure": settings.allow_insecure, // Use setting but profile could override if we wanted
            "alpn": profile.alpn.as_deref().map(|s| s.split(',').collect::<Vec<&str>>()).unwrap_or(vec![])
        });
        if let Some(fp) = &profile.fingerprint {
            tls_settings
                .as_object_mut()
                .unwrap()
                .insert("fingerprint".to_string(), json!(fp));
        }
        stream_settings
            .as_object_mut()
            .unwrap()
            .insert("tlsSettings".to_string(), tls_settings);
    } else if tls_type == "reality" {
        stream_settings
            .as_object_mut()
            .unwrap()
            .insert("security".to_string(), json!("reality"));
        stream_settings.as_object_mut().unwrap().insert("realitySettings".to_string(), json!({
             "serverName": profile.sni.as_deref().or(profile.host.as_deref()).or(Some(&profile.address)),
             "fingerprint": profile.fingerprint.as_deref().unwrap_or("chrome"),
             "publicKey": profile.public_key.as_deref().unwrap_or(""),
             "shortId": profile.short_id.as_deref().unwrap_or(""),
             "spiderX": profile.spider_x.as_deref().unwrap_or("")
        }));
    }

    // Sockopt for Proxy Chaining (Forward Proxy or Custom Proxy)
    // Priority: Forward Proxy (Global) > Custom Proxy (Per-mode check)
    // If Forward Proxy is enabled, we chain to it.
    if settings.forward_proxy_enabled.unwrap_or(false) && settings.forward_proxy_host.is_some() {
        let sockopt = json!({
             "dialerProxy": "forward-proxy"
        });
        stream_settings
            .as_object_mut()
            .unwrap()
            .insert("sockopt".to_string(), sockopt);
    } else if settings.proxy_type == "custom" && !settings.custom_proxy_server.is_empty() {
        let sockopt = json!({
             "dialerProxy": "proxy-out"
        });
        stream_settings
            .as_object_mut()
            .unwrap()
            .insert("sockopt".to_string(), sockopt);
    }

    stream_settings
}

fn generate_outbound(profile: &Profile, settings: &AppSettings) -> Value {
    let protocol = profile.protocol.to_lowercase();
    let mut settings_obj = json!({});

    match protocol.as_str() {
        "vmess" => {
            settings_obj = json!({
                "vnext": [{
                    "address": profile.address,
                    "port": profile.port,
                    "users": [{
                        "id": profile.uuid,
                        "alterId": profile.alter_id.unwrap_or(0),
                        "security": profile.security.as_deref().unwrap_or("auto")
                    }]
                }]
            });
        }
        "vless" => {
            settings_obj = json!({
                "vnext": [{
                    "address": profile.address,
                    "port": profile.port,
                    "users": [{
                        "id": profile.uuid,
                        "encryption": profile.encryption.as_deref().unwrap_or("none"),
                        "flow": profile.flow.as_deref().unwrap_or("")
                    }]
                }]
            });
        }
        "trojan" => {
            settings_obj = json!({
                "servers": [{
                    "address": profile.address,
                    "port": profile.port,
                    "password": profile.password.as_deref().unwrap_or(&profile.uuid),
                    "email": profile.email.as_deref().unwrap_or("")
                }]
            });
        }
        "shadowsocks" => {
            settings_obj = json!({
                "servers": [{
                    "address": profile.address,
                    "port": profile.port,
                    "method": profile.method.as_deref().unwrap_or("aes-256-gcm"),
                    "password": profile.password.as_deref().unwrap_or(""),
                    "uot": false
                }]
            });
        }
        _ => {
            // Unsupported or error, return empty but safe
            eprintln!("Unsupported protocol: {}", protocol);
        }
    }

    let mut outbound = json!({
        "tag": "proxy",
        "protocol": protocol,
        "settings": settings_obj,
        "streamSettings": generate_stream_settings(profile, settings)
    });

    if settings.mux_enabled {
        outbound.as_object_mut().unwrap().insert(
            "mux".to_string(),
            json!({
                "enabled": true,
                "concurrency": settings.mux_concurrency
            }),
        );
    }

    outbound
}

fn generate_routing(settings: &AppSettings) -> Value {
    let mut rules = vec![json!({
        "type": "field",
        "inboundTag": ["api"],
        "outboundTag": "api"
    })];

    // 0. Force Direct (High Priority)
    if settings.force_direct_connection.unwrap_or(false) {
        rules.push(json!({
            "type": "field",
            "port": "0-65535", // Match everything
            "outboundTag": "direct"
        }));
        // If we force direct, we might stop processing other rules?
        // V2Ray processes rules top-down. First match wins.
        // So this will send everything direct effectively.
    }

    // Determine effective bypass flags based on Routing Mode
    let (bypass_private, bypass_cn) = match settings.routing_mode.as_str() {
        "bypass-lan" => (true, false),
        "bypass-china" => (true, true),
        "global" => (false, false),
        "custom" | _ => (
            settings.bypass_private_addresses,
            settings.bypass_cn_mainland,
        ),
    };

    // 1. Bypass Private Addresses
    if bypass_private {
        rules.push(json!({
            "type": "field",
            "ip": ["geoip:private"],
            "outboundTag": "direct"
        }));
    }

    // 2. Bypass CN Mainland
    if bypass_cn {
        rules.push(json!({
            "type": "field",
            "domain": ["geosite:cn"],
            "outboundTag": "direct"
        }));
        rules.push(json!({
            "type": "field",
            "ip": ["geoip:cn"],
            "outboundTag": "direct"
        }));
    }

    // 3. Block Ads (Default)
    rules.push(json!({
        "type": "field",
        "domain": ["geosite:category-ads-all"],
        "outboundTag": "block"
    }));

    // 4. Block Bittorrent
    if settings.bypass_bittorrent {
        // UI says "Bypass", but usually means "Block" or "Direct"?
        // If "Bypass" means "Don't proxy", then Direct.
        // If "Block" means "Prevent usage", then Block.
        // V2Ray clients usually "Block" BT to protect servers.
        // Let's assume the user intent is "Block BT traffic from Proxy".
        rules.push(json!({
            "type": "field",
            "protocol": ["bittorrent"],
            "outboundTag": "direct" // Or block? Direct is safer to avoid account bans.
        }));
    }

    json!({
        "domainStrategy": "IPIfNonMatch",
        "rules": rules
    })
}

#[derive(Serialize)]
pub struct ConfigResult {
    pub path: String,
    pub content: String,
}

#[tauri::command]
pub fn generate_config(
    app: AppHandle,
    profile: Option<Profile>,
    settings: AppSettings,
) -> Result<ConfigResult, String> {
    let profile_name = profile.as_ref().map(|p| p.name.clone()).unwrap_or("None".to_string());

    let log_msg = format!("[Config] generate_config called for profile: {}", profile_name);
    println!("{}", log_msg);
    let _ = app.emit("xray-log", json!({
        "level": "INFO",
        "message": log_msg
    }));

    // Detailed Configuration Logging
    let routing_summary = format!(
        "Conf: Routing Mode: [{}], Bypass Private: {}, Bypass China: {}", 
        settings.routing_mode, 
        settings.bypass_private_addresses,
        settings.bypass_cn_mainland
    );
     let _ = app.emit("xray-log", json!({ "level": "INFO", "message": routing_summary }));

     let inbound_summary = format!(
         "Conf: Inbounds -> SOCKS: {}, HTTP: {}, API: 10085",
         settings.socks_port.unwrap_or(10808),
         settings.http_port.unwrap_or(10809)
     );
     let _ = app.emit("xray-log", json!({ "level": "INFO", "message": inbound_summary }));

    let mut outbounds = Vec::new();

    // 1. Proxy OutboundUrl
    if let Some(p) = &profile {
        // Log Protocol info
        let proto_msg = format!("Conf: Outbound Proxy -> Protocol: [{}], Address: {}:{}", p.protocol, p.address, p.port);
         let _ = app.emit("xray-log", json!({ "level": "INFO", "message": proto_msg }));
        
        outbounds.push(generate_outbound(p, &settings));
    } else {
        let _ = app.emit("xray-log", json!({ "level": "WARN", "message": "Conf: No Profile Selected." }));
    }

    // 2. Custom Proxy Outbound
    if settings.proxy_type == "custom" && !settings.custom_proxy_server.is_empty() {
        let custom_msg = format!("Conf: Custom Proxy Chaining Enabled -> {}://{}:{}", settings.custom_proxy_type, settings.custom_proxy_server, settings.custom_proxy_port);
         let _ = app.emit("xray-log", json!({ "level": "INFO", "message": custom_msg }));

        outbounds.push(json!({
            "tag": "proxy-out",
            "protocol": settings.custom_proxy_type,
            "settings": {
                "servers": [{
                    "address": settings.custom_proxy_server,
                    "port": settings.custom_proxy_port
                }]
            }
        }));
    }

    // 3. Forward Proxy Outbound
    if settings.forward_proxy_enabled.unwrap_or(false) {
        if let (Some(host), Some(port)) =
            (&settings.forward_proxy_host, settings.forward_proxy_port)
        {
            let mut proxy_settings = json!({
                "servers": [{
                    "address": host,
                    "port": port
                }]
            });

            // Add Auth if enabled
            if settings.forward_proxy_auth_enabled.unwrap_or(false) {
                let user = settings.forward_proxy_username.as_deref().unwrap_or("");
                let pass = settings.forward_proxy_password.as_deref().unwrap_or("");

                if settings.forward_proxy_type.as_deref().unwrap_or("http") == "socks5" {
                    proxy_settings
                        .as_object_mut()
                        .unwrap()
                        .get_mut("servers")
                        .unwrap()
                        .as_array_mut()
                        .unwrap()[0]
                        .as_object_mut()
                        .unwrap()
                        .insert(
                            "users".to_string(),
                            json!([{
                                "user": user,
                                "pass": pass
                            }]),
                        );
                } else {
                    // HTTP
                    proxy_settings
                        .as_object_mut()
                        .unwrap()
                        .get_mut("servers")
                        .unwrap()
                        .as_array_mut()
                        .unwrap()[0]
                        .as_object_mut()
                        .unwrap()
                        .insert(
                            "users".to_string(),
                            json!([{
                                "user": user,
                                "pass": pass
                            }]),
                        );
                }
            }

            outbounds.push(json!({
                "tag": "forward-proxy",
                "protocol": settings.forward_proxy_type.as_deref().unwrap_or("http").replace("socks5", "socks"), // Xray uses 'socks'
                "settings": proxy_settings
            }));
        }
    }

    // 4. Direct & Block & API
    outbounds.push(json!({ "tag": "direct", "protocol": "freedom" }));
    outbounds.push(json!({ "tag": "block", "protocol": "blackhole" }));
    // Critical: API Outbound for Stats Query response
    outbounds.push(json!({ "tag": "api", "protocol": "freedom" }));

    // Assemble Config
    let config = json!({
        "log": {
            "loglevel": settings.log_level,
            "access": "",
            "error": ""
        },
        "inbounds": generate_inbounds(&settings),
        "outbounds": outbounds,
        "routing": generate_routing(&settings),
        "dns": generate_dns(&settings),
        "api": {
            "tag": "api",
            "services": ["StatsService"]
        },
        "stats": {},
        "policy": {
            "levels": {
                "0": {
                    "statsUserUplink": true,
                    "statsUserDownlink": true
                }
            },
            "system": {
                "statsInboundUplink": true,
                "statsInboundDownlink": true,
                "statsOutboundUplink": true,
                "statsOutboundDownlink": true
            }
        }
    });

    // Save to temp file
    let json_content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;

    // Use Tauri's temp dir resolver or std::env::temp_dir()
    // app.path().temp_dir() returns PathBuf
    let temp_dir = app.path().temp_dir().map_err(|e| e.to_string())?;
    let config_path = temp_dir.join("xray-config.json");

    let mut file =
        File::create(&config_path).map_err(|e| format!("Failed to create config file: {}", e))?;
    file.write_all(json_content.as_bytes())
        .map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(ConfigResult {
        path: config_path.to_string_lossy().to_string(),
        content: json_content
    })
}
