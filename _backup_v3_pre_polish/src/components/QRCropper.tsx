import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { Check, X } from 'lucide-react'
import { getCroppedImg } from '../utils/cropImage'

interface QRCropperProps {
    imageSrc: string
    onConfirm: (croppedImage: Blob) => void
    onCancel: () => void
}

export const QRCropper = ({ imageSrc, onConfirm, onCancel }: QRCropperProps) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)

    const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels)
    }, [])

    const handleConfirm = async () => {
        try {
            const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels)
            if (croppedImage) {
                onConfirm(croppedImage)
            }
        } catch (e) {
            console.error(e)
        }
    }

    return (
        <div className="absolute inset-0 z-20 bg-black flex flex-col">
            <div className="relative flex-1 bg-black">
                <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                    objectFit="contain"
                    showGrid={true}
                />
            </div>

            <div className="bg-surface border-t border-border p-4 flex justify-between items-center z-30">
                <button
                    onClick={onCancel}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/10 text-white transition-colors"
                >
                    <X size={20} />
                    Cancel
                </button>

                <div className="text-secondary text-sm">
                    Drag to position • Pinch to zoom
                </div>

                <button
                    onClick={handleConfirm}
                    className="flex items-center gap-2 px-6 py-2 bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors font-medium"
                >
                    <Check size={20} />
                    Scan Area
                </button>
            </div>
        </div>
    )
}
