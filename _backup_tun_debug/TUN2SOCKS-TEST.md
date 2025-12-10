# Xray + tun2socks - CORRECT Order of Operations

## The Problem

Routes must be added **BEFORE** tun2socks starts, otherwise the physical gateway becomes unreachable.

## Complete Setup (In Order!)

### Step 1: Kill Everything & Clean Up

```powershell
taskkill /F /IM xray.exe
taskkill /F /IM tun2socks-windows-amd64.exe
route delete 0.0.0.0 mask 0.0.0.0 10.0.0.1
route delete 161.118.248.52
route delete 1.1.1.1
route delete 1.0.0.1
```

### Step 2: Add Bypass Routes FIRST (Before tun2socks!)

```powershell
route add 161.118.248.52 mask 255.255.255.255 10.4.2.1 metric 5
route add 1.1.1.1 mask 255.255.255.255 10.4.2.1 metric 5
route add 1.0.0.1 mask 255.255.255.255 10.4.2.1 metric 5
```

### Step 3: Verify Routes

```powershell
route print | findstr "161.118"
# Should show the route to 161.118.248.52 via 10.4.2.1
```

### Step 4: Start Xray (Window 1)

```powershell
cd "C:\Users\zenyy\Documents\Projects\v2ray client"
.\resources\xray\xray.exe run -c test-xray-socks.json
```

### Step 5: Start tun2socks (Window 2)

```powershell
cd "C:\Users\zenyy\Documents\Projects\v2ray client"
.\test-tun2socks\tun2socks-windows-amd64.exe -device tun://tun0 -proxy socks5://127.0.0.1:10808
```

### Step 6: Configure TUN Interface (Window 3)

```powershell
netsh interface ip set address name="tun0" static 10.0.0.2 255.255.255.0 10.0.0.1
route add 0.0.0.0 mask 0.0.0.0 10.0.0.1 metric 3
```

### Step 7: Test

```powershell
cmd /c "curl https://google.com"
```

## Key Point

The bypass routes (Step 2) MUST be added while your physical network is still the default route.
Once tun2socks starts, it captures traffic and the physical gateway becomes "unreachable".
