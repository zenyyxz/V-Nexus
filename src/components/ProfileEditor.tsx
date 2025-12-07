import { useState } from 'react'
import { X } from 'lucide-react'
import { Profile } from '../contexts/AppContext'

interface ProfileEditorProps {
    profile: Profile
    onSave: (updates: Partial<Profile>) => void
    onClose: () => void
}

export const ProfileEditor = ({ profile, onSave, onClose }: ProfileEditorProps) => {
    const [formData, setFormData] = useState({
        name: profile.name,
        group: profile.group || '',
        address: profile.address,
        port: profile.port,
        protocol: profile.protocol,
        uuid: profile.uuid || '',
        alterId: profile.alterId || 0,
        security: profile.security || 'auto',
        network: profile.network || 'tcp',
        headerType: profile.headerType || 'none',
        tls: profile.tls || '',
        sni: profile.sni || '',
        alpn: profile.alpn || '',
        fingerprint: profile.fingerprint || '',
        flow: profile.flow || '',
        encryption: profile.encryption || 'none'
    })

    const handleSave = () => {
        onSave(formData)
        onClose()
    }

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
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Remarks */}
                    <div>
                        <label className="block text-xs font-medium text-secondary mb-1.5">Remarks</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-background border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                        />
                    </div>

                    {/* Group */}
                    <div>
                        <label className="block text-xs font-medium text-secondary mb-1.5">Group (Optional)</label>
                        <input
                            type="text"
                            value={formData.group}
                            onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                            placeholder="e.g. My Servers"
                            className="w-full bg-background border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                        />
                    </div>

                    {/* Address & Port */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                            <label className="block text-xs font-medium text-secondary mb-1.5">Address</label>
                            <input
                                type="text"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                className="w-full bg-background border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-secondary mb-1.5">Port</label>
                            <input
                                type="number"
                                value={formData.port}
                                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                                className="w-full bg-background border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                            />
                        </div>
                    </div>

                    {/* User ID */}
                    <div>
                        <label className="block text-xs font-medium text-secondary mb-1.5">User ID</label>
                        <input
                            type="text"
                            value={formData.uuid}
                            onChange={(e) => setFormData({ ...formData, uuid: e.target.value })}
                            className="w-full bg-background border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm font-mono"
                        />
                    </div>

                    {/* Encrypt Method / Security */}
                    <div>
                        <label className="block text-xs font-medium text-secondary mb-1.5">Encrypt Method</label>
                        <select
                            value={formData.security}
                            onChange={(e) => setFormData({ ...formData, security: e.target.value })}
                            className="w-full bg-background border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                        >
                            <option value="auto">auto</option>
                            <option value="none">none</option>
                            <option value="aes-128-gcm">aes-128-gcm</option>
                            <option value="chacha20-poly1305">chacha20-poly1305</option>
                        </select>
                    </div>

                    {/* Flow (for VLESS) */}
                    {profile.protocol === 'vless' && (
                        <div>
                            <label className="block text-xs font-medium text-secondary mb-1.5">Flow</label>
                            <select
                                value={formData.flow}
                                onChange={(e) => setFormData({ ...formData, flow: e.target.value })}
                                className="w-full bg-background border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                            >
                                <option value="">none</option>
                                <option value="xtls-rprx-vision">xtls-rprx-vision</option>
                                <option value="xtls-rprx-direct">xtls-rprx-direct</option>
                            </select>
                        </div>
                    )}

                    {/* Transfer Protocol */}
                    <div>
                        <label className="block text-xs font-medium text-secondary mb-1.5">Transfer Protocol</label>
                        <select
                            value={formData.network}
                            onChange={(e) => setFormData({ ...formData, network: e.target.value })}
                            className="w-full bg-background border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                        >
                            <option value="tcp">tcp</option>
                            <option value="ws">ws</option>
                            <option value="h2">h2</option>
                            <option value="grpc">grpc</option>
                            <option value="quic">quic</option>
                        </select>
                    </div>

                    {/* Header Type */}
                    <div>
                        <label className="block text-xs font-medium text-secondary mb-1.5">Header Type</label>
                        <select
                            value={formData.headerType}
                            onChange={(e) => setFormData({ ...formData, headerType: e.target.value })}
                            className="w-full bg-background border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                        >
                            <option value="none">none</option>
                            <option value="http">http</option>
                        </select>
                    </div>

                    {/* TLS Type */}
                    <div>
                        <label className="block text-xs font-medium text-secondary mb-1.5">TLS Type</label>
                        <select
                            value={formData.tls}
                            onChange={(e) => setFormData({ ...formData, tls: e.target.value })}
                            className="w-full bg-background border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                        >
                            <option value="">none</option>
                            <option value="tls">tls</option>
                            <option value="xtls">xtls</option>
                        </select>
                    </div>

                    {/* Server Name Indication */}
                    <div>
                        <label className="block text-xs font-medium text-secondary mb-1.5">Server Name Indication</label>
                        <input
                            type="text"
                            value={formData.sni}
                            onChange={(e) => setFormData({ ...formData, sni: e.target.value })}
                            className="w-full bg-background border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                        />
                    </div>

                    {/* Fingerprint */}
                    <div>
                        <label className="block text-xs font-medium text-secondary mb-1.5">Fingerprint</label>
                        <select
                            value={formData.fingerprint}
                            onChange={(e) => setFormData({ ...formData, fingerprint: e.target.value })}
                            className="w-full bg-background border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                        >
                            <option value="">none</option>
                            <option value="chrome">chrome</option>
                            <option value="firefox">firefox</option>
                            <option value="safari">safari</option>
                            <option value="edge">edge</option>
                        </select>
                    </div>

                    {/* Alpn */}
                    <div>
                        <label className="block text-xs font-medium text-secondary mb-1.5">Alpn</label>
                        <select
                            value={formData.alpn}
                            onChange={(e) => setFormData({ ...formData, alpn: e.target.value })}
                            className="w-full bg-background border border-border rounded px-3 py-2 text-primary focus:outline-none focus:border-accent text-sm"
                        >
                            <option value="">none</option>
                            <option value="h2">h2</option>
                            <option value="http/1.1">http/1.1</option>
                            <option value="h2,http/1.1">h2,http/1.1</option>
                        </select>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-primary rounded text-sm font-medium border border-zinc-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-accent hover:bg-accent/80 text-white rounded text-sm font-medium transition-colors"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    )
}
