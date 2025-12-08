export interface ElectronAPI {
    ping: (address: string, port: number) => Promise<{ latency: number; success: boolean }>
    invoke: (channel: string, ...args: any[]) => Promise<any>
    on: (channel: string, callback: (...args: any[]) => void) => void
    removeListener: (channel: string, callback: (...args: any[]) => void) => void
}

export interface SystemAPI {
    getMemory: () => Promise<{ success: boolean; memory: number; error?: string }>
    getLaunchOnStartup: () => Promise<{ success: boolean; enabled: boolean; error?: string }>
    setLaunchOnStartup: (enabled: boolean) => Promise<{ success: boolean; error?: string }>
    checkAdmin: () => Promise<{ success: boolean; isAdmin: boolean }>
    restartAsAdmin: () => Promise<{ success: boolean; error?: string }>
}

export interface XrayAPI {
    start: (profileData: any, settingsData: any) => Promise<{ success: boolean; error?: string }>
    stop: () => Promise<{ success: boolean; error?: string }>
    getLogs: () => Promise<{ success: boolean; logs: string[]; error?: string }>
    clearLogs: () => Promise<{ success: boolean; error?: string }>
    getStatus: () => Promise<{ success: boolean; running: boolean; pid?: number; error?: string }>
    getStats: () => Promise<{ success: boolean; uploaded: number; downloaded: number; error?: string }>
}

export interface ElectronAppAPI {
    onTrayAction: (callback: (action: 'connect' | 'disconnect') => void) => () => void
    sendConnectionStatus: (isConnected: boolean) => void
}

export interface ElectronUtils {
    fetch: (url: string) => Promise<{ success: boolean; data: string; error?: string }>
}

export interface WindowAPI {
    minimize: () => Promise<void>
    close: () => Promise<void>
}

declare global {
    interface Window {
        electron: ElectronAPI
        system: SystemAPI
        xray: XrayAPI
        electronApp: ElectronAppAPI
        utils: ElectronUtils
        winControls: WindowAPI
    }
}
