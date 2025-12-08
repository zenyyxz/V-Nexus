import { useState } from 'react'
import { Save, Plus, X } from 'lucide-react'

export const RoutingEditor = () => {
    const [rules] = useState([
        { id: 1, type: 'field', outoundTag: 'block', domain: ['geosite:category-ads-all'] },
        { id: 2, type: 'field', outoundTag: 'proxy', domain: ['geosite:google'] },
        { id: 3, type: 'field', outoundTag: 'direct', domain: ['geosite:cn'] },
    ])

    return (
        <div className="h-full flex flex-col bg-surface border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border bg-background/50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary">Routing Rules</h3>
                <div className="flex gap-2">
                    <button className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-xs font-medium transition-colors border border-zinc-700">
                        <Plus size={14} />
                        Add Rule
                    </button>
                    <button className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors">
                        <Save size={14} />
                        Save
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {rules.map((rule, idx) => (
                    <div key={rule.id} className="p-3 bg-background border border-border rounded flex items-center gap-4 hover:border-zinc-700 transition-colors group">
                        <span className="text-secondary text-xs font-mono w-6 text-center">{idx + 1}</span>

                        <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                            <div className="col-span-2">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${rule.outoundTag === 'block' ? 'bg-red-500/10 text-red-500' :
                                    rule.outoundTag === 'proxy' ? 'bg-purple-500/10 text-purple-500' :
                                        'bg-emerald-500/10 text-emerald-500'
                                    }`}>
                                    {rule.outoundTag}
                                </span>
                            </div>

                            <div className="col-span-9 flex flex-wrap gap-1">
                                {rule.domain.map((d, i) => (
                                    <span key={i} className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs text-secondary font-mono">
                                        {d}
                                    </span>
                                ))}
                            </div>

                            <div className="col-span-1 flex justify-end">
                                <button className="p-1 hover:bg-white/10 rounded text-secondary hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
