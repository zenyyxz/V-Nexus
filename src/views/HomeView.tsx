import { useState, useEffect } from 'react'
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

// Country flag emoji mapping
const getCountryFlag = (region: string): string => {
    const flags: Record<string, string> = {
        'US': '🇺🇸', 'SG': '🇸🇬', 'JP': '🇯🇵', 'HK': '🇭🇰',
        'UK': '🇬🇧', 'DE': '🇩🇪', 'CA': '🇨🇦', 'AU': '🇦🇺',
        'FR': '🇫🇷', 'NL': '🇳🇱', 'KR': '🇰🇷', 'IN': '🇮🇳'
    }
    return flags[region.toUpperCase()] || '🌍'
}

const detectRegionFromAddress = (address: string | undefined): string => {
    if (!address) return 'US'

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
        if (patterns.some(pattern => lowerAddress.includes(pattern))) {
            return region
        }
    }

    return 'US'
}

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

export const HomeView = () => {
    const { stats, sessionStats, profiles, activeProfileId, setActiveProfile, updateProfile, settings, isConnected, setConnected, updateSessionStats, updateSettings, connectedAt } = useApp()
    const { showToast } = useToast()
    const { t } = useTranslation()
    useRealStats()
    const { markManualDisconnect } = useReconnect()
    useHealthCheck()
    usePeriodicLatencyTest()

    const [editingProfile, setEditingProfile] = useState<string | null>(null)
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
    const [connectedTime, setConnectedTime] = useState('')
    const [pingingAll, setPingingAll] = useState(false)
    const [copiedIp, setCopiedIp] = useState(false)

    // Keyboard shortcuts
    useKeyboardShortcuts([
        {
            key: 'd',
            ctrl: true,
            action: () => {
                if (isConnected) {
                    handleConnect() // Will disconnect if already connected
                }
            },
            description: 'Disconnect'
        },
        {
            key: 'r',
            ctrl: true,
            action: () => {
                if (!isConnected && (activeProfileId || selectedProfileId)) {
                    handleConnect() // Reconnect
                }
            },
            description: 'Reconnect'
        },
        {
            key: 't',
            ctrl: true,
            action: () => {
                handlePingAll()
            },
            description: 'Test all servers'
        }
    ])

    // Load last selected profile from localStorage on mount
    useEffect(() => {
        const lastSelectedId = localStorage.getItem('lastSelectedProfileId')
        if (lastSelectedId && profiles.some(p => p.id === lastSelectedId)) {
            setSelectedProfileId(lastSelectedId)
        }
    }, [profiles])

    // Update connected time every second
    useEffect(() => {
        if (!isConnected || !connectedAt) {
            setConnectedTime('')
            return
        }

        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - connectedAt) / 1000)
            const hours = Math.floor(elapsed / 3600)
            const minutes = Math.floor((elapsed % 3600) / 60)
            const seconds = elapsed % 60
            setConnectedTime(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
        }, 1000)

        return () => clearInterval(interval)
    }, [isConnected, connectedAt])

    // Auto-select fastest server when enabled
    useEffect(() => {
        if (settings.autoSelectFastest && profiles.length > 0) {
            const profilesWithLatency = profiles.filter(p => p.latency !== undefined && p.latency > 0)
            if (profilesWithLatency.length > 0) {
                const fastest = profilesWithLatency.reduce((prev, curr) =>
                    (curr.latency || 999) < (prev.latency || 999) ? curr : prev
                )
                setSelectedProfileId(fastest.id)
            }
        }
    }, [settings.autoSelectFastest, profiles])

    // Auto-connect on startup
    useEffect(() => {
        const checkAutoConnect = async () => {
            const hasAutoConnected = sessionStorage.getItem('hasAutoConnected')
            // Don't auto-connect if: already connected, already attempted, connectOnBoot is disabled, autoConnect is 'none', or no profiles
            if (hasAutoConnected || isConnected || !settings.connectOnBoot || settings.autoConnect === 'none' || profiles.length === 0) return

            sessionStorage.setItem('hasAutoConnected', 'true')

            // Wait a bit for latency checks if auto-fastest is on
            if (settings.autoSelectFastest) {
                await new Promise(resolve => setTimeout(resolve, 1000))
            }

            let targetId = localStorage.getItem('lastSelectedProfileId')

            // Logic for 'fixed' (currently falls back to last selected as UI doesn't allow picking specific yet)
            if (settings.autoConnect === 'fixed') {
                targetId = localStorage.getItem('lastSelectedProfileId')
            }

            if (targetId) {
                const profile = profiles.find(p => p.id === targetId)
                if (profile) {
                    showToast(`Auto-connecting to ${profile.name}...`, 'info')
                    const result = await window.xray.start(profile, settings)
                    if (result.success) {
                        setConnected(true)
                        setActiveProfile(profile.id)
                        window.electronApp?.sendConnectionStatus(true)
                        showToast(`Connected to ${profile.name}`, 'success')

                        // Resolve IP for stats
                        try {
                            const response = await fetch(`https://dns.google/resolve?name=${profile.address}&type=A`)
                            const data = await response.json()
                            if (data.Answer && data.Answer.length > 0) {
                                const serverIp = data.Answer[0].data
                                updateSessionStats({
                                    connectedIp: serverIp,
                                    connectedRegion: detectRegionFromAddress(profile.address),
                                    uploaded: 0,
                                    downloaded: 0
                                })
                            }
                        } catch (e) { console.error(e) }

                        // Test latency on connected if enabled
                        if (settings.testLatencyOnConnected) {
                            setTimeout(async () => {
                                try {
                                    const { pingServer } = await import('../utils/ping')
                                    const latency = await pingServer(profile.address, profile.port, settings.latencyTestMethod)
                                    updateProfile(profile.id, { latency })
                                    if (latency < 9999) {
                                        showToast(`Latency: ${latency}ms`, 'success', 2000)
                                    }
                                } catch (error) {
                                    console.error('Failed to test latency on connect:', error)
                                }
                            }, 1000) // Wait 1 second after connection
                        }
                    }
                }
            }
        }

        checkAutoConnect()
    }, [profiles, settings.connectOnBoot, settings.autoConnect, isConnected])

    const handleConnect = async () => {
        if (isConnected) {
            // Disconnect
            try {
                markManualDisconnect() // Prevent auto-reconnect for manual disconnects
                showToast('Disconnecting...', 'info')
                const result = await window.xray.stop()

                if (result.success) {
                    setConnected(false)
                    setActiveProfile(null)
                    window.electronApp?.sendConnectionStatus(false)
                    showToast('Disconnected', 'success')
                } else {
                    showToast(`Failed to disconnect: ${result.error}`, 'error')
                }
            } catch (error: any) {
                showToast(`Disconnect error: ${error.message}`, 'error')
            }
            return
        }

        // Connect to selected profile or auto-select fastest
        let profileId: string | null = null

        if (settings.autoSelectFastest) {
            const profilesWithLatency = profiles.filter(p => p.latency !== undefined && p.latency > 0)
            if (profilesWithLatency.length > 0) {
                const fastest = profilesWithLatency.reduce((prev, curr) =>
                    (curr.latency || 999) < (prev.latency || 999) ? curr : prev
                )
                profileId = fastest.id
                showToast(`Auto-selected fastest server: ${fastest.name} (${fastest.latency}ms)`, 'info')
            } else {
                showToast('No servers with latency data. Please ping servers first.', 'warning')
                return
            }
        } else {
            if (!selectedProfileId) {
                showToast('Please select a profile to connect', 'warning')
                return
            }
            profileId = selectedProfileId
        }

        if (!profileId) {
            showToast('No profile selected', 'warning')
            return
        }

        const profile = profiles.find(p => p.id === profileId)
        if (!profile) return

        try {
            showToast(`Connecting to ${profile.name}...`, 'info')
            const result = await window.xray.start(profile, settings)

            if (result.success) {
                setConnected(true)
                setActiveProfile(profile.id)
                localStorage.setItem('lastSelectedProfileId', profile.id)

                // Resolve domain to IP address
                let serverIp = profile.address
                try {
                    const response = await fetch(`https://dns.google/resolve?name=${profile.address}&type=A`)
                    const data = await response.json()
                    if (data.Answer && data.Answer.length > 0) {
                        serverIp = data.Answer[0].data
                    }
                } catch (error) {
                    console.error('Failed to resolve IP:', error)
                }

                updateSessionStats({
                    connectedIp: serverIp,
                    connectedRegion: detectRegionFromAddress(profile.address),
                    uploaded: 0,
                    downloaded: 0
                })

                showToast(`Connected to ${profile.name}`, 'success')
                window.electronApp?.sendConnectionStatus(true)

                // Test latency on connected if enabled
                if (settings.testLatencyOnConnected) {
                    setTimeout(async () => {
                        try {
                            const { pingServer } = await import('../utils/ping')
                            const latency = await pingServer(profile.address, profile.port, settings.latencyTestMethod)
                            updateProfile(profile.id, { latency })
                            if (latency < 9999) {
                                showToast(`Latency: ${latency}ms`, 'success', 2000)
                            }
                        } catch (error) {
                            console.error('Failed to test latency on connect:', error)
                        }
                    }, 1000) // Wait 1 second after connection
                }
            } else {
                showToast(`Connection failed: ${result.error}`, 'error')
            }
        } catch (error: any) {
            showToast(`Connection error: ${error.message}`, 'error')
        }
    }

    const handleCopyIp = () => {
        if (sessionStats?.connectedIp) {
            navigator.clipboard.writeText(sessionStats.connectedIp)
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

            if (latency < 9999) {
                showToast(`${profile.name}: ${latency}ms`, 'success')
            } else {
                showToast(`${profile.name}: Timeout`, 'error')
            }
        }
    }

    const handlePingAll = async () => {
        if (profiles.length === 0) {
            showToast('No profiles to ping', 'warning')
            return
        }

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

    const activeProfile = activeProfileId ? profiles.find(p => p.id === activeProfileId) : null
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

                    <button
                        onClick={handleConnect}
                        disabled={!isConnected && profiles.length === 0}
                        className={`flex items-center gap-3 px-6 py-3 rounded-lg font-semibold text-sm transition-all shadow-lg hover-lift ${isConnected
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                            }`}
                    >
                        <Power size={20} />
                        {isConnected ? 'Disconnect' : 'Connect'}
                    </button>
                </div>

                {isConnected && activeProfile && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium text-emerald-500">Connected to {activeProfile.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-emerald-400">
                            <Clock size={14} />
                            <span className="font-mono w-20 text-right">{connectedTime}</span>
                        </div>
                    </div>
                )}
            </header>

            <div className="flex-1 space-y-6 pb-6">
                {/* Stats Section */}
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
                                <div className="mb-1">
                                    <span className="text-3xl" style={{ fontFamily: '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif' }}>{getCountryFlag(sessionStats?.connectedRegion || '')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-2">
                                        <div className="font-mono text-sm font-semibold text-purple-500 truncate flex-1">{sessionStats.connectedIp}</div>
                                        <button
                                            onClick={handleCopyIp}
                                            className="p-1.5 hover:bg-purple-500/10 rounded transition-colors text-purple-400 hover:text-purple-300"
                                        >
                                            {copiedIp ? <Check size={14} /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-2xl font-semibold text-secondary w-32">{t('stat_not_connected')}</div>
                        )}
                    </div>
                </div>

                <TrafficGraph />

                {/* Auto-Select Fastest */}
                <div className="bg-surface border border-border rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Zap size={18} className="text-yellow-500" />
                        <div>
                            <div className="text-sm font-medium text-primary">{t('auto_select')}</div>
                            <div className="text-xs text-secondary mt-0.5">Automatically connect to the server with lowest latency</div>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.autoSelectFastest}
                            onChange={(e) => updateSettings({ autoSelectFastest: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                    </label>
                </div>

                {/* Quick Select Section */}
                <div className="bg-surface border border-border rounded-lg overflow-hidden">
                    <div className="p-4 bg-background/50 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-primary">{t('quick_select')}</h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePingAll}
                                disabled={pingingAll || profiles.length === 0}
                                className="px-3 py-1.5 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 transition-all hover-lift disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                            >
                                <Activity size={12} className={pingingAll ? 'animate-pulse' : ''} />
                                {pingingAll ? 'Pinging...' : 'Ping All'}
                            </button>
                            <a
                                href="#/configs"
                                className="text-xs text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
                            >
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
                                    <div
                                        key={profile.id}
                                        onClick={() => {
                                            if (!settings.autoSelectFastest) {
                                                setSelectedProfileId(profile.id)
                                            }
                                        }}
                                        className={`p-3 rounded-md border transition-all animate-fade-in hover-scale ${settings.autoSelectFastest ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${selectedProfileId === profile.id
                                            ? 'bg-accent/10 border-accent ring-1 ring-accent'
                                            : activeProfileId === profile.id && isConnected
                                                ? 'bg-emerald-500/10 border-emerald-500/50'
                                                : 'bg-background border-border hover:border-zinc-700'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex-shrink-0">
                                                {selectedProfileId === profile.id ? (
                                                    <div className="w-4 h-4 rounded-full border-2 border-accent flex items-center justify-center">
                                                        <div className="w-2 h-2 rounded-full bg-accent"></div>
                                                    </div>
                                                ) : (
                                                    <div className="w-4 h-4 rounded-full border-2 border-zinc-600"></div>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-sm text-primary truncate">{profile.name}</span>
                                                        {activeProfileId === profile.id && isConnected && (
                                                            <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-[10px] font-bold">ACTIVE</span>
                                                        )}
                                                        {profile.latency !== undefined && (
                                                            <span className={`text-xs px-2 py-0.5 rounded ${profile.latency < 100 ? 'bg-emerald-500/20 text-emerald-500' : profile.latency < 300 ? 'bg-yellow-500/20 text-yellow-500' : 'bg-red-500/20 text-red-500'}`}>
                                                                {profile.latency < 9999 ? `${profile.latency}ms` : 'Timeout'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handlePing(profile.id); }}
                                                        className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 transition-all hover-lift flex-shrink-0"
                                                    >
                                                        Ping
                                                    </button>
                                                </div>
                                                <div className="text-xs text-secondary font-mono truncate flex items-center gap-2">
                                                    {profile.address}:{profile.port}
                                                    <span className="text-zinc-600">•</span>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-400 uppercase tracking-wide border border-blue-500/30">
                                                        {profile.protocol || 'vmess'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                        )}
                    </div>
                </div>
            </div>

            {editingProfileData && (
                <ProfileEditor
                    profile={editingProfileData}
                    onSave={(updates) => {
                        updateProfile(editingProfileData.id, updates)
                        showToast('Profile updated', 'success')
                    }}
                    onClose={() => setEditingProfile(null)}
                />
            )}
        </div>
    )
}
