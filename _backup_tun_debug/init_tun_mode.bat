@echo off
setlocal
cd /d "C:\Users\zenyy\Documents\Projects\v2ray client"

echo [1/9] Terminating existing processes...
taskkill /F /IM xray.exe 2>nul
taskkill /F /IM tun2socks-windows-amd64.exe 2>nul
timeout /t 2 /nobreak >nul

echo [2/9] Cleaning old routes...
route delete 161.118.248.52 2>nul
route delete 1.1.1.1 2>nul
route delete 1.0.0.1 2>nul
route delete 0.0.0.0 mask 0.0.0.0 10.0.0.1 2>nul
route delete 0.0.0.0 mask 0.0.0.0 10.4.2.1 2>nul

echo [3/9] Adding Physical Bypass Route (Server -> WiFi)...
:: This is CRITICAL. Ensures VLESS traffic uses your WiFi.
route add 161.118.248.52 mask 255.255.255.255 192.168.8.1 metric 5

echo [4/9] Starting Xray Core...
start "Xray Core" .\resources\xray\xray.exe run -c test-xray-socks.json
timeout /t 2 /nobreak >nul

echo [5/9] Starting Tun2Socks...
start "Tun2Socks" .\test-tun2socks\tun2socks-windows-amd64.exe -device tun://tun0 -proxy socks5://127.0.0.1:10808
timeout /t 3 /nobreak >nul

echo [6/9] Configuring TUN Interface IP & Gateway (Netsh)...
:: Setting Gateway here forces Windows to use it as default route with Metric 1
netsh interface ip set address name="tun0" static 10.0.0.2 255.255.255.0 gateway=10.0.0.1 gwmetric=1
timeout /t 2 /nobreak >nul

echo [7/9] Configuring TUN DNS (PowerShell)...
powershell -ExecutionPolicy Bypass -Command "Set-DnsClientServerAddress -InterfaceAlias 'tun0' -ServerAddresses ('1.1.1.1', '1.0.0.1')"

echo [8/9] Verifying Routing Table...
:: Ensure 0.0.0.0 via 10.0.0.1 exists
route print -4 0.0.0.0

echo [9/9] Diagnostics...
echo.
echo [TEST 1] Ping Physical Gateway (192.168.8.1)
ping -n 2 192.168.8.1
echo.
echo [TEST 2] Ping Xray Server (161.118.248.52)
ping -n 2 161.118.248.52
echo.
echo [TEST 3] Ping Google (8.8.8.8) - Should go through TUN!
ping -n 2 8.8.8.8
echo.
echo [TEST 4] Curl IP-API
curl --connect-timeout 8 -v http://ip-api.com/json

echo.
pause
