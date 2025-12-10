import { useEffect } from 'react'
import { useApp } from '../contexts/AppContext'

export const useRealStats = () => {
    const { isConnected, updateStats } = useApp()

    useEffect(() => {
        if (!isConnected) return

        const interval = setInterval(async () => {
            try {
                // Get real memory usage
                const memoryResult = await window.system.getMemory()
                const memory = memoryResult.success ? memoryResult.memory : 0

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
