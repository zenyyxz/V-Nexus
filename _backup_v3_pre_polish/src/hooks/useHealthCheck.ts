import { useEffect, useRef } from 'react'
import { useApp } from '../contexts/AppContext'
import { useToast } from '../contexts/ToastContext'

export const useHealthCheck = () => {
    const { settings, isConnected, activeProfileId, profiles, updateProfile } = useApp()
    const { showToast } = useToast()
    const healthCheckInterval = useRef<NodeJS.Timeout | null>(null)
    const failedChecks = useRef<number>(0)

    useEffect(() => {
        // Clear any existing interval
        if (healthCheckInterval.current) {
            clearInterval(healthCheckInterval.current)
            healthCheckInterval.current = null
        }

        // Only run health checks if:
        // 1. Feature is enabled
        // 2. Currently connected
        // 3. Have an active profile
        if (!settings.connectionHealthCheck || !isConnected || !activeProfileId) {
            failedChecks.current = 0
            return
        }

        const profile = profiles.find(p => p.id === activeProfileId)
        if (!profile) {
            return
        }

        // Perform health check
        const performHealthCheck = async () => {
            try {
                const { pingServer } = await import('../utils/ping')
                const latency = await pingServer(
                    profile.address,
                    profile.port,
                    settings.latencyTestMethod
                )

                if (latency < 9999) {
                    // Successful ping
                    failedChecks.current = 0
                    // Update latency in profile
                    updateProfile(profile.id, { latency })
                } else {
                    // Failed ping
                    failedChecks.current++
                    console.warn(`Health check failed (${failedChecks.current}/3)`)

                    if (failedChecks.current >= 3) {
                        // 3 consecutive failures - connection is likely dead
                        showToast(
                            'Connection health check failed. Connection may be unstable.',
                            'warning'
                        )
                        failedChecks.current = 0 // Reset counter
                    }
                }
            } catch (error) {
                console.error('Health check error:', error)
                failedChecks.current++
            }
        }

        // Initial check after 30 seconds
        const initialTimeout = setTimeout(() => {
            performHealthCheck()

            // Then check every 30 seconds
            healthCheckInterval.current = setInterval(performHealthCheck, 30000)
        }, 30000)

        return () => {
            clearTimeout(initialTimeout)
            if (healthCheckInterval.current) {
                clearInterval(healthCheckInterval.current)
                healthCheckInterval.current = null
            }
            failedChecks.current = 0
        }
    }, [settings.connectionHealthCheck, isConnected, activeProfileId, profiles, settings.latencyTestMethod, updateProfile, showToast])
}
