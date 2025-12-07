export const getOrCreateDeviceId = (): string => {
    try {
        const STORAGE_KEY = 'vnexus_device_id'
        let deviceId = localStorage.getItem(STORAGE_KEY)

        if (!deviceId) {
            // Generate a random UUID as device ID
            deviceId = crypto.randomUUID()
            localStorage.setItem(STORAGE_KEY, deviceId)
        }

        return deviceId
    } catch (error) {
        console.error('Failed to access localStorage for Device ID', error)
        return 'unknown-device'
    }
}
