import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useApp } from '../contexts/AppContext'

export const useRealStats = () => {
    const { isConnected, updateStats } = useApp()

    useEffect(() => {
        if (!isConnected) return

        const interval = setInterval(async () => {
            try {
                // Get real memory usage
                const memory = await invoke<number>('get_memory_usage')

                updateStats({
                    memoryUsage: memory
                })

                // Note: Traffic stats (upload/download speeds and totals) are now
                // handled by TrafficGraph component to avoid duplicate polling
                // of the xray stats API which uses -reset flag
            } catch (error) {
                console.error('Failed to fetch stats:', error)
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [isConnected, updateStats])
}
