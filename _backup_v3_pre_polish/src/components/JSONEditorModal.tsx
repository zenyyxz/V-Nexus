import { useState, useEffect } from 'react'
import { X, Save, Code } from 'lucide-react'
import type { Profile } from '../contexts/AppContext'

interface JSONEditorModalProps {
    profile: Profile
    onClose: () => void
    onSave: (profile: Profile) => void
}

export const JSONEditorModal = ({ profile, onClose, onSave }: JSONEditorModalProps) => {
    const [jsonText, setJsonText] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [parsedData, setParsedData] = useState<any>(null)

    useEffect(() => {
        // Convert profile to formatted JSON
        const formatted = JSON.stringify(profile, null, 2)
        setJsonText(formatted)
        setParsedData(profile)
    }, [profile])

    const handleTextChange = (text: string) => {
        setJsonText(text)
        setError(null)

        // Try to parse for live preview
        try {
            const parsed = JSON.parse(text)
            setParsedData(parsed)
        } catch {
            setParsedData(null)
        }
    }

    const handleSave = () => {
        try {
            const parsed = JSON.parse(jsonText)

            // Validate required fields
            if (!parsed.id || !parsed.name || !parsed.address || !parsed.port) {
                setError('Missing required fields: id, name, address, or port')
                return
            }

            onSave(parsed as Profile)
            onClose()
        } catch (err) {
            setError('Invalid JSON format')
        }
    }

    const renderStructurePreview = (data: any, depth = 0): JSX.Element => {
        if (!data) return <div className="text-zinc-500 text-sm p-4">Invalid JSON</div>

        return (
            <div className="text-xs font-mono">
                {Object.entries(data).map(([key, value]) => (
                    <div key={key} className="py-0.5" style={{ paddingLeft: `${depth * 16}px` }}>
                        <span className="text-blue-400">{key}</span>
                        <span className="text-zinc-500">: </span>
                        {typeof value === 'object' && value !== null ? (
                            <div className="pl-4">
                                {renderStructurePreview(value, depth + 1)}
                            </div>
                        ) : (
                            <span className="text-emerald-400">
                                {typeof value === 'string' ? `"${value}"` : String(value)}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-6xl h-[85vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <Code size={20} className="text-accent" />
                        <div>
                            <h3 className="text-base font-semibold text-primary">Edit as JSON</h3>
                            <p className="text-xs text-secondary mt-0.5">{profile.name}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-800 rounded-lg text-secondary hover:text-primary transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Split View */}
                <div className="flex-1 flex overflow-hidden">
                    {/* JSON Editor */}
                    <div className="flex-1 flex flex-col border-r border-zinc-800">
                        <div className="px-4 py-2 bg-zinc-900/50 border-b border-zinc-800">
                            <h4 className="text-xs font-semibold text-primary">JSON Editor</h4>
                        </div>
                        <div className="flex-1 overflow-hidden p-4">
                            <textarea
                                value={jsonText}
                                onChange={(e) => handleTextChange(e.target.value)}
                                className="w-full h-full bg-black/60 border border-zinc-800 rounded-lg p-4 font-mono text-sm text-zinc-200 resize-none focus:outline-none focus:border-accent/50 transition-colors leading-relaxed"
                                spellCheck={false}
                            />
                        </div>
                    </div>

                    {/* Structure Preview */}
                    <div className="w-96 flex flex-col bg-zinc-900/30">
                        <div className="px-4 py-2 bg-zinc-900/50 border-b border-zinc-800">
                            <h4 className="text-xs font-semibold text-primary">Structure Preview</h4>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {renderStructurePreview(parsedData)}
                        </div>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="px-4 py-2 border-t border-zinc-800">
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-xs text-red-400">
                            {error}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-zinc-800">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-secondary hover:text-primary transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/80 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <Save size={16} />
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    )
}
