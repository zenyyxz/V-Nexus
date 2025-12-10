export interface AppAPI {
    ping: (address: string, port: number) => Promise<{ latency: number; success: boolean }>
    invoke: (channel: string, ...args: any[]) => Promise<any>
    on: (channel: string, callback: (...args: any[]) => void) => Promise<() => void> // Updated to return unlisten promise
    removeListener: (channel: string, callback: (...args: any[]) => void) => void
}

export interface SystemAPI {
    getMemory: () => Promise<{ success: boolean; memory: number; error?: string }>
    getLaunchOnStartup: () => Promise<{ success: boolean; enabled: boolean; error?: string }>
    setLaunchOnStartup: (enabled: boolean) => Promise<{ success: boolean; error?: string }>
    checkAdmin: () => Promise<boolean>
    restartAsAdmin: () => Promise<{ success: boolean; error?: string }>
    getVersion: () => Promise<string>
    resolveHostname: (hostname: string) => Promise<string>
}

export interface XrayAPI {
    start: (profileData: any, settingsData: any, onStatus?: (msg: string) => void, customConfig?: string | null) => Promise<{ success: boolean; error?: string }>
    stop: () => Promise<{ success: boolean; error?: string }>
    getLogs: () => Promise<{ success: boolean; logs: string[]; error?: string }>
    clearLogs: () => Promise<{ success: boolean; error?: string }>
    getStatus: () => Promise<{ success: boolean; running: boolean; pid?: number; error?: string }>
    getStats: () => Promise<{ success: boolean; uploaded: number; downloaded: number; error?: string }>
}

export interface AppEventsAPI {
    onTrayAction: (callback: (action: 'connect' | 'disconnect') => void) => () => void
    sendConnectionStatus: (isConnected: boolean) => void
}

export interface AppUtils {
    fetch: (url: string) => Promise<{ success: boolean; data: string; error?: string }>
}

export interface WindowAPI {
    minimize: () => Promise<void>
    close: () => Promise<void>
}

declare global {
    interface Window {
        api: AppAPI
        system: SystemAPI
        xray: XrayAPI
        appEvents: AppEventsAPI
        appUtils: AppUtils
        winControls: WindowAPI
    }
}
