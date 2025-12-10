import { useEffect, useRef } from 'react'
import { useApp } from '../contexts/AppContext'

export const usePeriodicLatencyTest = () => {
    const { settings, profiles, updateProfile } = useApp()
    const intervalRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        // Clear any existing interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }

        // Only run if feature is enabled and we have profiles
        if (!settings.testLatencyPeriodically || profiles.length === 0) {
            return
        }

        const testAllProfiles = async () => {
            console.log('Running periodic latency test for all profiles...')

            try {
                const { pingServer } = await import('../utils/ping')

                // Test profiles sequentially to avoid overwhelming the network
                for (const profile of profiles) {
                    try {
                        const latency = await pingServer(
                            profile.address,
                            profile.port,
                            settings.latencyTestMethod
                        )
                        updateProfile(profile.id, { latency })
                    } catch (error) {
                        console.error(`Failed to test ${profile.name}:`, error)
                        // Set high latency on failure
                        updateProfile(profile.id, { latency: 9999 })
                    }

                    // Small delay between tests to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 500))
                }

                console.log('Periodic latency test completed')
            } catch (error) {
                console.error('Periodic latency test error:', error)
            }
        }

        // Run initial test after 30 seconds
        const initialTimeout = setTimeout(() => {
            testAllProfiles()

            // Then run every 5 minutes (300000ms)
            intervalRef.current = setInterval(testAllProfiles, 300000)
        }, 30000)

        return () => {
            clearTimeout(initialTimeout)
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
        }
    }, [settings.testLatencyPeriodically, profiles.length, settings.latencyTestMethod, updateProfile])
}
