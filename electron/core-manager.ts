import { spawn, ChildProcess } from 'child_process'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

let xrayProcess: ChildProcess | null = null
let xrayLogs: string[] = []
const MAX_LOGS = 1000

/**
 * Get the path to the Xray binary
 * Handles both development and production environments
 */
function getXrayBinaryPath(): string {
    const isDev = !app.isPackaged

    if (isDev) {
        // Development: resources/xray/xray.exe
        return path.join(process.cwd(), 'resources', 'xray', 'xray.exe')
    } else {
        // Production: resources/xray/xray.exe (bundled with app)
        return path.join(process.resourcesPath, 'xray', 'xray.exe')
    }
}

/**
 * Get the path to the Xray assets directory (geoip.dat, geosite.dat)
 */
function getXrayAssetsPath(): string {
    const isDev = !app.isPackaged

    if (isDev) {
        return path.join(process.cwd(), 'resources', 'xray')
    } else {
        return path.join(process.resourcesPath, 'xray')
    }
}

/**
 * Add log entry with timestamp
 */
function addLog(level: string, message: string) {
    const timestamp = new Date().toLocaleTimeString()
    const logEntry = `[${timestamp}] [${level}] ${message}`
    xrayLogs.push(logEntry)

    // Keep only last MAX_LOGS entries
    if (xrayLogs.length > MAX_LOGS) {
        xrayLogs = xrayLogs.slice(-MAX_LOGS)
    }

    console.log(logEntry)
}

/**
 * Start Xray-core process with the given configuration
 * @param configPath Path to the Xray configuration JSON file
 */
export function startXray(configPath: string): void {
    if (xrayProcess) {
        addLog('WARNING', 'Xray is already running. Stopping existing process...')
        killXray()
    }

    const xrayBinary = getXrayBinaryPath()
    const assetsPath = getXrayAssetsPath()

    // Verify binary exists
    if (!fs.existsSync(xrayBinary)) {
        const error = `Xray binary not found at: ${xrayBinary}`
        addLog('ERROR', error)
        throw new Error(error)
    }

    // Verify config exists
    if (!fs.existsSync(configPath)) {
        const error = `Config file not found at: ${configPath}`
        addLog('ERROR', error)
        throw new Error(error)
    }

    addLog('INFO', `Starting Xray-core...`)
    addLog('INFO', `Binary: ${xrayBinary}`)
    addLog('INFO', `Config: ${configPath}`)
    addLog('INFO', `Assets: ${assetsPath}`)

    try {
        // Spawn Xray process
        xrayProcess = spawn(xrayBinary, [
            'run',
            '-c', configPath
        ], {
            env: {
                ...process.env,
                XRAY_LOCATION_ASSET: assetsPath
            },
            windowsHide: true // Hide console window on Windows
        })

        // Handle stdout
        xrayProcess.stdout?.on('data', (data: Buffer) => {
            const output = data.toString().trim()
            if (output && !output.includes('socks-in -> direct') && !output.includes('127.0.0.1:0')) {
                addLog('INFO', output)
                // Parse for traffic stats
                import('./traffic-monitor').then(() => {
                    // Stats are handled via API now
                })
            }
        })

        // Handle stderr
        xrayProcess.stderr?.on('data', (data: Buffer) => {
            const output = data.toString().trim()
            // Filter redundant connection closed errors or noise
            if (output && !output.includes('socks-in -> direct')) {
                addLog('ERROR', output)
                // Parse for traffic stats
                import('./traffic-monitor').then(() => {
                    // Stats are handled via API now
                })
            }
        })

        // Handle process exit
        xrayProcess.on('exit', (code, signal) => {
            if (code !== null) {
                addLog('INFO', `Xray process exited with code ${code}`)
            } else if (signal !== null) {
                addLog('INFO', `Xray process killed with signal ${signal}`)
            }
            xrayProcess = null
        })

        // Handle process errors
        xrayProcess.on('error', (error) => {
            addLog('ERROR', `Xray process error: ${error.message}`)
            xrayProcess = null
        })

        addLog('SUCCESS', `Xray-core started successfully (PID: ${xrayProcess.pid})`)

        // Start traffic monitoring with polling
        import('./traffic-monitor').then(({ startTrafficMonitoring, updateStatsFromXray }) => {
            startTrafficMonitoring()

            // Poll stats every 2 seconds
            const statsInterval = setInterval(async () => {
                await updateStatsFromXray()
            }, 2000)

                // Store interval for cleanup
                ; (global as any).xrayStatsInterval = statsInterval
        })
    } catch (error: any) {
        addLog('ERROR', `Failed to start Xray: ${error.message}`)
        throw error
    }

    // DIAGNOSTIC:: Check Port from Config
    try {
        const configContent = fs.readFileSync(configPath, 'utf-8')
        const config = JSON.parse(configContent)
        const socksInbound = config.inbounds?.find((i: any) => i.tag === 'socks-in')
        if (socksInbound) {
            addLog('INFO', `[DIAGNOSTIC] Xray Listening on Port: ${socksInbound.port}`)
        } else {
            addLog('WARNING', `[DIAGNOSTIC] Could not find 'socks-in' tag in config!`)
        }
    } catch (e: any) {
        addLog('ERROR', `[DIAGNOSTIC] Failed to parse config for port check: ${e.message}`)
    }
}

/**
 * Stop the Xray-core process
 */
export function killXray(): void {
    if (!xrayProcess) {
        addLog('WARNING', 'No Xray process to kill')
    } else {
        addLog('INFO', 'Stopping Xray-core...')

        try {
            xrayProcess.kill('SIGTERM')

            // Force kill after 5 seconds if still running
            setTimeout(() => {
                if (xrayProcess && !xrayProcess.killed) {
                    addLog('WARNING', 'Force killing Xray process')
                    xrayProcess.kill('SIGKILL')
                }
            }, 5000)

            addLog('SUCCESS', 'Xray-core stopped')

            // Clear stats polling interval
            if ((global as any).xrayStatsInterval) {
                clearInterval((global as any).xrayStatsInterval)
                    ; (global as any).xrayStatsInterval = null
            }

            // Stop traffic monitoring and reset stats
            import('./traffic-monitor').then(({ stopTrafficMonitoring, resetTrafficStats }) => {
                stopTrafficMonitoring()
                resetTrafficStats()
            })
        } catch (error: any) {
            addLog('ERROR', `Failed to stop Xray: ${error.message}`)
        }
        xrayProcess = null
    }
}

// --- Sing-Box TUN Management ---





// --- Xray/Sing-Box Status Functions ---


/**
 * Check if Xray is currently running
 */
export function isXrayRunning(): boolean {
    return xrayProcess !== null && !xrayProcess.killed
}

/**
 * Get all Xray logs
 */
export function getXrayLogs(): string[] {
    return [...xrayLogs]
}

/**
 * Clear all logs
 */
export function clearXrayLogs(): void {
    xrayLogs = []
    addLog('INFO', 'Logs cleared')
}

/**
 * Get Xray process PID
 */
export function getXrayPid(): number | undefined {
    return xrayProcess?.pid
}

// Stats tracking
let statsUploaded = 0
let statsDownloaded = 0


/**
 * Query Xray stats API
 * Xray exposes stats via gRPC API on the dokodemo-door inbound
 */
async function queryXrayStatsAPI(): Promise<{ uplink: number; downlink: number } | null> {
    try {
        // Import traffic monitor
        const { updateStatsFromXray, getTrafficStats } = await import('./traffic-monitor')

        // Update stats from Xray API
        await updateStatsFromXray()

        // Get current accumulated stats
        const stats = getTrafficStats()

        return {
            uplink: stats.uploaded,
            downlink: stats.downloaded
        }
    } catch (error) {
        console.error('Failed to query Xray stats:', error)
        return null
    }
}

/**
 * Get Xray traffic stats
 * Note: This queries Xray's stats API for real traffic data
 */
export async function getXrayStats(): Promise<{ uploaded: number; downloaded: number }> {
    if (!isXrayRunning()) {
        return { uploaded: 0, downloaded: 0 }
    }

    const stats = await queryXrayStatsAPI()

    if (stats) {
        statsUploaded = stats.uplink
        statsDownloaded = stats.downlink
    }

    return {
        uploaded: statsUploaded,
        downloaded: statsDownloaded
    }
}

/**
 * Reset stats (called when disconnecting)
 */
export function resetXrayStats(): void {
    statsUploaded = 0
    statsDownloaded = 0

}
