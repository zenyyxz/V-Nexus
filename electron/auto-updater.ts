import { autoUpdater } from 'electron-updater'
import { BrowserWindow } from 'electron'
import log from 'electron-log'

// Configure logging
autoUpdater.logger = log
log.transports.file.level = 'info'

export interface UpdateInfo {
    version: string
    releaseNotes?: string
    releaseName?: string
    releaseDate?: string
}

export interface DownloadProgress {
    bytesPerSecond: number
    percent: number
    transferred: number
    total: number
}

export class AutoUpdater {
    private mainWindow: BrowserWindow | null = null
    private updateDownloaded = false

    constructor() {
        this.setupEventHandlers()
    }

    setMainWindow(window: BrowserWindow) {
        this.mainWindow = window
    }

    private setupEventHandlers() {
        // Checking for update
        autoUpdater.on('checking-for-update', () => {
            log.info('Checking for update...')
            this.sendToRenderer('update-checking')
        })

        // Update available
        autoUpdater.on('update-available', (info) => {
            log.info('Update available:', info)
            this.sendToRenderer('update-available', {
                version: info.version,
                releaseNotes: info.releaseNotes,
                releaseName: info.releaseName,
                releaseDate: info.releaseDate
            })
        })

        // Update not available
        autoUpdater.on('update-not-available', (info) => {
            log.info('Update not available:', info)
            this.sendToRenderer('update-not-available', {
                version: info.version
            })
        })

        // Download progress
        autoUpdater.on('download-progress', (progressObj) => {
            log.info('Download progress:', progressObj.percent)
            this.sendToRenderer('update-download-progress', {
                bytesPerSecond: progressObj.bytesPerSecond,
                percent: progressObj.percent,
                transferred: progressObj.transferred,
                total: progressObj.total
            })
        })

        // Update downloaded
        autoUpdater.on('update-downloaded', (info) => {
            log.info('Update downloaded:', info)
            this.updateDownloaded = true
            this.sendToRenderer('update-downloaded', {
                version: info.version,
                releaseNotes: info.releaseNotes,
                releaseName: info.releaseName,
                releaseDate: info.releaseDate
            })
        })

        // Error
        autoUpdater.on('error', (error) => {
            log.error('Update error:', error)
            this.sendToRenderer('update-error', {
                message: error.message
            })
        })
    }

    private sendToRenderer(channel: string, data?: any) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(channel, data)
        }
    }

    // Check for updates
    async checkForUpdates(): Promise<void> {
        try {
            await autoUpdater.checkForUpdates()
        } catch (error) {
            log.error('Failed to check for updates:', error)
            throw error
        }
    }

    // Download update
    async downloadUpdate(): Promise<void> {
        try {
            await autoUpdater.downloadUpdate()
        } catch (error) {
            log.error('Failed to download update:', error)
            throw error
        }
    }

    // Install update and restart
    quitAndInstall(): void {
        if (this.updateDownloaded) {
            // Give the renderer process time to save state
            setTimeout(() => {
                autoUpdater.quitAndInstall(false, true)
            }, 1000)
        } else {
            log.warn('No update downloaded yet')
        }
    }

    // Cancel download (not directly supported, but we can track state)
    cancelDownload(): void {
        // electron-updater doesn't support canceling downloads
        // We just send a message to renderer to update UI
        this.sendToRenderer('update-download-cancelled')
    }
}

// Export singleton instance
export const updater = new AutoUpdater()
