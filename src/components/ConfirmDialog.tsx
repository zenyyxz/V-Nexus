import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Info, AlertCircle } from 'lucide-react'

interface ConfirmDialogProps {
    isOpen: boolean
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    variant?: 'danger' | 'warning' | 'info'
    onConfirm: () => void
    onCancel: () => void
}

export const ConfirmDialog = ({
    isOpen,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'warning',
    onConfirm,
    onCancel
}: ConfirmDialogProps) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return
            if (e.key === 'Enter') {
                e.preventDefault()
                onConfirm()
            } else if (e.key === 'Escape') {
                e.preventDefault()
                onCancel()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onConfirm, onCancel])

    const icons = {
        danger: <AlertCircle size={24} className="text-red-500" />,
        warning: <AlertTriangle size={24} className="text-yellow-500" />,
        info: <Info size={24} className="text-blue-500" />
    }

    const confirmButtonStyles = {
        danger: 'bg-red-500 hover:bg-red-600 text-white',
        warning: 'bg-yellow-500 hover:bg-yellow-600 text-white',
        info: 'bg-blue-500 hover:bg-blue-600 text-white'
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                        onClick={onCancel}
                    />

                    {/* Dialog */}
                    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="bg-surface border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-start gap-4 mb-4">
                                <div className="flex-shrink-0 mt-0.5">
                                    {icons[variant]}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-primary mb-2">
                                        {title}
                                    </h3>
                                    <p className="text-secondary text-sm leading-relaxed">
                                        {message}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end mt-6">
                                <button
                                    onClick={onCancel}
                                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-primary rounded-md border border-zinc-700 transition-all hover:scale-105 active:scale-95 font-medium text-sm"
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={onConfirm}
                                    className={`px-4 py-2 rounded-md transition-all hover:scale-105 active:scale-95 font-medium text-sm shadow-lg ${confirmButtonStyles[variant]}`}
                                >
                                    {confirmText}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    )
}
