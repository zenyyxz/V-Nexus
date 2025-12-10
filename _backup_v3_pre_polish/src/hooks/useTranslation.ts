import { useApp } from '../contexts/AppContext'
import { translations } from '../locales/translations'

export function useTranslation() {
    const { settings } = useApp()
    const lang = settings.language || 'English'

    const t = (key: string): string => {
        const langData = translations[lang] || translations['English']
        return langData[key] || translations['English'][key] || key
    }

    return { t, lang }
}
