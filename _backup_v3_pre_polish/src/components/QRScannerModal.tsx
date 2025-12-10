import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X, Camera, Image as ImageIcon, AlertCircle, Clipboard, Sliders, Monitor } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { readImage } from '@tauri-apps/plugin-clipboard-manager'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { invertImage } from '../utils/cropImage'
import { QRCropper } from './QRCropper'

interface QRScannerModalProps {
    onScan: (text: string) => void
    onClose: () => void
}

export const QRScannerModal = ({ onScan, onClose }: QRScannerModalProps) => {
    const { showToast } = useToast()
    const [isCameraRunning, setIsCameraRunning] = useState(false)
    const scannerRef = useRef<Html5Qrcode | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [cameras, setCameras] = useState<any[]>([])
    const [selectedCamera, setSelectedCamera] = useState<string>('')
    const [screenshot, setScreenshot] = useState<string | null>(null)

    // Initialize scanner instance
    useEffect(() => {
        const scanner = new Html5Qrcode("reader")
        scannerRef.current = scanner

        return () => {
            // Cleanup on unmount
            if (scannerRef.current) {
                if (scannerRef.current.isScanning) {
                    scannerRef.current.stop().then(() => {
                        scannerRef.current?.clear()
                    }).catch(err => console.error("Failed to stop scanner on unmount", err))
                } else {
                    scannerRef.current.clear()
                }
            }
        }
    }, [])

    // Handle Camera Toggle
    const toggleCamera = async () => {
        if (!scannerRef.current) return

        if (isCameraRunning) {
            try {
                await scannerRef.current.stop()
                setIsCameraRunning(false)
            } catch (err) {
                console.error("Failed to stop", err)
            }
        } else {
            setError(null)
            try {
                // Fetch cameras if not already fetched
                if (cameras.length === 0) {
                    try {
                        const devices = await Html5Qrcode.getCameras()
                        if (devices && devices.length) {
                            setCameras(devices)
                            setSelectedCamera(devices[0].id)
                        }
                    } catch (e) {
                        console.error("Permission likely denied", e)
                        // Continue anyway, maybe they have a default camera
                    }
                }

                await scannerRef.current.start(
                    selectedCamera || { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 }
                    },
                    (decodedText) => {
                        handleSuccess(decodedText)
                    },
                    () => { }
                )
                setIsCameraRunning(true)
            } catch (err: any) {
                console.error("Failed to start", err)
                setError(err.message || "Failed to start camera")
                setIsCameraRunning(false)
            }
        }
    }

    const handleSuccess = async (text: string) => {
        // Stop camera if running
        if (scannerRef.current && isCameraRunning) {
            try {
                await scannerRef.current.stop()
                setIsCameraRunning(false)
            } catch (ignore) { }
        }
        onScan(text)
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!scannerRef.current) return

        try {
            // If camera is running, stop it first?
            if (isCameraRunning) {
                await scannerRef.current.stop()
                setIsCameraRunning(false)
            }

            const result = await scannerRef.current.scanFileV2(file, true)
            handleSuccess(result.decodedText)
        } catch (err) {
            showToast('Could not find QR code in image', 'error')
        }
    }

    const handlePaste = async () => {
        try {
            const image = await readImage()
            if (!image) {
                showToast('No image found in clipboard', 'warning')
                return
            }

            // Tauri v2 Image API: size is a method returning Promise
            const rgba = await image.rgba()
            const size = await image.size()

            const canvas = document.createElement('canvas')
            canvas.width = size.width
            canvas.height = size.height
            const ctx = canvas.getContext('2d')
            if (!ctx) return

            const imageData = new ImageData(
                new Uint8ClampedArray(rgba),
                size.width,
                size.height
            )
            ctx.putImageData(imageData, 0, 0)

            canvas.toBlob(async (blob) => {
                if (!blob) return
                const file = new File([blob], "clipboard-image.png", { type: "image/png" })

                if (scannerRef.current) {
                    if (isCameraRunning) {
                        await scannerRef.current.stop()
                        setIsCameraRunning(false)
                    }
                    try {
                        const result = await scannerRef.current.scanFileV2(file, true)
                        handleSuccess(result.decodedText)
                    } catch (err) {
                        showToast('Could not decode QR code from image', 'error')
                    }
                }
            }, 'image/png')

        } catch (err) {
            console.error(err)
            showToast('Failed to read clipboard image', 'error')
        }
    }

    const handleScanScreen = async () => {
        try {
            // Minimize app
            await getCurrentWindow().minimize()

            // Wait for animation
            await new Promise(resolve => setTimeout(resolve, 500))

            // Capture
            // Invoke Rust command
            const b64 = await (window as any).api.invoke('capture_screen')

            // Restore app
            await getCurrentWindow().unminimize()
            await getCurrentWindow().setFocus()

            setScreenshot(b64)
        } catch (e: any) {
            console.error(e)
            // Ensure we restore even if capture fails
            await getCurrentWindow().unminimize()
            await getCurrentWindow().setFocus()
            showToast(e.message || 'Failed to capture screen', 'error')
        }
    }

    const handleCroppedImage = async (blob: Blob) => {
        setScreenshot(null) // Close cropper

        const scan = async (b: Blob, name: string) => {
            const file = new File([b], name, { type: "image/png" })
            return await scannerRef.current!.scanFileV2(file, true)
        }

        if (scannerRef.current) {
            if (isCameraRunning) {
                await scannerRef.current.stop()
                setIsCameraRunning(false)
            }
            try {
                const result = await scan(blob, "screen-capture.png")
                handleSuccess(result.decodedText)
            } catch (err) {
                // If normal scan fails, try inverted (dark mode support)
                try {
                    const invertedBlob = await invertImage(blob)
                    const result = await scan(invertedBlob, "screen-capture-inverted.png")
                    handleSuccess(result.decodedText)
                } catch (invertedErr) {
                    console.error("Scan failed:", invertedErr)
                    showToast('Could not decode QR code', 'error')
                }
            }
        }
    }

    const handleClose = async () => {
        if (scannerRef.current && isCameraRunning) {
            try {
                await scannerRef.current.stop()
            } catch (e) { console.error(e) }
        }
        onClose()
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
            <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative flex flex-col max-h-[90vh]">
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="p-6 pb-0">
                    <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                        Scan QR Code
                    </h3>
                </div>

                {/* Camera View Area */}
                <div className="flex-1 overflow-hidden relative bg-black flex flex-col justify-center min-h-[300px]">
                    <div id="reader" className="w-full h-full"></div>

                    {!isCameraRunning && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-secondary p-8 text-center bg-surface/50 backdrop-blur-sm">
                            <div className="bg-surface p-4 rounded-full mb-4 shadow-xl">
                                <Camera size={48} className="text-accent opacity-80" />
                            </div>
                            <p className="text-sm text-secondary mb-6">Camera is currently paused</p>
                            <button
                                onClick={toggleCamera}
                                className="px-6 py-2 bg-accent hover:bg-accent/80 text-white rounded-lg font-medium transition-all hover-lift shadow-lg flex items-center gap-2"
                            >
                                <Camera size={18} />
                                Start Camera
                            </button>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 p-4 text-center bg-black/90 z-20">
                            <AlertCircle size={48} className="mb-2" />
                            <p>{error}</p>
                            <button
                                onClick={() => { setError(null); toggleCamera(); }}
                                className="mt-4 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 rounded text-sm font-medium transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="p-6 bg-surface border-t border-border space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <label className="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg cursor-pointer transition-colors group">
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                            <ImageIcon size={18} className="text-secondary group-hover:text-primary" />
                            <span className="text-sm font-medium text-secondary group-hover:text-primary">
                                Upload Image
                            </span>
                        </label>

                        <button
                            onClick={handlePaste}
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg cursor-pointer transition-colors group text-secondary hover:text-primary"
                        >
                            <Clipboard size={18} />
                            <span className="text-sm font-medium">
                                Paste Image
                            </span>
                        </button>
                    </div>

                    {cameras.length > 1 && (
                        <div className="relative">
                            <select
                                value={selectedCamera}
                                onChange={(e) => {
                                    setSelectedCamera(e.target.value)
                                    if (isCameraRunning) {
                                        // Restart with new camera
                                        toggleCamera().then(toggleCamera)
                                    }
                                }}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-primary appearance-none focus:outline-none focus:border-accent"
                            >
                                {cameras.map(cam => (
                                    <option key={cam.id} value={cam.id}>{cam.label || `Camera ${cam.id}`}</option>
                                ))}
                            </select>
                            <Sliders size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" />
                        </div>
                    )}

                    <button
                        onClick={handleScanScreen}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors font-medium mt-2"
                    >
                        <Monitor size={18} />
                        Scan Screen
                    </button>
                    <p className="text-xs text-secondary text-center">
                        Minimizes app to capture QR codes on your desktop
                    </p>
                </div>
            </div>

            {screenshot && (
                <QRCropper
                    imageSrc={screenshot}
                    onConfirm={handleCroppedImage}
                    onCancel={() => setScreenshot(null)}
                />
            )}
        </div>
    )
}
