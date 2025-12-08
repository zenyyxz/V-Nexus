import { Minus, Square, X } from 'lucide-react'

export function TitleBar() {
    return (
        <div className="absolute top-0 left-0 w-full h-8 flex justify-between items-center z-50 select-none">
            {/* Drag Region */}
            <div className="flex-1 h-full app-region-drag" />

            {/* Window Controls */}
            <div className="flex h-full app-region-no-drag">
                <button
                    onClick={() => window.winControls.minimize()}
                    className="h-full w-12 flex items-center justify-center hover:bg-white/10 text-secondary hover:text-white transition-colors"
                >
                    <Minus size={16} />
                </button>
                <button
                    disabled
                    className="h-full w-12 flex items-center justify-center text-secondary/30 cursor-default"
                >
                    <Square size={14} />
                </button>
                <button
                    onClick={() => window.winControls.close()}
                    className="h-full w-12 flex items-center justify-center hover:bg-red-500 hover:text-white text-secondary transition-colors"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    )
}
