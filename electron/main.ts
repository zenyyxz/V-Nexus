import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } from 'electron'
import { exec, spawn } from 'child_process'
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
        show: true, // Force show for debugging
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            // Allow loading local resources if needed
            webSecurity: true
        },
        titleBarStyle: 'hidden',
        backgroundColor: '#09090b', // Match app background (dark theme)
        icon: getIconPath(),
        resizable: false // Enforce fixed size as per user request (and greyed restore button implication)
    })

    // Hide instead of close
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault()
            mainWindow?.hide()
            return false
        }
    })

    // Load Index
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173')
        mainWindow.webContents.openDevTools()
    } else {
        // Robust Path Checking for ASAR
        const appPath = app.getAppPath()
        const indexPath = path.join(appPath, 'dist/index.html')

        console.log('App Path:', appPath)
        console.log('Target Index Path:', indexPath)

        mainWindow.loadFile(indexPath).catch(e => {
            console.error('Failed to load primary path:', indexPath)
            console.error('Error:', e)

            // Fallback
            console.log('Attempting fallback load: dist/index.html')
            mainWindow?.loadFile('dist/index.html').catch(e2 => {
                dialog.showErrorBox('Startup Error', `Failed to load app from:\n${indexPath}\n\nFallback error: ${e2.message}`)
            })
        })

        // Disable DevTools in production
        // mainWindow.webContents.openDevTools() 
    }

    updater.setMainWindow(mainWindow)

    // Auto-check for updates on startup (only in production)
    if (process.env.NODE_ENV !== 'development') {
        setTimeout(() => {
            updater.checkForUpdates().catch(err => console.error('Auto-update check failed:', err))
        }, 3000) // Wait 3 seconds after app starts
    }
}

// App Life Cycle
app.on('ready', () => {
    createWindow()
    createTray()
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // Do nothing if tray is active, rely on explicit quit
        // app.quit() 
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// IPC Handlers
ipcMain.handle('xray:start', async (_, profileData: any, settingsData: any) => {
    try {
        console.log('Starting Xray with profile:', profileData)
        console.log('Using settings:', settingsData)

        const { tunManager } = await import('./tun_manager')

        // Force correct ports (Standard defaults)
        settingsData.socksPort = 10808
        settingsData.httpPort = 10809

        // 1. ALWAYS Start Xray (It acts as the SOCKS5 server for both modes)
        console.log('Generating Xray configuration...')
        const { generateAndSaveConfig } = await import('./xray-config-generator')
        const configPath = generateAndSaveConfig(profileData, settingsData)

        startXray(configPath)

        // 2. Mode Specific Setup
        if (settingsData.tunMode) {
            // ===== TUN MODE: Xray + Tun2Socks =====
            console.log('TUN Mode enabled - Starting TunManager...')

            // Xray acts as the socks proxy
            await tunManager.start(null, {
                serverIp: profileData.address,
                proxyPort: settingsData.socksPort,
                dnsServers: ['1.1.1.1', '1.0.0.1']
            })

        } else {
            // ===== SYSTEM PROXY MODE: Xray + System Proxy =====
            console.log('System Proxy mode - setting up system proxy')

            // Only set system proxy if the toggle is enabled
            if (settingsData.setSystemProxy) {
                await enableSystemProxy(settingsData.httpPort)
            }
        }

        // Get server IP for kill switch
        const serverIp = profileData.address

        // Enable kill switch if configured
        if (settingsData.killSwitch) {
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
        // Cleanup if failed
        killXray()
        return { success: false, error: error.message }
    }
})

ipcMain.handle('xray:stop', async () => {
    try {
        console.log('Stopping proxy...')

        const { tunManager } = await import('./tun_manager')

        // Stop TUN if running
        // Note: We might need the Server IP to clean specific routes?
        // For now, TunManager.stop() cleans what it can. 
        // Ideally we should track the active server IP in state, but TunManager handles general cleanup.
        await tunManager.stop()

        // Stop Xray
        killXray()
        // We removed killSingBox() call as we don't use it anymore

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
// Fetch URL content (bypass CORS)
ipcMain.handle('utils:fetch', async (_, url: string) => {
    try {
        const response = await fetch(url)
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        const text = await response.text()
        return { success: true, data: text }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
})

// Check if running as Admin
ipcMain.handle('system:check-admin', async () => {
    return new Promise((resolve) => {
        exec('net session', (err) => {
            resolve({ success: true, isAdmin: !err })
        })
    })
})

// Restart as Admin
ipcMain.handle('system:restart-as-admin', async () => {
    if (process.env.NODE_ENV === 'development') {
        return { success: false, error: 'Cannot auto-restart in Development mode. Please restart your terminal as Administrator.' }
    }

    const appPath = app.getPath('exe')
    console.log('Restarting as Admin:', appPath)
    spawn('powershell', ['Start-Process', `"${appPath}"`, '-Verb', 'RunAs'], { detached: true })
    app.quit()
    return { success: true }
})

// Window Controls Handlers
ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize()
})

ipcMain.handle('window:close', () => {
    if (!isQuitting) {
        mainWindow?.hide()
    } else {
        mainWindow?.close()
    }
})

app.on('before-quit', async (_event) => {
    isQuitting = true
    console.log('App is quitting, cleaning up...')
    try {
        killXray()
        await disableSystemProxy()
        await killSwitch.disable()
    } catch (e) {
        console.error('Cleanup failed:', e)
    }
})
