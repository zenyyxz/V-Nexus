@echo off
echo ========================================
echo TUN Interface Configuration Script
echo ========================================

REM Wait for interface to be ready
timeout /t 2 /nobreak > nul

echo Setting IP address on tun0...
netsh interface ip set address name="tun0" static 10.0.0.2 255.255.255.0 10.0.0.1

echo Setting DNS on tun0...
netsh interface ip set dns name="tun0" static 1.1.1.1

echo Adding static routes for proxy server and DNS...
REM These bypass the TUN to prevent routing loops
route add 161.118.248.52 mask 255.255.255.255 10.4.2.1 metric 5
route add 1.1.1.1 mask 255.255.255.255 10.4.2.1 metric 5
route add 1.0.0.1 mask 255.255.255.255 10.4.2.1 metric 5

echo Setting default route via TUN...
REM Lower metric = higher priority
route add 0.0.0.0 mask 0.0.0.0 10.0.0.1 metric 3

echo ========================================
echo Configuration Complete!
echo ========================================
echo Test with: curl https://google.com
pause
