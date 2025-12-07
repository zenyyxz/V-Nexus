import { useState, useEffect } from 'react'
import { useTranslation } from '../hooks/useTranslation'
import { useApp } from '../contexts/AppContext'
import { useToast } from '../contexts/ToastContext'
import { parseProfileLink, parseJSONProfile, generateProfileLink, generateV2RayJSON } from '../utils/profile-parser'
import { exportProfilesAsFile } from '../utils/export'
import { pingServer } from '../utils/ping'
import { ProfileEditor } from '../components/ProfileEditor'
import { QRScannerModal } from '../components/QRScannerModal'
import { QRCodeModal } from '../components/QRCodeModal'
import { LockShareModal } from '../components/LockShareModal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { JSONEditorModal } from '../components/JSONEditorModal'
import { ProfileCardSkeleton } from '../components/ProfileCardSkeleton'
import { CodeSlashIcon } from '../components/icons/CodeSlashIcon'
import { FileCode, Plus, Clipboard, FileJson, Link2, Trash2, Edit, Zap, Share2, QrCode, Copy, Activity, TrendingUp, Server, Lock, Star } from 'lucide-react'

// Helper function to get latency status with colors and labels
const getLatencyStatus = (latency: number | undefined) => {
    if (!latency || latency >= 4000) return { label: 'Timed Out', color: 'red', gradient: 'from-red-500 to-rose-600', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' }
    if (latency < 1000) return { label: 'Excellent', color: 'emerald', gradient: 'from-emerald-500 to-green-600', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' }
    return { label: 'Good', color: 'yellow', gradient: 'from-yellow-500 to-orange-500', bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' }
}

// Calculate stats for the summary cards
const calculateStats = (profiles: any[]) => {
    const validLatencies = profiles.filter(p => p.latency && p.latency < 4000).map(p => p.latency)
    const avgLatency = validLatencies.length > 0
        ? Math.round(validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length)
        : 0
    return { total: profiles.length, avgLatency, tested: validLatencies.length }
}

export const ConfigsView = () => {
    const { profiles, addProfile, removeProfile, updateProfile, settings } = useApp()
    const { t } = useTranslation()
    const { showToast } = useToast()
    const [showImportMenu, setShowImportMenu] = useState(false)
    const [editingProfile, setEditingProfile] = useState<string | null>(null)
    const [jsonEditingProfile, setJsonEditingProfile] = useState<any | null>(null)
    const [pingingAll, setPingingAll] = useState(false)
    const [shareMenuOpen, setShareMenuOpen] = useState<string | null>(null)
    const [qrProfile, setQrProfile] = useState<{ data: string; title: string } | null>(null)
    const [showQRScanner, setShowQRScanner] = useState(false)
    const [lockShareProfile, setLockShareProfile] = useState<any | null>(null)
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)
    const [importing, setImporting] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    // Simulate loading on mount for professional feel
    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 800)
        return () => clearTimeout(timer)
    }, [])

    const handleImportFromClipboard = async () => {
        try {
            setImporting(true)
            const text = await navigator.clipboard.readText()
            const profile = parseProfileLink(text)
            if (profile) {
                const duplicate = profiles.find(p =>
                    p.address === profile.address && p.port === profile.port
                )

                if (duplicate) {
                    showToast(`⚠️ Duplicate detected: ${duplicate.name} already exists`, 'warning')
                    profile.name = `${profile.name} (Copy)`
                }

                addProfile(profile)
                showToast(`Successfully imported: ${profile.name}`, 'success')
            } else {
                showToast('Invalid profile link in clipboard', 'error')
            }
        } catch (error: any) {
            showToast(error.message || 'Failed to parse profile link', 'error')
        } finally {
            setImporting(false)
            setShowImportMenu(false)
        }
    }

    const handleImportJSONFromClipboard = async () => {
        try {
            setImporting(true)
            const text = await navigator.clipboard.readText()
            const profile = parseJSONProfile(text)
            if (profile) {
                const duplicate = profiles.find(p =>
                    p.address === profile.address && p.port === profile.port
                )

                if (duplicate) {
                    showToast(`⚠️ Duplicate detected: ${duplicate.name} already exists`, 'warning')
                    profile.name = `${profile.name} (Copy)`
                }

                addProfile(profile)
                showToast(`Successfully imported: ${profile.name}`, 'success')
            } else {
                showToast('Invalid JSON config in clipboard', 'error')
            }
        } catch (error) {
            showToast('Failed to parse JSON config', 'error')
        } finally {
            setImporting(false)
            setShowImportMenu(false)
        }
    }

    const handleScanResult = (text: string) => {
        try {
            const profile = parseProfileLink(text)
            if (profile) {
                const duplicate = profiles.find(p =>
                    p.address === profile.address && p.port === profile.port
                )

                if (duplicate) {
                    showToast(`⚠️ Duplicate detected: ${duplicate.name} already exists`, 'warning')
                    profile.name = `${profile.name} (Copy)`
                }

                addProfile(profile)
                showToast(`Successfully imported: ${profile.name}`, 'success')
                setShowQRScanner(false)
            } else {
                showToast('Invalid profile format', 'error')
            }
        } catch (error) {
            showToast('Failed to parse scanned code', 'error')
        }
    }

    const handlePing = async (profileId: string) => {
        const profile = profiles.find(p => p.id === profileId)
        if (profile) {
            showToast(`Pinging ${profile.name}...`, 'info', 1500)
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

        for (const profile of profiles) {
            const latency = await pingServer(profile.address, profile.port, settings.latencyTestMethod)
            updateProfile(profile.id, { latency })
        }

        setPingingAll(false)
        showToast('All servers pinged successfully', 'success')
    }

    const handleShareQR = (profile: any) => {
        const uri = generateProfileLink(profile)
        setQrProfile({ data: uri, title: profile.name })
        setShareMenuOpen(null)
    }

    const handleCopyLink = async (profile: any) => {
        const uri = generateProfileLink(profile)
        await navigator.clipboard.writeText(uri)
        showToast('Profile link copied to clipboard', 'success')
        setShareMenuOpen(null)
    }

    const handleCopyJSON = async (profile: any) => {
        const json = generateV2RayJSON(profile, settings)
        await navigator.clipboard.writeText(json)
        showToast('V2Ray JSON copied to clipboard', 'success')
        setShareMenuOpen(null)
    }

    const handleShareLocked = (profile: any) => {
        setLockShareProfile(profile)
        setShareMenuOpen(null)
    }

    const editingProfileData = editingProfile ? profiles.find(p => p.id === editingProfile) : null
    const stats = calculateStats(profiles)

    return (
        <div className="flex flex-col h-full w-full overflow-y-auto">
            <header className="mb-6 px-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <FileCode size={24} className="text-accent" />
                        <div>
                            <h2 className="text-2xl font-semibold text-primary tracking-tight">{t('configs_title')}</h2>
                            <p className="text-secondary text-sm mt-1">{t('configs_subtitle')}</p>
                        </div>
                    </div>

                    {/* Export & Import Buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                exportProfilesAsFile(profiles)
                                showToast('Profiles exported successfully', 'success')
                            }}
                            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-sm font-medium transition-all border border-zinc-700"
                            title="Export all profiles to JSON file"
                        >
                            <FileJson size={16} className="inline mr-2" />
                            {t('export_all')}
                        </button>

                        {/* Import Button */}
                        <div className="relative">
                            <button
                                onClick={() => setShowImportMenu(!showImportMenu)}
                                disabled={importing}
                                className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/80 text-white rounded-lg font-medium text-sm transition-all shadow-lg hover-lift disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus size={18} className={importing ? 'animate-spin' : ''} />
                                {importing ? t('importing') : t('import_config')}
                            </button>

                            {/* Import Dropdown */}
                            {showImportMenu && (
                                <div className="absolute right-0 mt-2 w-64 bg-surface border border-border rounded-lg shadow-xl z-50 overflow-hidden animate-scale-in">
                                    <button
                                        onClick={handleImportFromClipboard}
                                        className="w-full px-4 py-3 hover:bg-white/5 transition-colors flex items-center gap-3 text-left"
                                    >
                                        <Clipboard size={18} className="text-accent" />
                                        <div>
                                            <div className="font-medium text-sm text-primary">Import URI from Clipboard</div>
                                            <div className="text-xs text-secondary">vless:// or vmess://</div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={handleImportJSONFromClipboard}
                                        className="w-full px-4 py-3 hover:bg-white/5 transition-colors flex items-center gap-3 text-left border-t border-border"
                                    >
                                        <FileJson size={18} className="text-emerald-500" />
                                        <div>
                                            <div className="font-medium text-sm text-primary">Import JSON from Clipboard</div>
                                            <div className="text-xs text-secondary">Xray JSON config</div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setShowQRScanner(true)
                                            setShowImportMenu(false)
                                        }}
                                        className="w-full px-4 py-3 hover:bg-white/5 transition-colors flex items-center gap-3 text-left border-t border-border"
                                    >
                                        <Link2 size={18} className="text-blue-500" />
                                        <div>
                                            <div className="font-medium text-sm text-primary">Scan QR Code</div>
                                            <div className="text-xs text-secondary">From screen or camera</div>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Stats Summary */}
                {profiles.length > 0 && (
                    <div className="grid grid-cols-3 gap-3 animate-fade-in">
                        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-lg p-3 hover:border-blue-500/40 transition-all">
                            <div className="flex items-center gap-2 mb-1">
                                <Server size={16} className="text-blue-400" />
                                <span className="text-xs font-medium text-blue-300">{t('configs_stat_total')}</span>
                            </div>
                            <div className="text-2xl font-bold text-primary">{stats.total}</div>
                        </div>

                        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-lg p-3 hover:border-emerald-500/40 transition-all">
                            <div className="flex items-center gap-2 mb-1">
                                <TrendingUp size={16} className="text-emerald-400" />
                                <span className="text-xs font-medium text-emerald-300">{t('configs_stat_latency')}</span>
                            </div>
                            <div className="text-2xl font-bold text-primary">
                                {stats.avgLatency > 0 ? `${stats.avgLatency}ms` : '—'}
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-lg p-3 hover:border-purple-500/40 transition-all">
                            <div className="flex items-center gap-2 mb-1">
                                <Activity size={16} className="text-purple-400" />
                                <span className="text-xs font-medium text-purple-300">{t('configs_stat_tested')}</span>
                            </div>
                            <div className="text-2xl font-bold text-primary">
                                {stats.tested}/{stats.total}
                            </div>
                        </div>
                    </div>
                )}
            </header>

            <div className="flex-1 overflow-hidden w-full px-6 pb-6">
                {/* Configs List */}
                <div className="bg-surface border border-border rounded-lg overflow-hidden h-full flex flex-col w-full mr-0">
                    <div className="p-4 bg-background/50 flex items-center justify-between border-b border-border">
                        <h3 className="text-sm font-semibold text-primary">{t('configs_all_title')} ({profiles.length})</h3>
                        <button
                            onClick={handlePingAll}
                            disabled={pingingAll || profiles.length === 0}
                            className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded text-xs font-medium border border-yellow-500/30 transition-all hover-lift disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <Zap size={14} className={pingingAll ? 'animate-spin' : ''} />
                            {pingingAll ? t('configs_pinging') : t('configs_ping_all')}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {isLoading || importing ? (
                            <div className="space-y-3 m-6">
                                <ProfileCardSkeleton />
                                <ProfileCardSkeleton />
                                <ProfileCardSkeleton />
                            </div>
                        ) : profiles.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                                <div className="bg-gradient-to-br from-accent/10 to-accent/5 rounded-full p-6 mb-4">
                                    <FileCode size={48} className="text-accent" />
                                </div>
                                <h3 className="text-lg font-semibold text-primary mb-2">{t('configs_no_configs')}</h3>
                                <p className="text-sm text-secondary mb-6 max-w-sm">{t('configs_no_configs_desc')}</p>
                                <button
                                    onClick={() => setShowImportMenu(true)}
                                    className="px-6 py-2.5 bg-accent hover:bg-accent/80 text-white rounded-lg text-sm font-medium transition-all shadow-lg hover-lift"
                                >
                                    <Plus size={16} className="inline mr-2" />
                                    Import Config
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3 m-6">
                                {profiles
                                    .sort((a, b) => {
                                        // 1. Favorites
                                        const favDiff = (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0)
                                        if (favDiff !== 0) return favDiff

                                        // 2. Groups
                                        const groupA = a.group || ''
                                        const groupB = b.group || ''
                                        if (groupA !== groupB) return groupA.localeCompare(groupB)

                                        // 3. Name
                                        return a.name.localeCompare(b.name)
                                    })
                                    .map((profile) => {
                                        const latencyStatus = getLatencyStatus(profile.latency)
                                        return (
                                            <div
                                                key={profile.id}
                                                className="group relative bg-black/80 backdrop-blur-sm border border-zinc-800/50 rounded-xl p-4 hover:border-zinc-700/50 hover:bg-black/90 transition-all duration-200 animate-fade-in overflow-hidden"
                                            >
                                                {/* Subtle gradient overlay on hover */}
                                                <div className="absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/5 to-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                                                <div className="relative flex items-start justify-between gap-4">
                                                    <div className="flex-1 min-w-0 space-y-2.5">
                                                        {/* Profile Name & Latency */}
                                                        <div className="flex items-center gap-3">
                                                            <h4 className="font-semibold text-primary truncate group-hover:text-accent transition-colors text-base">
                                                                {profile.name}
                                                            </h4>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    updateProfile(profile.id, { isFavorite: !profile.isFavorite })
                                                                }}
                                                                className={`p-1 rounded transition-colors ${profile.isFavorite ? 'text-yellow-400 hover:text-yellow-300' : 'text-zinc-600 hover:text-yellow-400'}`}
                                                                title={profile.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                                            >
                                                                <Star size={14} fill={profile.isFavorite ? 'currentColor' : 'none'} />
                                                            </button>
                                                            {profile.latency !== undefined && (
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`text-xs px-2.5 py-1 rounded-md font-bold bg-gradient-to-r ${latencyStatus.gradient} text-white shadow-md`}>
                                                                        {profile.latency < 4000 ? `${profile.latency}ms` : 'Timeout'}
                                                                    </span>
                                                                    {profile.latency < 4000 && (
                                                                        <span className={`text-xs px-2.5 py-1 rounded-md border ${latencyStatus.bg} ${latencyStatus.text} ${latencyStatus.border} font-medium`}>
                                                                            {latencyStatus.label}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Address & Protocol */}
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="font-mono text-xs bg-black/60 px-3 py-1.5 rounded-md border border-zinc-800/50 text-zinc-300 backdrop-blur-sm">
                                                                {profile.address}:{profile.port}
                                                            </div>
                                                            <div className="text-xs font-bold px-2.5 py-1 rounded-md bg-blue-500/15 text-blue-400 uppercase tracking-wide border border-blue-500/30">
                                                                {profile.protocol || 'vmess'}
                                                            </div>
                                                        </div>

                                                        {/* Security Info */}
                                                        <div className="text-xs text-zinc-500 flex items-center gap-2 pl-1">
                                                            <span className="w-1 h-1 rounded-full bg-zinc-600" />
                                                            <span>{profile.network || 'tcp'}</span>
                                                            <span className="w-1 h-1 rounded-full bg-zinc-600" />
                                                            <span>{profile.security || 'none'}</span>
                                                        </div>
                                                    </div>

                                                    {/* Action Buttons & Group Badge */}
                                                    <div className="flex flex-col items-end gap-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handlePing(profile.id) }}
                                                                className="p-2 hover:bg-yellow-500/10 rounded-lg text-zinc-400 hover:text-yellow-400 transition-all hover:scale-105"
                                                                title="Test Latency"
                                                            >
                                                                <Zap size={16} />
                                                            </button>

                                                            <div className="relative">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setShareMenuOpen(shareMenuOpen === profile.id ? null : profile.id)
                                                                    }}
                                                                    className={`p-2 rounded-lg transition-all hover:scale-105 ${shareMenuOpen === profile.id ? 'text-accent bg-accent/15' : 'text-zinc-400 hover:text-accent hover:bg-accent/10'}`}
                                                                    title="Share Config"
                                                                >
                                                                    <Share2 size={16} />
                                                                </button>

                                                                {/* Share Dropdown */}
                                                                {shareMenuOpen === profile.id && (
                                                                    <div className="absolute right-0 mt-2 w-52 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-scale-in backdrop-blur-xl">
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); handleShareQR(profile) }}
                                                                            className="w-full px-4 py-3 hover:bg-white/5 transition-colors flex items-center gap-3 text-left text-sm text-primary"
                                                                        >
                                                                            <QrCode size={16} className="text-zinc-400" />
                                                                            Show QR Code
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); handleCopyLink(profile) }}
                                                                            className="w-full px-4 py-3 hover:bg-white/5 transition-colors flex items-center gap-3 text-left text-sm text-primary"
                                                                        >
                                                                            <Copy size={16} className="text-zinc-400" />
                                                                            Copy Link
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); handleCopyJSON(profile) }}
                                                                            className="w-full px-4 py-3 hover:bg-white/5 transition-colors flex items-center gap-3 text-left text-sm text-primary"
                                                                        >
                                                                            <FileJson size={16} className="text-zinc-400" />
                                                                            Copy V2Ray JSON
                                                                        </button>
                                                                        <div className="h-px bg-zinc-700/50 my-1" />
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); handleShareLocked(profile) }}
                                                                            className="w-full px-4 py-2 hover:bg-white/5 transition-colors flex items-center gap-2 text-left text-sm text-yellow-500"
                                                                        >
                                                                            <Lock size={14} />
                                                                            Create Locked Link
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setEditingProfile(profile.id) }}
                                                                className="p-2 hover:bg-blue-500/10 rounded-lg text-zinc-400 hover:text-blue-400 transition-all hover:scale-105"
                                                                title="Edit Config"
                                                            >
                                                                <Edit size={16} />
                                                            </button>

                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setJsonEditingProfile(profile) }}
                                                                className="p-2 hover:bg-purple-500/10 rounded-lg text-zinc-400 hover:text-purple-400 transition-all hover:scale-105"
                                                                title="Edit as JSON"
                                                            >
                                                                <CodeSlashIcon size={16} />
                                                            </button>

                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: profile.id, name: profile.name }) }}
                                                                className="p-2 hover:bg-red-500/10 rounded-lg text-secondary hover:text-red-500 transition-all hover-lift"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>

                                                        {profile.group && (
                                                            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                                                                {profile.group}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Profile Editor Modal */}
            {editingProfile && editingProfileData && (
                <ProfileEditor
                    profile={editingProfileData}
                    onSave={(updated) => {
                        updateProfile(editingProfile, updated)
                        setEditingProfile(null)
                        showToast('Profile updated', 'success')
                    }}
                    onClose={() => setEditingProfile(null)}
                />
            )}

            {/* QR Code Modal (Display) */}
            {qrProfile && (
                <QRCodeModal
                    data={qrProfile.data}
                    title={qrProfile.title}
                    onClose={() => setQrProfile(null)}
                />
            )}

            {/* QR Scanner Modal (Camera) */}
            {showQRScanner && (
                <QRScannerModal
                    onScan={handleScanResult}
                    onClose={() => setShowQRScanner(false)}
                />
            )}

            {/* Lock Share Modal */}
            {lockShareProfile && (
                <LockShareModal
                    profile={lockShareProfile}
                    onClose={() => setLockShareProfile(null)}
                />
            )}

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={deleteConfirm !== null}
                title="Delete Profile?"
                message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
                onConfirm={() => {
                    if (deleteConfirm) {
                        removeProfile(deleteConfirm.id)
                        showToast('Profile deleted', 'success')
                        setDeleteConfirm(null)
                    }
                }}
                onCancel={() => setDeleteConfirm(null)}
            />

            {/* JSON Editor Modal */}
            {jsonEditingProfile && (
                <JSONEditorModal
                    profile={jsonEditingProfile}
                    onClose={() => setJsonEditingProfile(null)}
                    onSave={(updatedProfile) => {
                        updateProfile(updatedProfile.id, updatedProfile)
                        showToast(`Updated ${updatedProfile.name}`, 'success')
                    }}
                />
            )}
        </div>
    )
}
