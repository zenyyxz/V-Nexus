import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type AppMode = 'simple' | 'advanced'

export interface Profile {
    id: string
    isFavorite?: boolean
    name: string
    protocol: 'vmess' | 'vless' | 'trojan' | 'shadowsocks' | 'socks' | 'http'
    address: string
    port: number
    latency?: number
    // Protocol-specific fields
    uuid?: string
    alterId?: number
    security?: string
    network?: string
    headerType?: string
    tls?: string
    sni?: string
    alpn?: string
    fingerprint?: string
    flow?: string
    encryption?: string
    password?: string
    method?: string
    // Additional fields for advanced configs
    host?: string
    path?: string
    serviceName?: string
    mode?: string
    allowInsecure?: boolean
    publicKey?: string
    shortId?: string
    spiderX?: string
    email?: string
}

export interface AppSettings {
    mode: AppMode
    language: string
    deviceId: string
    userAgent: string
    logLevel: 'none' | 'info' | 'warning' | 'error' | 'debug'
    showLogs: boolean
    allowInsecure: boolean
    muxEnabled: boolean
    muxConcurrency: number
    dnsQueryStrategy: 'UseIP' | 'UseIPv4' | 'UseIPv6'
    dnsLog: boolean
    dnsDisableCache: boolean
    dnsDisableFallback: boolean
    dnsDisableFallbackIfMatch: boolean
    selectedDnsServer: string
    customDnsServers: Array<{ label: string; value: string }>
    autoSelectFastest: boolean
    // New features
    launchOnStartup: boolean
    connectOnBoot: boolean
    reconnectOnFailure: boolean
    killSwitch: boolean
    dnsLeakProtection: boolean
    webrtcLeakProtection: boolean
    theme: 'dark' | 'light'
    routingMode: 'global' | 'bypass-lan' | 'bypass-china' | 'custom'
    connectionHealthCheck: boolean
    profileTemplates: Array<{ name: string; template: Partial<Profile> }>
    // Qv2ray settings
    maxLogLines: number
    autoConnect: 'none' | 'last' | 'fixed'
    latencyTestMethod: 'tcping' | 'icmping'
    realPingTestUrl: string
    proxyType: 'none' | 'system' | 'custom'
    customProxyType: 'http' | 'socks5'
    customProxyServer: string
    customProxyPort: number
    testLatencyPeriodically: boolean
    testLatencyOnConnected: boolean
    disableSystemRootCerts: boolean
    // Inbound settings
    setSystemProxy: boolean
    socksEnabled: boolean
    socksPort: number
    socksUdpEnabled: boolean
    socksUdpLocalIp: string
    socksAuthEnabled: boolean
    socksUsername: string
    socksPassword: string
    socksSniffing: boolean
    socksDestOverrideHttp: boolean
    socksDestOverrideTls: boolean
    httpEnabled: boolean
    httpPort: number
    httpAuthEnabled: boolean
    httpUsername: string
    httpPassword: string
    httpSniffing: boolean
    httpDestOverrideHttp: boolean
    httpDestOverrideTls: boolean
    browserForwarderAddress: string
    browserForwarderPort: number
    // Connection settings
    forceDirectConnection: boolean
    bypassPrivateAddresses: boolean
    bypassCnMainland: boolean
    bypassBittorrent: boolean
    useV2rayDnsForDirect: boolean
    dnsIntercept: boolean
    forwardProxyEnabled: boolean
    forwardProxyType: 'http' | 'socks5'
    forwardProxyHost: string
    forwardProxyPort: number
    forwardProxyAuthEnabled: boolean
    forwardProxyUsername: string
    forwardProxyPassword: string
}

export interface TrafficDataPoint {
    timestamp: number
    upload: number
    download: number
}

interface AppState {
    settings: AppSettings
    profiles: Profile[]
    activeProfileId: string | null
    isConnected: boolean
    connectedAt: number | null
    stats: {
        memoryUsage: number
        uploadSpeed: number
        downloadSpeed: number
        totalTunneled: number
    }
    trafficGraphData: TrafficDataPoint[]
    sessionStats: {
        uploaded: number
        downloaded: number
        connectedIp: string
        connectedRegion: string
    }
}

interface AppContextType extends AppState {
    updateSettings: (settings: Partial<AppSettings>) => void
    addProfile: (profile: Profile) => void
    removeProfile: (id: string) => void
    updateProfile: (id: string, profile: Partial<Profile>) => void
    setActiveProfile: (id: string | null) => void
    setConnected: (connected: boolean) => void
    updateStats: (stats: Partial<AppState['stats']>) => void
    updateSessionStats: (stats: Partial<AppState['sessionStats']>) => void
    addTrafficDataPoint: (dataPoint: TrafficDataPoint) => void
    clearTrafficData: () => void
}

const defaultSettings: AppSettings = {
    mode: 'simple',
    language: 'English',
    deviceId: crypto.randomUUID(),
    userAgent: 'Chrome/Latest',
    logLevel: 'warning',
    showLogs: false,
    allowInsecure: false,
    muxEnabled: false,
    muxConcurrency: 8,
    dnsQueryStrategy: 'UseIP',
    dnsLog: false,
    dnsDisableCache: false,
    dnsDisableFallback: false,
    dnsDisableFallbackIfMatch: false,
    selectedDnsServer: 'DoU: 1.1.1.1',
    customDnsServers: [],
    autoSelectFastest: false,
    // New features defaults
    launchOnStartup: false,
    connectOnBoot: false,
    reconnectOnFailure: true,
    killSwitch: false,
    dnsLeakProtection: true,
    webrtcLeakProtection: true,
    theme: 'dark',
    routingMode: 'global',
    connectionHealthCheck: true,
    profileTemplates: [],
    // Qv2ray settings defaults
    maxLogLines: 500,
    autoConnect: 'none',
    latencyTestMethod: 'tcping',
    realPingTestUrl: 'https://www.google.com',
    proxyType: 'none',
    customProxyType: 'http',
    customProxyServer: '127.0.0.1',
    customProxyPort: 8000,
    testLatencyPeriodically: false,
    testLatencyOnConnected: false,
    disableSystemRootCerts: false,
    // Inbound settings defaults
    setSystemProxy: false,
    socksEnabled: true,
    socksPort: 1089,
    socksUdpEnabled: true,
    socksUdpLocalIp: '127.0.0.1',
    socksAuthEnabled: false,
    socksUsername: 'user',
    socksPassword: 'pass',
    socksSniffing: true,
    socksDestOverrideHttp: false,
    socksDestOverrideTls: false,
    httpEnabled: true,
    httpPort: 8889,
    httpAuthEnabled: false,
    httpUsername: 'user',
    httpPassword: 'pass',
    httpSniffing: true,
    httpDestOverrideHttp: false,
    httpDestOverrideTls: false,
    browserForwarderAddress: '127.0.0.1',
    browserForwarderPort: 8088,
    // Connection settings defaults
    forceDirectConnection: false,
    bypassPrivateAddresses: true,
    bypassCnMainland: true,
    bypassBittorrent: false,
    useV2rayDnsForDirect: false,
    dnsIntercept: false,
    forwardProxyEnabled: false,
    forwardProxyType: 'http',
    forwardProxyHost: '',
    forwardProxyPort: 1,
    forwardProxyAuthEnabled: false,
    forwardProxyUsername: '',
    forwardProxyPassword: '',
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AppState>(() => {
        const saved = localStorage.getItem('v2ray-app-state')
        if (saved) {
            try {
                const parsed = JSON.parse(saved)

                // Migrate old profile format (type -> protocol, tlsType -> tls)
                if (parsed.profiles && Array.isArray(parsed.profiles)) {
                    parsed.profiles = parsed.profiles.map((profile: any) => {
                        const migrated = { ...profile }

                        // Migrate type to protocol
                        if (profile.type && !profile.protocol) {
                            migrated.protocol = profile.type
                            delete migrated.type
                        }

                        // Migrate tlsType to tls
                        if (profile.tlsType && !profile.tls) {
                            migrated.tls = profile.tlsType
                            delete migrated.tlsType
                        }

                        return migrated
                    })
                }

                // Ensure trafficGraphData exists (migration for new field)
                if (!parsed.trafficGraphData) {
                    parsed.trafficGraphData = []
                }

                return parsed
            } catch {
                return {
                    settings: defaultSettings,
                    profiles: [],
                    activeProfileId: null,
                    isConnected: false,
                    connectedAt: null,
                    stats: { memoryUsage: 0, uploadSpeed: 0, downloadSpeed: 0, totalTunneled: 0 },
                    trafficGraphData: [],
                    sessionStats: { uploaded: 0, downloaded: 0, connectedIp: '', connectedRegion: '' }
                }
            }
        }
        return {
            settings: defaultSettings,
            profiles: [],
            activeProfileId: null,
            isConnected: false,
            connectedAt: null,
            stats: { memoryUsage: 0, uploadSpeed: 0, downloadSpeed: 0, totalTunneled: 0 },
            trafficGraphData: [],
            sessionStats: { uploaded: 0, downloaded: 0, connectedIp: '', connectedRegion: '' }
        }
    })

    useEffect(() => {
        localStorage.setItem('v2ray-app-state', JSON.stringify(state))
    }, [state])

    const updateSettings = (newSettings: Partial<AppSettings>) => {
        setState(prev => ({
            ...prev,
            settings: { ...prev.settings, ...newSettings }
        }))
    }

    const addProfile = (profile: Profile) => {
        setState(prev => ({
            ...prev,
            profiles: [...prev.profiles, profile]
        }))
    }

    const removeProfile = (id: string) => {
        setState(prev => ({
            ...prev,
            profiles: prev.profiles.filter(p => p.id !== id),
            activeProfileId: prev.activeProfileId === id ? null : prev.activeProfileId
        }))
    }

    const updateProfile = (id: string, updates: Partial<Profile>) => {
        setState(prev => ({
            ...prev,
            profiles: prev.profiles.map(p => p.id === id ? { ...p, ...updates } : p)
        }))
    }

    const setActiveProfile = (id: string | null) => {
        setState(prev => ({ ...prev, activeProfileId: id }))
    }

    const setConnected = (connected: boolean) => {
        setState(prev => ({
            ...prev,
            isConnected: connected,
            connectedAt: connected ? Date.now() : null,
            trafficGraphData: connected ? prev.trafficGraphData : [] // Clear graph data on disconnect
        }))
    }

    const addTrafficDataPoint = (dataPoint: TrafficDataPoint) => {
        setState(prev => {
            const newData = [...prev.trafficGraphData, dataPoint]
            // Keep only last 60 data points
            return {
                ...prev,
                trafficGraphData: newData.slice(-60)
            }
        })
    }

    const clearTrafficData = () => {
        setState(prev => ({ ...prev, trafficGraphData: [] }))
    }

    const updateStats = (newStats: Partial<AppState['stats']>) => {
        setState(prev => ({
            ...prev,
            stats: { ...prev.stats, ...newStats }
        }))
    }

    const updateSessionStats = (newStats: Partial<AppState['sessionStats']>) => {
        setState(prev => ({
            ...prev,
            sessionStats: { ...prev.sessionStats, ...newStats }
        }))
    }

    return (
        <AppContext.Provider value={{
            ...state,
            updateSettings,
            addProfile,
            removeProfile,
            updateProfile,
            setActiveProfile,
            setConnected,
            updateStats,
            updateSessionStats,
            addTrafficDataPoint,
            clearTrafficData
        }}>
            {children}
        </AppContext.Provider>
    )
}

export const useApp = () => {
    const context = useContext(AppContext)
    if (!context) {
        throw new Error('useApp must be used within AppProvider')
    }
    return context
}
