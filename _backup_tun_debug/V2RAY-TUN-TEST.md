# V2Ray Native TUN Mode Test

## CONFIRMED: V2Ray HAS Native TUN Support! ✅

V2Ray core includes a `tun` inbound protocol that creates a TUN interface natively.

## Test Configuration

The `test-v2ray-tun.json` uses:

- **Protocol**: `tun` (native V2Ray TUN inbound)
- **Interface**: `v2ray_tun`
- **IP**: 172.19.0.1/30
- **MTU**: 9000
- **DNS**: Direct to 1.1.1.1, 1.0.0.1
- **Routing**: Port 53 → direct, all other → proxy

## Testing Steps

### Step 1: Run V2Ray as Administrator

```powershell
cd "C:\Users\zenyy\Documents\Projects\v2ray client"
.\test-v2ray\v2ray.exe run -c test-v2ray-tun.json
```

### Step 2: Verify TUN Interface Created

Check if `v2ray_tun` interface appears in network connections.

### Step 3: Test DNS Resolution

```powershell
# In another PowerShell window
nslookup google.com
```

### Step 4: Test HTTP Connectivity

```powershell
curl -v https://google.com
```

## Expected Behavior

If V2Ray TUN works correctly:

1. ✅ TUN interface `v2ray_tun` created
2. ✅ DNS queries resolve (via 1.1.1.1)
3. ✅ HTTP traffic routes through proxy
4. ✅ Internet connectivity works

## Why This Should Work

V2Ray's native TUN implementation:

- Creates actual TUN interface at OS level
- Handles IP packet routing
- Supports DNS routing rules
- Proven to work (NetMod uses it!)

## Next Steps

If this works:

1. Integrate V2Ray core into V-Nexus
2. Add V2Ray TUN config generator
3. Keep Xray for system proxy mode
4. Use V2Ray for TUN mode

**This is the solution we've been looking for!** 🎯
