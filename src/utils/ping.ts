// Real TCP/ICMP ping utility
export const pingServer = async (
    address: string,
    port: number,
    method: 'tcping' | 'icmping' = 'tcping',
    timeoutMs: number = 5000
): Promise<number> => {
    const startTime = performance.now()

    try {
        // Use fetch with AbortController for timeout
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), timeoutMs)

        // For now, send message to main process
        if (window.electron) {
            // @ts-ignore - ping method might be new in IPC
            const result = await window.electron.ping(address, port, method)
            return result.latency
        }

        // Fallback: HTTP ping (won't work for most V2Ray servers)
        await fetch(`http://${address}:${port}`, {
            method: 'HEAD',
            mode: 'no-cors',
            signal: controller.signal
        })

        clearTimeout(timeout)
        const endTime = performance.now()
        return Math.round(endTime - startTime)
    } catch (error) {
        // If connection fails, return high latency
        return 9999
    }
}

// Batch ping multiple servers
export const pingMultipleServers = async (
    servers: Array<{ id: string; address: string; port: number }>,
    onProgress?: (id: string, latency: number) => void,
    method: 'tcping' | 'icmping' = 'tcping'
): Promise<Map<string, number>> => {
    const results = new Map<string, number>()

    // Ping servers in parallel with a concurrency limit
    const concurrency = 5
    const chunks = []

    for (let i = 0; i < servers.length; i += concurrency) {
        chunks.push(servers.slice(i, i + concurrency))
    }

    for (const chunk of chunks) {
        const promises = chunk.map(async (server) => {
            const latency = await pingServer(server.address, server.port, method)
            results.set(server.id, latency)
            onProgress?.(server.id, latency)
        })

        await Promise.all(promises)
    }

    return results
}
