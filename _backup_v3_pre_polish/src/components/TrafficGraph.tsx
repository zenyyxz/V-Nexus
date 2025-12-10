import { useEffect, useRef, useState } from 'react'
import { useApp } from '../contexts/AppContext'

export const TrafficGraph = () => {
    const { isConnected, trafficGraphData, addTrafficDataPoint, updateSessionStats, updateStats } = useApp()
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [currentSpeed, setCurrentSpeed] = useState({ upload: 0, download: 0 })
    const maxDataPoints = 60 // 60 seconds of data

    // Use refs to persist values across renders
    const lastStatsRef = useRef({ uploaded: 0, downloaded: 0 })
    const lastTimeRef = useRef(Date.now())
    const isFirstRunRef = useRef(true)

    // Poll traffic stats every second
    useEffect(() => {
        if (!isConnected) {
            setCurrentSpeed({ upload: 0, download: 0 })
            // Reset refs when disconnected
            lastStatsRef.current = { uploaded: 0, downloaded: 0 }
            lastTimeRef.current = Date.now()
            isFirstRunRef.current = true
            return
        }

        const interval = setInterval(async () => {
            try {
                const stats = await window.xray.getStats()

                if (stats.success) {
                    const now = Date.now()
                    const timeDiff = (now - lastTimeRef.current) / 1000 // seconds

                    // Skip first run to get accurate baseline
                    if (isFirstRunRef.current) {
                        lastStatsRef.current = { uploaded: stats.uploaded, downloaded: stats.downloaded }
                        lastTimeRef.current = now
                        isFirstRunRef.current = false
                        return
                    }

                    // Ensure we have a valid time difference (at least 0.5 seconds)
                    if (timeDiff < 0.5) {
                        return
                    }

                    // Calculate speeds (bytes per second)
                    const uploadSpeed = Math.max(0, (stats.uploaded - lastStatsRef.current.uploaded) / timeDiff)
                    const downloadSpeed = Math.max(0, (stats.downloaded - lastStatsRef.current.downloaded) / timeDiff)

                    setCurrentSpeed({
                        upload: uploadSpeed,
                        download: downloadSpeed
                    })

                    // Update session stats with cumulative totals
                    updateSessionStats({
                        uploaded: stats.uploaded,
                        downloaded: stats.downloaded
                    })

                    // Update global stats with current speeds
                    updateStats({
                        uploadSpeed,
                        downloadSpeed,
                        totalTunneled: stats.uploaded + stats.downloaded
                    })

                    addTrafficDataPoint({
                        timestamp: now,
                        upload: uploadSpeed,
                        download: downloadSpeed
                    })

                    lastStatsRef.current = { uploaded: stats.uploaded, downloaded: stats.downloaded }
                    lastTimeRef.current = now
                }
            } catch (error) {
                console.error('Failed to get traffic stats:', error)
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [isConnected, addTrafficDataPoint, updateSessionStats, updateStats])

    // Draw graph
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Set canvas size
        const dpr = window.devicePixelRatio || 1
        const rect = canvas.getBoundingClientRect()
        canvas.width = rect.width * dpr
        canvas.height = rect.height * dpr
        ctx.scale(dpr, dpr)

        // Clear canvas
        ctx.clearRect(0, 0, rect.width, rect.height)

        if (trafficGraphData.length < 2) return

        // Find max value for scaling
        const maxUpload = Math.max(...trafficGraphData.map(d => d.upload), 1)
        const maxDownload = Math.max(...trafficGraphData.map(d => d.download), 1)
        const maxValue = Math.max(maxUpload, maxDownload)

        const padding = 10
        const graphWidth = rect.width - padding * 2
        const graphHeight = rect.height - padding * 2

        // Draw grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
        ctx.lineWidth = 1
        for (let i = 0; i <= 4; i++) {
            const y = padding + (graphHeight / 4) * i
            ctx.beginPath()
            ctx.moveTo(padding, y)
            ctx.lineTo(rect.width - padding, y)
            ctx.stroke()
        }

        // Draw download line (blue)
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 2
        ctx.beginPath()
        trafficGraphData.forEach((point, index) => {
            const x = padding + (index / (maxDataPoints - 1)) * graphWidth
            const y = rect.height - padding - (point.download / maxValue) * graphHeight
            if (index === 0) {
                ctx.moveTo(x, y)
            } else {
                ctx.lineTo(x, y)
            }
        })
        ctx.stroke()

        // Draw upload line (green)
        ctx.strokeStyle = '#10b981'
        ctx.lineWidth = 2
        ctx.beginPath()
        trafficGraphData.forEach((point, index) => {
            const x = padding + (index / (maxDataPoints - 1)) * graphWidth
            const y = rect.height - padding - (point.upload / maxValue) * graphHeight
            if (index === 0) {
                ctx.moveTo(x, y)
            } else {
                ctx.lineTo(x, y)
            }
        })
        ctx.stroke()

        // Draw fill areas with gradient
        // Download fill
        const downloadGradient = ctx.createLinearGradient(0, 0, 0, rect.height)
        downloadGradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)')
        downloadGradient.addColorStop(1, 'rgba(59, 130, 246, 0)')
        ctx.fillStyle = downloadGradient
        ctx.beginPath()
        ctx.moveTo(padding, rect.height - padding)
        trafficGraphData.forEach((point, index) => {
            const x = padding + (index / (maxDataPoints - 1)) * graphWidth
            const y = rect.height - padding - (point.download / maxValue) * graphHeight
            ctx.lineTo(x, y)
        })
        ctx.lineTo(rect.width - padding, rect.height - padding)
        ctx.closePath()
        ctx.fill()

        // Upload fill
        const uploadGradient = ctx.createLinearGradient(0, 0, 0, rect.height)
        uploadGradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)')
        uploadGradient.addColorStop(1, 'rgba(16, 185, 129, 0)')
        ctx.fillStyle = uploadGradient
        ctx.beginPath()
        ctx.moveTo(padding, rect.height - padding)
        trafficGraphData.forEach((point, index) => {
            const x = padding + (index / (maxDataPoints - 1)) * graphWidth
            const y = rect.height - padding - (point.upload / maxValue) * graphHeight
            ctx.lineTo(x, y)
        })
        ctx.lineTo(rect.width - padding, rect.height - padding)
        ctx.closePath()
        ctx.fill()
    }, [trafficGraphData, maxDataPoints])

    const formatSpeed = (bytesPerSecond: number): string => {
        if (bytesPerSecond === 0) return '0 B/s'
        const k = 1024
        const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s']
        const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k))
        return Math.round(bytesPerSecond / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
    }

    return (
        <div className="bg-surface border border-border rounded-lg p-4 relative">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-primary">Traffic Monitor</h3>
                <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                        <span className="text-secondary">Upload: <span className="text-emerald-500 font-mono">{formatSpeed(currentSpeed.upload)}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span className="text-secondary">Download: <span className="text-blue-500 font-mono">{formatSpeed(currentSpeed.download)}</span></span>
                    </div>
                </div>
            </div>
            <canvas
                ref={canvasRef}
                className="w-full h-32 rounded"
                style={{ width: '100%', height: '128px' }}
            />
            {!isConnected && (
                <div className="absolute inset-0 flex items-center justify-center bg-surface/80 rounded-lg">
                    <p className="text-sm text-secondary">Connect to view traffic graph</p>
                </div>
            )}
        </div>
    )
}
