import subprocess
import time
import urllib.request
import socket
import sys

def test_engine():
    print("[E2E] Starting vnexus engine...")
    proc = subprocess.Popen(
        ["./build/vnexus", "--config", "config.json"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )
    time.sleep(1)

    try:
        # Check port listening
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2)
        s.connect(("127.0.0.1", 10808))
        print("[E2E] Successfully connected to Mixed Inbound on 127.0.0.1:10808")

        # Test SOCKS5 greeting
        s.sendall(b"\x05\x01\x00")
        resp = s.recv(2)
        assert resp == b"\x05\x00", f"Unexpected SOCKS5 auth resp: {resp}"
        print("[E2E] SOCKS5 Greeting & No-Auth negotiation verified: 0x05 0x00")

        # Send SOCKS5 CONNECT to 127.0.0.1:10808 (or arbitrary IP) with ATYP=IPv4 (0x01)
        # SOCKS5 request: VER(5), CMD(1), RSV(0), ATYP(1), IP(127.0.0.1), PORT(80)
        s.sendall(b"\x05\x01\x00\x01\x7f\x00\x00\x01\x00\x50")
        resp = s.recv(10)
        assert resp[:3] == b"\x05\x00\x00", f"Unexpected SOCKS5 connect resp: {resp}"
        print("[E2E] SOCKS5 CONNECT successful!")

        # Now send HTTP GET with Host header to test SNI/Host sniffing
        http_data = b"GET / HTTP/1.1\r\nHost: my-sniffed-target.lan\r\nUser-Agent: test\r\n\r\n"
        s.sendall(http_data)
        time.sleep(0.3)
        s.close()
        print("[E2E] SOCKS5 HTTP Host sniffing test completed.")

        # Test TLS ClientHello SNI sniffing over SOCKS5
        s2 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s2.connect(("127.0.0.1", 10808))
        s2.sendall(b"\x05\x01\x00")
        s2.recv(2)
        # Connect to a dummy IP (1.2.3.4:443)
        s2.sendall(b"\x05\x01\x00\x01\x01\x02\x03\x04\x01\xbb")
        s2.recv(10)

        # Build raw TLS ClientHello with SNI "cloudflare.com"
        sni = b"cloudflare.com"
        sni_len = len(sni)
        list_len = sni_len + 3
        ext_len = list_len + 2
        # Extension 0x0000 (server_name)
        ext = b"\x00\x00" + ext_len.to_bytes(2, 'big') + list_len.to_bytes(2, 'big') + b"\x00" + sni_len.to_bytes(2, 'big') + sni
        exts_len = len(ext)
        body = (
            b"\x03\x03" + # TLS 1.2
            b"\x00" * 32 + # Random
            b"\x00" +      # Session ID
            b"\x00\x02\x13\x01" + # Cipher suite
            b"\x01\x00" +  # Compression
            exts_len.to_bytes(2, 'big') + ext
        )
        hs_len = len(body)
        record = b"\x16\x03\x01" + (hs_len + 4).to_bytes(2, 'big') + b"\x01" + hs_len.to_bytes(3, 'big') + body
        s2.sendall(record)
        time.sleep(0.3)
        s2.close()
        print("[E2E] SOCKS5 TLS SNI sniffing test completed.")

    finally:
        proc.terminate()
        try:
            outs, _ = proc.communicate(timeout=2)
            print("\n--- Engine Log Output ---")
            print(outs)
        except Exception:
            proc.kill()

if __name__ == "__main__":
    test_engine()
