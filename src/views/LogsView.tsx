import { useState, useEffect } from 'react'
import { useApp } from '../contexts/AppContext'
import { FileText, Download, Trash2 } from 'lucide-react'

export const LogsView = () => {
    const { settings } = useApp()
    const [logs, setLogs] = useState<string[]>([])
    const [autoRefresh, setAutoRefresh] = useState(true)

    // Fetch logs from Xray
    const fetchLogs = async () => {
        try {
            const result = await window.xray.getLogs()
            if (result.success) {
                const maxLines = settings.maxLogLines || 500
                setLogs(result.logs.slice(-maxLines))
            }
        } catch (error) {
            console.error('Failed to fetch logs:', error)
        }
    }

    // Auto-refresh logs every 2 seconds
    useEffect(() => {
        fetchLogs()

        if (autoRefresh) {
            const interval = setInterval(fetchLogs, 2000)
            return () => clearInterval(interval)
        }
    }, [autoRefresh])

    const handleExport = () => {
        const logText = logs.join('\n')
        const blob = new Blob([logText], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `vnexus-logs-${new Date().toISOString().replace(/:/g, '-')}.txt`
        a.click()
        URL.revokeObjectURL(url)
    }

    const handleClear = async () => {
        try {
            const result = await window.xray.clearLogs()
            if (result.success) {
                setLogs([])
            }
        } catch (error) {
            console.error('Failed to clear logs:', error)
        }
    }

    return (
        <div className="h-full flex flex-col">
            <header className="mb-6 px-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <FileText size={24} className="text-accent" />
                        <div>
                            <h2 className="text-2xl font-semibold text-primary tracking-tight">Logs</h2>
                            <p className="text-secondary text-sm mt-1">View application and connection logs.</p>
                        </div>
                    </div>
                    <div className="flex gap-2 items-center">
                        <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                                className="rounded border-border bg-background"
                            />
                            Auto-refresh
                        </label>
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/80 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <Download size={16} />
                            Export
                        </button>
                        <button
                            onClick={handleClear}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-sm font-medium border border-red-500/30 transition-colors"
                        >
                            <Trash2 size={16} />
                            Clear
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 bg-surface border border-border rounded-2xl overflow-hidden flex flex-col mx-6 mb-6">
                <div className="p-4 border-b border-border bg-background/50 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-primary">Application Logs</h3>
                    <span className="text-xs text-secondary">{logs.length} entries</span>
                </div>

                <div className="flex-1 overflow-y-auto p-5 font-mono text-sm leading-relaxed">
                    {logs.length === 0 ? (
                        <div className="text-center text-secondary py-12">
                            <FileText size={48} className="mx-auto mb-4 opacity-30" />
                            <p className="text-base">No logs yet. Start a connection to see logs.</p>
                        </div>
                    ) : (
                        <div className="space-y-0.5">
                            {logs.map((log, index) => (
                                <div key={index} className="text-zinc-300 hover:bg-zinc-800/30 px-2 py-1 rounded transition-colors">
                                    {log}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
