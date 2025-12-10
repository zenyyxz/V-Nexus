import { X } from 'lucide-react'

interface LegalDocModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    content: string
}

export const LegalDocModal = ({ isOpen, onClose, title, content }: LegalDocModalProps) => {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-surface border border-border rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-semibold text-primary">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-800 rounded-md transition-colors"
                    >
                        <X size={20} className="text-secondary" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="prose prose-invert prose-sm max-w-none">
                        <div
                            className="space-y-4 [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:text-primary [&>h1]:mb-6 [&>h2]:text-lg [&>h2]:font-semibold [&>h2]:text-primary [&>h2]:mt-8 [&>h2]:mb-4 [&>h3]:text-base [&>h3]:font-medium [&>h3]:text-primary [&>h3]:mt-6 [&>p]:text-secondary [&>ul]:text-secondary [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-2 [&_strong]:text-primary [&_a]:text-accent [&_a]:underline"
                            dangerouslySetInnerHTML={{ __html: content }}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-accent hover:bg-accent/80 text-white rounded-md transition-colors font-medium"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
