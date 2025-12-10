import { useState, useEffect } from 'react'
import { useTranslation } from '../hooks/useTranslation'
import { useApp } from '../contexts/AppContext'
import { ConnectionEditor } from '../components/editors/ConnectionEditor'
import { RoutingEditor } from '../components/editors/RoutingEditor'



export const AdvancedView = () => {
    const [activeTab, setActiveTab] = useState<'config' | 'connections' | 'routing'>('config')
    const { t } = useTranslation()
    const { profiles, activeProfileId, settings, customConfig, setCustomConfig, selectedProfileId } = useApp()

    const [configPreview, setConfigPreview] = useState<string>('// Select a profile to view generated config')
    const [isLoadingConfig, setIsLoadingConfig] = useState(false)

    // Determine which profile to show config for: Connected > Selected > First Available
    const targetProfile = activeProfileId
        ? profiles.find(p => p.id === activeProfileId)
        : (selectedProfileId ? profiles.find(p => p.id === selectedProfileId) : profiles[0])

    const displayProfile = targetProfile || null

    // Fetch Config Preview (or use Custom)
    useEffect(() => {
        const fetchConfig = async () => {
            if (activeTab === 'config') {
                if (customConfig) {
                    setConfigPreview(customConfig)
                    return
                }

                if (displayProfile || true) { // Always generate config, even if none (Skeleton)
                    setIsLoadingConfig(true)
                    try {
                        const { invoke } = await import('@tauri-apps/api/core')
                        // Generate config to a temp file
                        const genResult = await invoke('generate_config', {
                            profile: displayProfile || null,
                            settings: settings
                        }) as { path: string, content: string }

                        setConfigPreview(genResult.content)
                    } catch (error) {
                        console.error('Failed to preview config:', error)
                        setConfigPreview(`// Error generating config: ${error}`)
                    } finally {
                        setIsLoadingConfig(false)
                    }
                }
            }
        }
        fetchConfig()
    }, [activeTab, displayProfile, settings, customConfig])

    return (
        <div className="h-full flex flex-col">
            <header className="mb-6 px-6 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-semibold text-primary tracking-tight">{t('adv_title')}</h2>
                    <p className="text-secondary text-sm mt-1">{t('adv_subtitle')}</p>
                </div>
                {/* Global Actions (Disabled for now as they are contextual) */}
            </header>

            <div className="flex-1 bg-surface rounded-2xl border border-border overflow-hidden flex flex-col shadow-sm mx-6 mb-6">
                <div className="flex border-b border-border bg-zinc-950/30">
                    <button
                        onClick={() => setActiveTab('config')}
                        className={`px-5 py-3 text-sm font-medium border-r border-border transition-colors ${activeTab === 'config' ? 'bg-surface text-primary border-b-2 border-b-accent' : 'text-secondary hover:text-primary hover:bg-white/5'}`}
                    >
                        {t('adv_tab_config')}
                    </button>
                    <button
                        onClick={() => setActiveTab('connections')}
                        className={`px-5 py-3 text-sm font-medium border-r border-border transition-colors ${activeTab === 'connections' ? 'bg-surface text-primary border-b-2 border-b-accent' : 'text-secondary hover:text-primary hover:bg-white/5'}`}
                    >
                        {t('adv_tab_connection')}
                    </button>
                    <button
                        onClick={() => setActiveTab('routing')}
                        className={`px-5 py-3 text-sm font-medium border-r border-border transition-colors ${activeTab === 'routing' ? 'bg-surface text-primary border-b-2 border-b-accent' : 'text-secondary hover:text-primary hover:bg-white/5'}`}
                    >
                        {t('adv_tab_routing')}
                    </button>
                </div>

                <div className="flex-1 relative overflow-hidden bg-background/50">
                    {activeTab === 'config' && (
                        <div className="w-full h-full flex flex-col relative">
                            {/* Toolbar */}
                            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-black/20">
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-0.5 rounded border ${customConfig ? 'border-orange-500/50 text-orange-400 bg-orange-500/10' : 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'}`}>
                                        {customConfig ? 'Custom Config Active' : 'Auto-Generated'}
                                    </span>
                                    {customConfig && <span className="text-[10px] text-zinc-500">Auto-generation disabled</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            if (confirm('Are you sure you want to reset to default? Your custom edits will be lost.')) {
                                                setCustomConfig(null)
                                                // Trigger regenerate by clearing preview (optional, effect handles it)
                                            }
                                        }}
                                        className="text-xs text-secondary hover:text-white px-3 py-1.5 rounded hover:bg-white/5 transition-colors"
                                        disabled={!customConfig}
                                    >
                                        Reset to Default
                                    </button>
                                    <button
                                        onClick={() => {
                                            setCustomConfig(configPreview)
                                            // Optional toast
                                            alert('Config saved! This configuration will be used for the next connection.')
                                        }}
                                        className="text-xs bg-accent hover:bg-accent/80 text-white px-3 py-1.5 rounded transition-colors font-medium flex items-center gap-1.5"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 relative">
                                {isLoadingConfig && !customConfig && (
                                    <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center pointer-events-none z-10">
                                        <span className="text-xs text-secondary animate-pulse">Generating Preview...</span>
                                    </div>
                                )}
                                <textarea
                                    className="w-full h-full bg-transparent p-5 resize-none focus:outline-none font-mono text-sm text-zinc-300 leading-relaxed"
                                    spellCheck="false"
                                    value={configPreview}
                                    onChange={(e) => setConfigPreview(e.target.value)}
                                    placeholder="// Config content..."
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'connections' && (
                        <div className="h-full p-4">
                            <ConnectionEditor />
                        </div>
                    )}

                    {activeTab === 'routing' && (
                        <div className="h-full p-4">
                            <RoutingEditor />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
