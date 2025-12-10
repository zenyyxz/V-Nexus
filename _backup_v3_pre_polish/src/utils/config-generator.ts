export interface V2RayConfig {
    log: {
        loglevel: string
    }
    inbounds: Inbound[]
    outbounds: Outbound[]
    routing: Routing
}

interface Inbound {
    port: number
    protocol: string
    settings: any
    sniffing: {
        enabled: boolean
        destOverride: string[]
    }
}

interface Outbound {
    protocol: string
    settings: any
    streamSettings?: any
    tag?: string
}

interface Routing {
    domainStrategy: string
    rules: Rule[]
}

interface Rule {
    type: string
    domain?: string[]
    ip?: string[]
    outboundTag: string
}

export const generateConfig = (server: any): V2RayConfig => {
    // Logic to convert server object to V2Ray JSON
    // This is a basic template.

    return {
        log: {
            loglevel: "warning"
        },
        inbounds: [
            {
                port: 10808,
                protocol: "socks",
                settings: {
                    auth: "noauth",
                    udp: true
                },
                sniffing: {
                    enabled: true,
                    destOverride: ["http", "tls"]
                }
            },
            {
                port: 10809,
                protocol: "http",
                settings: {},
                sniffing: {
                    enabled: true,
                    destOverride: ["http", "tls"]
                }
            }
        ],
        outbounds: [
            {
                protocol: server.protocol, // "vmess", "vless", "trojan"
                settings: {
                    vnext: [
                        {
                            address: server.address,
                            port: parseInt(server.port),
                            users: [
                                {
                                    id: server.uuid,
                                    alterId: 0,
                                    security: "auto",
                                    level: 0
                                }
                            ]
                        }
                    ]
                },
                streamSettings: {
                    network: server.network || "tcp",
                    security: server.tls ? "tls" : "none",
                    wsSettings: server.network === "ws" ? {
                        path: server.path || "/"
                    } : undefined
                },
                tag: "proxy"
            },
            {
                protocol: "freedom",
                settings: {},
                tag: "direct"
            },
            {
                protocol: "blackhole",
                settings: {},
                tag: "block"
            }
        ],
        routing: {
            domainStrategy: "IPIfNonMatch",
            rules: [
                {
                    type: "field",
                    domain: ["geosite:category-ads-all"],
                    outboundTag: "block"
                },
                {
                    type: "field",
                    domain: ["geosite:cn"],
                    outboundTag: "direct"
                },
                {
                    type: "field",
                    ip: ["geoip:cn", "geoip:private"],
                    outboundTag: "direct"
                }
            ]
        }
    }
}
