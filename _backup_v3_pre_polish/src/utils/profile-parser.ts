import { Profile, AppSettings } from '../contexts/AppContext'
import { getOrCreateDeviceId } from './device-id'

export const parseVMessLink = (link: string): Profile | null => {
    try {
        const base64 = link.replace('vmess://', '')
        const decoded = atob(base64)
        const config = JSON.parse(decoded)

        return {
            id: crypto.randomUUID(),
            name: config.ps || `${config.add}:${config.port}`,
            protocol: 'vmess',
            address: config.add,
            port: parseInt(config.port),
            uuid: config.id,
            alterId: parseInt(config.aid) || 0,
            security: config.scy || 'auto',
            network: config.net || 'tcp',
            headerType: config.type || 'none',
            tls: config.tls || '',
            sni: config.sni || config.host || '',
            alpn: config.alpn || ''
        }
    } catch (error) {
        console.error('Failed to parse VMess link:', error)
        return null
    }
}

export const parseVLESSLink = (link: string): Profile | null => {
    try {
        // vless://uuid@address:port?param1=value1&param2=value2#name
        const cleaned = link.replace('vless://', '')
        const [userPart, rest] = cleaned.split('@')
        const uuid = userPart

        const [addressPort, paramsPart] = rest.split('?')
        const [address, portStr] = addressPort.split(':')
        const port = parseInt(portStr)

        const [paramsStr, name] = paramsPart.split('#')
        const params = new URLSearchParams(paramsStr)

        return {
            id: crypto.randomUUID(),
            name: decodeURIComponent(name || `${address}:${port}`),
            protocol: 'vless',
            address,
            port,
            uuid,
            encryption: params.get('encryption') || 'none',
            flow: params.get('flow') || '',
            network: params.get('type') || 'tcp',
            headerType: params.get('headerType') || 'none',
            tls: params.get('security') || '',
            sni: params.get('sni') || params.get('peer') || '',
            alpn: params.get('alpn') || '',
            fingerprint: params.get('fp') || params.get('fingerprint') || ''
        }
    } catch (error) {
        console.error('Failed to parse VLESS link:', error)
        return null
    }
}

export const parseTrojanLink = (link: string): Profile | null => {
    try {
        const url = new URL(link)
        const password = url.username
        const address = url.hostname
        const port = parseInt(url.port)
        const params = new URLSearchParams(url.search)

        return {
            id: crypto.randomUUID(),
            name: decodeURIComponent(url.hash.substring(1)) || address,
            protocol: 'trojan',
            address,
            port,
            password,
            sni: params.get('sni') || address,
            alpn: params.get('alpn') || '',
            fingerprint: params.get('fp') || ''
        }
    } catch (error) {
        console.error('Failed to parse Trojan link:', error)
        return null
    }
}

export const parseShadowsocksLink = (link: string): Profile | null => {
    try {
        const url = new URL(link)
        const userInfo = atob(url.username)
        const [method, password] = userInfo.split(':')
        const address = url.hostname
        const port = parseInt(url.port)

        return {
            id: crypto.randomUUID(),
            name: decodeURIComponent(url.hash.substring(1)) || address,
            protocol: 'shadowsocks',
            address,
            port,
            method,
            password
        }
    } catch (error) {
        console.error('Failed to parse Shadowsocks link:', error)
        return null
    }
}

export const parseProfileLink = (link: string | null | undefined): Profile | null => {
    if (!link) return null
    const trimmed = link.trim()

    // Handle V-Nexus Locked Links
    if (trimmed.startsWith('vnexus://locked=')) {
        try {
            const base64 = trimmed.replace('vnexus://locked=', '')
            const decodedLink = atob(base64)

            // Check for deviceID restriction
            const [base] = decodedLink.split('#')
            // Parse params from the base URL part. Params usually start after ?
            const paramStart = base.indexOf('?')
            if (paramStart !== -1) {
                const params = new URLSearchParams(base.substring(paramStart))
                const allowedDeviceId = params.get('deviceID')

                if (allowedDeviceId) {
                    const localDeviceId = getOrCreateDeviceId()
                    if (allowedDeviceId !== localDeviceId) {
                        console.error('Device ID mismatch. Allowed:', allowedDeviceId, 'Local:', localDeviceId)
                        throw new Error('This profile is locked to a different device.')
                    }
                }
            }

            return parseProfileLink(decodedLink)
        } catch (e) {
            console.error('Failed to parse locked V-Nexus link', e)
            throw e // Re-throw to let caller handle the specific error message
        }
    }

    if (trimmed.startsWith('vmess://')) {
        return parseVMessLink(trimmed)
    } else if (trimmed.startsWith('vless://')) {
        return parseVLESSLink(trimmed)
    } else if (trimmed.startsWith('trojan://')) {
        return parseTrojanLink(trimmed)
    } else if (trimmed.startsWith('ss://')) {
        return parseShadowsocksLink(trimmed)
    }

    return null
}

export const parseJSONProfile = (json: string | null | undefined): Profile | null => {
    if (!json) return null
    try {
        const config = JSON.parse(json)

        // Basic validation
        if (!config.outbounds || !Array.isArray(config.outbounds) || config.outbounds.length === 0) {
            return null
        }

        const outbound = config.outbounds[0]
        const server = outbound.settings?.vnext?.[0] || outbound.settings?.servers?.[0]

        if (!server) return null

        return {
            id: crypto.randomUUID(),
            name: config.remarks || server.address || 'JSON Config',
            protocol: outbound.protocol,
            address: server.address,
            port: server.port
        }
    } catch (error) {
        console.error('Failed to parse JSON profile:', error)
        return null
    }
}

export const generateProfileLink = (profile: Profile): string => {
    try {
        if (profile.protocol === 'vmess') {
            const config = {
                v: '2',
                ps: profile.name,
                add: profile.address,
                port: profile.port.toString(),
                id: profile.uuid,
                aid: profile.alterId?.toString() || '0',
                scy: profile.security || 'auto',
                net: profile.network || 'tcp',
                type: profile.headerType || 'none',
                host: profile.host || '',
                path: profile.path || '',
                tls: profile.tls || '',
                sni: profile.sni || '',
                alpn: profile.alpn || ''
            }
            return `vmess://${btoa(JSON.stringify(config))}`
        } else if (profile.protocol === 'vless') {
            const params = new URLSearchParams()
            if (profile.encryption) params.set('encryption', profile.encryption)
            if (profile.network) params.set('type', profile.network)
            if (profile.path) params.set('path', profile.path)
            if (profile.host) params.set('host', profile.host)
            if (profile.headerType) params.set('headerType', profile.headerType)
            if (profile.tls) params.set('security', profile.tls)
            if (profile.sni) params.set('sni', profile.sni)
            if (profile.flow) params.set('flow', profile.flow)
            if (profile.alpn) params.set('alpn', profile.alpn)
            if (profile.fingerprint) params.set('fp', profile.fingerprint)

            return `vless://${profile.uuid}@${profile.address}:${profile.port}?${params.toString()}#${encodeURIComponent(profile.name)}`
        } else if (profile.protocol === 'trojan') {
            const params = new URLSearchParams()
            if (profile.sni) params.set('sni', profile.sni)
            if (profile.alpn) params.set('alpn', profile.alpn)
            if (profile.security) params.set('security', profile.security)
            if (profile.flow) params.set('flow', profile.flow)

            return `trojan://${profile.password}@${profile.address}:${profile.port}?${params.toString()}#${encodeURIComponent(profile.name)}`
        } else if (profile.protocol === 'shadowsocks') {
            const userInfo = btoa(`${profile.method}:${profile.password}`)
            return `ss://${userInfo}@${profile.address}:${profile.port}#${encodeURIComponent(profile.name)}`
        }

        return ''
    } catch (error) {
        console.error('Failed to generate profile link:', error)
        return ''
    }
}



export const generateV2RayJSON = (profile: Profile, settings?: AppSettings): string => {
    try {
        const outbound: any = {
            tag: "proxy",
            protocol: profile.protocol,
            settings: {}
        }

        const streamSettings: any = {
            network: profile.network || 'tcp',
            security: profile.tls || 'none',
            tlsSettings: profile.tls === 'tls' ? {
                allowInsecure: profile.allowInsecure || false,
                serverName: profile.sni || profile.host
            } : undefined,
            wsSettings: profile.network === 'ws' ? {
                path: profile.path || '/',
                headers: {
                    Host: profile.host || profile.sni
                }
            } : undefined,
            tcpSettings: profile.network === 'tcp' && profile.headerType === 'http' ? {
                header: {
                    type: 'http',
                    request: {
                        path: [profile.path || '/'],
                        headers: {
                            Host: [profile.host || profile.sni]
                        }
                    }
                }
            } : undefined
        }

        if (profile.protocol === 'vmess') {
            outbound.settings = {
                vnext: [{
                    address: profile.address,
                    port: profile.port,
                    users: [{
                        id: profile.uuid,
                        alterId: profile.alterId || 0,
                        security: profile.security || 'auto',
                        level: 0
                    }]
                }]
            }
        } else if (profile.protocol === 'vless') {
            outbound.settings = {
                vnext: [{
                    address: profile.address,
                    port: profile.port,
                    users: [{
                        id: profile.uuid,
                        encryption: profile.encryption || 'none',
                        level: 0
                    }]
                }]
            }
            if (profile.flow) {
                outbound.settings.vnext[0].users[0].flow = profile.flow
            }
        } else if (profile.protocol === 'trojan') {
            outbound.settings = {
                servers: [{
                    address: profile.address,
                    port: profile.port,
                    password: profile.password || '',
                    level: 0
                }]
            }
        } else if (profile.protocol === 'shadowsocks') {
            outbound.settings = {
                servers: [{
                    address: profile.address,
                    port: profile.port,
                    method: profile.method,
                    password: profile.password,
                    level: 0
                }]
            }
        }

        outbound.streamSettings = streamSettings

        const config = {
            log: {
                loglevel: "warning"
            },

            inbounds: [
                {
                    port: 1080,
                    listen: "127.0.0.1",
                    protocol: "socks",
                    settings: {
                        udp: true
                    }
                }
            ],
            outbounds: [
                outbound,
                {
                    protocol: "freedom",
                    tag: "direct",
                    settings: {}
                },
                {
                    protocol: "blackhole",
                    tag: "block",
                    settings: {}
                }
            ]
        }

        // Add custom proxy outbound if configured
        if (settings?.proxyType === 'custom' && settings.customProxyServer && settings.customProxyPort) {
            const proxyOutbound: any = {
                tag: "proxy-out",
                protocol: settings.customProxyType,
                settings: {
                    servers: [{
                        address: settings.customProxyServer,
                        port: Number(settings.customProxyPort)
                    }]
                }
            }
            config.outbounds.push(proxyOutbound)

            // Route main outbound through proxy
            if (!outbound.streamSettings) outbound.streamSettings = {}
            if (!outbound.streamSettings.sockopt) outbound.streamSettings.sockopt = {}
            outbound.streamSettings.sockopt.dialerProxy = "proxy-out"
        }

        return JSON.stringify(config, null, 2)
    } catch (error) {
        console.error('Failed to generate V2Ray JSON:', error)
        return '{}'
    }
}

export const generateLockedLink = (profile: Profile, deviceId?: string): string => {
    try {
        const link = generateProfileLink(profile)

        if (link.startsWith('vless://') || link.startsWith('trojan://')) {
            const [base, hash] = link.split('#')
            let newBase = base

            // Append deviceID if provided
            if (deviceId) {
                const separator = newBase.includes('?') ? '&' : '?'
                newBase += `${separator}deviceID=${encodeURIComponent(deviceId)}`
            }

            // Construct the full link with params
            const fullUrl = hash ? `${newBase}#${hash}` : newBase

            // V-Nexus style locking: base64 encode the whole link and wrap
            const b64 = btoa(fullUrl)
            return `vnexus://locked=${b64}`
        }
        return link
    } catch (e) {
        return ''
    }
}

export const parseSubscriptionContent = (content: string): Profile[] => {
    try {
        // Handle Base64 encoding
        // Some subscriptions return plain text, others base64. Try to decode if it looks like base64.
        let decoded = content.trim()
        const isBase64 = /^[a-zA-Z0-9+/=]+$/.test(decoded.replace(/\s/g, ''))

        if (isBase64) {
            try {
                decoded = atob(decoded)
            } catch (e) {
                // Ignore, might be plain text
            }
        }

        const lines = decoded.split(/[\r\n]+/)
        const profiles: Profile[] = []

        lines.forEach(line => {
            const link = line.trim()
            if (!link) return

            const profile = parseProfileLink(link)
            if (profile) {
                profiles.push(profile)
            }
        })

        return profiles
    } catch (error) {
        console.error('Failed to parse subscription content:', error)
        return []
    }
}
