import { useState, useEffect, useCallback } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

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

const STORAGE_KEY_DISMISSED = 'update_dismissed_version'

export const useUpdateChecker = (autoCheck: boolean = true) => {
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({
        updateAvailable: false,
        latestVersion: '',
        downloadUrl: '',
        releaseNotes: '',
        checking: false,
        downloading: false,
        downloadProgress: 0,
        updateDownloaded: false,
        error: null,
        dismissed: false
    })

    const [currentVersion, setCurrentVersion] = useState('2.0.0')

    // Fetch current version from Tauri
    useEffect(() => {
        if (window.api) { // Or app.getVersion()
            import('@tauri-apps/api/app').then(app => {
                app.getVersion().then(setCurrentVersion)
            }).catch(console.error)
        }
    }, [])

    const checkForUpdates = useCallback(async () => {
        try {
            setUpdateInfo(prev => ({ ...prev, checking: true, error: null }))

            const update = await check()

            if (update) {
                console.log(`[Updater] Found update: v${update.version}`)
                const dismissedVersion = localStorage.getItem(STORAGE_KEY_DISMISSED)
                const dismissed = dismissedVersion === update.version

                setUpdateInfo(prev => ({
                    ...prev,
                    checking: false,
                    updateAvailable: true,
                    latestVersion: update.version,
                    downloadUrl: '', // URL is internal to plugin usually, but we can verify
                    releaseNotes: update.body || '',
                    dismissed
                }))
            } else {
                console.log(`[Updater] You are on the latest version.`)
                setUpdateInfo(prev => ({
                    ...prev,
                    checking: false,
                    updateAvailable: false
                }))
            }
        } catch (error) {
            console.error('Failed to check for updates:', error)
            setUpdateInfo(prev => ({
                ...prev,
                checking: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }))
        }
    }, [])

    const downloadUpdate = useCallback(async () => {
        try {
            setUpdateInfo(prev => ({ ...prev, downloading: true, error: null, downloadProgress: 0 }))

            const update = await check()
            if (update) {
                let downloaded = 0
                let contentLength = 0

                // Note: The plugin API calls might have changed slightly in v2.
                // update.downloadAndInstall(cb) is common.
                // Let's check docs or standard usage.
                // standard: await update.downloadAndInstall((event) => { ... })

                await update.downloadAndInstall((event: any) => {
                    switch (event.event) {
                        case 'Started':
                            contentLength = event.data.contentLength || 0
                            // console.log(`[Updater] Started downloading ${contentLength} bytes`)
                            break;
                        case 'Progress':
                            downloaded += event.data.chunkLength
                            if (contentLength > 0) {
                                const progress = (downloaded / contentLength) * 100
                                setUpdateInfo(prev => ({ ...prev, downloadProgress: Math.round(progress) }))
                            }
                            break;
                        case 'Finished':
                            console.log('[Updater] Download finished')
                            break;
                    }
                })

                setUpdateInfo(prev => ({
                    ...prev,
                    downloading: false,
                    downloadProgress: 100,
                    updateDownloaded: true
                }))
            }
        } catch (error) {
            console.error('Failed to download update:', error)
            setUpdateInfo(prev => ({
                ...prev,
                downloading: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }))
        }
    }, [])

    const installUpdate = useCallback(async () => {
        try {
            // In v2, downloadAndInstall typically handles everything and prepares for restart.
            // Using `relaunch` to restart.
            await relaunch()
        } catch (error) {
            console.error('Failed to relaunch:', error)
            setUpdateInfo(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Unknown error'
            }))
        }
    }, [])

    const dismissUpdate = useCallback(() => {
        localStorage.setItem(STORAGE_KEY_DISMISSED, updateInfo.latestVersion)
        setUpdateInfo(prev => ({ ...prev, dismissed: true }))
    }, [updateInfo.latestVersion])

    useEffect(() => {
        if (autoCheck) {
            checkForUpdates()
        }
    }, [autoCheck, checkForUpdates])

    return {
        ...updateInfo,
        checkForUpdates,
        downloadUpdate,
        installUpdate,
        dismissUpdate,
        currentVersion
    }
}
