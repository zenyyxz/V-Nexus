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
declare global {
    interface Window {
        electron: {
            ping: (address: string, port: number) => Promise<{ latency: number; success: boolean }>
            invoke: (channel: string, ...args: any[]) => Promise<any>
            on: (channel: string, callback: (...args: any[]) => void) => void
            removeListener: (channel: string, callback: (...args: any[]) => void) => void
        }
        system: {
            getMemory: () => Promise<{ success: boolean; memory: number; error?: string }>
            getLaunchOnStartup: () => Promise<{ success: boolean; enabled: boolean; error?: string }>
            setLaunchOnStartup: (enabled: boolean) => Promise<{ success: boolean; error?: string }>
        }
        utils: {
            fetch: (url: string) => Promise<{ success: boolean; data: string; error?: string }>
        }
        xray: {
            start: (profileData: any, settingsData: any) => Promise<{ success: boolean; error?: string }>
            stop: () => Promise<{ success: boolean; error?: string }>
            getLogs: () => Promise<{ success: boolean; logs: string[]; error?: string }>
            clearLogs: () => Promise<{ success: boolean; error?: string }>
            getStatus: () => Promise<{ success: boolean; running: boolean; pid?: number; error?: string }>
            getStats: () => Promise<{ success: boolean; uploaded: number; downloaded: number; error?: string }>
        }
        electronApp: {
            onTrayAction: (callback: (action: 'connect' | 'disconnect') => void) => () => void
            sendConnectionStatus: (isConnected: boolean) => void
        }
    }
}
