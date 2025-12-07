import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * Enable Windows system proxy via registry
 * Sets HTTP/HTTPS proxy to 127.0.0.1:port
 */
export async function enableSystemProxy(port: number): Promise<void> {
    try {
        console.log(`Enabling system proxy on port ${port}...`)

        // Enable proxy
        await execAsync(
            `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 1 /f`
        )

        // Set proxy server
        await execAsync(
            `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer /t REG_SZ /d "127.0.0.1:${port}" /f`
        )

        // Notify system of proxy change
        await notifyProxyChange()

        console.log(`System proxy enabled: 127.0.0.1:${port}`)
    } catch (error: any) {
        console.error('Failed to enable system proxy:', error)
        throw new Error(`Failed to enable system proxy: ${error.message}`)
    }
}

/**
 * Disable Windows system proxy
 */
export async function disableSystemProxy(): Promise<void> {
    try {
        console.log('Disabling system proxy...')

        // Disable proxy
        await execAsync(
            `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f`
        )

        // Clear proxy server (optional but clean)
        await execAsync(
            `reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer /f`
        ).catch(() => {
            // Ignore error if ProxyServer doesn't exist
        })

        // Notify system of proxy change
        await notifyProxyChange()

        console.log('System proxy disabled')
    } catch (error: any) {
        console.error('Failed to disable system proxy:', error)
        throw new Error(`Failed to disable system proxy: ${error.message}`)
    }
}

/**
 * Notify Windows that proxy settings have changed
 * This forces Windows to refresh the proxy settings
 */
async function notifyProxyChange(): Promise<void> {
    try {
        // Use PowerShell to call Windows API to refresh proxy settings
        // Simplified approach without here-string to avoid escaping issues
        const script = `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class WinInet { [DllImport(\\"wininet.dll\\")] public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength); }'; [WinInet]::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0); [WinInet]::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0)`

        await execAsync(`powershell -Command "${script}"`)
    } catch (error) {
        // Non-critical error, log but don't throw
        console.warn('Failed to notify proxy change (non-critical):', error)
    }
}

/**
 * Get current system proxy status
 */
export async function getProxyStatus(): Promise<{ enabled: boolean; server?: string }> {
    try {
        // Check if proxy is enabled
        const { stdout: enabledOutput } = await execAsync(
            `reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable`
        )

        const enabled = enabledOutput.includes('0x1')

        if (!enabled) {
            return { enabled: false }
        }

        // Get proxy server
        const { stdout: serverOutput } = await execAsync(
            `reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer`
        )

        const match = serverOutput.match(/ProxyServer\s+REG_SZ\s+(.+)/)
        const server = match ? match[1].trim() : undefined

        return { enabled, server }
    } catch (error) {
        return { enabled: false }
    }
}
