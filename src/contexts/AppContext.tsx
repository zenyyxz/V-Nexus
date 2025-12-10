import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { DEFAULT_SETTINGS } from '../constants/defaults'

export type AppMode = 'simple' | 'advanced'

export interface Profile {
    id: string
    isFavorite?: boolean
    group?: string
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
    subscriptionId?: string // Link to subscription
}

export interface Subscription {
    id: string
    name: string
    url: string
    updatedAt: string // ISO string
    count: number
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
    tunMode: boolean
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
    subscriptions: Subscription[]
    logs: string[]
    customConfig: string | null
    selectedProfileId: string | null
}

export interface AppContextType extends AppState {
    updateSettings: (settings: Partial<AppSettings>) => void
    setCustomConfig: (config: string | null) => void
    setSelectedProfileId: (id: string | null) => void
    addProfile: (profile: Profile) => void
    removeProfile: (id: string) => void
    updateProfile: (id: string, profile: Partial<Profile>) => void
    setActiveProfile: (id: string | null) => void
    setConnected: (connected: boolean) => void
    updateStats: (stats: Partial<AppState['stats']>) => void
    updateSessionStats: (stats: Partial<AppState['sessionStats']>) => void
    addTrafficDataPoint: (dataPoint: TrafficDataPoint) => void
    clearTrafficData: () => void
    addSubscription: (sub: Subscription) => void
    removeSubscription: (id: string) => void
    updateSubscription: (id: string, updates: Partial<Subscription>) => void
    addLog: (log: string) => void
    clearLogs: () => void
}

const defaultSettings: AppSettings = {
    ...DEFAULT_SETTINGS,
    deviceId: crypto.randomUUID(),
} as AppSettings

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

                // Ensure logs exists (migration)
                if (!parsed.logs) {
                    parsed.logs = []
                }

                // Migrate bad default ports (1089/8889) to standard (10808/10809)
                if (parsed.settings) {
                    if (parsed.settings.socksPort === 1089) parsed.settings.socksPort = 10808
                    if (parsed.settings.httpPort === 8889) parsed.settings.httpPort = 10809
                    // Ensure tunMode matches default if missing
                    if (parsed.settings.tunMode === undefined) parsed.settings.tunMode = true
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
                    sessionStats: { uploaded: 0, downloaded: 0, connectedIp: '', connectedRegion: '' },
                    logs: []
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
            sessionStats: { uploaded: 0, downloaded: 0, connectedIp: '', connectedRegion: '' },
            logs: [],
            customConfig: null
        }
    })

    useEffect(() => {
        // Exclude logs from persistence to save space/perf
        const { logs, ...persistedState } = state
        localStorage.setItem('v2ray-app-state', JSON.stringify(persistedState))
    }, [state])

    const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
        setState(prev => ({
            ...prev,
            settings: { ...prev.settings, ...newSettings }
        }))
    }, [])

    const setCustomConfig = useCallback((config: string | null) => {
        setState(prev => ({ ...prev, customConfig: config }))
    }, [])

    const setSelectedProfileId = useCallback((id: string | null) => {
        setState(prev => ({ ...prev, selectedProfileId: id }))
    }, [])

    const addProfile = useCallback((profile: Profile) => {
        setState(prev => ({
            ...prev,
            profiles: [...prev.profiles, profile]
        }))
    }, [])

    const removeProfile = useCallback((id: string) => {
        setState(prev => ({
            ...prev,
            profiles: prev.profiles.filter(p => p.id !== id),
            activeProfileId: prev.activeProfileId === id ? null : prev.activeProfileId
        }))
    }, [])

    const updateProfile = useCallback((id: string, updates: Partial<Profile>) => {
        setState(prev => ({
            ...prev,
            profiles: prev.profiles.map(p => p.id === id ? { ...p, ...updates } : p)
        }))
    }, [])

    const setActiveProfile = useCallback((id: string | null) => {
        setState(prev => ({ ...prev, activeProfileId: id }))
    }, [])

    const setConnected = useCallback((connected: boolean) => {
        setState(prev => ({
            ...prev,
            isConnected: connected,
            connectedAt: connected ? Date.now() : null,
            trafficGraphData: connected ? prev.trafficGraphData : []
        }))
    }, [])

    const addTrafficDataPoint = useCallback((dataPoint: TrafficDataPoint) => {
        setState(prev => {
            const newData = [...prev.trafficGraphData, dataPoint]
            return {
                ...prev,
                trafficGraphData: newData.slice(-60)
            }
        })
    }, [])

    const clearTrafficData = useCallback(() => {
        setState(prev => ({ ...prev, trafficGraphData: [] }))
    }, [])

    const updateStats = useCallback((newStats: Partial<AppState['stats']>) => {
        setState(prev => ({
            ...prev,
            stats: { ...prev.stats, ...newStats }
        }))
    }, [])

    const updateSessionStats = useCallback((newStats: Partial<AppState['sessionStats']>) => {
        setState(prev => ({
            ...prev,
            sessionStats: { ...prev.sessionStats, ...newStats }
        }))
    }, [])

    const addSubscription = useCallback((sub: Subscription) => {
        setState(prev => ({
            ...prev,
            subscriptions: [...prev.subscriptions, sub]
        }))
    }, [])

    const removeSubscription = useCallback((id: string) => {
        setState(prev => ({
            ...prev,
            subscriptions: prev.subscriptions.filter(s => s.id !== id),
            profiles: prev.profiles.filter(p => p.subscriptionId !== id)
        }))
    }, [])

    const updateSubscription = useCallback((id: string, updates: Partial<Subscription>) => {
        setState(prev => ({
            ...prev,
            subscriptions: prev.subscriptions.map(s => s.id === id ? { ...s, ...updates } : s)
        }))
    }, [])

    // Global Log Listener (Restored)
    useEffect(() => {
        let unlistenFn: (() => void) | undefined;
        let isMounted = true;

        const setupLogListener = async () => {
            try {
                // Use dynamic import but log success
                const { listen } = await import('@tauri-apps/api/event')
                console.log('[AppContext] Setting up Xray log listener...')

                unlistenFn = await listen('xray-log', (event: any) => {
                    if (!isMounted) return
                    const payload = event.payload as { level: string, message: string }

                    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false })
                    const logLine = `[${timestamp}] [${payload.level}] ${payload.message}`

                    setState(prev => {
                        const maxLines = prev.settings.maxLogLines || 500
                        const newLogs = [...prev.logs, logLine]
                        if (newLogs.length > maxLines) {
                            return { ...prev, logs: newLogs.slice(newLogs.length - maxLines) }
                        }
                        return { ...prev, logs: newLogs }
                    })
                })
                console.log('[AppContext] Log listener attached successfully')
            } catch (err) {
                console.error('[AppContext] Failed to setup log listener:', err)
            }
        }

        setupLogListener()

        return () => {
            isMounted = false
            if (unlistenFn) unlistenFn()
        }
    }, [])

    const addLog = useCallback((log: string) => {
        setState(prev => ({
            ...prev,
            logs: [...prev.logs, log].slice(-(prev.settings.maxLogLines || 500))
        }))
    }, [])

    const clearLogs = useCallback(() => {
        setState(prev => ({ ...prev, logs: [] }))
    }, [])

    return (
        <AppContext.Provider value={{
            ...state,
            updateSettings,
            setCustomConfig,
            setSelectedProfileId,
            addProfile,
            removeProfile,
            updateProfile,
            setActiveProfile,
            setConnected,
            updateStats,
            updateSessionStats,
            addTrafficDataPoint,
            clearTrafficData,
            addSubscription,
            removeSubscription,
            updateSubscription,
            addLog,
            clearLogs
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
