import { Minus, Square, X } from 'lucide-react'
import { useState, useEffect } from 'react'


function TitleBarContent() {
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

    useEffect(() => {
        const check = async () => {
            try {
                const res = await window.system.checkAdmin()
                setIsAdmin(res.isAdmin)
            } catch (e) {
                console.error('Failed to check admin:', e)
                setIsAdmin(false)
            }
        }
        check()
    }, [])

    return (
        <div className="flex-1 h-full app-region-drag flex items-center pl-4">
            <span className="text-[10px] text-gray-500 font-mono">
                Admin: {isAdmin === null ? 'Checking...' : (isAdmin ? 'YES' : 'NO')}
            </span>
        </div>
    )
}

export function TitleBar() {
    return (
        <div className="absolute top-0 left-0 w-full h-8 flex justify-between items-center z-50 select-none">
            {/* Drag Region */}
            <TitleBarContent />

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
