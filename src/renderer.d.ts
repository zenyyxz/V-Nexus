export interface ElectronAPI {
    startXray: (config: string) => Promise<{ success: boolean; error?: string }>
    stopXray: () => Promise<{ success: boolean; error?: string }>
}

declare global {
    interface Window {
        electronAPI: ElectronAPI
    }
}
