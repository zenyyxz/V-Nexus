import { Minus, Square, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useApp } from '../contexts/AppContext'

function TitleBarContent() {
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
    const { settings } = useApp()

    useEffect(() => {
        const check = async () => {
            try {
                // Import invoke dynamically to avoid SSR issues if any
                const { invoke } = await import('@tauri-apps/api/core')
                const isAdmin = await invoke<boolean>('check_is_admin')
                setIsAdmin(isAdmin)
            } catch (e) {
                console.error('Failed to check admin:', e)
                setIsAdmin(false)
            }
        }
        check()
    }, [])

    return (
        <div
            className="flex-1 h-full app-region-drag flex items-center pl-4 gap-4"
            onDoubleClick={(e) => e.preventDefault()}
        >
            <span className="text-[10px] text-gray-500 font-mono">
                Admin: {isAdmin === null ? (window.system ? 'YES' : 'Checking...') : (isAdmin ? 'YES' : 'NO')}
            </span>
            <div className="h-3 w-px bg-gray-700/50"></div>
            <span className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                Mode: <span className={settings.tunMode ? 'text-accent font-bold' : 'text-zinc-400'}>{settings.tunMode ? 'TUN' : 'PROXY'}</span>
            </span>
        </div>
    )
}

export function TitleBar() {
    const appWindow = getCurrentWindow()

    return (
        <div className="absolute top-0 left-0 w-full h-8 flex justify-between items-center z-50 select-none">
            {/* Drag Region */}
            <TitleBarContent />

            {/* Window Controls */}
            <div className="flex h-full app-region-no-drag">
                <button
                    onClick={() => appWindow.minimize()}
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
                    onClick={() => appWindow.close()}
                    className="h-full w-12 flex items-center justify-center hover:bg-red-500 hover:text-white text-secondary transition-colors"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    )
}
