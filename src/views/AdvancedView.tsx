import { useState } from 'react'
import { ConnectionEditor } from '../components/editors/ConnectionEditor'
import { RoutingEditor } from '../components/editors/RoutingEditor'

export const AdvancedView = () => {
    const [activeTab, setActiveTab] = useState<'config' | 'connections' | 'routing'>('config')

    return (
        <div className="h-full flex flex-col">
            <header className="mb-6 px-6 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-semibold text-primary tracking-tight">Configuration</h2>
                    <p className="text-secondary text-sm mt-1">Advanced control over V2Ray core settings.</p>
                </div>
                <div className="flex gap-2">
                    <button className="px-3 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-300 hover:text-white rounded border border-zinc-700 hover:border-zinc-600 transition-all">
                        Reset Defaults
                    </button>
                    <button className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded shadow-sm transition-all border border-blue-500">
                        Save Changes
                    </button>
                </div>
            </header>

            <div className="flex-1 bg-surface rounded-2xl border border-border overflow-hidden flex flex-col shadow-sm mx-6 mb-6">
                <div className="flex border-b border-border bg-zinc-950/30">
                    <button
                        onClick={() => setActiveTab('config')}
                        className={`px-5 py-3 text-sm font-medium border-r border-border transition-colors ${activeTab === 'config' ? 'bg-surface text-primary border-b-2 border-b-accent' : 'text-secondary hover:text-primary hover:bg-white/5'}`}
                    >
                        config.json
                    </button>
                    <button
                        onClick={() => setActiveTab('connections')}
                        className={`px-5 py-3 text-sm font-medium border-r border-border transition-colors ${activeTab === 'connections' ? 'bg-surface text-primary border-b-2 border-b-accent' : 'text-secondary hover:text-primary hover:bg-white/5'}`}
                    >
                        Connection Editor
                    </button>
                    <button
                        onClick={() => setActiveTab('routing')}
                        className={`px-5 py-3 text-sm font-medium border-r border-border transition-colors ${activeTab === 'routing' ? 'bg-surface text-primary border-b-2 border-b-accent' : 'text-secondary hover:text-primary hover:bg-white/5'}`}
                    >
                        Routing Rules
                    </button>
                </div>

                <div className="flex-1 relative overflow-hidden bg-background/50">
                    {activeTab === 'config' && (
                        <textarea
                            className="w-full h-full bg-transparent p-5 resize-none focus:outline-none font-mono text-sm text-zinc-200 leading-relaxed"
                            spellCheck="false"
                            defaultValue={`{
    "log": {
        "loglevel": "warning"
    },
    "inbounds": [
        {
            "port": 10808,
            "protocol": "socks",
            "settings": {
                "auth": "noauth"
            }
        }
    ],
    "outbounds": [
        {
            "protocol": "freedom"
        }
    ]
}`}
                        />
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
