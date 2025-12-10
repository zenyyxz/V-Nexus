import { X } from 'lucide-react'
import { Profile } from '../contexts/AppContext'
import { ProfileForm } from './ProfileForm'

interface ProfileEditorProps {
    profile: Profile
    onSave: (updates: Partial<Profile>) => void
    onClose: () => void
}

export const ProfileEditor = ({ profile, onSave, onClose }: ProfileEditorProps) => {
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-surface border border-border rounded-lg w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="text-lg font-semibold text-primary">Edit Config ({profile.protocol?.toUpperCase() || 'UNKNOWN'})</h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/5 rounded text-secondary hover:text-primary transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <ProfileForm
                    profile={profile}
                    onSave={(data) => {
                        onSave(data)
                        onClose()
                    }}
                    onCancel={onClose}
                />
            </div>
        </div>
    )
}
