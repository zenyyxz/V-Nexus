import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import QRCode from 'qrcode'
import { Profile } from '../contexts/AppContext'
import { generateLockedLink } from '../utils/profile-parser'
import { useToast } from '../contexts/ToastContext'

interface LockShareModalProps {
    profile: Profile
    onClose: () => void
}

export const LockShareModal: React.FC<LockShareModalProps> = ({ profile, onClose }) => {
    const [deviceId, setDeviceId] = useState('')
    const [qrUrl, setQrUrl] = useState<string | null>(null)
    const { showToast } = useToast()

    const handleLockAndCopy = async () => {
        if (!deviceId.trim()) return

        try {
            const link = generateLockedLink(profile, deviceId.trim())

            // 1. Copy to clipboard
            await navigator.clipboard.writeText(link)
            showToast('Locked profile link copied!', 'success')

            // 2. Generate and show QR Code
            const url = await QRCode.toDataURL(link, {
                margin: 2,
                width: 400,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            })
            setQrUrl(url)
        } catch (err) {
            console.error('Failed to generate locked share', err)
            showToast('Failed to generate link', 'error')
        }
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="w-full max-w-sm bg-[#121212] rounded-3xl shadow-2xl overflow-hidden border border-white/5"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
                        <h2 className="text-xl font-bold text-white tracking-tight">Lock and Share</h2>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-8 flex flex-col items-center">
                        {/* Visual Display */}
                        <div className="mb-8 relative group min-h-[192px] flex items-center justify-center">
                            <AnimatePresence mode="wait">
                                {qrUrl ? (
                                    <motion.div
                                        key="qr"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.2 }}
                                        className="p-3 bg-white rounded-2xl shadow-lg shadow-black/20"
                                    >
                                        <img
                                            src={qrUrl}
                                            alt="Locked Profile QR"
                                            className="w-48 h-48 object-contain"
                                        />
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="placeholder"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="grid grid-cols-2 gap-2 text-zinc-500 group-hover:text-zinc-400 transition-colors duration-500"
                                    >
                                        {/* CSS construction of QR-like pattern */}
                                        <div className="w-16 h-16 border-[6px] border-current rounded-2xl flex items-center justify-center relative">
                                            <div className="w-6 h-6 bg-current rounded-md" />
                                        </div>
                                        <div className="w-16 h-16 border-[6px] border-current rounded-2xl flex items-center justify-center relative">
                                            <div className="w-6 h-6 bg-current rounded-md" />
                                        </div>
                                        <div className="w-16 h-16 border-[6px] border-current rounded-2xl flex items-center justify-center relative">
                                            <div className="w-6 h-6 bg-current rounded-md" />
                                        </div>
                                        <div className="w-16 h-16 grid grid-cols-2 gap-2 p-1">
                                            <div className="bg-current rounded-sm opacity-60" />
                                            <div className="bg-current rounded-sm" />
                                            <div className="bg-current rounded-sm" />
                                            <div className="bg-current rounded-sm opacity-40" />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="w-full space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-zinc-400 ml-1 block text-center uppercase tracking-wider">
                                    Target Device ID
                                </label>
                                <input
                                    type="text"
                                    value={deviceId}
                                    onChange={(e) => {
                                        setDeviceId(e.target.value)
                                        if (qrUrl) setQrUrl(null)
                                    }}
                                    placeholder="Enter Target Device ID"
                                    className="w-full px-4 py-3 bg-zinc-900/50 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all font-mono text-sm text-center tracking-wide"
                                    autoFocus
                                    spellCheck={false}
                                />
                                <p className="text-[10px] text-zinc-600 text-center px-4 leading-relaxed">
                                    {qrUrl
                                        ? "QR Code generated. Link copied to clipboard."
                                        : "This profile will be strictly locked to the specified device."}
                                </p>
                            </div>

                            <button
                                onClick={handleLockAndCopy}
                                disabled={!deviceId.trim()}
                                className={`w-full py-3.5 rounded-xl font-medium transition-all shadow-lg shadow-black/20 ${!deviceId.trim()
                                        ? 'bg-zinc-800/50 text-zinc-500 cursor-not-allowed'
                                        : 'bg-zinc-800 hover:bg-zinc-700 text-white hover:scale-[1.02] active:scale-[0.98]'
                                    }`}
                            >
                                {qrUrl ? 'Copy Again' : 'Lock and Copy'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
