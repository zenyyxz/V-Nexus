import { ShieldAlert, RefreshCw } from 'lucide-react'

interface AdminPrivilegeBannerProps {
    onRestartAsAdmin: () => void
}

export const AdminPrivilegeBanner = ({ onRestartAsAdmin }: AdminPrivilegeBannerProps) => {
    return (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 animate-slide-down mt-8 relative z-40">
            <div className="max-w-7xl mx-auto px-4 py-2">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-yellow-500">
                        <ShieldAlert size={16} />
                        <span className="text-sm font-medium">Administrator privileges required for TUN mode</span>
                    </div>
                    <button
                        onClick={onRestartAsAdmin}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-500 rounded-md text-xs font-medium transition-colors"
                    >
                        <RefreshCw size={12} />
                        Restart as Admin
                    </button>
                </div>
            </div>
        </div>
    )
}
