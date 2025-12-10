import { invoke } from '@tauri-apps/api/core'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { AppSettings, Profile } from '../contexts/AppContext'

class ConnectionService {
    private async sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    async connect(
        profile: Profile,
        settings: AppSettings,
        onStatus: (msg: string) => void,
        customConfig: string | null
    ): Promise<{ success: boolean; message?: string; error?: string }> {
        try {
            const reportStatus = (msg: string) => onStatus(msg)

            // 1. Generate Config
            reportStatus('Generating Configuration...')
            await this.sleep(400)

            // Fix: generate_config returns { path: string, content: string }
            const genResult = await invoke('generate_config', { profile, settings }) as { path: string, content: string }
            const configPath = genResult.path
            console.log('[ConnectionService] Config generated at:', configPath)

            // 1b. Apply Custom Config Override
            if (customConfig && typeof customConfig === 'string') {
                console.log('[ConnectionService] Overwriting with Custom Config...')
                reportStatus('Applying Custom Config...')
                await writeTextFile(configPath, customConfig)
            }

            // 2. Start Xray (Rust)
            reportStatus('Starting Xray Core...')
            await this.sleep(500)
            const msg = await invoke('start_xray', { configPath }) as string

            // 3. Setup Routing (Tun or System Proxy)
            if (settings.tunMode) {
                console.log('[ConnectionService] Starting Tun Mode...')
                reportStatus('Resolving Server IP...')
                await this.sleep(400)

                // RESOLVE IP: Critical for Bypass Route to work
                let serverIp = profile.address
                try {
                    console.log(`[ConnectionService] Resolving Server IP for: ${profile.address}`)
                    const resolved = await invoke('resolve_hostname', { hostname: profile.address }) as string
                    if (resolved) {
                        console.log(`[ConnectionService] Resolved IP: ${resolved}`)
                        serverIp = resolved
                    }
                } catch (e) {
                    console.warn('[ConnectionService] DNS Resolution failed, falling back to raw address:', e)
                }

                reportStatus('Initializing TUN Interface...')
                await this.sleep(400)

                // Prepare DNS List for TUN (Leak Protection)
                let dnsServers: string[] = []
                // 1. Add Custom DNS
                if (settings.customDnsServers && Array.isArray(settings.customDnsServers)) {
                    dnsServers.push(...settings.customDnsServers.map(s => s.value)) // Fix: map to string values
                }
                // 2. Add Selected DNS (Parse DoH/DoU format)
                if (settings.selectedDnsServer) {
                    if (settings.selectedDnsServer.startsWith('DoU:')) {
                        const ip = settings.selectedDnsServer.split(':')[1]?.trim()
                        if (ip) dnsServers.push(ip)
                    } else if (settings.selectedDnsServer.startsWith('DoH:')) {
                        // Map common DoH providers to their bootstrap IPs
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
                console.log('[ConnectionService] Setting System Proxy...')
                reportStatus('Setting System Proxy...')
                await this.sleep(500)
                await invoke('set_system_proxy', {
                    enable: true,
                    port: settings.httpPort || 10809
                })
            }

            reportStatus('Connection Established')
            return { success: true, message: msg }
        } catch (e) {
            console.error('[ConnectionService] Failed to start xray:', e)
            // Cleanup if partial failure
            try { await this.disconnect() } catch { }
            return { success: false, error: String(e) }
        }
    }

    async disconnect(): Promise<{ success: boolean; message?: string; error?: string }> {
        try {
            // 1. Stop Routing first
            try { await invoke('stop_tun') } catch (e) { console.warn('Failed to stop tun:', e) }
            try { await invoke('set_system_proxy', { enable: false, port: 0 }) } catch (e) { console.warn('Failed to disable proxy:', e) }

            // 2. Stop Xray
            const msg = await invoke('stop_xray') as string
            return { success: true, message: msg }
        } catch (e) {
            return { success: false, error: String(e) }
        }
    }
}

export const connectionService = new ConnectionService()
