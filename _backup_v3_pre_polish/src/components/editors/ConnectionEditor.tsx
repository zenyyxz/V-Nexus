import { useApp } from '../../contexts/AppContext'
import { Shield, Zap, FileText } from 'lucide-react'

export const ConnectionEditor = () => {
    const { settings, updateSettings, isConnected } = useApp()

    return (
        <div className="h-full flex flex-col bg-surface border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border bg-background/50 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-primary">Core Settings</h3>
                    <p className="text-xs text-secondary mt-0.5">Global configuration for V2Ray core</p>
                </div>
                {isConnected && (
                    <span className="text-xs text-yellow-500 font-medium px-2 py-0.5 bg-yellow-500/10 rounded">
                        Read Only (Connected)
                    </span>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">

                {/* Process & Logging */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <FileText size={16} className="text-accent" />
                        <h4 className="text-sm font-semibold text-primary">Process & Logging</h4>
                    </div>

                    <div className="space-y-4 pl-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-secondary mb-1.5">Log Level</label>
                                <select
                                    value={settings.logLevel}
                                    onChange={(e) => updateSettings({ logLevel: e.target.value as any })}
                                    disabled={isConnected}
                                    className="w-full bg-background border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm disabled:opacity-50"
                                >
                                    <option value="none">None</option>
                                    <option value="info">Info</option>
                                    <option value="warning">Warning</option>
                                    <option value="error">Error</option>
                                    <option value="debug">Debug</option>
                                </select>
                                <p className="text-[10px] text-secondary mt-1">Controls the verbosity of the core logs.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-secondary mb-1.5">Stats Collection</label>
                                <div className="p-2 border border-border rounded bg-background/50">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-zinc-300">Detailed Traffic Stats</span>
                                        <span className="text-xs text-emerald-500 font-medium">Always On</span>
                                    </div>
                                    <p className="text-[10px] text-secondary mt-1">Required for traffic graph.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="h-px bg-border/50" />

                {/* Multiplexing (Mux) */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Zap size={16} className="text-accent" />
                        <h4 className="text-sm font-semibold text-primary">Multiplexing (Mux)</h4>
                    </div>

                    <div className="space-y-4 pl-6">
                        <div className="flex items-start gap-3">
                            <div className="pt-0.5">
                                <input
                                    type="checkbox"
                                    id="mux-toggle"
                                    checked={settings.muxEnabled}
                                    onChange={(e) => updateSettings({ muxEnabled: e.target.checked })}
                                    disabled={isConnected}
                                    className="rounded border-zinc-700 bg-background text-accent focus:ring-accent"
                                />
                            </div>
                            <div className="flex-1">
                                <label htmlFor="mux-toggle" className="text-sm font-medium text-primary block">Enable Mux</label>
                                <p className="text-xs text-secondary mt-0.5">
                                    Multiplexes multiple TCP connections over a single connection. Improves performance on high-latency networks but may be unstable on some ISPs.
                                </p>
                            </div>
                        </div>

                        {settings.muxEnabled && (
                            <div className="bg-background/30 p-4 rounded-lg border border-border/50">
                                <label className="block text-xs font-medium text-secondary mb-1.5">Concurrency</label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="number"
                                        min="1"
                                        max="1024"
                                        value={settings.muxConcurrency}
                                        onChange={(e) => updateSettings({ muxConcurrency: parseInt(e.target.value) || 8 })}
                                        disabled={isConnected}
                                        className="w-24 bg-background border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm disabled:opacity-50"
                                    />
                                    <span className="text-xs text-secondary">Max concurrent streams per connection (Default: 8).</span>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                <div className="h-px bg-border/50" />

                {/* Security */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Shield size={16} className="text-accent" />
                        <h4 className="text-sm font-semibold text-primary">Security & TLS</h4>
                    </div>

                    <div className="space-y-4 pl-6">
                        <div className="flex items-start gap-3">
                            <div className="pt-0.5">
                                <input
                                    type="checkbox"
                                    id="insecure-toggle"
                                    checked={settings.allowInsecure}
                                    onChange={(e) => updateSettings({ allowInsecure: e.target.checked })}
                                    disabled={isConnected}
                                    className="rounded border-zinc-700 bg-background text-accent focus:ring-accent"
                                />
                            </div>
                            <div className="flex-1">
                                <label htmlFor="insecure-toggle" className="text-sm font-medium text-primary block">Allow Insecure TLS</label>
                                <p className="text-xs text-red-400/80 mt-0.5">
                                    Skips certificate verification. Extremely unsafe and enables Man-in-the-Middle attacks. Use only for debugging.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

            </div>
        </div>
    )
}
