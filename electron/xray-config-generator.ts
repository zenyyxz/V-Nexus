import path from 'path'
import fs from 'fs'
import { app } from 'electron'

// AppSettings type definition
interface AppSettings {
    logLevel: 'none' | 'info' | 'warning' | 'error' | 'debug'
    allowInsecure: boolean
    muxEnabled: boolean
    muxConcurrency: number
    dnsQueryStrategy: 'UseIP' | 'UseIPv4' | 'UseIPv6'
    dnsDisableCache: boolean
    dnsDisableFallback: boolean
    selectedDnsServer: string
    customDnsServers: string[]
    // Proxy Settings
    proxyType: 'none' | 'system' | 'custom'
    customProxyType: 'http' | 'socks'
    customProxyServer: string
    customProxyPort: number
    tunMode: boolean
    socksPort?: number
    httpPort?: number
}

// Profile type definition (matching src/contexts/AppContext.tsx)
interface Profile {
    id: string
    name: string
    protocol: string
    address: string
    port: number
    uuid: string
    password?: string
    alterId?: number
    security?: string
    encryption?: string
    flow?: string
    network?: string
    headerType?: string
    path?: string
    host?: string
    serviceName?: string
    mode?: string
    tls?: string
    sni?: string
    allowInsecure?: boolean
    alpn?: string
    fingerprint?: string
    publicKey?: string
    shortId?: string
    spiderX?: string
    method?: string
    email?: string
}

interface XrayConfig {
    log: {
        loglevel: string
        access?: string
        error?: string
    }
    inbounds: any[]
    outbounds: any[]
    routing?: any
    dns?: any
    api?: any
    policy?: any
    stats?: any
}

/**
 * Generate Xray configuration from a Profile and Settings
 */
export function generateXrayConfig(profile: Profile, settings: AppSettings): XrayConfig {
    const config: XrayConfig = {
        log: {
            loglevel: settings.logLevel,
            access: '',     // Output access logs to stdout (connection events)
            error: ''       // Output errors to stderr
        },
        inbounds: generateInbounds(settings),
        outbounds: [
            generateOutbound(profile, settings),
            // Add custom proxy outbound if configured
            ...(settings.proxyType === 'custom' && settings.customProxyServer && settings.customProxyPort ? [{
                tag: 'proxy-out',
                protocol: settings.customProxyType,
                settings: {
                    servers: [{
                        address: settings.customProxyServer,
                        port: Number(settings.customProxyPort)
                    }]
                }
            }] : []),
            // Add direct and block outbounds
            {
                tag: 'direct',
                protocol: 'freedom'
            },
            {
                tag: 'block',
                protocol: 'blackhole'
            }
        ],
        routing: generateRouting(),
        dns: generateDNS(settings),
        // Enable stats API for traffic monitoring
        api: {
            tag: 'api',
            services: ['StatsService']
        },
        // Enable stats collection
        stats: {},
        // Policy for stats
        policy: {
            levels: {
                '0': {
                    statsUserUplink: true,
                    statsUserDownlink: true
                }
            },
            system: {
                statsInboundUplink: true,
                statsInboundDownlink: true,
                statsOutboundUplink: true,
                statsOutboundDownlink: true
            }
        }
    }

    return config
}

/**
 * Generate DNS configuration from settings
 */
function generateDNS(settings: AppSettings): any {
    const dns: any = {
        queryStrategy: settings.dnsQueryStrategy,
        disableCache: settings.dnsDisableCache,
        disableFallback: settings.dnsDisableFallback,
        servers: []
    }

    // Parse selected DNS server
    if (settings.selectedDnsServer.startsWith('DoU:')) {
        const ip = settings.selectedDnsServer.split(':')[1]?.trim()
        if (ip) dns.servers.push(ip)
    } else if (settings.selectedDnsServer.startsWith('DoH:')) {
        const url = settings.selectedDnsServer.substring(4).trim()
        if (url) dns.servers.push(url)
    }

    // Add custom DNS servers
    if (settings.customDnsServers && settings.customDnsServers.length > 0) {
        dns.servers.push(...settings.customDnsServers)
    }

    // Fallback to defaults if no servers configured
    if (dns.servers.length === 0) {
        dns.servers = ['1.1.1.1', '8.8.8.8']
    }

    return dns
}

/**
 * Generate routing rules
 */
function generateRouting(): any {
    return {
        domainStrategy: 'IPIfNonMatch',
        rules: [
            // API inbound rule
            {
                type: 'field',
                inboundTag: ['api'],
                outboundTag: 'api'
            },
            // Private IPs go direct
            {
                type: 'field',
                ip: ['geoip:private'],
                outboundTag: 'direct'
            },
            // Block ads
            {
                type: 'field',
                domain: ['geosite:category-ads'],
                outboundTag: 'block'
            }
        ]
    }
}

/**
 * Generate inbound configurations (SOCKS + HTTP proxy)
 */
function generateInbounds(settings: AppSettings): any[] {
    const socksPort = settings.socksPort || 10808
    const httpPort = settings.httpPort || 10809

    const inbounds: any[] = [
        {
            tag: 'socks-in',
            port: socksPort,
            listen: '127.0.0.1',
            protocol: 'socks',
            settings: {
                auth: 'noauth',
                udp: true,
                ip: '127.0.0.1'
            },
            sniffing: {
                enabled: true,
                destOverride: ['http', 'tls']
            }
        },
        {
            tag: 'http-in',
            port: httpPort,
            listen: '127.0.0.1',
            protocol: 'http',
            settings: {
                timeout: 360
            },
            sniffing: {
                enabled: true,
                destOverride: ['http', 'tls']
            }
        },
        // API inbound for stats
        {
            tag: 'api',
            port: 10085,
            listen: '127.0.0.1',
            protocol: 'dokodemo-door',
            settings: {
                address: '127.0.0.1'
            }
        }
    ]
    // TUN Mode is now handled by external tun2socks process
    // We do NOT add a native tun inbound here anymore.

    return inbounds
}

/**
 * Generate outbound configuration from Profile
 */
function generateOutbound(profile: Profile, settings: AppSettings): any {
    // Validate protocol
    if (!profile.protocol) {
        throw new Error('Profile protocol is required')
    }

    const protocol = profile.protocol.toLowerCase()
    const outbound: any = {
        tag: 'proxy',
        protocol: protocol,
        settings: {},
        streamSettings: {}
    }

    // Protocol-specific settings
    switch (protocol) {
        case 'vmess':
            outbound.settings = generateVMessSettings(profile)
            break
        case 'vless':
            outbound.settings = generateVLESSSettings(profile)
            break
        case 'trojan':
            outbound.settings = generateTrojanSettings(profile)
            break
        case 'shadowsocks':
            outbound.settings = generateShadowsocksSettings(profile)
            break
        default:
            throw new Error(`Unsupported protocol: ${profile.protocol}`)
    }

    // Stream settings (transport + TLS)
    outbound.streamSettings = generateStreamSettings(profile, settings)

    // Mux settings
    if (settings.muxEnabled) {
        outbound.mux = {
            enabled: true,
            concurrency: settings.muxConcurrency
        }
    }

    return outbound
}

/**
 * Generate VMess settings
 */
function generateVMessSettings(profile: Profile): any {
    return {
        vnext: [
            {
                address: profile.address,
                port: profile.port,
                users: [
                    {
                        id: profile.uuid,
                        alterId: profile.alterId || 0,
                        security: profile.security || 'auto'
                    }
                ]
            }
        ]
    }
}

/**
 * Generate VLESS settings
 */
function generateVLESSSettings(profile: Profile): any {
    return {
        vnext: [
            {
                address: profile.address,
                port: profile.port,
                users: [
                    {
                        id: profile.uuid,
                        encryption: profile.encryption || 'none',
                        flow: profile.flow || ''
                    }
                ]
            }
        ]
    }
}

/**
 * Generate Trojan settings
 */
function generateTrojanSettings(profile: Profile): any {
    return {
        servers: [
            {
                address: profile.address,
                port: profile.port,
                password: profile.password || profile.uuid,
                email: profile.email || ''
            }
        ]
    }
}

/**
 * Generate Shadowsocks settings
 */
function generateShadowsocksSettings(profile: Profile): any {
    return {
        servers: [
            {
                address: profile.address,
                port: profile.port,
                method: profile.method || 'aes-256-gcm',
                password: profile.password || '',
                uot: false
            }
        ]
    }
}

/**
 * Generate stream settings (transport + TLS)
 */
function generateStreamSettings(profile: Profile, settings: AppSettings): any {
    const streamSettings: any = {
        network: profile.network || 'tcp'
    }

    // Transport settings
    switch (profile.network) {
        case 'tcp':
            if (profile.headerType) {
                streamSettings.tcpSettings = {
                    header: {
                        type: profile.headerType
                    }
                }
            }
            break
        case 'ws':
            streamSettings.wsSettings = {
                path: profile.path || '/',
                headers: profile.host ? { Host: profile.host } : {}
            }
            break
        case 'h2':
        case 'http':
            streamSettings.httpSettings = {
                host: profile.host ? [profile.host] : [],
                path: profile.path || '/'
            }
            break
        case 'grpc':
            streamSettings.grpcSettings = {
                serviceName: profile.serviceName || '',
                multiMode: profile.mode === 'multi'
            }
            break
    }

    // TLS settings
    if (profile.tls === 'tls') {
        streamSettings.security = 'tls'
        streamSettings.tlsSettings = {
            serverName: profile.sni || profile.host || profile.address,
            allowInsecure: settings.allowInsecure, // Use setting instead of profile
            alpn: profile.alpn ? profile.alpn.split(',') : []
        }

        if (profile.fingerprint) {
            streamSettings.tlsSettings.fingerprint = profile.fingerprint
        }
    } else if (profile.tls === 'reality') {
        streamSettings.security = 'reality'
        streamSettings.realitySettings = {
            serverName: profile.sni || profile.host || profile.address,
            fingerprint: profile.fingerprint || 'chrome',
            publicKey: profile.publicKey || '',
            shortId: profile.shortId || '',
            spiderX: profile.spiderX || ''
        }
    }

    // Add sockopt for proxy chaining
    if (settings.proxyType === 'custom' && settings.customProxyServer && settings.customProxyPort) {
        if (!streamSettings.sockopt) {
            streamSettings.sockopt = {}
        }
        streamSettings.sockopt.dialerProxy = 'proxy-out'
    }

    return streamSettings
}

/**
 * Save configuration to a temporary file and return the path
 */
export function saveConfigToTemp(config: XrayConfig): string {
    const configJson = JSON.stringify(config, null, 2)
    const tempDir = app.getPath('temp')
    const configPath = path.join(tempDir, 'xray-config.json')

    fs.writeFileSync(configPath, configJson, 'utf-8')

    return configPath
}

/**
 * Generate and save configuration for a profile
 */
export function generateAndSaveConfig(profile: Profile, settings: AppSettings): string {
    const config = generateXrayConfig(profile, settings)
    return saveConfigToTemp(config)
}
