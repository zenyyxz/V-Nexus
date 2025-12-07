import { useState, useEffect, useCallback } from 'react'

interface UpdateInfo {
    updateAvailable: boolean
    latestVersion: string
    downloadUrl: string
    releaseNotes: string
    checking: boolean
    downloading: boolean
    downloadProgress: number
    updateDownloaded: boolean
    error: string | null
    dismissed: boolean
}

const CURRENT_VERSION = '2.0.0'
const STORAGE_KEY_DISMISSED = 'update_dismissed_version'

export const useUpdateChecker = (autoCheck: boolean = true) => {
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({
        updateAvailable: false,
        latestVersion: CURRENT_VERSION,
        downloadUrl: '',
        releaseNotes: '',
        checking: false,
        downloading: false,
        downloadProgress: 0,
        updateDownloaded: false,
        error: null,
        dismissed: false
    })

    // Check for updates
    const checkForUpdates = useCallback(async () => {
        try {
            setUpdateInfo(prev => ({ ...prev, checking: true, error: null }))
            await window.electron.invoke('check-for-updates')
        } catch (error) {
            console.error('Failed to check for updates:', error)
            setUpdateInfo(prev => ({
                ...prev,
                checking: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }))
        }
    }, [])

    // Download update
    const downloadUpdate = useCallback(async () => {
        try {
            setUpdateInfo(prev => ({ ...prev, downloading: true, error: null }))
            await window.electron.invoke('download-update')
        } catch (error) {
            console.error('Failed to download update:', error)
            setUpdateInfo(prev => ({
                ...prev,
                downloading: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }))
        }
    }, [])

    // Install update
    const installUpdate = useCallback(async () => {
        try {
            await window.electron.invoke('install-update')
        } catch (error) {
            console.error('Failed to install update:', error)
            setUpdateInfo(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Unknown error'
            }))
        }
    }, [])

    // Dismiss update
    const dismissUpdate = useCallback(() => {
        localStorage.setItem(STORAGE_KEY_DISMISSED, updateInfo.latestVersion)
        setUpdateInfo(prev => ({ ...prev, dismissed: true }))
    }, [updateInfo.latestVersion])

    // Listen to IPC events from main process
    useEffect(() => {
        const handleChecking = () => {
            setUpdateInfo(prev => ({ ...prev, checking: true }))
        }

        const handleUpdateAvailable = (info: any) => {
            const dismissedVersion = localStorage.getItem(STORAGE_KEY_DISMISSED)
            const dismissed = dismissedVersion === info.version

            setUpdateInfo(prev => ({
                ...prev,
                checking: false,
                updateAvailable: true,
                latestVersion: info.version,
                downloadUrl: `https://github.com/zenyyxz/V-Nexus/releases/tag/v${info.version}`,
                releaseNotes: info.releaseNotes || '',
                dismissed
            }))
        }

        const handleUpdateNotAvailable = () => {
            setUpdateInfo(prev => ({
                ...prev,
                checking: false,
                updateAvailable: false
            }))
        }

        const handleDownloadProgress = (progress: any) => {
            setUpdateInfo(prev => ({
                ...prev,
                downloading: true,
                downloadProgress: Math.round(progress.percent)
            }))
        }

        const handleUpdateDownloaded = () => {
            setUpdateInfo(prev => ({
                ...prev,
                downloading: false,
                downloadProgress: 100,
                updateDownloaded: true
            }))
        }

        const handleError = (error: any) => {
            setUpdateInfo(prev => ({
                ...prev,
                checking: false,
                downloading: false,
                error: error.message
            }))
        }

        // Register event listeners
        window.electron.on('update-checking', handleChecking)
        window.electron.on('update-available', handleUpdateAvailable)
        window.electron.on('update-not-available', handleUpdateNotAvailable)
        window.electron.on('update-download-progress', handleDownloadProgress)
        window.electron.on('update-downloaded', handleUpdateDownloaded)
        window.electron.on('update-error', handleError)

        // Auto-check on mount if enabled
        if (autoCheck) {
            checkForUpdates()
        }

        // Cleanup
        return () => {
            window.electron.removeListener('update-checking', handleChecking)
            window.electron.removeListener('update-available', handleUpdateAvailable)
            window.electron.removeListener('update-not-available', handleUpdateNotAvailable)
            window.electron.removeListener('update-download-progress', handleDownloadProgress)
            window.electron.removeListener('update-downloaded', handleUpdateDownloaded)
            window.electron.removeListener('update-error', handleError)
        }
    }, [autoCheck, checkForUpdates])

    return {
        ...updateInfo,
        checkForUpdates,
        downloadUpdate,
        installUpdate,
        dismissUpdate,
        currentVersion: CURRENT_VERSION
    }
}
