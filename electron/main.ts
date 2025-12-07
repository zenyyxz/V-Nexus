import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import { startXray, killXray } from './core-manager'
import { enableSystemProxy, disableSystemProxy } from './system-proxy'
import { killSwitch } from './killswitch'
import { updater } from './auto-updater'
import * as net from 'net'

let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null
let isQuitting = false

// TCP Ping handler
ipcMain.handle('ping', async (_event, { address, port }) => {
    return new Promise((resolve) => {
        const startTime = Date.now()
        const socket = new net.Socket()

        const timeout = setTimeout(() => {
            socket.destroy()
            resolve({ latency: 9999, success: false })
        }, 5000)

        socket.connect(port, address, () => {
            const latency = Date.now() - startTime
            clearTimeout(timeout)
            socket.destroy()
            resolve({ latency, success: true })
        })

        socket.on('error', () => {
            clearTimeout(timeout)
            socket.destroy()
            resolve({ latency: 9999, success: false })
        })
    })
})

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit()
}

const getIconPath = () => {
    if (process.env.NODE_ENV === 'development') {
        return path.join(__dirname, '../resources/icon.png')
    }
    return path.join(process.resourcesPath, 'icon.png')
}

const createTray = () => {
    const icon = nativeImage.createFromPath(getIconPath())
    tray = new Tray(icon)
    tray.setToolTip('V-Nexus')

    const updateContextMenu = (isConnected: boolean) => {
        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show V-Nexus',
                click: () => {
                    if (mainWindow) {
                        mainWindow.show()
                        if (mainWindow.isMinimized()) mainWindow.restore()
                        mainWindow.focus()
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Connect',
                enabled: !isConnected,
                click: () => {
                    mainWindow?.webContents.send('tray-action', 'connect')
                }
            },
            {
                label: 'Disconnect',
                enabled: isConnected,
                click: () => {
                    mainWindow?.webContents.send('tray-action', 'disconnect')
                }
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => {
                    isQuitting = true
                    app.quit()
                }
            }
        ])
        tray?.setContextMenu(contextMenu)
    }

    // Initial menu
    updateContextMenu(false)

    tray.on('double-click', () => {
        if (mainWindow) {
            mainWindow.show()
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
        }
    })

    // Listen for connection status updates from renderer
    ipcMain.on('connection-status', (_event, isConnected) => {
        updateContextMenu(isConnected)
        // Optionally update icon here (e.g. green icon)
    })
}

const createWindow = () => {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        minWidth: 1000,
        minHeight: 700,
        maxWidth: 1000,
        maxHeight: 700,
        frame: false, // Custom titlebar
        show: false, // Don't show until ready
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
        titleBarStyle: 'hidden',
        backgroundColor: '#09090b', // Match app background (dark theme)
        icon: getIconPath()
    })

    // Hide instead of close
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault()
            mainWindow?.hide()
            return false
        }
    })

    // Show window when ready to prevent black screen
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show()
    })

    // and load the index.html of the app.
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173')
        mainWindow.webContents.openDevTools()
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
    }

    // Initialize auto-updater with main window
    updater.setMainWindow(mainWindow)

    // Auto-check for updates on startup (only in production)
    if (process.env.NODE_ENV !== 'development') {
        setTimeout(() => {
            updater.checkForUpdates().catch(err => console.error('Auto-update check failed:', err))
        }, 3000) // Wait 3 seconds after app starts
    }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    createWindow()
    createTray()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // Do nothing if tray is active, rely on explicit quit
        // app.quit() 
    }
})

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// IPC Handlers
ipcMain.handle('xray:start', async (_, profileData: any, settingsData: any) => {
    try {
        console.log('Starting Xray with profile:', profileData)
        console.log('Using settings:', settingsData)

        const { generateAndSaveConfig } = await import('./xray-config-generator')
        const configPath = generateAndSaveConfig(profileData, settingsData)

        startXray(configPath)
        await enableSystemProxy(10809)

        // Enable kill switch if configured
        if (settingsData.killSwitch) {
            // Resolve server IP
            const serverIp = profileData.address
            const result = await killSwitch.enable(serverIp)
            if (!result.success) {
                console.error('Failed to enable kill switch:', result.error)
            }
        }

        // Notify tray
        mainWindow?.webContents.send('connection-status-changed', true)

        return { success: true }
    } catch (error: any) {
        console.error('Failed to start Xray:', error)
        return { success: false, error: error.message }
    }
})

ipcMain.handle('xray:stop', async () => {
    try {
        console.log('Stopping Xray...')
        killXray()
        await disableSystemProxy()

        // Disable kill switch
        await killSwitch.disable()

        // Notify tray
        mainWindow?.webContents.send('connection-status-changed', false)

        return { success: true }
    } catch (error: any) {
        console.error('Failed to stop Xray:', error)
        return { success: false, error: error.message }
    }
})

ipcMain.handle('xray:logs', async () => {
    try {
        const { getXrayLogs } = await import('./core-manager')
        return { success: true, logs: getXrayLogs() }
    } catch (error: any) {
        return { success: false, error: error.message, logs: [] }
    }
})

// Auto-updater IPC handlers
ipcMain.handle('check-for-updates', async () => {
    try {
        await updater.checkForUpdates()
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
})

ipcMain.handle('download-update', async () => {
    try {
        await updater.downloadUpdate()
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
})

ipcMain.handle('install-update', async () => {
    try {
        updater.quitAndInstall()
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
})

ipcMain.handle('xray:clear-logs', async () => {
    try {
        const { clearXrayLogs } = await import('./core-manager')
        clearXrayLogs()
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
})

ipcMain.handle('xray:status', async () => {
    try {
        const { isXrayRunning, getXrayPid } = await import('./core-manager')
        return {
            success: true,
            running: isXrayRunning(),
            pid: getXrayPid()
        }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
})

// Get system memory usage
ipcMain.handle('system:memory', async () => {
    try {
        const memoryUsage = process.memoryUsage()
        // Use RSS (Resident Set Size) for total memory used by the app
        const totalMemoryMB = Math.round(memoryUsage.rss / 1024 / 1024)
        return { success: true, memory: totalMemoryMB }
    } catch (error: any) {
        return { success: false, error: error.message, memory: 0 }
    }
})

// Launch on Startup handlers
ipcMain.handle('system:get-launch-on-startup', async () => {
    try {
        const settings = app.getLoginItemSettings()
        return { success: true, enabled: settings.openAtLogin }
    } catch (error: any) {
        return { success: false, error: error.message, enabled: false }
    }
})

ipcMain.handle('system:set-launch-on-startup', async (_, enabled: boolean) => {
    try {
        app.setLoginItemSettings({
            openAtLogin: enabled,
            openAsHidden: false
        })
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
})

// Get Xray stats (traffic data)
// Note: Xray needs to be configured with stats API enabled
ipcMain.handle('xray:stats', async () => {
    try {
        const { getXrayStats } = await import('./core-manager')
        const stats = await getXrayStats()
        return { success: true, ...stats }
    } catch (error: any) {
        return { success: false, error: error.message, uploaded: 0, downloaded: 0 }
    }
})

// Clean up on exit
app.on('before-quit', async () => {
    isQuitting = true // Ensure we actually quit
    killXray()
    await disableSystemProxy()
    await killSwitch.disable() // Clean up firewall rules
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
