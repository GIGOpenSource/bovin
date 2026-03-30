#!/usr/bin/env python3
"""
在局域网通过 HTTPS 托管当前目录（静态前端）。默认监听 0.0.0.0:3443。
同时将 /api/v1/* 与 /health 反向代理到本机 HTTP 上游（默认 binance_proxy），避免
「HTTPS 页面请求 http://」的混合内容拦截；K 线（/api/v1/klines）与探活（/health）同源。

环境变量：
  FRONTEND_HTTPS_HOST        默认 0.0.0.0
  FRONTEND_HTTPS_PORT        默认 3443
  FREQTRADE_HTTPS_PROXY_UPSTREAM  默认 http://192.168.77.46:8000
      （须与浏览器里 Base URL 指向的逻辑一致：无代理则可为 http://127.0.0.1:8080 等，
       仅写 origin，不要尾斜杠；路径 /api/v1/... 由原请求保留）
"""
from __future__ import annotations

import os
import socket
import ssl
import subprocess
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
CERT_DIR = ROOT / ".certs"
CERT_FILE = CERT_DIR / "cert.pem"
KEY_FILE = CERT_DIR / "key.pem"

# 不从客户端转发的 hop-by-hop / 需重写的头
_SKIP_IN = frozenset(
    {
        "host",
        "connection",
        "content-length",
        "transfer-encoding",
        "keep-alive",
        "te",
        "trailer",
        "upgrade",
        "proxy-connection",
        "proxy-authenticate",
        "proxy-authorization",
    }
)
_SKIP_OUT = frozenset({"transfer-encoding", "connection"})


def _ensure_certs() -> None:
    CERT_DIR.mkdir(mode=0o700, exist_ok=True)
    if CERT_FILE.is_file() and KEY_FILE.is_file():
        return
    print("[serve_https_lan] 正在生成自签名证书 (.certs/) …", flush=True)
    subprocess.run(
        [
            "openssl",
            "req",
            "-x509",
            "-newkey",
            "rsa:2048",
            "-keyout",
            str(KEY_FILE),
            "-out",
            str(CERT_FILE),
            "-days",
            "825",
            "-nodes",
            "-subj",
            "/CN=bovin-panel-lan/O=dev/C=US",
        ],
        check=True,
    )
    os.chmod(KEY_FILE, 0o600)


def _guess_lan_ipv4() -> str | None:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def _upstream_host_header(upstream: str) -> str:
    p = urlparse(upstream)
    host = p.hostname or "127.0.0.1"
    port = p.port
    if port is None:
        port = 443 if (p.scheme or "http") == "https" else 80
    if (p.scheme == "http" and port == 80) or (p.scheme == "https" and port == 443):
        return host
    return f"{host}:{port}"


class _Handler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt: str, *args) -> None:
        print(f"[https] {self.address_string()} — {fmt % args}", flush=True)

    def _should_proxy(self) -> bool:
        path_only = self.path.split("?", 1)[0]
        if path_only == "/health":
            return True
        return path_only.startswith("/api/v1")

    def _read_body(self) -> bytes | None:
        if self.command in ("GET", "HEAD", "OPTIONS"):
            return None
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0:
            return None
        return self.rfile.read(length)

    def _proxy(self) -> None:
        upstream = os.environ.get("FREQTRADE_HTTPS_PROXY_UPSTREAM", "http://192.168.77.46:8000").rstrip(
            "/"
        )
        url = upstream + self.path
        body = self._read_body()
        req = Request(url, data=body, method=self.command)
        for k, v in self.headers.items():
            if k.lower() in _SKIP_IN:
                continue
            req.add_header(k, v)
        req.add_header("Host", _upstream_host_header(upstream))
        try:
            with urlopen(req, timeout=180) as resp:
                self.send_response(resp.status)
                for k, v in resp.headers.items():
                    if k.lower() in _SKIP_OUT:
                        continue
                    self.send_header(k, v)
                self.end_headers()
                self.wfile.write(resp.read())
        except HTTPError as e:
            self.send_response(e.code)
            for k, v in e.headers.items():
                if k.lower() in _SKIP_OUT:
                    continue
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(e.read() or b"")
        except URLError as e:
            self.send_response(502)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            msg = (
                f"无法连接 API 上游 {upstream}：{e!s}\n"
                "请在本机启动 binance_proxy.py 或 Bovin api_server，"
                "或设置环境变量 FREQTRADE_HTTPS_PROXY_UPSTREAM 为实际 HTTP 根地址。"
            )
            self.wfile.write(msg.encode())

    def do_GET(self) -> None:
        if self._should_proxy():
            self._proxy()
        else:
            super().do_GET()

    def do_HEAD(self) -> None:
        if self._should_proxy():
            self._proxy()
        else:
            super().do_HEAD()

    def do_POST(self) -> None:
        if self._should_proxy():
            self._proxy()
        else:
            self.send_error(405, "Method not allowed")

    def do_PUT(self) -> None:
        if self._should_proxy():
            self._proxy()
        else:
            self.send_error(405, "Method not allowed")

    def do_PATCH(self) -> None:
        if self._should_proxy():
            self._proxy()
        else:
            self.send_error(405, "Method not allowed")

    def do_DELETE(self) -> None:
        if self._should_proxy():
            self._proxy()
        else:
            self.send_error(405, "Method not allowed")

    def do_OPTIONS(self) -> None:
        if self._should_proxy():
            self._proxy()
        else:
            self.send_error(405, "Method not allowed")


def main() -> None:
    host = os.environ.get("FRONTEND_HTTPS_HOST", "0.0.0.0")
    port = int(os.environ.get("FRONTEND_HTTPS_PORT", "3443"))
    upstream = os.environ.get("FREQTRADE_HTTPS_PROXY_UPSTREAM", "http://192.168.77.46:8000").rstrip("/")
    _ensure_certs()

    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(str(CERT_FILE), str(KEY_FILE))

    httpd = ThreadingHTTPServer((host, port), _Handler)
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)

    lan = _guess_lan_ipv4()
    print(f"[serve_https_lan] 已监听 https://{host}:{port}/ （本机可试 https://127.0.0.1:{port}/）", flush=True)
    if lan:
        print(f"[serve_https_lan] 局域网其它设备: https://{lan}:{port}/", flush=True)
    print(f"[serve_https_lan] /api/v1 反代至: {upstream}", flush=True)
    print(
        "[serve_https_lan] Base URL 可留空：将与当前页同源（https://127.0.0.1:3443/api/v1）。\n"
        f"[serve_https_lan] 若 K 线仍无数据，请确认上游已启动，或设置 FREQTRADE_HTTPS_PROXY_UPSTREAM。",
        flush=True,
    )
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[serve_https_lan] 已停止。", flush=True)
        sys.exit(0)


if __name__ == "__main__":
    main()
