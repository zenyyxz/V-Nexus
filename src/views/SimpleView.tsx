import { useState } from 'react'
import { TrafficGraph } from '../components/TrafficGraph'

export const SimpleView = () => {
    const [serverLink, setServerLink] = useState('')

    const [isPlaying, setIsPlaying] = useState(false)
    const [status, setStatus] = useState('Disconnected')

    const toggleConnection = async () => {
        if (isPlaying) {
            setStatus('Disconnecting...')
            const res = await window.electronAPI.stopXray()
            if (res.success) {
                setIsPlaying(false)
                setStatus('Disconnected')
            } else {
                setStatus('Error stopping')
            }
        } else {
            setStatus('Connecting...')
            // TODO: Parse actual server link. For now sending dummy config.
            const res = await window.electronAPI.startXray('{}')
            if (res.success) {
                setIsPlaying(true)
                setStatus('Connected')
            } else {
                setStatus('Connection Failed')
            }
        }
    }

    const handleImport = () => {
        console.log('Importing:', serverLink)
    }

    return (
        <div className="w-full mx-auto h-full flex flex-col">
            <header className="mb-6">
                <h2 className="text-2xl font-semibold text-primary tracking-tight">Dashboard</h2>
                <p className="text-secondary text-sm mt-1">Manage your connection and quick server actions.</p>
            </header>

            <div className="flex-1 overflow-y-auto space-y-6 pb-6">
                <div className="bg-surface border border-border rounded-lg p-6">
                    <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-3">
                        Quick Connect
                    </label>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={serverLink}
                            onChange={(e) => setServerLink(e.target.value)}
                            placeholder="vmess://..."
                            className="flex-1 bg-background border border-border rounded-md px-4 py-2 text-primary placeholder:text-zinc-600 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all font-mono text-sm"
                        />
                        <button
                            onClick={handleImport}
                            className="bg-zinc-800 hover:bg-zinc-700 text-primary px-5 py-2 rounded-md text-sm font-medium transition-colors border border-zinc-700"
                        >
                            Import
                        </button>
                    </div>
                </div>

                <div className="bg-surface border border-border rounded-lg p-6">
                    <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-3">
                        Connection Status
                    </label>
                    <button
                        onClick={toggleConnection}
                        className={`
                            w-full py-8 rounded-lg border transition-all duration-200 group relative overflow-hidden
                            ${isPlaying
                                ? 'bg-emerald-950/20 border-emerald-900/50'
                                : 'bg-background border-border hover:border-zinc-700'
                            }
                        `}
                    >
                        <div className="relative z-10 flex flex-col items-center justify-center">
                            <div className={`p-4 rounded-full mb-4 transition-all duration-300 ${isPlaying ? 'text-emerald-500 bg-emerald-500/10' : 'text-zinc-500 bg-zinc-800/50 group-hover:bg-zinc-800 group-hover:text-zinc-400'}`}>
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <span className={`font-semibold text-xl tracking-wide ${isPlaying ? 'text-emerald-500' : 'text-secondary group-hover:text-primary transition-colors'}`}>
                                {status}
                            </span>
                            {isPlaying && <span className="text-xs text-emerald-600/80 mt-2 font-mono">00:01:23</span>}
                        </div>
                    </button>

                    {isPlaying && (
                        <div className="mt-6 h-48">
                            <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-3">Live Traffic</label>
                            <TrafficGraph />
                        </div>
                    )}
                </div>

                <div className="mt-8 grid grid-cols-2 gap-4">
                    <div className="bg-surface border border-border rounded-lg p-4 hover:border-zinc-700 transition-colors cursor-pointer group">
                        <div className="flex items-center justify-between mb-3">
                            <span className="font-medium text-sm text-primary">US - Premium 1</span>
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-secondary font-mono">
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">VLESS</span>
                            <span>45ms</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
