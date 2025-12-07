import { useState } from 'react'
import { Plus, RefreshCw, Trash2, MoreVertical, CheckCircle2 } from 'lucide-react'

export const SubscriptionManager = () => {
    const [subscriptions, setSubscriptions] = useState([
        { id: 1, name: 'Main Provider', url: 'https://sub.example.com/v2ray', count: 12, lastUpdated: '10 mins ago' },
        { id: 2, name: 'Backup Server', url: 'https://bak.example.com/vmess', count: 5, lastUpdated: '2 days ago' },
    ])

    return (
        <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-border bg-background/50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary">Subscription Groups</h3>
                <div className="flex gap-2">
                    <button className="p-1.5 hover:bg-white/5 rounded text-secondary hover:text-primary transition-colors">
                        <RefreshCw size={14} />
                    </button>
                    <button className="p-1.5 hover:bg-white/5 rounded text-secondary hover:text-primary transition-colors">
                        <Plus size={14} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {subscriptions.map(sub => (
                    <div key={sub.id} className="group p-3 rounded-md bg-background border border-border hover:border-zinc-700 transition-all cursor-pointer">
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-primary">{sub.name}</span>
                                <CheckCircle2 size={12} className="text-emerald-500" />
                            </div>
                            <button className="text-secondary opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400">
                                <Trash2 size={12} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between text-xs text-secondary">
                            <span className="font-mono bg-zinc-800 px-1.5 py-0.5 rounded">{sub.count} Nodes</span>
                            <span>{sub.lastUpdated}</span>
                        </div>
                    </div>
                ))}

                <div className="p-8 text-center border-2 border-dashed border-border rounded-lg text-secondary text-xs hover:bg-white/5 cursor-pointer transition-colors">
                    Add Subscription Group
                </div>
            </div>
        </div>
    )
}
