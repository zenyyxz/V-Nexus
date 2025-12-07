import { useState } from 'react'
import { useApp } from '../contexts/AppContext'
import { useToast } from '../contexts/ToastContext'
import { UpdateChecker } from '../components/UpdateChecker'
import { LegalDocModal } from '../components/LegalDocModal'
import { PRIVACY_POLICY, TERMS_OF_USE } from '../constants/legalDocs'
import { Settings as SettingsIcon, Globe, Wifi, Shield, Info, Copy, Plus, Trash2, Check, AlertTriangle } from 'lucide-react'

const DNS_SERVERS = [
    { label: 'DoU: 1.1.1.1', value: 'udp://1.1.1.1' },
    { label: 'DoH: 1.1.1.1', value: 'https://1.1.1.1/dns-query' },
    { label: 'DoT: 1.1.1.1', value: 'tls://1.1.1.1' },
    { label: 'DoU: 8.8.8.8', value: 'udp://8.8.8.8' },
    { label: 'DoH: 8.8.8.8', value: 'https://dns.google/dns-query' },
    { label: 'DoT: 8.8.8.8', value: 'tls://dns.google' },
    { label: 'DoU: 9.9.9.9', value: 'udp://9.9.9.9' },
    { label: 'DoH: 9.9.9.9', value: 'https://dns.quad9.net/dns-query' },
    { label: 'DoT: 9.9.9.9', value: 'tls://dns.quad9.net' },
]

const USER_AGENTS = [
    'Chrome/Latest',
    'Firefox/Latest',
    'Safari/Latest',
    'Edge/Latest',
    'Custom'
]

// ToggleRow Component
const ToggleRow = ({ label, description, checked, onChange }: { label: string, description: string, checked: boolean, onChange: (checked: boolean) => void }) => (
    <div className="flex items-center justify-between py-2">
        <div>
            <div className="text-sm font-medium text-primary">{label}</div>
            <div className="text-xs text-secondary mt-0.5">{description}</div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
        </label>
    </div>
)

export const SettingsView = () => {
    const { settings, updateSettings } = useApp()
    const { showToast } = useToast()
    const [copied, setCopied] = useState(false)
    const [customUserAgent, setCustomUserAgent] = useState('')
    const [showConfirmModal, setShowConfirmModal] = useState<'reset' | 'erase' | null>(null)
    const [activeTab, setActiveTab] = useState<'general' | 'network' | 'advanced' | 'about'>('general')
    const [legalDoc, setLegalDoc] = useState<'privacy' | 'terms' | null>(null)
    const [showDnsModal, setShowDnsModal] = useState(false)
    const [customDnsLabel, setCustomDnsLabel] = useState('')
    const [customDnsValue, setCustomDnsValue] = useState('')
    const [showTemplateModal, setShowTemplateModal] = useState(false)
    const [templateName, setTemplateName] = useState('')
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null)

    const tabs = [
        { id: 'general' as const, label: 'General', icon: SettingsIcon },
        { id: 'network' as const, label: 'Network', icon: Wifi },
        { id: 'advanced' as const, label: 'Advanced', icon: Shield },
        { id: 'about' as const, label: 'About', icon: Info }
    ]

    const handleCopyDeviceId = () => {
        navigator.clipboard.writeText(settings.deviceId)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleResetVPN = () => {
        setShowConfirmModal('reset')
    }

    const handleEraseData = () => {
        setShowConfirmModal('erase')
    }

    const handleAddCustomDns = () => {
        if (!customDnsLabel.trim() || !customDnsValue.trim()) {
            showToast('Please enter both label and value', 'warning')
            return
        }

        const newServer = { label: customDnsLabel.trim(), value: customDnsValue.trim() }
        const currentCustom = settings.customDnsServers || []

        // Check for duplicates
        if (currentCustom.some(s => s.value === newServer.value)) {
            showToast('DNS server already exists', 'warning')
            return
        }

        updateSettings({ customDnsServers: [...currentCustom, newServer] })
        showToast('Custom DNS server added', 'success')
        setShowDnsModal(false)
        setCustomDnsLabel('')
        setCustomDnsValue('')
    }

    const handleRemoveCustomDns = (value: string) => {
        const currentCustom = settings.customDnsServers || []
        updateSettings({ customDnsServers: currentCustom.filter(s => s.value !== value) })
        showToast('Custom DNS server removed', 'success')
    }

    const handleSaveTemplate = () => {
        if (!templateName.trim()) {
            showToast('Please enter a template name', 'warning')
            return
        }

        if (!selectedTemplate) {
            showToast('No template data to save', 'warning')
            return
        }

        const newTemplate = {
            name: templateName.trim(),
            ...selectedTemplate
        }

        const currentTemplates = settings.profileTemplates || []
        updateSettings({ profileTemplates: [...currentTemplates, newTemplate] })
        showToast('Template saved', 'success')
        setShowTemplateModal(false)
        setTemplateName('')
        setSelectedTemplate(null)
    }

    const handleRemoveTemplate = (index: number) => {
        const currentTemplates = settings.profileTemplates || []
        updateSettings({ profileTemplates: currentTemplates.filter((_, i) => i !== index) })
        showToast('Template removed', 'success')
    }

    const confirmAction = () => {
        if (showConfirmModal === 'reset') {
            // Reset settings to defaults but keep profiles and deviceId
            const deviceId = settings.deviceId
            updateSettings({
                mode: 'simple',
                language: 'English',
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
                deviceId // Preserve device ID
            })
            showToast('VPN configuration reset to defaults', 'success')
        } else if (showConfirmModal === 'erase') {
            localStorage.clear()
            window.location.reload()
        }
        setShowConfirmModal(null)
    }

    return (
        <div className="h-full flex flex-col">
            <header className="mb-6 px-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <SettingsIcon size={24} className="text-accent" />
                        <div>
                            <h2 className="text-2xl font-semibold text-primary tracking-tight">Settings</h2>
                            <p className="text-secondary text-sm mt-1">Configure application preferences and behavior.</p>
                        </div>
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex items-center gap-2 bg-surface border border-border rounded-lg p-1">
                        <button
                            onClick={() => updateSettings({ mode: 'simple' })}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${settings.mode === 'simple'
                                ? 'bg-accent text-white shadow-md'
                                : 'text-secondary hover:text-primary'
                                }`}
                        >
                            Simple
                        </button>
                        <button
                            onClick={() => updateSettings({ mode: 'advanced' })}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${settings.mode === 'advanced'
                                ? 'bg-accent text-white shadow-md'
                                : 'text-secondary hover:text-primary'
                                }`}
                        >
                            Advanced
                        </button>
                    </div>
                </div>

                {/* Mode Description */}
                <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
                    <p className="text-sm text-accent">
                        {settings.mode === 'simple'
                            ? '📱 Simple Mode - Essential settings for everyday use'
                            : '⚙️ Advanced Mode - Full control with all technical options'}
                    </p>
                </div>
            </header>

            {/* Tab Navigation */}
            <div className="flex gap-1 border-b border-border px-6">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative
                            ${activeTab === tab.id
                                ? 'text-accent'
                                : 'text-secondary hover:text-primary'}`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                        {activeTab === tab.id && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-t" />
                        )}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pb-6 px-6 pt-6">
                {/* General Tab */}
                {activeTab === 'general' && (
                    <>
                        {/* Device Section */}
                        <section className="bg-surface border border-border rounded-lg p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Globe size={18} className="text-accent" />
                                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Device</h3>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-2">Language</label>
                                    <select
                                        value={settings.language}
                                        onChange={(e) => updateSettings({ language: e.target.value })}
                                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                    >
                                        <option>English</option>
                                        <option>中文</option>
                                        <option>Español</option>
                                        <option>Français</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-2">Device ID</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={settings.deviceId}
                                            readOnly
                                            className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-primary font-mono text-xs"
                                        />
                                        <button
                                            onClick={handleCopyDeviceId}
                                            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-primary rounded-md border border-zinc-700 transition-colors"
                                        >
                                            {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Advanced Mode Only: User Agent */}
                                {settings.mode === 'advanced' && (
                                    <div>
                                        <label className="block text-xs font-medium text-secondary mb-2">User Agent</label>
                                        <select
                                            value={settings.userAgent === 'Custom' ? 'Custom' : settings.userAgent}
                                            onChange={(e) => {
                                                if (e.target.value === 'Custom') {
                                                    updateSettings({ userAgent: customUserAgent || 'Custom' })
                                                } else {
                                                    updateSettings({ userAgent: e.target.value })
                                                }
                                            }}
                                            className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                        >
                                            {USER_AGENTS.map(ua => (
                                                <option key={ua} value={ua}>{ua}</option>
                                            ))}
                                        </select>
                                        {settings.userAgent === 'Custom' && (
                                            <input
                                                type="text"
                                                value={customUserAgent}
                                                onChange={(e) => {
                                                    setCustomUserAgent(e.target.value)
                                                    updateSettings({ userAgent: e.target.value })
                                                }}
                                                placeholder="Enter custom user agent"
                                                className="w-full mt-2 bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* System Section */}
                        <section className="bg-surface border border-border rounded-lg p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Shield size={18} className="text-accent" />
                                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">System</h3>
                            </div>

                            <div className="space-y-4">
                                <ToggleRow
                                    label="Launch on Startup"
                                    description="Automatically start V-Nexus when Windows starts"
                                    checked={settings.launchOnStartup}
                                    onChange={async (checked) => {
                                        updateSettings({ launchOnStartup: checked })
                                        const result = await window.system.setLaunchOnStartup(checked)
                                        if (result.success) {
                                            showToast(checked ? 'Launch on startup enabled' : 'Launch on startup disabled', 'success')
                                        } else {
                                            showToast('Failed to update startup settings', 'error')
                                        }
                                    }}
                                />

                                <ToggleRow
                                    label="Connect on Boot"
                                    description="Automatically connect to last server when app starts"
                                    checked={settings.connectOnBoot}
                                    onChange={(checked) => updateSettings({ connectOnBoot: checked })}
                                />

                                <ToggleRow
                                    label="Reconnect on Failure"
                                    description="Automatically reconnect if connection drops"
                                    checked={settings.reconnectOnFailure}
                                    onChange={(checked) => updateSettings({ reconnectOnFailure: checked })}
                                />

                                <ToggleRow
                                    label="Kill Switch"
                                    description="Block internet if VPN disconnects unexpectedly"
                                    checked={settings.killSwitch}
                                    onChange={(checked) => updateSettings({ killSwitch: checked })}
                                />

                                <ToggleRow
                                    label="Connection Health Check"
                                    description="Periodically ping server to verify connection (every 30s)"
                                    checked={settings.connectionHealthCheck}
                                    onChange={(checked) => updateSettings({ connectionHealthCheck: checked })}
                                />

                                {/* Advanced Mode Only: Max Log Lines */}
                                {settings.mode === 'advanced' && (
                                    <div className="pt-4 border-t border-border">
                                        <label className="block text-xs font-medium text-secondary mb-2">Maximum Log Lines</label>
                                        <input
                                            type="number"
                                            min="100"
                                            max="10000"
                                            value={settings.maxLogLines || 500}
                                            onChange={(e) => updateSettings({ maxLogLines: parseInt(e.target.value) })}
                                            className="w-32 bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                        />
                                        <p className="text-xs text-secondary mt-1.5">
                                            Maximum number of log lines to keep in memory
                                        </p>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-2">Auto Connect</label>
                                    <select
                                        value={settings.autoConnect || 'none'}
                                        onChange={(e) => updateSettings({ autoConnect: e.target.value as any })}
                                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                    >
                                        <option value="none">None</option>
                                        <option value="last">Last Connected</option>
                                        <option value="fixed">Fixed Server</option>
                                    </select>
                                    <p className="text-xs text-secondary mt-1.5">
                                        {settings.autoConnect === 'none' && 'Do not auto-connect on startup'}
                                        {settings.autoConnect === 'last' && 'Connect to last used server on startup'}
                                        {settings.autoConnect === 'fixed' && 'Connect to a specific server on startup'}
                                    </p>
                                </div>

                                <div className="pt-4 border-t border-border">
                                    <label className="block text-xs font-medium text-secondary mb-2">Theme</label>
                                    <select
                                        value={settings.theme}
                                        onChange={(e) => updateSettings({ theme: e.target.value as 'dark' | 'light' })}
                                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                    >
                                        <option value="dark">Dark</option>
                                        <option value="light">Light</option>
                                    </select>
                                    <p className="text-xs text-secondary mt-1.5">
                                        Choose between dark and light theme for the application interface
                                    </p>
                                </div>

                                <div className="pt-4 border-t border-border">
                                    <ToggleRow
                                        label="Show Logs"
                                        description="Display application logs in the Logs tab"
                                        checked={settings.showLogs}
                                        onChange={(checked) => updateSettings({ showLogs: checked })}
                                    />

                                    <ToggleRow
                                        label="Allow Insecure"
                                        description="Allow insecure TLS connections"
                                        checked={settings.allowInsecure}
                                        onChange={(checked) => updateSettings({ allowInsecure: checked })}
                                    />
                                </div>
                            </div>
                        </section>
                    </>
                )}

                {/* Network Tab */}
                {activeTab === 'network' && (
                    <>
                        {/* DNS Section */}
                        <section className="bg-surface border border-border rounded-lg p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Wifi size={18} className="text-accent" />
                                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">DNS</h3>
                            </div>

                            <div className="space-y-4">
                                {/* Advanced Mode Only: DNS Query Strategy */}
                                {settings.mode === 'advanced' && (
                                    <div>
                                        <label className="block text-xs font-medium text-secondary mb-2">Query Strategy</label>
                                        <select
                                            value={settings.dnsQueryStrategy}
                                            onChange={(e) => updateSettings({ dnsQueryStrategy: e.target.value as any })}
                                            className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                        >
                                            <option value="UseIP">UseIP (Query both A and AAAA)</option>
                                            <option value="UseIPv4">UseIPv4 (Query A records only)</option>
                                            <option value="UseIPv6">UseIPv6 (Query AAAA records only)</option>
                                        </select>
                                        <p className="text-xs text-secondary mt-1.5">
                                            Controls which IP version to use for DNS queries. UseIP queries both IPv4 and IPv6.
                                        </p>
                                    </div>
                                )}


                                {/* Advanced Mode Only: DNS Log */}
                                {settings.mode === 'advanced' && (
                                    <ToggleRow
                                        label="DNS Log"
                                        description="Enable DNS query logging"
                                        checked={settings.dnsLog}
                                        onChange={(checked) => updateSettings({ dnsLog: checked })}
                                    />
                                )}


                                {/* Advanced Mode Only: Disable Cache */}
                                {settings.mode === 'advanced' && (
                                    <ToggleRow
                                        label="Disable Cache"
                                        description="Disable DNS caching"
                                        checked={settings.dnsDisableCache}
                                        onChange={(checked) => updateSettings({ dnsDisableCache: checked })}
                                    />
                                )}


                                {/* Advanced Mode Only: Disable Fallback */}
                                {settings.mode === 'advanced' && (
                                    <ToggleRow
                                        label="Disable Fallback"
                                        description="Disable fallback to system DNS"
                                        checked={settings.dnsDisableFallback}
                                        onChange={(checked) => updateSettings({ dnsDisableFallback: checked })}
                                    />
                                )}


                                {/* Advanced Mode Only: Disable Fallback If Match */}
                                {settings.mode === 'advanced' && (
                                    <ToggleRow
                                        label="Disable Fallback If Match"
                                        description="Disable fallback when domain matches routing rules"
                                        checked={settings.dnsDisableFallbackIfMatch}
                                        onChange={(checked) => updateSettings({ dnsDisableFallbackIfMatch: checked })}
                                    />
                                )}

                                <div className="pt-4 border-t border-border space-y-4">
                                    <ToggleRow
                                        label="DNS Leak Protection"
                                        description="Ensure all DNS queries go through the proxy"
                                        checked={settings.dnsLeakProtection}
                                        onChange={(checked) => updateSettings({ dnsLeakProtection: checked })}
                                    />

                                    <ToggleRow
                                        label="WebRTC Leak Protection"
                                        description="Prevent IP leaks via WebRTC"
                                        checked={settings.webrtcLeakProtection}
                                        onChange={(checked) => updateSettings({ webrtcLeakProtection: checked })}
                                    />
                                </div>


                                {/* Advanced Mode Only: Custom DNS Servers */}
                                {settings.mode === 'advanced' && (
                                    <div className="pt-4 border-t border-border">
                                        <div className="flex items-center justify-between mb-3">
                                            <label className="text-xs font-medium text-secondary uppercase tracking-wider">DNS Servers</label>
                                            <button
                                                onClick={() => setShowDnsModal(true)}
                                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent hover:bg-accent/80 text-white rounded text-xs font-medium transition-colors"
                                            >
                                                <Plus size={12} />
                                                Add DNS Server
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            {/* Predefined DNS Servers */}
                                            {DNS_SERVERS.map(server => (
                                                <div
                                                    key={server.value}
                                                    className={`flex items-center justify-between p-3 rounded-md border transition-all cursor-pointer ${settings.selectedDnsServer === server.label
                                                        ? 'bg-accent/10 border-accent'
                                                        : 'bg-background border-border hover:border-zinc-700'
                                                        }`}
                                                    onClick={() => updateSettings({ selectedDnsServer: server.label })}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${settings.selectedDnsServer === server.label ? 'border-accent' : 'border-zinc-600'
                                                            }`}>
                                                            {settings.selectedDnsServer === server.label && (
                                                                <div className="w-2 h-2 rounded-full bg-accent"></div>
                                                            )}
                                                        </div>
                                                        <span className="text-sm font-mono text-primary">{server.label}</span>
                                                    </div>
                                                    {/* Predefined servers don't have delete button */}
                                                </div>
                                            ))}

                                            {/* Custom DNS Servers */}
                                            {(settings.customDnsServers || []).map(server => (
                                                <div
                                                    key={server.value}
                                                    className={`flex items-center justify-between p-3 rounded-md border transition-all cursor-pointer ${settings.selectedDnsServer === server.label
                                                        ? 'bg-accent/10 border-accent'
                                                        : 'bg-background border-border hover:border-zinc-700'
                                                        }`}
                                                    onClick={() => updateSettings({ selectedDnsServer: server.label })}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${settings.selectedDnsServer === server.label ? 'border-accent' : 'border-zinc-600'
                                                            }`}>
                                                            {settings.selectedDnsServer === server.label && (
                                                                <div className="w-2 h-2 rounded-full bg-accent"></div>
                                                            )}
                                                        </div>
                                                        <span className="text-sm font-mono text-primary">{server.label}</span>
                                                        <span className="text-xs text-accent px-2 py-0.5 bg-accent/10 rounded">Custom</span>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleRemoveCustomDns(server.value)
                                                        }}
                                                        className="p-1 hover:bg-red-500/10 rounded text-secondary hover:text-red-400 transition-colors"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Inbound Settings Section */}
                        <section className="bg-surface border border-border rounded-lg p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Wifi size={18} className="text-accent" />
                                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Inbound Settings</h3>
                            </div>

                            <div className="space-y-6">
                                {/* Set System Proxy */}
                                <ToggleRow
                                    label="Set System Proxy"
                                    description="Automatically configure system to use V-Nexus proxy"
                                    checked={settings.setSystemProxy || false}
                                    onChange={(checked) => updateSettings({ setSystemProxy: checked })}
                                />

                                {/* SOCKS Settings */}
                                <div className="pt-4 border-t border-border">
                                    <ToggleRow
                                        label="SOCKS Settings"
                                        description="Enable SOCKS5 proxy server"
                                        checked={settings.socksEnabled || false}
                                        onChange={(checked) => updateSettings({ socksEnabled: checked })}
                                    />

                                    {settings.socksEnabled && settings.mode === 'advanced' && (
                                        <div className="ml-6 pl-4 border-l-2 border-accent/30 space-y-3 mt-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-secondary mb-2">Port</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="65535"
                                                        value={settings.socksPort || 1089}
                                                        onChange={(e) => updateSettings({ socksPort: parseInt(e.target.value) })}
                                                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-secondary mb-2">UDP Local IP</label>
                                                    <input
                                                        type="text"
                                                        value={settings.socksUdpLocalIp || '127.0.0.1'}
                                                        onChange={(e) => updateSettings({ socksUdpLocalIp: e.target.value })}
                                                        placeholder="127.0.0.1"
                                                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm font-mono"
                                                    />
                                                </div>
                                            </div>

                                            <ToggleRow
                                                label="UDP Support"
                                                description="Enable UDP protocol support"
                                                checked={settings.socksUdpEnabled || false}
                                                onChange={(checked) => updateSettings({ socksUdpEnabled: checked })}
                                            />

                                            <ToggleRow
                                                label="Authentication"
                                                description="Require username and password"
                                                checked={settings.socksAuthEnabled || false}
                                                onChange={(checked) => updateSettings({ socksAuthEnabled: checked })}
                                            />

                                            {settings.socksAuthEnabled && (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-medium text-secondary mb-2">Username</label>
                                                        <input
                                                            type="text"
                                                            value={settings.socksUsername || 'user'}
                                                            onChange={(e) => updateSettings({ socksUsername: e.target.value })}
                                                            placeholder="user"
                                                            className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-secondary mb-2">Password</label>
                                                        <input
                                                            type="password"
                                                            value={settings.socksPassword || 'pass'}
                                                            onChange={(e) => updateSettings({ socksPassword: e.target.value })}
                                                            placeholder="pass"
                                                            className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <ToggleRow
                                                label="Sniffing"
                                                description="Enable traffic sniffing for better routing"
                                                checked={settings.socksSniffing || false}
                                                onChange={(checked) => updateSettings({ socksSniffing: checked })}
                                            />

                                            {settings.socksSniffing && (
                                                <div>
                                                    <label className="block text-xs font-medium text-secondary mb-2">Destination Override</label>
                                                    <div className="flex gap-4">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={settings.socksDestOverrideHttp || false}
                                                                onChange={(e) => updateSettings({ socksDestOverrideHttp: e.target.checked })}
                                                                className="w-4 h-4 text-accent bg-background border-border rounded focus:ring-accent"
                                                            />
                                                            <span className="text-sm text-primary">HTTP</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={settings.socksDestOverrideTls || false}
                                                                onChange={(e) => updateSettings({ socksDestOverrideTls: e.target.checked })}
                                                                className="w-4 h-4 text-accent bg-background border-border rounded focus:ring-accent"
                                                            />
                                                            <span className="text-sm text-primary">TLS</span>
                                                        </label>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* HTTP Settings */}
                                <div className="pt-4 border-t border-border">
                                    <ToggleRow
                                        label="HTTP Settings"
                                        description="Enable HTTP proxy server"
                                        checked={settings.httpEnabled || false}
                                        onChange={(checked) => updateSettings({ httpEnabled: checked })}
                                    />

                                    {settings.httpEnabled && settings.mode === 'advanced' && (
                                        <div className="ml-6 pl-4 border-l-2 border-accent/30 space-y-3 mt-3">
                                            <div>
                                                <label className="block text-xs font-medium text-secondary mb-2">Port</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="65535"
                                                    value={settings.httpPort || 8889}
                                                    onChange={(e) => updateSettings({ httpPort: parseInt(e.target.value) })}
                                                    className="w-32 bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                                />
                                            </div>

                                            <ToggleRow
                                                label="Authentication"
                                                description="Require username and password"
                                                checked={settings.httpAuthEnabled || false}
                                                onChange={(checked) => updateSettings({ httpAuthEnabled: checked })}
                                            />

                                            {settings.httpAuthEnabled && (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-medium text-secondary mb-2">Username</label>
                                                        <input
                                                            type="text"
                                                            value={settings.httpUsername || 'user'}
                                                            onChange={(e) => updateSettings({ httpUsername: e.target.value })}
                                                            placeholder="user"
                                                            className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-secondary mb-2">Password</label>
                                                        <input
                                                            type="password"
                                                            value={settings.httpPassword || 'pass'}
                                                            onChange={(e) => updateSettings({ httpPassword: e.target.value })}
                                                            placeholder="pass"
                                                            className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <ToggleRow
                                                label="Sniffing"
                                                description="Enable traffic sniffing for better routing"
                                                checked={settings.httpSniffing || false}
                                                onChange={(checked) => updateSettings({ httpSniffing: checked })}
                                            />

                                            {settings.httpSniffing && (
                                                <div>
                                                    <label className="block text-xs font-medium text-secondary mb-2">Destination Override</label>
                                                    <div className="flex gap-4">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={settings.httpDestOverrideHttp || false}
                                                                onChange={(e) => updateSettings({ httpDestOverrideHttp: e.target.checked })}
                                                                className="w-4 h-4 text-accent bg-background border-border rounded focus:ring-accent"
                                                            />
                                                            <span className="text-sm text-primary">HTTP</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={settings.httpDestOverrideTls || false}
                                                                onChange={(e) => updateSettings({ httpDestOverrideTls: e.target.checked })}
                                                                className="w-4 h-4 text-accent bg-background border-border rounded focus:ring-accent"
                                                            />
                                                            <span className="text-sm text-primary">TLS</span>
                                                        </label>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Advanced Mode Only: Browser Forwarder Settings */}
                                {settings.mode === 'advanced' && (
                                    <div className="pt-4 border-t border-border">
                                        <div className="mb-3">
                                            <h4 className="text-sm font-medium text-primary mb-1">Browser Forwarder Settings</h4>
                                            <p className="text-xs text-secondary italic">This applies to Simple Configs with Browser Forwarder on.</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-secondary mb-2">Listening Address</label>
                                                <input
                                                    type="text"
                                                    value={settings.browserForwarderAddress || '127.0.0.1'}
                                                    onChange={(e) => updateSettings({ browserForwarderAddress: e.target.value })}
                                                    placeholder="127.0.0.1"
                                                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-secondary mb-2">Listening Port</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="65535"
                                                    value={settings.browserForwarderPort || 8088}
                                                    onChange={(e) => updateSettings({ browserForwarderPort: parseInt(e.target.value) })}
                                                    placeholder="8088"
                                                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Routing Section */}
                        <section className="bg-surface border border-border rounded-lg p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <SettingsIcon size={18} className="text-accent" />
                                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Routing</h3>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-2">Routing Mode</label>
                                    <select
                                        value={settings.routingMode}
                                        onChange={(e) => updateSettings({ routingMode: e.target.value as any })}
                                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                    >
                                        <option value="global">Global Proxy</option>
                                        <option value="bypass-lan">Bypass LAN</option>
                                        <option value="bypass-china">Bypass LAN & China</option>
                                        <option value="custom">Custom Rules</option>
                                    </select>
                                    <p className="text-xs text-secondary mt-1.5">
                                        {settings.routingMode === 'global' && 'Route all traffic through proxy'}
                                        {settings.routingMode === 'bypass-lan' && 'Direct connection for private IPs'}
                                        {settings.routingMode === 'bypass-china' && 'Direct connection for LAN and China IPs'}
                                        {settings.routingMode === 'custom' && 'Use custom routing rules'}
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Latency Testing Section */}
                        <section className="bg-surface border border-border rounded-lg p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Wifi size={18} className="text-accent" />
                                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Latency Testing</h3>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-2">Test Method</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="latencyMethod"
                                                value="tcping"
                                                checked={(settings.latencyTestMethod || 'tcping') === 'tcping'}
                                                onChange={(e) => updateSettings({ latencyTestMethod: e.target.value as any })}
                                                className="w-4 h-4 text-accent bg-background border-border focus:ring-accent"
                                            />
                                            <span className="text-sm text-primary">TCPing</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="latencyMethod"
                                                value="icmping"
                                                checked={(settings.latencyTestMethod || 'tcping') === 'icmping'}
                                                onChange={(e) => updateSettings({ latencyTestMethod: e.target.value as any })}
                                                className="w-4 h-4 text-accent bg-background border-border focus:ring-accent"
                                            />
                                            <span className="text-sm text-primary">ICMPing</span>
                                        </label>
                                    </div>
                                    <p className="text-xs text-secondary mt-1.5">
                                        {(settings.latencyTestMethod || 'tcping') === 'tcping' && 'Test latency using TCP connection'}
                                        {(settings.latencyTestMethod || 'tcping') === 'icmping' && 'Test latency using ICMP ping (requires admin)'}
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-2">RealPing Test URL</label>
                                    <input
                                        type="text"
                                        value={settings.realPingTestUrl || 'https://www.google.com'}
                                        onChange={(e) => updateSettings({ realPingTestUrl: e.target.value })}
                                        placeholder="https://www.google.com"
                                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm font-mono"
                                    />
                                    <p className="text-xs text-secondary mt-1.5">
                                        URL used for real connection latency testing
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Advanced Mode Only: Proxy Settings Section */}
                        {settings.mode === 'advanced' && (
                            <section className="bg-surface border border-border rounded-lg p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Shield size={18} className="text-accent" />
                                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Proxy Settings</h3>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-secondary mb-2">V-Nexus Proxy</label>
                                        <div className="flex gap-4 mb-3">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="proxyType"
                                                    value="none"
                                                    checked={(settings.proxyType || 'none') === 'none'}
                                                    onChange={(e) => updateSettings({ proxyType: e.target.value as any })}
                                                    className="w-4 h-4 text-accent bg-background border-border focus:ring-accent"
                                                />
                                                <span className="text-sm text-primary">None</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="proxyType"
                                                    value="system"
                                                    checked={(settings.proxyType || 'none') === 'system'}
                                                    onChange={(e) => updateSettings({ proxyType: e.target.value as any })}
                                                    className="w-4 h-4 text-accent bg-background border-border focus:ring-accent"
                                                />
                                                <span className="text-sm text-primary">System Proxy</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="proxyType"
                                                    value="custom"
                                                    checked={(settings.proxyType || 'none') === 'custom'}
                                                    onChange={(e) => updateSettings({ proxyType: e.target.value as any })}
                                                    className="w-4 h-4 text-accent bg-background border-border focus:ring-accent"
                                                />
                                                <span className="text-sm text-primary">Custom Proxy</span>
                                            </label>
                                        </div>

                                        {(settings.proxyType === 'system' || settings.proxyType === 'custom') && (
                                            <div className="ml-6 pl-4 border-l-2 border-accent/30 space-y-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-secondary mb-2">Type</label>
                                                    <select
                                                        value={settings.proxyType === 'system' ? 'http' : (settings.customProxyType || 'http')}
                                                        onChange={(e) => updateSettings({ customProxyType: e.target.value as any })}
                                                        disabled={settings.proxyType === 'system'}
                                                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <option value="http">HTTP</option>
                                                        <option value="socks5">SOCKS5</option>
                                                    </select>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-medium text-secondary mb-2">Server</label>
                                                        <input
                                                            type="text"
                                                            value={settings.proxyType === 'system' ? '127.0.0.1' : (settings.customProxyServer || '127.0.0.1')}
                                                            onChange={(e) => updateSettings({ customProxyServer: e.target.value })}
                                                            disabled={settings.proxyType === 'system'}
                                                            placeholder="127.0.0.1"
                                                            className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-secondary mb-2">Port</label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="65535"
                                                            value={settings.proxyType === 'system' ? 8000 : (settings.customProxyPort || 8000)}
                                                            onChange={(e) => updateSettings({ customProxyPort: parseInt(e.target.value) })}
                                                            disabled={settings.proxyType === 'system'}
                                                            placeholder="8000"
                                                            className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>
                        )}
                    </>
                )}



                {/* Advanced Tab */}
                {activeTab === 'advanced' && (
                    <>
                        {/* Show message in Simple mode */}
                        {settings.mode === 'simple' && (
                            <section className="bg-surface border border-border rounded-lg p-8">
                                <div className="flex flex-col items-center justify-center text-center space-y-4">
                                    <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                                        <Shield size={32} className="text-accent" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-primary mb-2">Advanced Settings</h3>
                                        <p className="text-secondary text-sm max-w-md">
                                            Switch to <span className="text-accent font-medium">Advanced Mode</span> to access all technical settings including DNS configuration, proxy options, latency testing, and more.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => updateSettings({ mode: 'advanced' })}
                                        className="px-4 py-2 bg-accent hover:bg-accent/80 text-white rounded-md text-sm font-medium transition-colors"
                                    >
                                        Switch to Advanced Mode
                                    </button>
                                </div>
                            </section>
                        )}

                        {/* Show advanced settings in Advanced mode */}
                        {settings.mode === 'advanced' && (
                            <>
                                {/* Advanced Settings */}
                                <section className="bg-surface border border-border rounded-lg p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Shield size={18} className="text-accent" />
                                        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Advanced Settings</h3>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-medium text-secondary mb-2">Log Level</label>
                                            <select
                                                value={settings.logLevel}
                                                onChange={(e) => updateSettings({ logLevel: e.target.value as any })}
                                                className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                            >
                                                <option value="none">None</option>
                                                <option value="info">Info</option>
                                                <option value="warning">Warning</option>
                                                <option value="error">Error</option>
                                                <option value="debug">Debug</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <ToggleRow
                                                label="Enable Mux"
                                                description="Multiplexing for better performance"
                                                checked={settings.muxEnabled}
                                                onChange={(checked) => updateSettings({ muxEnabled: checked })}
                                            />
                                            {settings.muxEnabled && (
                                                <div className="ml-6 pl-4 border-l-2 border-accent/30">
                                                    <label className="block text-xs font-medium text-secondary mb-2">Concurrency</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="32"
                                                        value={settings.muxConcurrency}
                                                        onChange={(e) => updateSettings({ muxConcurrency: parseInt(e.target.value) })}
                                                        className="w-32 bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-4 border-t border-border space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-medium text-primary">Profile Templates</h4>
                                                <button
                                                    onClick={() => {
                                                        setSelectedTemplate({
                                                            protocol: 'vmess',
                                                            security: 'auto',
                                                            network: 'tcp'
                                                        })
                                                        setShowTemplateModal(true)
                                                    }}
                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent hover:bg-accent/80 text-white rounded text-xs font-medium transition-colors"
                                                >
                                                    <Plus size={12} />
                                                    Add Template
                                                </button>
                                            </div>
                                            <p className="text-xs text-secondary">
                                                Save profile configurations as templates for quick reuse
                                            </p>

                                            {(settings.profileTemplates || []).length === 0 ? (
                                                <div className="text-center py-8 text-secondary text-sm">
                                                    No templates saved yet
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {(settings.profileTemplates || []).map((template, index) => (
                                                        <div
                                                            key={index}
                                                            className="flex items-center justify-between p-3 rounded-md border border-border bg-background hover:border-zinc-700 transition-all"
                                                        >
                                                            <div>
                                                                <div className="text-sm font-medium text-primary">{template.name}</div>
                                                                <div className="text-xs text-secondary mt-0.5">
                                                                    {template.template?.protocol || 'N/A'} • {template.template?.network || 'N/A'}
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => handleRemoveTemplate(index)}
                                                                className="p-1 hover:bg-red-500/10 rounded text-secondary hover:text-red-400 transition-colors"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-4 border-t border-border space-y-4">
                                            <ToggleRow
                                                label="Test Latency Periodically"
                                                description="Automatically test server latency at regular intervals"
                                                checked={settings.testLatencyPeriodically || false}
                                                onChange={(checked) => updateSettings({ testLatencyPeriodically: checked })}
                                            />

                                            <ToggleRow
                                                label="Test Latency On Connected"
                                                description="Test latency immediately after connecting to a server"
                                                checked={settings.testLatencyOnConnected || false}
                                                onChange={(checked) => updateSettings({ testLatencyOnConnected: checked })}
                                            />

                                            <ToggleRow
                                                label="Disable System Root Certificates"
                                                description="Don't use system root certificates for TLS verification"
                                                checked={settings.disableSystemRootCerts || false}
                                                onChange={(checked) => updateSettings({ disableSystemRootCerts: checked })}
                                            />
                                        </div>
                                    </div>
                                </section>

                                {/* Connection Settings Section */}
                                <section className="bg-surface border border-border rounded-lg p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Shield size={18} className="text-accent" />
                                        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Connection Settings</h3>
                                    </div>

                                    <div className="space-y-6">
                                        {/* General Connection Settings */}
                                        <div>
                                            <h4 className="text-sm font-medium text-primary mb-3">General Connection Settings</h4>
                                            <div className="space-y-3">
                                                <ToggleRow
                                                    label="Force Direct for All Connections"
                                                    description="Bypass proxy for all connections"
                                                    checked={settings.forceDirectConnection || false}
                                                    onChange={(checked) => updateSettings({ forceDirectConnection: checked })}
                                                />

                                                <ToggleRow
                                                    label="Bypass Private Addresses"
                                                    description="Direct connection for private IP ranges (192.168.x.x, 10.x.x.x, etc.)"
                                                    checked={settings.bypassPrivateAddresses || false}
                                                    onChange={(checked) => updateSettings({ bypassPrivateAddresses: checked })}
                                                />

                                                <ToggleRow
                                                    label="Bypass CN Mainland"
                                                    description="Direct connection for Chinese mainland IPs"
                                                    checked={settings.bypassCnMainland || false}
                                                    onChange={(checked) => updateSettings({ bypassCnMainland: checked })}
                                                />

                                                <ToggleRow
                                                    label="Bypass Bittorrent Protocol"
                                                    description="Direct connection for BitTorrent traffic"
                                                    checked={settings.bypassBittorrent || false}
                                                    onChange={(checked) => updateSettings({ bypassBittorrent: checked })}
                                                />

                                                <ToggleRow
                                                    label="Use V2Ray DNS for Direct Connection"
                                                    description="Use V2Ray's DNS resolver for direct connections"
                                                    checked={settings.useV2rayDnsForDirect || false}
                                                    onChange={(checked) => updateSettings({ useV2rayDnsForDirect: checked })}
                                                />

                                                <ToggleRow
                                                    label="DNS Intercept"
                                                    description="Intercept and handle DNS queries"
                                                    checked={settings.dnsIntercept || false}
                                                    onChange={(checked) => updateSettings({ dnsIntercept: checked })}
                                                />
                                            </div>
                                        </div>

                                        {/* Forward Proxy */}
                                        <div className="pt-4 border-t border-border">
                                            <ToggleRow
                                                label="Forward Proxy"
                                                description="Only simple config is supported"
                                                checked={settings.forwardProxyEnabled || false}
                                                onChange={(checked) => updateSettings({ forwardProxyEnabled: checked })}
                                            />

                                            {settings.forwardProxyEnabled && (
                                                <div className="ml-6 pl-4 border-l-2 border-accent/30 space-y-3 mt-3">
                                                    <div>
                                                        <label className="block text-xs font-medium text-secondary mb-2">Type</label>
                                                        <select
                                                            value={settings.forwardProxyType || 'http'}
                                                            onChange={(e) => updateSettings({ forwardProxyType: e.target.value as any })}
                                                            className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                                        >
                                                            <option value="http">http</option>
                                                            <option value="socks5">socks5</option>
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-medium text-secondary mb-2">Host Address</label>
                                                        <input
                                                            type="text"
                                                            value={settings.forwardProxyHost || ''}
                                                            onChange={(e) => updateSettings({ forwardProxyHost: e.target.value })}
                                                            placeholder="Enter host address"
                                                            className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm font-mono"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-medium text-secondary mb-2">Port</label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="65535"
                                                            value={settings.forwardProxyPort || 1}
                                                            onChange={(e) => updateSettings({ forwardProxyPort: parseInt(e.target.value) })}
                                                            placeholder="1"
                                                            className="w-32 bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                                        />
                                                    </div>

                                                    <ToggleRow
                                                        label="Authentication"
                                                        description="Require username and password"
                                                        checked={settings.forwardProxyAuthEnabled || false}
                                                        onChange={(checked) => updateSettings({ forwardProxyAuthEnabled: checked })}
                                                    />

                                                    {settings.forwardProxyAuthEnabled && (
                                                        <div className="space-y-3">
                                                            <div>
                                                                <label className="block text-xs font-medium text-secondary mb-2">Username</label>
                                                                <input
                                                                    type="text"
                                                                    value={settings.forwardProxyUsername || ''}
                                                                    onChange={(e) => updateSettings({ forwardProxyUsername: e.target.value })}
                                                                    placeholder="Enter username"
                                                                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-medium text-secondary mb-2">Password</label>
                                                                <input
                                                                    type="password"
                                                                    value={settings.forwardProxyPassword || ''}
                                                                    onChange={(e) => updateSettings({ forwardProxyPassword: e.target.value })}
                                                                    placeholder="Enter password"
                                                                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </section>

                                {/* VPN Management */}
                                <section className="bg-surface border border-border rounded-lg p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Shield size={18} className="text-accent" />
                                        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">VPN Management</h3>
                                    </div>

                                    <div className="space-y-4">
                                        <button
                                            onClick={handleResetVPN}
                                            className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-primary rounded-md text-sm font-medium border border-zinc-700 transition-colors"
                                        >
                                            Reset VPN Config
                                        </button>

                                        <button
                                            onClick={handleEraseData}
                                            className="w-full px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md text-sm font-medium border border-red-500/30 transition-colors"
                                        >
                                            Erase Client Data
                                        </button>

                                        <div className="pt-4 border-t border-border space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-secondary">Xray Version:</span>
                                                <span className="text-primary font-mono">v1.8.7</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-secondary">App Version:</span>
                                                <span className="text-primary font-mono">v2.0.0</span>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </>
                        )}
                    </>
                )}

                {/* About Tab */}
                {activeTab === 'about' && (
                    <>
                        {/* About Section */}
                        <section className="bg-surface border border-border rounded-lg p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Info size={18} className="text-accent" />
                                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">About</h3>
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={() => setLegalDoc('privacy')}
                                    className="block text-sm text-accent hover:underline text-left"
                                >
                                    Privacy Policy
                                </button>
                                <button
                                    onClick={() => setLegalDoc('terms')}
                                    className="block text-sm text-accent hover:underline text-left"
                                >
                                    Terms of Use
                                </button>

                                <div className="pt-3 border-t border-border space-y-2">
                                    <div className="text-sm text-secondary">Contact:</div>
                                    <a href="mailto:admin@lahirux.dev" className="text-sm text-accent hover:underline">admin@lahirux.dev</a>
                                </div>

                                <div className="pt-3 border-t border-border">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <div className="text-xs text-secondary">Current Version</div>
                                            <div className="text-sm font-mono text-primary">v2.0.0</div>
                                        </div>
                                        <UpdateChecker />
                                    </div>
                                </div>
                            </div>
                        </section>
                    </>
                )}

                {/* Confirmation Modal */}
                {showConfirmModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full mx-4">
                            <div className="flex items-center gap-3 mb-4">
                                <AlertTriangle size={24} className="text-yellow-500" />
                                <h3 className="text-lg font-semibold text-primary">
                                    {showConfirmModal === 'reset' ? 'Reset VPN Configuration?' : 'Erase All Client Data?'}
                                </h3>
                            </div>
                            <p className="text-secondary text-sm mb-6">
                                {showConfirmModal === 'reset'
                                    ? 'This will reset your VPN configuration to default settings.'
                                    : 'This will erase all profiles, settings, and data. This action cannot be undone.'}
                            </p>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowConfirmModal(null)}
                                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-primary rounded-md border border-zinc-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmAction}
                                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
                                >
                                    {showConfirmModal === 'reset' ? 'Reset' : 'Erase All Data'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}


                {/* DNS Modal */}
                {showDnsModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full mx-4">
                            <h3 className="text-lg font-semibold text-primary mb-4">Add Custom DNS Server</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-2">Label</label>
                                    <input
                                        type="text"
                                        value={customDnsLabel}
                                        onChange={(e) => setCustomDnsLabel(e.target.value)}
                                        placeholder="e.g., My Custom DNS"
                                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-2">DNS Server Address</label>
                                    <input
                                        type="text"
                                        value={customDnsValue}
                                        onChange={(e) => setCustomDnsValue(e.target.value)}
                                        placeholder="e.g., https://dns.example.com/dns-query"
                                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm font-mono"
                                    />
                                    <p className="text-xs text-secondary mt-1.5">
                                        Supported formats: udp://, https://, tls://
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end mt-6">
                                <button
                                    onClick={() => {
                                        setShowDnsModal(false)
                                        setCustomDnsLabel('')
                                        setCustomDnsValue('')
                                    }}
                                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-primary rounded-md border border-zinc-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddCustomDns}
                                    className="px-4 py-2 bg-accent hover:bg-accent/80 text-white rounded-md transition-colors"
                                >
                                    Add Server
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Template Modal */}
                {showTemplateModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full mx-4">
                            <h3 className="text-lg font-semibold text-primary mb-4">Create Profile Template</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-2">Template Name</label>
                                    <input
                                        type="text"
                                        value={templateName}
                                        onChange={(e) => setTemplateName(e.target.value)}
                                        placeholder="e.g., VMess TCP Template"
                                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-2">Protocol</label>
                                    <select
                                        value={selectedTemplate?.protocol || 'vmess'}
                                        onChange={(e) => setSelectedTemplate({ ...selectedTemplate, protocol: e.target.value })}
                                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                    >
                                        <option value="vmess">VMess</option>
                                        <option value="vless">VLESS</option>
                                        <option value="trojan">Trojan</option>
                                        <option value="shadowsocks">Shadowsocks</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-2">Security</label>
                                    <select
                                        value={selectedTemplate?.security || 'auto'}
                                        onChange={(e) => setSelectedTemplate({ ...selectedTemplate, security: e.target.value })}
                                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                    >
                                        <option value="auto">Auto</option>
                                        <option value="aes-128-gcm">AES-128-GCM</option>
                                        <option value="chacha20-poly1305">ChaCha20-Poly1305</option>
                                        <option value="none">None</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-2">Network</label>
                                    <select
                                        value={selectedTemplate?.network || 'tcp'}
                                        onChange={(e) => setSelectedTemplate({ ...selectedTemplate, network: e.target.value })}
                                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                                    >
                                        <option value="tcp">TCP</option>
                                        <option value="ws">WebSocket</option>
                                        <option value="grpc">gRPC</option>
                                        <option value="http">HTTP/2</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end mt-6">
                                <button
                                    onClick={() => {
                                        setShowTemplateModal(false)
                                        setTemplateName('')
                                        setSelectedTemplate(null)
                                    }}
                                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-primary rounded-md border border-zinc-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveTemplate}
                                    className="px-4 py-2 bg-accent hover:bg-accent/80 text-white rounded-md transition-colors"
                                >
                                    Save Template
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Legal Document Modals */}
                <LegalDocModal
                    isOpen={legalDoc === 'privacy'}
                    onClose={() => setLegalDoc(null)}
                    title="Privacy Policy"
                    content={PRIVACY_POLICY}
                />
                <LegalDocModal
                    isOpen={legalDoc === 'terms'}
                    onClose={() => setLegalDoc(null)}
                    title="Terms of Use"
                    content={TERMS_OF_USE}
                />
            </div>
        </div >
    )
}

export default SettingsView
