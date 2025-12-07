import { useEffect } from 'react'
import { useApp } from '../contexts/AppContext'

export const useStatsSimulation = () => {
    const { isConnected, updateStats, updateSessionStats } = useApp()

    useEffect(() => {
        if (!isConnected) return

        let uploaded = 0
        let downloaded = 0

        const interval = setInterval(() => {
            // Simulate realistic network traffic
            const uploadSpeed = Math.floor(Math.random() * 500000) + 50000 // 50KB - 550KB/s
            const downloadSpeed = Math.floor(Math.random() * 2000000) + 200000 // 200KB - 2.2MB/s
            const memoryUsage = Math.floor(Math.random() * 50) + 80 // 80-130 MB

            uploaded += uploadSpeed
            downloaded += downloadSpeed

            updateStats({
                uploadSpeed,
                downloadSpeed,
                memoryUsage,
                totalTunneled: uploaded + downloaded
            })

            // Accumulate session stats
            updateSessionStats({
                uploaded,
                downloaded
            })
        }, 1000)

        return () => clearInterval(interval)
    }, [isConnected, updateStats, updateSessionStats])
}
