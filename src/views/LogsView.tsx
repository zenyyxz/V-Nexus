import { useState, useEffect, useRef } from 'react'
import { useTranslation } from '../hooks/useTranslation'
import { useApp } from '../contexts/AppContext'
import { FileText, Download, Trash2, ArrowDownCircle } from 'lucide-react'

export const LogsView = () => {
    const { settings } = useApp()
    const { t } = useTranslation()
    const [logs, setLogs] = useState<string[]>([])
    const [autoRefresh, setAutoRefresh] = useState(true)
    const logsEndRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [userScrolled, setUserScrolled] = useState(false)

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

    // Auto-scroll logic
    useEffect(() => {
        if (!userScrolled && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [logs, userScrolled])

    // Detect user scroll
    const handleScroll = () => {
        if (containerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = containerRef.current
            // If user is near bottom (within 50px), enable auto-scroll. Otherwise disable.
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 50
            setUserScrolled(!isNearBottom)
        }
    }

    const scrollToBottom = () => {
        setUserScrolled(false)
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

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
                            <h2 className="text-2xl font-semibold text-primary tracking-tight">{t('logs_title')}</h2>
                            <p className="text-secondary text-sm mt-1">{t('logs_subtitle')}</p>
                        </div>
                    </div>
                    <div className="flex gap-2 items-center">
                        <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                                className="rounded border-border bg-background accent-accent"
                            />
                            {t('logs_auto_refresh')}
                        </label>
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/80 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <Download size={16} />
                            {t('logs_export')}
                        </button>
                        <button
                            onClick={handleClear}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-sm font-medium border border-red-500/30 transition-colors"
                        >
                            <Trash2 size={16} />
                            {t('logs_clear')}
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 bg-surface border border-border rounded-2xl overflow-hidden flex flex-col mx-6 mb-6 relative">
                <div className="p-4 border-b border-border bg-background/50 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-primary">{t('logs_app_logs')}</h3>
                    <span className="text-xs text-secondary">{logs.length} {t('logs_entries')}</span>
                </div>

                <div
                    ref={containerRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto p-5 font-mono text-sm leading-relaxed"
                >
                    {logs.length === 0 ? (
                        <div className="text-center text-secondary py-12">
                            <FileText size={48} className="mx-auto mb-4 opacity-30" />
                            <p className="text-base">{t('logs_empty')}. {t('logs_empty_desc')}</p>
                        </div>
                    ) : (
                        <div className="space-y-0.5">
                            {logs.map((log, index) => (
                                <div key={index} className="text-zinc-300 hover:bg-zinc-800/30 px-2 py-1 rounded transition-colors break-words">
                                    {log}
                                </div>
                            ))}
                            <div ref={logsEndRef} />
                        </div>
                    )}
                </div>

                {/* Scroll to bottom button if user scrolled up */}
                {userScrolled && logs.length > 0 && (
                    <button
                        onClick={scrollToBottom}
                        className="absolute bottom-6 right-6 p-2 bg-accent text-white rounded-full shadow-lg hover:bg-accent/90 transition-all hover:scale-110 animate-fade-in"
                        title="Scroll to Bottom"
                    >
                        <ArrowDownCircle size={24} />
                    </button>
                )}
            </div>
        </div>
    )
}
