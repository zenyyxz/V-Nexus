import { X, Download, ExternalLink, CheckCircle } from 'lucide-react'

interface UpdateNotificationBannerProps {
    version: string
    downloadUrl: string
    downloading: boolean
    downloadProgress: number
    updateDownloaded: boolean
    onDownload: () => void
    onInstall: () => void
    onDismiss: () => void
}

export const UpdateNotificationBanner = ({
    version,
    downloadUrl,
    downloading,
    downloadProgress,
    updateDownloaded,
    onDownload,
    onInstall,
    onDismiss
}: UpdateNotificationBannerProps) => {
    return (
        <div className="bg-gradient-to-r from-accent/20 to-accent/10 border-b border-accent/30 animate-slide-down">
            <div className="max-w-7xl mx-auto px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                            {updateDownloaded ? (
                                <CheckCircle size={16} className="text-accent" />
                            ) : (
                                <Download size={16} className="text-accent" />
                            )}
                        </div>
                        <div className="flex-1">
                            {updateDownloaded ? (
                                <>
                                    <p className="text-sm font-medium text-primary">
                                        Update ready: <span className="text-accent font-semibold">v{version}</span>
                                    </p>
                                    <p className="text-xs text-secondary">
                                        Click "Install & Restart" to complete the update
                                    </p>
                                </>
                            ) : downloading ? (
                                <>
                                    <p className="text-sm font-medium text-primary">
                                        Downloading update: <span className="text-accent font-semibold">{downloadProgress}%</span>
                                    </p>
                                    <div className="w-full bg-zinc-700 rounded-full h-1.5 mt-1">
                                        <div
                                            className="bg-accent h-1.5 rounded-full transition-all duration-300"
                                            style={{ width: `${downloadProgress}%` }}
                                        ></div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm font-medium text-primary">
                                        New version available: <span className="text-accent font-semibold">v{version}</span>
                                    </p>
                                    <p className="text-xs text-secondary">
                                        Update now to get the latest features and improvements
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {updateDownloaded ? (
                            <button
                                onClick={onInstall}
                                className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent/80 text-white rounded-md text-sm font-medium transition-colors"
                            >
                                <CheckCircle size={14} />
                                Install & Restart
                            </button>
                        ) : downloading ? (
                            <button
                                disabled
                                className="flex items-center gap-1.5 px-4 py-2 bg-accent/50 text-white rounded-md text-sm font-medium cursor-not-allowed"
                            >
                                <Download size={14} className="animate-pulse" />
                                Downloading...
                            </button>
                        ) : (
                            <button
                                onClick={onDownload}
                                className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent/80 text-white rounded-md text-sm font-medium transition-colors"
                            >
                                <Download size={14} />
                                Install Update
                            </button>
                        )}

                        <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-white/10 rounded-md transition-colors text-secondary hover:text-primary"
                            title="View release notes"
                        >
                            <ExternalLink size={14} />
                        </a>

                        <button
                            onClick={onDismiss}
                            className="p-2 hover:bg-white/10 rounded-md transition-colors text-secondary hover:text-primary"
                            aria-label="Dismiss"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
