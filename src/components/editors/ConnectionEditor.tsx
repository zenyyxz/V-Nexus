import { useState } from 'react'
import { Save, Server, Shield, Globe } from 'lucide-react'

export const ConnectionEditor = () => {
    const [protocol, setProtocol] = useState('vmess')

    return (
        <div className="h-full flex flex-col bg-surface border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border bg-background/50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary">Edit Connection</h3>
                <button className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors">
                    <Save size={14} />
                    Save
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-2 gap-6 mb-6">
                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-secondary mb-1.5">Remark Name</label>
                        <input type="text" className="w-full bg-background border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm" placeholder="My Server" />
                    </div>

                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-secondary mb-1.5">Protocol</label>
                        <div className="flex bg-background border border-border rounded p-1 gap-1">
                            {['vmess', 'vless', 'trojan', 'shadowsocks'].map(p => (
                                <button
                                    key={p}
                                    onClick={() => setProtocol(p)}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded capitalize transition-all ${protocol === p ? 'bg-zinc-700 text-white' : 'text-secondary hover:text-primary'}`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-secondary mb-1.5">Address</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-secondary"><Globe size={14} /></span>
                            <input type="text" className="w-full bg-background border border-border rounded pl-9 pr-3 py-2 text-primary focus:outline-none focus:border-accent text-sm" placeholder="example.com" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-secondary mb-1.5">Port</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-secondary"><Server size={14} /></span>
                            <input type="number" className="w-full bg-background border border-border rounded pl-9 pr-3 py-2 text-primary focus:outline-none focus:border-accent text-sm" placeholder="443" />
                        </div>
                    </div>

                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-secondary mb-1.5">UUID / Password</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-secondary"><Shield size={14} /></span>
                            <input type="text" className="w-full bg-background border border-border rounded pl-9 pr-3 py-2 text-primary focus:outline-none focus:border-accent font-mono text-sm" placeholder="uuid" />
                        </div>
                    </div>
                </div>

                {protocol === 'vmess' && (
                    <div className="space-y-4 pt-4 border-t border-border">
                        <h4 className="text-xs font-semibold text-secondary uppercase tracking-wider">Transport Settings</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-secondary mb-1.5">Network</label>
                                <select className="w-full bg-background border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm">
                                    <option>tcp</option>
                                    <option>kcp</option>
                                    <option>ws</option>
                                    <option>http</option>
                                    <option>grpc</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-secondary mb-1.5">Security</label>
                                <select className="w-full bg-background border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm">
                                    <option>auto</option>
                                    <option>aes-128-gcm</option>
                                    <option>chacha20-poly1305</option>
                                    <option>none</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
