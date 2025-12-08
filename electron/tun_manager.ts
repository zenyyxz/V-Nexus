import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import { app } from 'electron'
import sudo from 'sudo-prompt'
import os from 'os'
import { exec } from 'child_process'

// Use require to bypass esbuild export mismatch issues with default-gateway
// @ts-ignore
const defaultGateway = require('default-gateway')

const RESOURCES_PATH = app.isPackaged
    ? process.resourcesPath
    : path.join(process.cwd(), 'resources')

const TUN2SOCKS_PATH = path.join(RESOURCES_PATH, 'tun2socks', 'tun2socks-windows-amd64.exe')

interface TunOptions {
    serverIp: string
    proxyPort: number // SOCKS5 Port
    dnsServers?: string[]
}

export class TunManager {
    private tunProcess: ChildProcess | null = null
    private interfaceName = 'tun0'
    private tunIp = '10.0.0.2'
    private tunGateway = '10.0.0.1'
    private tunNetmask = '255.255.255.0'

    private physicalGateway: string | null = null
    private currentServerIp: string | null = null

    async start(_config: any, options: TunOptions): Promise<void> {
        console.log('[TunManager] Starting TUN Mode...')

        // 0. Check Admin Privileges
        const isAdmin = await this.checkAdmin()
        if (!isAdmin) {
            throw new Error('TUN Mode requires Administrator privileges. Please restart V-Nexus as Administrator.')
        }

        try {
            this.currentServerIp = options.serverIp

            // 1. Find Physical Gateway (for bypass route)
            // Handle both structure types (direct export or nested in default)
            // Based on debug script: 
            // default: { gateway4async: [Function] }, gateway4async: [Function]
            const gwFunc = defaultGateway.gateway4async || defaultGateway.default?.gateway4async || defaultGateway.v4

            if (!gwFunc) {
                console.error('[TunManager] Gateway function not found in:', defaultGateway)
                throw new Error('Default Gateway library export mismatch')
            }

            const gw = await gwFunc()
            this.physicalGateway = gw.gateway
            console.log('[TunManager] Physical Gateway detected:', this.physicalGateway)

            // 2. Start Tun2Socks
            await this.startTun2Socks(options.proxyPort)

            // 3. Configure Interface & Routes (Admin)
            await this.configureRouting(options.serverIp)

            console.log('[TunManager] TUN Mode Started Successfully!')

        } catch (error) {
            console.error('[TunManager] Failed to start TUN:', error)
            await this.stop() // Cleanup
            throw error
        }
    }

    async stop(): Promise<void> {
        console.log('[TunManager] Stopping TUN Mode...')

        // 1. Kill Tun2Socks
        if (this.tunProcess) {
            try {
                process.kill(this.tunProcess.pid as number) // Force kill if needed
            } catch (e) { /* ignore */ }
            this.tunProcess = null
        }

        // 2. Cleanup Routes (Admin)
        await this.cleanupRouting()
    }

    private startTun2Socks(socksPort: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const args = [
                '-device', `tun://${this.interfaceName}`,
                '-proxy', `socks5://127.0.0.1:${socksPort}`,
                '-loglevel', 'info'
            ]

            console.log(`[TunManager] Spawning: ${TUN2SOCKS_PATH} ${args.join(' ')}`)

            this.tunProcess = spawn(TUN2SOCKS_PATH, args, {
                stdio: 'ignore', // or 'pipe' for logs
                windowsHide: true,
                detached: false
            })

            this.tunProcess.on('error', (err) => {
                console.error('[TunManager] Tun2Socks Error:', err)
                reject(err)
            })

            this.tunProcess.on('exit', (code) => {
                console.log('[TunManager] Tun2Socks exited with code:', code)
                this.tunProcess = null
            })

            // Polling for Interface Creation (Max 3s)
            const checkInterval = 100
            const maxRetries = 30 // 3 seconds total
            let attempts = 0

            const pollInterval = setInterval(() => {
                attempts++
                const interfaces = os.networkInterfaces()
                // Check if our interface name or similar exists
                // Note: Windows names might not match exactly "tun0" in os.networkInterfaces, 
                // but tun2socks usually sets the name if possible. 
                // Alternatively, we can assume if the process didn't exit in 500ms, it's capable.

                // Better approach: resolving quickly if process is alive
                if (attempts >= 5) { // Wait at least 500ms to ensure stability
                    clearInterval(pollInterval)
                    resolve()
                }

                if (attempts > maxRetries) {
                    clearInterval(pollInterval)
                    resolve() // Resolving anyway, downstream might fail if not ready
                }
            }, checkInterval)

            this.tunProcess.on('exit', () => clearInterval(pollInterval))
        })
    }

    private async configureRouting(serverIp: string): Promise<void> {
        if (!this.physicalGateway) throw new Error('Physical Gateway unknown')

        const cmds = [
            // 1. Configure TUN Interface IP & Gateway (Netsh)
            // Force Metric 1
            `netsh interface ip set address name="${this.interfaceName}" static ${this.tunIp} ${this.tunNetmask} gateway=${this.tunGateway} gwmetric=1`,

            // 2. Configure DNS (PowerShell) - Force Public DNS via Tunnel
            `powershell -ExecutionPolicy Bypass -Command "Set-DnsClientServerAddress -InterfaceAlias '${this.interfaceName}' -ServerAddresses ('1.1.1.1', '1.0.0.1')"`,

            // 3. Add Bypass Route for Xray Server (prevent loop)
            `route add ${serverIp} mask 255.255.255.255 ${this.physicalGateway} metric 5`
        ]

        await this.runAdminCommands(cmds)
    }

    private async cleanupRouting(): Promise<void> {
        // Tun2Socks exit removes the interface and its routes.
        // We only need to manually remove the bypass route we added.
        if (this.currentServerIp) {
            try {
                console.log(`[TunManager] removing bypass route for ${this.currentServerIp}`)
                await this.runAdminCommands([`route delete ${this.currentServerIp}`])
            } catch (error) {
                console.error('[TunManager] Failed to cleanup route:', error)
            } finally {
                this.currentServerIp = null
            }
        }
    }

    // Deprecated: Internal state now handles this
    async stopWithServerIp(_serverIp?: string): Promise<void> {
        await this.stop()
    }

    private runAdminCommands(cmds: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const combinedCmd = cmds.join(' && ')
            console.log('[TunManager] Executing Admin Commands:', combinedCmd)

            // OPTIMIZATION: If we are already running as Admin (which we should be),
            // use native 'exec' instead of 'sudo-prompt' to save time.
            // We can trust the check done in start()

            exec(combinedCmd, (error, stdout, stderr) => {
                if (error) {
                    console.warn('[TunManager] Native exec failed, falling back to sudo-prompt:', error.message)
                    // Fallback to sudo-prompt if native fails (rare)
                    const options = { name: 'VNexus Tun Manager' }
                    sudo.exec(combinedCmd, options, (sudoErr, sudoStdout, _sudoStderr) => {
                        if (sudoErr) {
                            console.error('[TunManager] Sudo Command Error:', sudoErr)
                            reject(sudoErr)
                        } else {
                            console.log('[TunManager] Sudo Command Success:', sudoStdout)
                            resolve()
                        }
                    })
                } else {
                    console.log('[TunManager] Native Exec Success:', stdout)
                    resolve()
                }
            })
        })
    }

    private checkAdmin(): Promise<boolean> {
        return new Promise((resolve) => {
            // 'net session' only works with admin privileges
            import('child_process').then(({ exec }) => {
                exec('net session', (err) => {
                    resolve(!err)
                })
            })
        })
    }
}

export const tunManager = new TunManager()
