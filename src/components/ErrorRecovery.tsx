import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorBoundaryState {
    hasError: boolean
    error: Error | null
}

export const ErrorRecovery = () => {
    const [errorState, setErrorState] = useState<ErrorBoundaryState>({
        hasError: false,
        error: null
    })

    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            console.error('Global error caught:', event.error)
            setErrorState({
                hasError: true,
                error: event.error
            })
        }

        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            console.error('Unhandled promise rejection:', event.reason)
            setErrorState({
                hasError: true,
                error: new Error(event.reason)
            })
        }

        window.addEventListener('error', handleError)
        window.addEventListener('unhandledrejection', handleUnhandledRejection)

        return () => {
            window.removeEventListener('error', handleError)
            window.removeEventListener('unhandledrejection', handleUnhandledRejection)
        }
    }, [])

    const handleRecover = () => {
        setErrorState({ hasError: false, error: null })
        window.location.reload()
    }

    if (!errorState.hasError) return null

    return (
        <div className="fixed inset-0 bg-background flex items-center justify-center z-50 p-4">
            <div className="bg-surface border border-red-500/30 rounded-lg p-6 max-w-md w-full">
                <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle size={24} className="text-red-500" />
                    <h2 className="text-lg font-semibold text-primary">Something went wrong</h2>
                </div>

                <p className="text-sm text-secondary mb-4">
                    An unexpected error occurred. You can try to recover by reloading the application.
                </p>

                {errorState.error && (
                    <div className="bg-background border border-border rounded p-3 mb-4">
                        <p className="text-xs font-mono text-red-400 break-all">
                            {errorState.error.message}
                        </p>
                    </div>
                )}

                <button
                    onClick={handleRecover}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent/80 text-white rounded-md text-sm font-medium transition-colors"
                >
                    <RefreshCw size={16} />
                    Reload Application
                </button>
            </div>
        </div>
    )
}
