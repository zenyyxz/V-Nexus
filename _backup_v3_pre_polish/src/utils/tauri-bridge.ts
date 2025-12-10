/**
 * Tauri Bridge
 * Replaces Electron IPC with Tauri Invokes
 */
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { writeTextFile } from '@tauri-apps/plugin-fs'

const appWindow = getCurrentWindow()

// --- App API (Formerly Electron API) ---
export const appAPI = {
    ping: async (address: string, port: number, method: 'tcping' | 'icmping' | 'httping' = 'tcping') => {
        try {
            let result;
            if (method === 'icmping') {
                result = await invoke('icmp_ping', { address }) as { latency: number, success: boolean }
            } else if (method === 'httping') {
                result = await invoke('http_ping', { url: address }) as { latency: number, success: boolean }
            } else {
                result = await invoke('tcp_ping', { address, port }) as { latency: number, success: boolean }
            }
            return result
        } catch (e) {
            console.error('Ping failed:', e)
            return { latency: 9999, success: false }
        }
    },
    invoke: async (channel: string, ...args: any[]) => {
        console.log(`[Tauri Bridge] invoked: ${channel}`, args)
        // Map legacy IPC channels to Tauri commands
        switch (channel) {
            case 'xray:start':
                try {
                    const [profile, settings, onStatus, customConfig] = args
                    const reportStatus = (msg: string) => {
                        if (onStatus && typeof onStatus === 'function') onStatus(msg)
                    }
                    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

                    // 1. Generate Config
                    reportStatus('Generating Configuration...')
                    await sleep(400)
                    const genResult = await invoke('generate_config', { profile, settings }) as { path: string, content: string }
                    const configPath = genResult.path
                    console.log('[Tauri] Config generated at:', configPath)

                    // 1b. Apply Custom Config Override
                    if (customConfig && typeof customConfig === 'string') {
                        console.log('[Tauri] Overwriting with Custom Config...')
                        reportStatus('Applying Custom Config...')
                        await writeTextFile(configPath, customConfig)
                    }

                    // 2. Start Xray (Rust)
                    reportStatus('Starting Xray Core...')
                    await sleep(500)
                    const msg = await invoke('start_xray', { configPath })

                    // 3. Setup Routing (Tun or System Proxy)
                    // 3. Setup Routing (Tun or System Proxy)
                    if (settings.tunMode) {
                        console.log('[Tauri] Starting Tun Mode...')
                        reportStatus('Resolving Server IP...')
                        await sleep(400)

                        // RESOLVE IP: Critical for Bypass Route to work
                        let serverIp = profile.address;
                        try {
                            console.log(`[Tauri] Resolving Server IP for: ${profile.address}`);
                            reportStatus('Resolving Server IP...')
                            const resolved = await invoke('resolve_hostname', { hostname: profile.address }) as string;
                            if (resolved) {
                                console.log(`[Tauri] Resolved IP: ${resolved}`);
                                serverIp = resolved;
                            }
                        } catch (e) {
                            console.warn('[Tauri] DNS Resolution failed, falling back to raw address:', e);
                        }

                        reportStatus('Initializing TUN Interface...')
                        await sleep(400)
                        // Prepare DNS List for TUN (Leak Protection)
                        let dnsServers: string[] = []
                        // 1. Add Custom DNS
                        if (settings.customDnsServers && Array.isArray(settings.customDnsServers)) {
                            dnsServers.push(...settings.customDnsServers)
                        }
                        // 2. Add Selected DNS (Parse DoH/DoU format)
                        if (settings.selectedDnsServer) {
                            if (settings.selectedDnsServer.startsWith('DoU:')) {
                                const ip = settings.selectedDnsServer.split(':')[1]?.trim()
                                if (ip) dnsServers.push(ip)
                            } else if (settings.selectedDnsServer.startsWith('DoH:')) {
                                // DoH often uses URL, so we might need the bootstrap IP or let system handle it.
                                // But for TUN Interface DNS, we need an IP.
                                // If it's a known provider like Cloudflare/Google, we can map it.
                                if (settings.selectedDnsServer.includes('cloudflare')) dnsServers.push('1.1.1.1')
                                else if (settings.selectedDnsServer.includes('google')) dnsServers.push('8.8.8.8')
                                else if (settings.selectedDnsServer.includes('quad9')) dnsServers.push('9.9.9.9')
                            } else {
                                // Raw IP
                                dnsServers.push(settings.selectedDnsServer)
                            }
                        }
                        // 3. Fallback/Default if empty
                        if (dnsServers.length === 0) {
                            dnsServers = ['1.1.1.1', '1.0.0.1']
                        }

                        await invoke('start_tun', {
                            serverIp: serverIp, // Pass resolved IP
                            proxyPort: settings.socksPort || 10808,
                            killSwitch: settings.killSwitch || false,
                            dnsServers: dnsServers
                        })
                    } else if (settings.setSystemProxy || settings.proxyType === 'system') {
                        console.log('[Tauri] Setting System Proxy...')
                        reportStatus('Setting System Proxy...')
                        await sleep(500)
                        await invoke('set_system_proxy', {
                            enable: true,
                            port: settings.httpPort || 10809
                        })
                    }

                    reportStatus('Connection Established')
                    return { success: true, message: msg }
                } catch (e) {
                    console.error('[Tauri] Failed to start xray:', e)
                    // Cleanup if partial failure
                    try { await invoke('stop_xray'); await invoke('stop_tun'); } catch { }
                    return { success: false, error: String(e) }
                }
            case 'xray:stop':
                try {
                    // 1. Stop Routing first
                    try { await invoke('stop_tun') } catch (e) { console.warn('Failed to stop tun:', e) }
                    try { await invoke('set_system_proxy', { enable: false, port: 0 }) } catch (e) { console.warn('Failed to disable proxy:', e) }

                    // 2. Stop Xray
                    const msg = await invoke('stop_xray')
                    return { success: true, message: msg }
                } catch (e) {
                    return { success: false, error: String(e) }
                }
            case 'capture_screen':
                try {
                    const b64 = await invoke('capture_screen')
                    return b64 // Return raw string for this command
                } catch (e) {
                    console.error('Capture failed:', e)
                    throw e
                }
            default:
                console.warn(`[Tauri Bridge] Unmapped channel: ${channel}`)
                return { success: false, error: 'Unmapped channel' }
        }
    },
    on: async (channel: string, callback: (...args: any[]) => void) => {
        if (channel === 'xray-log') {
            // Return the unlisten function to the caller
            const unlisten = await listen('xray-log', (event: any) => {
                callback(event.payload)
            })
            return unlisten
        }
    },
    removeListener: (_channel: string, _callback: (...args: any[]) => void) => {
        // Not fully implemented for specific callbacks due to Tauri's unlisten pattern
        // The 'on' method now returns the unlisten function which is cleaner
    }
}

// --- Xray API ---
export const xrayAPI = {
    start: async (profileData: any, settingsData: any, onStatus?: (msg: string) => void, customConfig?: string | null) => {
        return await appAPI.invoke('xray:start', profileData, settingsData, onStatus, customConfig)
    },
    stop: async () => {
        return await appAPI.invoke('xray:stop')
    },
    getLogs: async () => { return { success: true, logs: [] } }, // TODO: Implement log storage in Rust
    clearLogs: async () => { return { success: true } },
    getStatus: async () => {
        const running = await invoke('is_xray_running')
        return { success: true, running }
    },
    getStats: async () => {
        const stats = await invoke('get_xray_stats') as any
        return { success: true, ...stats }
    }
}

// --- System API ---
export const systemAPI = {
    checkAdmin: async () => { return await invoke('check_is_admin') as any },
    getVersion: async () => { return await invoke('get_version') as string },
    restartAsAdmin: async () => {
        try {
            await invoke('restart_as_admin')
            return { success: true }
        } catch (e: any) {
            console.error('Restart failed:', e)
            return { success: false, error: String(e) }
        }
    },
    getMemory: async () => {
        try {
            const memory = await invoke('get_memory_usage') as number
            return { success: true, memory }
        } catch (e) {
            console.error(e)
            return { success: false, memory: 0 }
        }
    },
    getLaunchOnStartup: async () => {
        // Using tauri-plugin-autostart which is handled in SettingsView directly now?
        // Or we can invoke usage here if we expose commands.
        // For now, let's keep stub or implement if needed.
        return { success: true, enabled: false }
    },
    setLaunchOnStartup: async () => { return { success: true } },
    setSystemProxy: async (enable: boolean, port: number) => {
        try {
            await invoke('set_system_proxy', { enable, port })
            return { success: true }
        } catch (e) {
            console.error("Proxy Error:", e)
            return { success: false, error: String(e) }
        }
    },
    resolveHostname: async (hostname: string) => {
        try {
            return await invoke('resolve_hostname', { hostname }) as string
        } catch { return '' }
    }
}

// --- App Events (Mock) ---
export const appEvents = {
    onTrayAction: (_callback: any) => { return () => { } },
    sendConnectionStatus: (_isConnected: boolean) => { }
}
export const appUtils = {
    fetch: async (_url: string) => { return { success: false, data: '', error: 'Use standard fetch' } }
}

// --- Window API ---
export const winControls = {
    minimize: async () => appWindow.minimize(),
    close: async () => appWindow.close()
}

// --- Init Bridge ---
export function initTauriBridge() {
    console.log('[Tauri] Initializing Bridge...')
    if (typeof window !== 'undefined') {
        window.api = appAPI as any
        window.xray = xrayAPI as any
        window.system = systemAPI as any
        window.winControls = winControls as any
        window.appEvents = appEvents as any
        window.appUtils = appUtils as any
    }
}
