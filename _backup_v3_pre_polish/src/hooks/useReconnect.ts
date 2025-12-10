import { useEffect, useRef } from 'react'
import { useApp } from '../contexts/AppContext'
import { useToast } from '../contexts/ToastContext'

interface ReconnectState {
    attempts: number
    lastAttempt: number
    isReconnecting: boolean
}

export const useReconnect = () => {
    const { settings, isConnected, activeProfileId, profiles, setConnected, setActiveProfile, updateSessionStats } = useApp()
    const { showToast } = useToast()
    const reconnectState = useRef<ReconnectState>({
        attempts: 0,
        lastAttempt: 0,
        isReconnecting: false
    })
    const previousConnectionState = useRef<boolean>(isConnected)
    const wasManualDisconnect = useRef<boolean>(false)

    // Reset reconnect state when successfully connected
    useEffect(() => {
        if (isConnected) {
            reconnectState.current = {
                attempts: 0,
                lastAttempt: 0,
                isReconnecting: false
            }
            previousConnectionState.current = true
        }
    }, [isConnected])

    // Monitor connection drops
    useEffect(() => {
        const handleConnectionDrop = async () => {
            // Only reconnect if:
            // 1. Reconnect on failure is enabled
            // 2. We were previously connected
            // 3. We're now disconnected
            // 4. We have an active profile
            // 5. Not already reconnecting
            // 6. Not a manual disconnect
            if (
                !settings.reconnectOnFailure ||
                !previousConnectionState.current ||
                isConnected ||
                !activeProfileId ||
                reconnectState.current.isReconnecting ||
                wasManualDisconnect.current
            ) {
                previousConnectionState.current = isConnected
                return
            }

            // Connection dropped unexpectedly
            const profile = profiles.find(p => p.id === activeProfileId)
            if (!profile) {
                previousConnectionState.current = isConnected
                return
            }

            reconnectState.current.isReconnecting = true
            const maxAttempts = 3
            const delays = [2000, 5000, 10000] // 2s, 5s, 10s

            while (reconnectState.current.attempts < maxAttempts) {
                const attemptNumber = reconnectState.current.attempts + 1
                const delay = delays[reconnectState.current.attempts]

                showToast(
                    `Connection lost. Reconnecting (${attemptNumber}/${maxAttempts})...`,
                    'warning'
                )

                // Wait before attempting
                await new Promise(resolve => setTimeout(resolve, delay))

                try {
                    const result = await window.xray.start(profile, settings)

                    if (result.success) {
                        setConnected(true)
                        setActiveProfile(profile.id)
                        window.appEvents?.sendConnectionStatus(true)
                        showToast(`Reconnected to ${profile.name}`, 'success')

                        // Resolve IP for stats
                        try {
                            const response = await fetch(`https://dns.google/resolve?name=${profile.address}&type=A`)
                            const data = await response.json()
                            if (data.Answer && data.Answer.length > 0) {
                                const serverIp = data.Answer[0].data
                                updateSessionStats({
                                    connectedIp: serverIp,
                                    uploaded: 0,
                                    downloaded: 0
                                })
                            }
                        } catch (e) {
                            console.error('Failed to resolve IP:', e)
                        }

                        reconnectState.current.isReconnecting = false
                        return
                    }
                } catch (error) {
                    console.error(`Reconnect attempt ${attemptNumber} failed:`, error)
                }

                reconnectState.current.attempts++
            }

            // All attempts failed
            showToast(
                `Failed to reconnect after ${maxAttempts} attempts`,
                'error'
            )
            reconnectState.current.isReconnecting = false
        }

        handleConnectionDrop()
        previousConnectionState.current = isConnected
    }, [isConnected, activeProfileId, settings.reconnectOnFailure, profiles, setConnected, setActiveProfile, updateSessionStats, showToast])

    // Expose method to mark manual disconnect
    const markManualDisconnect = () => {
        wasManualDisconnect.current = true
        setTimeout(() => {
            wasManualDisconnect.current = false
        }, 1000)
    }

    return { markManualDisconnect }
}
