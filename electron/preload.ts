import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
    ping: (address: string, port: number) => ipcRenderer.invoke('ping', { address, port }),
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    on: (channel: string, callback: (...args: any[]) => void) => {
        ipcRenderer.on(channel, (_event, ...args) => callback(...args))
    },
    removeListener: (channel: string, callback: (...args: any[]) => void) => {
        ipcRenderer.removeListener(channel, callback)
    }
})

contextBridge.exposeInMainWorld('system', {
    getMemory: () => ipcRenderer.invoke('system:memory'),
    getLaunchOnStartup: () => ipcRenderer.invoke('system:get-launch-on-startup'),
    setLaunchOnStartup: (enabled: boolean) => ipcRenderer.invoke('system:set-launch-on-startup', enabled),
    checkAdmin: () => ipcRenderer.invoke('system:check-admin'),
    restartAsAdmin: () => ipcRenderer.invoke('system:restart-as-admin')
})

contextBridge.exposeInMainWorld('utils', {
    fetch: (url: string) => ipcRenderer.invoke('utils:fetch', url)
})

contextBridge.exposeInMainWorld('winControls', {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    close: () => ipcRenderer.invoke('window:close')
})

contextBridge.exposeInMainWorld('xray', {
    start: (profileData: any, settingsData: any) => ipcRenderer.invoke('xray:start', profileData, settingsData),
    stop: () => ipcRenderer.invoke('xray:stop'),
    getLogs: () => ipcRenderer.invoke('xray:logs'),
    clearLogs: () => ipcRenderer.invoke('xray:clear-logs'),
    getStatus: () => ipcRenderer.invoke('xray:status'),
    getStats: () => ipcRenderer.invoke('xray:stats')
})

contextBridge.exposeInMainWorld('electronApp', {
    onTrayAction: (callback: (action: 'connect' | 'disconnect') => void) => {
        const handler = (_: any, action: 'connect' | 'disconnect') => callback(action)
        ipcRenderer.on('tray-action', handler)
        return () => ipcRenderer.removeListener('tray-action', handler)
    },
    sendConnectionStatus: (isConnected: boolean) => ipcRenderer.send('connection-status', isConnected)
})

// Type definitions for TypeScript
// Type definitions are in src/renderer.d.ts
