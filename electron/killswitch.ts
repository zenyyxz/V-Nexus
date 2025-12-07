import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const RULE_NAME = 'V2RayClient_KillSwitch'

/**
 * Kill Switch implementation using Windows Firewall
 * Blocks all outbound traffic except VPN and local network
 */
export class KillSwitch {
    private isEnabled = false
    private allowedIp: string | null = null

    /**
     * Enable kill switch - blocks all traffic except VPN server
     */
    async enable(vpnServerIp: string): Promise<{ success: boolean; error?: string }> {
        try {
            // First, remove any existing rules
            await this.disable()

            this.allowedIp = vpnServerIp

            // Create firewall rule to block all outbound traffic
            const blockAllCommand = `netsh advfirewall firewall add rule name="${RULE_NAME}_BlockAll" dir=out action=block enable=yes`
            await execAsync(blockAllCommand)

            // Allow VPN server IP
            const allowVpnCommand = `netsh advfirewall firewall add rule name="${RULE_NAME}_AllowVPN" dir=out action=allow remoteip=${vpnServerIp} enable=yes`
            await execAsync(allowVpnCommand)

            // Allow local network (192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12)
            const allowLocalCommand = `netsh advfirewall firewall add rule name="${RULE_NAME}_AllowLocal" dir=out action=allow remoteip=192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,127.0.0.1 enable=yes`
            await execAsync(allowLocalCommand)

            // Allow DNS (port 53)
            const allowDnsCommand = `netsh advfirewall firewall add rule name="${RULE_NAME}_AllowDNS" dir=out action=allow protocol=UDP remoteport=53 enable=yes`
            await execAsync(allowDnsCommand)

            this.isEnabled = true
            console.log('Kill switch enabled successfully')
            return { success: true }
        } catch (error: any) {
            console.error('Failed to enable kill switch:', error)
            // Try to clean up if something failed
            await this.disable()
            return { success: false, error: error.message }
        }
    }

    /**
     * Disable kill switch - restore normal traffic
     */
    async disable(): Promise<{ success: boolean; error?: string }> {
        try {
            // Remove all kill switch rules
            const rules = [
                `${RULE_NAME}_BlockAll`,
                `${RULE_NAME}_AllowVPN`,
                `${RULE_NAME}_AllowLocal`,
                `${RULE_NAME}_AllowDNS`
            ]

            for (const rule of rules) {
                try {
                    await execAsync(`netsh advfirewall firewall delete rule name="${rule}"`)
                } catch (e) {
                    // Rule might not exist, ignore error
                }
            }

            this.isEnabled = false
            this.allowedIp = null
            console.log('Kill switch disabled successfully')
            return { success: true }
        } catch (error: any) {
            console.error('Failed to disable kill switch:', error)
            return { success: false, error: error.message }
        }
    }

    /**
     * Check if kill switch is currently enabled
     */
    getStatus(): { enabled: boolean; allowedIp: string | null } {
        return {
            enabled: this.isEnabled,
            allowedIp: this.allowedIp
        }
    }
}

// Singleton instance
export const killSwitch = new KillSwitch()
