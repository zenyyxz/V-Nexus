export interface SystemAPI {
    getMemory: () => Promise<{ success: boolean; memory: number; error?: string }>
    getLaunchOnStartup: () => Promise<{ success: boolean; enabled: boolean; error?: string }>
    setLaunchOnStartup: (enabled: boolean) => Promise<{ success: boolean; error?: string }>
    checkAdmin: () => Promise<{ success: boolean; isAdmin: boolean }>
    restartAsAdmin: () => Promise<{ success: boolean; error?: string }>
}

export interface ElectronAPI {
    startXray: (config: string) => Promise<{ success: boolean; error?: string }>
    stopXray: () => Promise<{ success: boolean; error?: string }>
}

export interface ElectronUtils {
    fetch: (url: string) => Promise<{ success: boolean; data?: string; error?: string }>
}

declare global {
    interface Window {
        electronAPI: ElectronAPI
        utils: ElectronUtils
        system: SystemAPI // Add system here
    }
}
