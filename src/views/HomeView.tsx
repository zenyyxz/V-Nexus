import { useState, useEffect } from 'react'
import { connectionService } from '../services/ConnectionService'
import { invoke } from '@tauri-apps/api/core'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { useTranslation } from '../hooks/useTranslation'
import { useApp } from '../contexts/AppContext'
import { useToast } from '../contexts/ToastContext'
import { useRealStats } from '../hooks/useRealStats'
import { useReconnect } from '../hooks/useReconnect'
import { useHealthCheck } from '../hooks/useHealthCheck'
import { usePeriodicLatencyTest } from '../hooks/usePeriodicLatencyTest'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { ProfileEditor } from '../components/ProfileEditor'
import { TrafficGraph } from '../components/TrafficGraph'
import { Home, Upload, Download, HardDrive, Server, Zap, FileCode, Power, Clock, Activity, Copy, Check } from 'lucide-react'

// Helper to get Flag URL
const getFlagUrl = (region: string) => {
    if (!region) return ''
    const code = region.toLowerCase()
    return `https://flagcdn.com/w40/${code}.png`
}

const detectRegionFromAddress = (address: string | undefined): string => {
    if (!address) return ''
    const regionPatterns: Record<string, string[]> = {
        'US': ['us', 'usa', 'america', 'dallas', 'newyork', 'losangeles'],
        'SG': ['sg', 'singapore'],
        'DE': ['de', 'germany', 'frankfurt'],
        'UK': ['uk', 'london', 'britain'],
        'JP': ['jp', 'japan', 'tokyo'],
        'HK': ['hk', 'hongkong'],
        'CA': ['ca', 'canada', 'toronto'],
        'AU': ['au', 'australia', 'sydney'],
        'NL': ['nl', 'netherlands', 'amsterdam'],
        'FR': ['fr', 'france', 'paris']
    }
    const lowerAddress = address.toLowerCase()
    for (const [region, patterns] of Object.entries(regionPatterns)) {
        if (patterns.some(pattern => lowerAddress.includes(pattern))) return region
    }
    return ''
}

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

export const HomeView = () => {
    const { stats, sessionStats, profiles, activeProfileId, setActiveProfile, updateProfile, settings, isConnected, setConnected, updateSessionStats, updateSettings, connectedAt, customConfig } = useApp()
    const { showToast } = useToast()
    const { t } = useTranslation()
    useRealStats()
    const { markManualDisconnect } = useReconnect()
    useHealthCheck()
    usePeriodicLatencyTest()

    const [editingProfile, setEditingProfile] = useState<string | null>(null)
    const { selectedProfileId, setSelectedProfileId } = useApp()
    const [connectedTime, setConnectedTime] = useState('')
    const [pingingAll, setPingingAll] = useState(false)
    const [connectionStatus, setConnectionStatus] = useState<string>('')
    const [copiedIp, setCopiedIp] = useState(false)
    const [isTransitioning, setIsTransitioning] = useState(false)

    useKeyboardShortcuts([
        { key: 'd', ctrl: true, action: () => { if (isConnected && !isTransitioning) handleConnect() }, description: 'Disconnect' },
        { key: 'r', ctrl: true, action: () => { if (!isConnected && (activeProfileId || selectedProfileId) && !isTransitioning) handleConnect() }, description: 'Reconnect' },
        { key: 't', ctrl: true, action: () => handlePingAll(), description: 'Test all servers' }
    ])

    useEffect(() => {
        const lastSelectedId = localStorage.getItem('lastSelectedProfileId')
        if (lastSelectedId && profiles.some(p => p.id === lastSelectedId)) setSelectedProfileId(lastSelectedId)
    }, [profiles])

    useEffect(() => {
        if (!isConnected || !connectedAt) { setConnectedTime(''); return }
        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - connectedAt) / 1000)
            const hours = Math.floor(elapsed / 3600)
            const minutes = Math.floor((elapsed % 3600) / 60)
            const seconds = elapsed % 60
            setConnectedTime(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
        }, 1000)
        return () => clearInterval(interval)
    }, [isConnected, connectedAt])

    useEffect(() => {
        if (settings.autoSelectFastest && profiles.length > 0) {
            const profilesWithLatency = profiles.filter(p => p.latency !== undefined && p.latency > 0)
            if (profilesWithLatency.length > 0) {
                const fastest = profilesWithLatency.reduce((prev, curr) => (curr.latency || 999) < (prev.latency || 999) ? curr : prev)
                setSelectedProfileId(fastest.id)
            }
        }
    }, [settings.autoSelectFastest, profiles])

    useEffect(() => {
        const checkAutoConnect = async () => {
            const hasAutoConnected = sessionStorage.getItem('hasAutoConnected')
            if (hasAutoConnected || isConnected || !settings.connectOnBoot || settings.autoConnect === 'none' || profiles.length === 0) return
            sessionStorage.setItem('hasAutoConnected', 'true')
            setIsTransitioning(true)

            if (settings.autoSelectFastest) await new Promise(resolve => setTimeout(resolve, 1000))
            let targetId = localStorage.getItem('lastSelectedProfileId')
            if (settings.autoConnect === 'fixed') targetId = localStorage.getItem('lastSelectedProfileId')

            if (targetId) {
                const profile = profiles.find(p => p.id === targetId)
                if (profile) {
                    showToast(`Auto-connecting to ${profile.name}...`, 'info')
                    try {
                        const result = await connectionService.connect(profile, settings, (msg) => console.log(msg), customConfig)
                        if (result.success) {
                            setConnected(true)
                            setActiveProfile(profile.id)
                            showToast(`Connected to ${profile.name}`, 'success')

                            // Resolve IP logic duplicated here? Usually handleConnect is better but for auto-connect we do it manually
                            // Let's use the new logic logic here too if possible, or just copy-paste for safety
                            // Or better: call handleConnect? No, handleConnect toggles.
                            // Just update stats simply for auto-connect or copy the new logic.
                            updateSessionStats({ connectedIp: profile.address, connectedRegion: detectRegionFromAddress(profile.address), uploaded: 0, downloaded: 0 })
                        }
                    } catch (e) { console.error(e) }
                }
            }
            setIsTransitioning(false)
        }
        checkAutoConnect()
    }, [profiles, settings.connectOnBoot, settings.autoConnect, isConnected])

    const handleConnect = async () => {
        if (isTransitioning) return
        setIsTransitioning(true)

        if (isConnected) {
            try {
                markManualDisconnect()
                const result = await connectionService.disconnect()
                if (result.success) {
                    setConnected(false)
                    setActiveProfile(null)
                    showToast('Disconnected', 'success')
                } else {
                    showToast(`Failed to disconnect: ${result.error}`, 'error')
                }
            } catch (error: any) {
                showToast(`Disconnect error: ${error.message}`, 'error')
            } finally { setIsTransitioning(false) }
            return
        }

        let profileId: string | null = null
        if (settings.autoSelectFastest) {
            const profilesWithLatency = profiles.filter(p => p.latency !== undefined && p.latency > 0)
            if (profilesWithLatency.length > 0) {
                const fastest = profilesWithLatency.reduce((prev, curr) => (curr.latency || 999) < (prev.latency || 999) ? curr : prev)
                profileId = fastest.id
                showToast(`Auto-selected fastest server: ${fastest.name} (${fastest.latency}ms)`, 'info')
            } else {
                showToast('No servers with latency data. Please ping servers first.', 'warning')
                setIsTransitioning(false); return
            }
        } else {
            if (!selectedProfileId) { showToast('Please select a profile to connect', 'warning'); setIsTransitioning(false); return }
            profileId = selectedProfileId
        }

        const profile = profiles.find(p => p.id === profileId)
        if (!profile) { setIsTransitioning(false); return }

        if (settings.tunMode) {
            const isAdmin = await invoke('check_is_admin')
            if (!isAdmin) {
                showToast('TUN Mode requires Administrator privileges.', 'error', 10000, {
                    label: 'Restart as Admin',
                    onClick: async () => {
                        try {
                            // Prevent zombie processes by killing the engine first
                            await invoke('stop_xray')
                            await invoke('restart_as_admin')
                        } catch (e: any) {
                            showToast(String(e), 'error', 5000)
                        }
                    }
                })
                setIsTransitioning(false); return
            }
        }

        try {
            setConnectionStatus('Initializing Connection...')
            const result = await connectionService.connect(profile, settings, (status) => setConnectionStatus(status), customConfig)
            if (result.success) {
                setConnectionStatus('Verifying Internet Access, Please Wait...')

                // Synchonous Resolve Logic
                let serverIp = profile.address
                let regionCode = ''

                // 1. Resolve IP via Backend (Reliable)
                try {
                    const resolvedIp = await invoke('resolve_hostname', { hostname: profile.address }) as string
                    if (resolvedIp) serverIp = resolvedIp
                } catch { /* Ignore resolve error, use hostname */ }

                // 2. Fetch GeoIP with Fallback
                try {
                    // Start with high-quality provider
                    const geoRes = await fetch(`https://ipapi.co/${serverIp}/json/`)
                    if (geoRes.ok) {
                        const geoData = await geoRes.json()
                        if (geoData.country_code) regionCode = geoData.country_code
                    }
                    else throw new Error('ipapi.co failed')
                } catch (e) {
                    // Fallback to ipwho.is (Very reliable, free)
                    try {
                        const geoResFallback = await fetch(`https://ipwho.is/${serverIp}`)
                        if (geoResFallback.ok) {
                            const geoDataFallback = await geoResFallback.json()
                            if (geoDataFallback.success && geoDataFallback.country_code) {
                                regionCode = geoDataFallback.country_code
                            }
                        }
                    } catch (e2) {
                        console.warn('All GeoIP services failed:', e, e2)
                        regionCode = detectRegionFromAddress(profile.address)
                    }
                }

                // Final safety check
                if (!regionCode) regionCode = detectRegionFromAddress(profile.address)

                updateSessionStats({ connectedIp: serverIp, connectedRegion: regionCode, uploaded: 0, downloaded: 0 })

                // Finalize Connection State
                setConnected(true)
                setActiveProfile(profile.id)
                localStorage.setItem('lastSelectedProfileId', profile.id)
                setConnectionStatus('')

                showToast(`Connected to ${profile.name}`, 'success')

                if (settings.testLatencyOnConnected) {
                    setTimeout(async () => {
                        try {
                            const { pingServer } = await import('../utils/ping')
                            const latency = await pingServer(profile.address, profile.port, settings.latencyTestMethod)
                            updateProfile(profile.id, { latency })
                        } catch (e) { console.error(e) }
                    }, 1000)
                }
            } else {
                showToast(`Connection failed: ${result.error}`, 'error')
            }
        } catch (error: any) {
            showToast(`Connection error: ${error.message}`, 'error')
            setConnectionStatus('')
        } finally {
            setIsTransitioning(false)
        }
    }

    const handleCopyIp = async () => {
        if (sessionStats?.connectedIp) {
            await writeText(sessionStats.connectedIp)
            setCopiedIp(true)
            showToast('IP copied to clipboard', 'success')
            setTimeout(() => setCopiedIp(false), 2000)
        }
    }

    const handlePing = async (profileId: string) => {
        const profile = profiles.find(p => p.id === profileId)
        if (profile) {
            showToast(`Pinging ${profile.name}...`, 'info', 1500)
            const { pingServer } = await import('../utils/ping')
            const latency = await pingServer(profile.address, profile.port, settings.latencyTestMethod)
            updateProfile(profileId, { latency })
            if (latency < 9999) showToast(`${profile.name}: ${latency}ms`, 'success')
            else showToast(`${profile.name}: Timeout`, 'error')
        }
    }

    const handlePingAll = async () => {
        if (profiles.length === 0) { showToast('No profiles to ping', 'warning'); return }
        setPingingAll(true)
        showToast('Pinging all servers...', 'info')
        const { pingServer } = await import('../utils/ping')
        for (const profile of profiles) {
            const latency = await pingServer(profile.address, profile.port, settings.latencyTestMethod)
            updateProfile(profile.id, { latency })
        }
        setPingingAll(false)
        showToast('All servers pinged successfully', 'success')
    }


    const editingProfileData = editingProfile ? profiles.find(p => p.id === editingProfile) : null

    return (
        <div className="flex flex-col px-6 h-full overflow-y-auto">
            <header className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Home size={24} className="text-accent" />
                        <div>
                            <h2 className="text-2xl font-semibold text-primary tracking-tight">{t('nav_home')}</h2>
                            <p className="text-secondary text-sm mt-1">{t('home_subtitle')}</p>
                        </div>
                    </div>
                    <button onClick={handleConnect} disabled={(!isConnected && profiles.length === 0) || isTransitioning} className={`flex items-center gap-3 px-6 py-3 rounded-lg font-semibold text-sm transition-all shadow-lg hover-lift ${isConnected ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed'} ${isTransitioning ? 'cursor-wait opacity-80' : ''}`}>
                        <Power size={20} className={isTransitioning ? 'animate-pulse' : ''} />
                        {isConnected ? (isTransitioning ? 'Stopping...' : 'Disconnect') : (isTransitioning ? 'Starting...' : 'Connect')}
                    </button>
                </div>
            </header>

            {/* Status Bar */}
            <div className={`rounded-lg p-4 mb-6 flex items-center justify-between transition-colors duration-300 ${isConnected ? 'bg-emerald-500/10 border border-emerald-500/20' :
                (connectionStatus ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-surface border border-border')
                }`}>
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' :
                        (connectionStatus ? 'bg-yellow-500 animate-pulse' : 'bg-secondary')
                        }`}></div>
                    <span className={`text-sm font-medium ${isConnected ? 'text-emerald-500' :
                        (connectionStatus ? 'text-yellow-500' : 'text-secondary')
                        }`}>
                        {isConnected
                            ? `Connected to ${profiles.find(p => p.id === activeProfileId)?.name}`
                            : (connectionStatus || 'Not Connected')}
                    </span>
                </div>
                {isConnected && (
                    <div className="flex items-center gap-2 text-sm text-emerald-400">
                        <Clock size={14} />
                        <span className="font-mono w-20 text-right">{connectedTime}</span>
                    </div>
                )}
            </div>

            <div className="flex-1 space-y-6 pb-6">
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-surface border border-border rounded-lg p-4 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <HardDrive size={16} className="text-secondary flex-shrink-0" />
                            <span className="text-xs font-medium text-secondary uppercase tracking-wider">{t('stat_memory')}</span>
                        </div>
                        <div className="text-2xl font-semibold text-primary w-24 truncate">{stats.memoryUsage} MB</div>
                    </div>
                    <div className="bg-surface border border-border rounded-lg p-4 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <Upload size={16} className="text-emerald-500 flex-shrink-0" />
                            <span className="text-xs font-medium text-secondary uppercase tracking-wider">{t('stat_upload')}</span>
                        </div>
                        <div className="text-2xl font-semibold text-emerald-500 w-32 truncate">{formatBytes(sessionStats?.uploaded || 0)}</div>
                        <div className="text-xs text-secondary mt-1 w-32 truncate">{t('stat_session')}: {formatBytes(sessionStats?.uploaded || 0)}</div>
                    </div>
                    <div className="bg-surface border border-border rounded-lg p-4 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <Download size={16} className="text-blue-500 flex-shrink-0" />
                            <span className="text-xs font-medium text-secondary uppercase tracking-wider">{t('stat_download')}</span>
                        </div>
                        <div className="text-2xl font-semibold text-blue-500 w-32 truncate">{formatBytes(sessionStats?.downloaded || 0)}</div>
                        <div className="text-xs text-secondary mt-1 w-32 truncate">{t('stat_session')}: {formatBytes(sessionStats?.downloaded || 0)}</div>
                    </div>
                    <div className="bg-surface border border-border rounded-lg p-4 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <Server size={16} className="text-purple-500 flex-shrink-0" />
                            <span className="text-xs font-medium text-secondary uppercase tracking-wider">{t('stat_server')}</span>
                        </div>
                        {isConnected && sessionStats?.connectedIp ? (
                            <>
                                <div className="mb-1 flex items-center justify-center bg-zinc-950/50 rounded-lg p-2 border border-white/5 h-16 w-24">
                                    {sessionStats.connectedRegion ? (
                                        <img src={getFlagUrl(sessionStats.connectedRegion)} alt={sessionStats.connectedRegion} className="w-full h-full object-contain drop-shadow-md" />
                                    ) : (
                                        <span className="text-3xl">🌍</span>
                                    )}
                                </div>
                                <div onClick={handleCopyIp} className="group font-mono text-sm font-semibold text-purple-500 truncate cursor-pointer hover:text-purple-400 transition-colors w-full flex items-center gap-2" title="Click to copy">
                                    <span className="truncate">{sessionStats.connectedIp}</span>
                                    {copiedIp ? <Check size={12} className="flex-shrink-0" /> : <Copy size={12} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />}
                                </div>
                            </>
                        ) : (
                            <div className="text-2xl font-semibold text-secondary w-32">{t('stat_not_connected')}</div>
                        )}
                    </div>
                </div>

                <TrafficGraph />

                <div className="bg-surface border border-border rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Zap size={18} className="text-yellow-500" />
                        <div>
                            <div className="text-sm font-medium text-primary">{t('auto_select')}</div>
                            <div className="text-xs text-secondary mt-0.5">Automatically connect to the server with lowest latency</div>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={settings.autoSelectFastest} onChange={(e) => updateSettings({ autoSelectFastest: e.target.checked })} className="sr-only peer" />
                        <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                    </label>
                </div>

                <div className="bg-surface border border-border rounded-lg overflow-hidden">
                    <div className="p-4 bg-background/50 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-primary">{t('quick_select')}</h3>
                        <div className="flex items-center gap-2">
                            <button onClick={handlePingAll} disabled={pingingAll || profiles.length === 0} className="px-3 py-1.5 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 transition-all hover-lift disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
                                <Activity size={12} className={pingingAll ? 'animate-pulse' : ''} />
                                {pingingAll ? 'Pinging...' : 'Ping All'}
                            </button>
                            <a href="#/configs" className="text-xs text-accent hover:text-accent/80 transition-colors flex items-center gap-1">
                                <FileCode size={14} />
                                Manage Configs →
                            </a>
                        </div>
                    </div>

                    <div className="p-2 space-y-2 max-h-96 overflow-y-auto">
                        {profiles.length === 0 ? (
                            <div className="p-8 text-center text-secondary text-sm">
                                No configurations yet. Go to <a href="#/configs" className="text-accent hover:underline">Configs</a> to import.
                            </div>
                        ) : (
                            [...profiles]
                                .sort((a, b) => (a.latency || 9999) - (b.latency || 9999))
                                .map(profile => (
                                    <div key={profile.id} onClick={() => { if (!settings.autoSelectFastest) setSelectedProfileId(profile.id) }} className={`p-3 rounded-md border transition-all animate-fade-in hover-scale ${settings.autoSelectFastest ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${selectedProfileId === profile.id ? 'bg-accent/10 border-accent ring-1 ring-accent' : activeProfileId === profile.id && isConnected ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-background border-border hover:border-zinc-700'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-shrink-0">
                                                {selectedProfileId === profile.id ? <div className="w-4 h-4 rounded-full border-2 border-accent flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-accent"></div></div> : <div className="w-4 h-4 rounded-full border-2 border-zinc-600"></div>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-sm text-primary truncate">{profile.name}</span>
                                                        {activeProfileId === profile.id && isConnected && <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-[10px] font-bold">ACTIVE</span>}
                                                        {profile.latency !== undefined && <span className={`text-xs px-2 py-0.5 rounded ${profile.latency < 100 ? 'bg-emerald-500/20 text-emerald-500' : profile.latency < 300 ? 'bg-yellow-500/20 text-yellow-500' : 'bg-red-500/20 text-red-500'}`}>{profile.latency < 9999 ? `${profile.latency}ms` : 'Timeout'}</span>}
                                                    </div>
                                                    <button onClick={(e) => { e.stopPropagation(); handlePing(profile.id); }} className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 transition-all hover-lift flex-shrink-0">Ping</button>
                                                </div>
                                                <div className="text-xs text-secondary font-mono truncate flex items-center gap-2">{profile.address}:{profile.port} <span className="text-zinc-600">•</span> <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-400 uppercase tracking-wide border border-blue-500/30">{profile.protocol || 'vmess'}</span></div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                        )}
                    </div>
                </div>
            </div>

            {editingProfileData && <ProfileEditor profile={editingProfileData} onSave={(updates) => { updateProfile(editingProfileData.id, updates); showToast('Profile updated', 'success') }} onClose={() => setEditingProfile(null)} />}
        </div>
    )
}
