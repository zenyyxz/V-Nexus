// Real Xray stats using xray api statsquery command
// This is the standard way to get traffic stats from Xray
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { app } from 'electron'

const execAsync = promisify(exec)

let totalUploaded = 0
let totalDownloaded = 0
let isMonitoring = false

/**
 * Get Xray binary path
 */
function getXrayBinaryPath(): string {
    const isDev = !app.isPackaged
    if (isDev) {
        return path.join(process.cwd(), 'resources', 'xray', 'xray.exe')
    } else {
        return path.join(process.resourcesPath, 'xray', 'xray.exe')
    }
}

/**
 * Query Xray stats using CLI API
 * Uses: xray api statsquery -reset
 */
async function queryXrayStatsCLI(): Promise<{ uplink: number; downlink: number } | null> {
    try {
        const xrayBinary = getXrayBinaryPath()

        // Run xray api statsquery command
        const { stdout } = await execAsync(`"${xrayBinary}" api statsquery -s 127.0.0.1:10085 -reset`)

        // Parse JSON output
        const stats = JSON.parse(stdout)

        let uplink = 0
        let downlink = 0

        // Parse stats from response
        // Only count outbound traffic from the 'proxy' tag to avoid double-counting
        if (stats && stats.stat) {
            for (const stat of stats.stat) {
                const name = stat.name || ''
                const value = parseInt(stat.value) || 0

                // Only count outbound proxy traffic (not inbound)
                // Format: "outbound>>>proxy>>>traffic>>>uplink"
                if (name.includes('outbound') && name.includes('proxy')) {
                    if (name.includes('uplink')) {
                        uplink += value
                    } else if (name.includes('downlink')) {
                        downlink += value
                    }
                }
            }
        }

        console.log(`[Stats] Real traffic from Xray API: ${uplink}B up, ${downlink}B down`)
        return { uplink, downlink }
    } catch (error) {
        console.error('[Stats] Failed to query Xray stats:', error)
        return null
    }
}

/**
 * Update stats from Xray
 */
export async function updateStatsFromXray(): Promise<void> {
    if (!isMonitoring) return

    const stats = await queryXrayStatsCLI()

    if (stats) {
        // Accumulate stats (since we use -reset, these are deltas)
        totalUploaded += stats.uplink
        totalDownloaded += stats.downlink
    }
}

/**
 * Get accumulated traffic stats
 */
export function getTrafficStats(): { uploaded: number; downloaded: number } {
    return {
        uploaded: totalUploaded,
        downloaded: totalDownloaded
    }
}

/**
 * Reset stats
 */
export function resetTrafficStats(): void {
    totalUploaded = 0
    totalDownloaded = 0
}

/**
 * Start monitoring
 */
export function startTrafficMonitoring(): void {
    isMonitoring = true
    console.log('[Stats] Real traffic monitoring started (using xray api)')
}

/**
 * Stop monitoring
 */
export function stopTrafficMonitoring(): void {
    isMonitoring = false
    console.log(`[Stats] Monitoring stopped. Total: ${totalUploaded}B up, ${totalDownloaded}B down`)
    resetTrafficStats()
}

// End of file
