import type { Profile } from '../contexts/AppContext'

export const exportProfiles = (profiles: Profile[]): string => {
    return JSON.stringify(profiles, null, 2)
}

import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

export const exportProfilesAsFile = async (profiles: Profile[], filename: string = 'v-nexus-profiles.json') => {
    const data = exportProfiles(profiles)

    // check if running in Tauri environment
    const isTauri = !!(window as any).__TAURI_INTERNALS__;

    if (isTauri) {
        try {
            const path = await save({
                defaultPath: filename,
                filters: [{
                    name: 'JSON Profile Export',
                    extensions: ['json']
                }]
            });

            if (path) {
                await writeTextFile(path, data);
            }
            return;
        } catch (e) {
            console.error("Native save failed, falling back to browser download", e);
        }
    }

    // Fallback for Web / if native fails
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

export const copyProfilesToClipboard = async (profiles: Profile[]): Promise<void> => {
    const data = exportProfiles(profiles)
    await navigator.clipboard.writeText(data)
}

export const importProfiles = (jsonString: string): Profile[] => {
    try {
        const parsed = JSON.parse(jsonString)
        if (!Array.isArray(parsed)) {
            throw new Error('Invalid format: expected array of profiles')
        }

        // Validate each profile has required fields
        for (const profile of parsed) {
            if (!profile.id || !profile.name || !profile.address || !profile.port) {
                throw new Error('Invalid profile: missing required fields')
            }
        }

        return parsed as Profile[]
    } catch (error) {
        throw new Error(`Failed to import profiles: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
}

export const importProfilesFromFile = (file: File): Promise<Profile[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = (e) => {
            try {
                const content = e.target?.result as string
                const profiles = importProfiles(content)
                resolve(profiles)
            } catch (error) {
                reject(error)
            }
        }

        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsText(file)
    })
}
