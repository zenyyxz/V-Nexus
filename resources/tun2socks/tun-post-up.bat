@echo off
REM Configure TUN interface IP and routes
netsh interface ip set address name="tun0" static 10.0.0.1 255.255.255.0
netsh interface ip set dns name="tun0" static 1.1.1.1
route add 0.0.0.0 mask 0.0.0.0 10.0.0.1 metric 3 if %1
