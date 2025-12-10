// Real TCP/ICMP ping utility
export const pingServer = async (
    address: string,
    port: number,
    method: 'tcping' | 'icmping' = 'tcping'
): Promise<number> => {

    try {
        const { invoke } = await import('@tauri-apps/api/core')

        let result: { latency: number; success: boolean };

        if (method === 'icmping') {
            result = await invoke('icmp_ping', { address })
        } else {
            // Default to TCP
            result = await invoke('tcp_ping', { address, port })
        }

        return result.success ? result.latency : 9999
    } catch (error) {
        console.error('Ping failed:', error)
        return 9999
    }
}

// Check "Real URL" Latency (HTTP)
export const checkRealConnection = async (
    targetUrl: string,
    proxy?: string
): Promise<number> => {
    try {
        const { invoke } = await import('@tauri-apps/api/core')
        const result = await invoke<{ latency: number; success: boolean }>('http_ping', {
            url: targetUrl,
            proxyUrl: proxy
        })
        return result.success ? result.latency : 9999
    } catch (e) {
        console.error("Real connection check failed", e);
        return 9999;
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
