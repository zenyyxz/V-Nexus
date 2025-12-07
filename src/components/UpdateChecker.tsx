import { Download, CheckCircle, ExternalLink, AlertCircle } from 'lucide-react'
import { useUpdateChecker } from '../hooks/useUpdateChecker'

export const UpdateChecker = () => {
    const {
        updateAvailable,
        latestVersion,
        downloadUrl,
        checking,
        downloading,
        downloadProgress,
        updateDownloaded,
        error,
        currentVersion,
        checkForUpdates,
        downloadUpdate,
        installUpdate
    } = useUpdateChecker(false) // Manual check only for this component

    return (
        <div className="flex flex-col gap-2">
            <button
                onClick={checkForUpdates}
                disabled={checking || downloading}
                className="px-4 py-2 bg-accent hover:bg-accent/80 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {checking ? 'Checking...' : 'Check for Updates'}
            </button>

            {error && (
                <div className="flex items-center gap-2 p-2 rounded-md text-xs bg-red-500/10 border border-red-500/30">
                    <AlertCircle size={14} className="text-red-500" />
                    <p className="text-red-500 font-medium">Failed to check for updates</p>
                </div>
            )}

            {!checking && !error && latestVersion && (
                <div className={`flex flex-col gap-2 p-2 rounded-md text-xs ${updateAvailable ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-emerald-500/10 border border-emerald-500/30'}`}>
                    {updateAvailable ? (
                        <>
                            <div className="flex items-center gap-2">
                                <Download size={14} className="text-blue-500" />
                                <div className="flex-1">
                                    <p className="text-blue-500 font-medium">Update available: v{latestVersion}</p>
                                </div>
                            </div>

                            {updateDownloaded ? (
                                <button
                                    onClick={installUpdate}
                                    className="w-full px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-medium transition-colors"
                                >
                                    Install & Restart
                                </button>
                            ) : downloading ? (
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-blue-400">Downloading...</span>
                                        <span className="text-blue-400 font-medium">{downloadProgress}%</span>
                                    </div>
                                    <div className="w-full bg-zinc-700 rounded-full h-1">
                                        <div
                                            className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                                            style={{ width: `${downloadProgress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={downloadUpdate}
                                    className="w-full px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-medium transition-colors"
                                >
                                    Download Update
                                </button>
                            )}

                            <a
                                href={downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:underline flex items-center gap-1"
                            >
                                View release notes
                                <ExternalLink size={10} />
                            </a>
                        </>
                    ) : (
                        <>
                            <CheckCircle size={14} className="text-emerald-500" />
                            <p className="text-emerald-500 font-medium">You're up to date! (v{currentVersion})</p>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

