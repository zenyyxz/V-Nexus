import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
    id: string
    type: ToastType
    message: string
    duration?: number
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType, duration?: number) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([])

    const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 3000) => {
        const id = crypto.randomUUID()
        const toast: Toast = { id, type, message, duration }

        setToasts(prev => [...prev, toast])

        if (duration > 0) {
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id))
            }, duration)
        }
    }, [])

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }

    const getIcon = (type: ToastType) => {
        switch (type) {
            case 'success': return <CheckCircle size={18} />
            case 'error': return <XCircle size={18} />
            case 'warning': return <AlertTriangle size={18} />
            default: return <Info size={18} />
        }
    }

    const getColors = (type: ToastType) => {
        switch (type) {
            case 'success': return 'bg-zinc-900/95 border-emerald-500/30 text-emerald-400'
            case 'error': return 'bg-zinc-900/95 border-red-500/30 text-red-400'
            case 'warning': return 'bg-zinc-900/95 border-yellow-500/30 text-yellow-400'
            default: return 'bg-zinc-900/95 border-blue-500/30 text-blue-400'
        }
    }

    const getProgressColor = (type: ToastType) => {
        switch (type) {
            case 'success': return 'bg-emerald-500'
            case 'error': return 'bg-red-500'
            case 'warning': return 'bg-yellow-500'
            default: return 'bg-blue-500'
        }
    }

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none max-w-md">
                <AnimatePresence>
                    {toasts.map(toast => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, x: 100, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 100, scale: 0.95 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className={`relative flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-xl shadow-2xl pointer-events-auto overflow-hidden ${getColors(toast.type)}`}
                        >
                            {/* Progress bar */}
                            {toast.duration && toast.duration > 0 && (
                                <motion.div
                                    className={`absolute bottom-0 left-0 h-0.5 ${getProgressColor(toast.type)}`}
                                    initial={{ width: '100%' }}
                                    animate={{ width: '0%' }}
                                    transition={{ duration: toast.duration / 1000, ease: 'linear' }}
                                />
                            )}

                            {getIcon(toast.type)}
                            <span className="text-sm font-medium text-zinc-100 flex-1">{toast.message}</span>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="ml-2 text-zinc-400 hover:text-zinc-200 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    )
}

export const useToast = () => {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within ToastProvider')
    }
    return context
}
