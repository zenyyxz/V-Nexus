import { useState } from 'react'
import { Plus, RefreshCw, Trash2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { useApp, Subscription, Profile } from '../contexts/AppContext'
import { useToast } from '../contexts/ToastContext'
import { parseSubscriptionContent } from '../utils/profile-parser'

export const SubscriptionManager = () => {
    const { subscriptions, addSubscription, removeSubscription, updateSubscription, addProfile, removeProfile, profiles } = useApp()
    const { showToast } = useToast()
    const [isAdding, setIsAdding] = useState(false)
    const [newUrl, setNewUrl] = useState('')
    const [newName, setNewName] = useState('')
    const [loadingSubId, setLoadingSubId] = useState<string | null>(null)

    const fetchSubscriptionData = async (url: string): Promise<Profile[] | null> => {
        try {
            const result = await window.appUtils.fetch(url)
            if (result.success && result.data) {
                return parseSubscriptionContent(result.data)
            } else {
                throw new Error(result.error || 'Failed to fetch')
            }
        } catch (error: any) {
            console.error('Subscription fetch failed:', error)
            showToast(`Failed to update subscription: ${error.message}`, 'error')
            return null
        }
    }

    const handleAddSubscription = async () => {
        if (!newUrl) return

        const id = crypto.randomUUID()
        setLoadingSubId(id) // Use temp ID for loading state

        try {
            showToast('Fetching subscription...', 'info')
            const fetchedProfiles = await fetchSubscriptionData(newUrl)

            if (fetchedProfiles) {
                const newSub: Subscription = {
                    id,
                    name: newName || 'New Subscription',
                    url: newUrl,
                    updatedAt: new Date().toISOString(),
                    count: fetchedProfiles.length
                }

                addSubscription(newSub)

                // Add profiles with subscriptionId
                fetchedProfiles.forEach(p => {
                    p.subscriptionId = id
                    p.group = newSub.name // Auto-group by subscription name
                    addProfile(p)
                })

                showToast(`Added ${fetchedProfiles.length} profiles`, 'success')
                setIsAdding(false)
                setNewUrl('')
                setNewName('')
            }
        } finally {
            setLoadingSubId(null)
        }
    }

    const handleUpdateSubscription = async (sub: Subscription) => {
        setLoadingSubId(sub.id)
        try {
            showToast(`Updating ${sub.name}...`, 'info')
            const fetchedProfiles = await fetchSubscriptionData(sub.url)

            if (fetchedProfiles) {
                // 1. Remove old profiles for this sub
                // We need to find them first to avoid removing user modifications if we want smart update?
                // For now, simpler: remove all old, add all new.
                const oldProfileIds = profiles.filter(p => p.subscriptionId === sub.id).map(p => p.id)
                oldProfileIds.forEach(id => removeProfile(id))

                // 2. Add new profiles
                fetchedProfiles.forEach(p => {
                    p.subscriptionId = sub.id
                    p.group = sub.name
                    addProfile(p)
                })

                // 3. Update subscription metadata
                updateSubscription(sub.id, {
                    updatedAt: new Date().toISOString(),
                    count: fetchedProfiles.length
                })

                showToast(`Updated ${sub.name}: ${fetchedProfiles.length} profiles`, 'success')
            }
        } finally {
            setLoadingSubId(null)
        }
    }

    const handleDeleteSubscription = (sub: Subscription) => {
        if (confirm(`Delete subscription "${sub.name}" and all its profiles?`)) {
            removeSubscription(sub.id)
            showToast('Subscription deleted', 'success')
        }
    }

    const handleUpdateAll = async () => {
        for (const sub of subscriptions) {
            await handleUpdateSubscription(sub)
        }
    }

    return (
        <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-border bg-background/50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary">Subscription Groups</h3>
                <div className="flex gap-2">
                    <button
                        onClick={handleUpdateAll}
                        disabled={loadingSubId !== null}
                        className="p-1.5 hover:bg-white/5 rounded text-secondary hover:text-primary transition-colors disabled:opacity-50"
                        title="Update All"
                    >
                        <RefreshCw size={14} className={loadingSubId === 'all' ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        className={`p-1.5 hover:bg-white/5 rounded transition-colors ${isAdding ? 'text-accent' : 'text-secondary hover:text-primary'}`}
                        title="Add Subscription"
                    >
                        <Plus size={14} className={isAdding ? 'rotate-45 transition-transform' : 'transition-transform'} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {isAdding && (
                    <div className="p-3 rounded-md bg-background border border-border animate-fade-in space-y-3">
                        <input
                            type="text"
                            placeholder="Subscription Name (Optional)"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-primary focus:outline-none focus:border-accent"
                        />
                        <input
                            type="text"
                            placeholder="Subscription URL (https://...)"
                            value={newUrl}
                            onChange={e => setNewUrl(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-primary focus:outline-none focus:border-accent"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setIsAdding(false)}
                                className="px-3 py-1.5 text-xs text-secondary hover:text-primary transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddSubscription}
                                disabled={!newUrl || loadingSubId !== null}
                                className="px-3 py-1.5 bg-accent hover:bg-accent/80 text-white rounded text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {loadingSubId && !subscriptions.some(s => s.id === loadingSubId) ? <Loader2 size={12} className="animate-spin" /> : null}
                                Add
                            </button>
                        </div>
                    </div>
                )}

                {subscriptions.length === 0 && !isAdding ? (
                    <div
                        onClick={() => setIsAdding(true)}
                        className="p-8 text-center border-2 border-dashed border-border rounded-lg text-secondary text-xs hover:bg-white/5 cursor-pointer transition-colors flex flex-col items-center gap-2"
                    >
                        <Plus size={24} className="opacity-50" />
                        <span>Add Subscription Group</span>
                    </div>
                ) : (
                    subscriptions.map(sub => (
                        <div key={sub.id} className="group p-3 rounded-md bg-background border border-border hover:border-zinc-700 transition-all">
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm text-primary">{sub.name}</span>
                                    {sub.count > 0 ? (
                                        <CheckCircle2 size={12} className="text-emerald-500" />
                                    ) : (
                                        <AlertCircle size={12} className="text-yellow-500" />
                                    )}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleUpdateSubscription(sub)}
                                        disabled={loadingSubId === sub.id}
                                        className="p-1 hover:bg-zinc-800 rounded text-secondary hover:text-blue-400 transition-colors"
                                        title="Update"
                                    >
                                        <RefreshCw size={12} className={loadingSubId === sub.id ? 'animate-spin' : ''} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteSubscription(sub)}
                                        className="p-1 hover:bg-zinc-800 rounded text-secondary hover:text-red-400 transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between text-xs text-secondary">
                                <span className="font-mono bg-zinc-800 px-1.5 py-0.5 rounded">{sub.count} Nodes</span>
                                <span>{new Date(sub.updatedAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
