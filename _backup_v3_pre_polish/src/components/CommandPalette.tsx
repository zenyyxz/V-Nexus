import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Server, Settings, Shield } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export const CommandPalette = () => {
    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState('')
    const navigate = useNavigate()

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setIsOpen((open) => !open)
            }
        }
        document.addEventListener('keydown', down)
        return () => document.removeEventListener('keydown', down)
    }, [])

    const actions = [
        { id: 'connect', label: 'Quick Connect', icon: <Server size={14} />, action: () => console.log('Connect') },
        { id: 'settings', label: 'Open Settings', icon: <Settings size={14} />, action: () => navigate('/settings') },
        { id: 'security', label: 'Security Check', icon: <Shield size={14} />, action: () => navigate('/security') },
    ]

    const filteredActions = actions.filter(a => a.label.toLowerCase().includes(query.toLowerCase()))

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsOpen(false)}
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl overflow-hidden relative z-10"
                    >
                        <div className="flex items-center px-4 py-3 border-b border-border">
                            <Search size={16} className="text-secondary mr-3" />
                            <input
                                autoFocus
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Type a command or search..."
                                className="flex-1 bg-transparent border-none text-primary placeholder:text-zinc-600 focus:outline-none text-sm"
                            />
                            <div className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-400 font-mono">ESC</div>
                        </div>
                        <div className="p-2">
                            {filteredActions.length === 0 ? (
                                <div className="p-4 text-center text-sm text-secondary">No results found.</div>
                            ) : (
                                filteredActions.map(action => (
                                    <button
                                        key={action.id}
                                        onClick={() => {
                                            action.action()
                                            setIsOpen(false)
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 text-sm text-secondary hover:text-primary transition-colors text-left"
                                    >
                                        {action.icon}
                                        {action.label}
                                    </button>
                                ))
                            )}
                        </div>
                        <div className="bg-zinc-900 border-t border-border px-4 py-2 text-[10px] text-zinc-500 flex justify-between">
                            <span>Cmd+K to toggle</span>
                            <span>Pro Client v2.0</span>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
