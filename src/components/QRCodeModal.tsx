import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download } from 'lucide-react'
import QRCode from 'qrcode'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { useToast } from '../contexts/ToastContext'

interface QRCodeModalProps {
    data: string
    title: string
    onClose: () => void
}

export const QRCodeModal = ({ data, title, onClose }: QRCodeModalProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const { showToast } = useToast()

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [onClose])

    useEffect(() => {
        if (!canvasRef.current) return

        QRCode.toCanvas(canvasRef.current, data, {
            width: 256,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        }, (error) => {
            if (error) console.error('Error generating QR code:', error)
        })
    }, [data])

    const handleCopy = async () => {
        try {
            await writeText(data)
            showToast('URI copied to clipboard', 'success')
        } catch (err) {
            console.error('Failed to copy:', err)
            showToast('Failed to copy to clipboard', 'error')
        }
    }

    const handleDownload = async () => {
        if (!canvasRef.current) return
        try {
            const dataUrl = canvasRef.current.toDataURL('image/png')
            const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '')
            const binaryString = atob(base64Data)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i)
            }

            const sanitizedTitle = title.replace(/[^a-zA-Z0-9-_]/g, '_')
            const filePath = await save({
                filters: [{ name: 'PNG Image', extensions: ['png'] }],
                defaultPath: `${sanitizedTitle}_QR.png`
            })

            if (filePath) {
                await writeFile(filePath, bytes)
                showToast('QR Code saved successfully', 'success')
            }
        } catch (err) {
            console.error('Failed to save QR:', err)
            showToast('Failed to save QR code', 'error')
        }
    }

    return (
        <AnimatePresence>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="bg-surface border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-primary truncate pr-4">{title}</h3>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-white/5 rounded transition-all hover-lift text-secondary hover:text-primary"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="flex justify-center mb-4"
                    >
                        <canvas
                            ref={canvasRef}
                            className="border border-border rounded shadow-lg"
                            style={{ width: '256px', height: '256px' }}
                        />
                    </motion.div>

                    <div className="bg-background border border-border rounded p-3 mb-4">
                        <p className="text-xs text-secondary mb-1">Profile URI:</p>
                        <p className="text-xs font-mono text-primary break-all line-clamp-3 select-all">{data}</p>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleCopy}
                            className="flex-1 px-4 py-2 bg-accent hover:bg-accent/80 text-white rounded-md text-sm font-medium transition-all hover-lift shadow-lg"
                        >
                            Copy URI
                        </button>
                        <button
                            onClick={handleDownload}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium transition-all hover-lift shadow-lg flex items-center gap-2"
                        >
                            <Download size={16} />
                            Download
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-md text-sm font-medium transition-all hover-lift"
                        >
                            Close
                        </button>
                    </div>


                </motion.div>
            </div>
        </AnimatePresence>
    )
}
