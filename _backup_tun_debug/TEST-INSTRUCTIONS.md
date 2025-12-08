# Sing-Box TUN Mode Testing Instructions

## Prerequisites

- **Close V-Nexus completely** (or keep it in Xray mode for internet)
- **Run PowerShell as Administrator**

## Test 1: Basic Connectivity Test

### Step 1: Check Sing-Box Version

```powershell
cd "C:\Users\zenyy\Documents\Projects\v2ray client"
.\resources\sing-box\sing-box.exe version
```

### Step 2: Run Sing-Box with Test Config

```powershell
.\resources\sing-box\sing-box.exe run -c test-singbox-tun.json
```

**Expected Output:**

- `INFO network: updated default interface Wi-Fi`
- `INFO inbound/tun[tun-in]: started at test_tun`
- `INFO sing-box started`

**If you see errors, STOP and share them!**

### Step 3: Test Internet (in a NEW PowerShell window)

```powershell
# Test DNS
nslookup google.com

# Test HTTP
curl -v http://google.com

# Test HTTPS
curl -v https://google.com
```

**What to look for:**

- ✅ DNS resolves
- ✅ Curl connects and gets response
- ✅ In sing-box window, you see traffic logs

---

## Test 2: If Test 1 Fails - Try Without strict_route

1. **Stop sing-box** (Ctrl+C)
2. **Edit `test-singbox-tun.json`**:
   - Change `"strict_route": true` to `"strict_route": false`
3. **Run again** and test

---

## Test 3: If Test 2 Fails - Try Without sniff_override_destination

1. **Stop sing-box**
2. **Edit `test-singbox-tun.json`**:
   - Remove the line `"sniff_override_destination": true,`
3. **Run again** and test

---

## Test 4: Check What's Different from Working Xray

When Xray mode works, check:

```powershell
# Check routing table
route print

# Check network interfaces
ipconfig /all

# Check if TUN interface exists
netsh interface show interface
```

Compare with when sing-box TUN is running.

---

## Troubleshooting

### Error: "Access Denied"

- Make sure PowerShell is running as **Administrator**

### Error: "Address already in use"

- Close V-Nexus completely
- Check if sing-box is already running: `tasklist | findstr sing-box`
- Kill it: `taskkill /F /IM sing-box.exe`

### No Internet but Sing-Box Starts

- Check sing-box logs for traffic
- Try `curl -v https://google.com` and watch the logs
- Share the full output

---

## What to Share With Me

After each test, share:

1. **Sing-box startup logs** (first 20 lines)
2. **Any errors**
3. **Curl output** (if it fails)
4. **What worked/didn't work**

Let's iterate until we find what works!
