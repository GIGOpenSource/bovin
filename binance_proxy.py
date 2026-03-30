#!/usr/bin/env python3
"""
本地聚合代理：币安行情 + Bovin 核心 REST（同源 CORS，适合内置浏览器 / 嵌入式预览）。

- /api/v1/klines、/api/v1/ticker24hr → 币安
- 其余 /api/v1/* → 默认转发至 BOVIN_UPSTREAM（未设置则用 FREQTRADE_UPSTREAM 兼容旧名）；若均未设置则从 user_data 下 config 解析 listen_port（优先 config.api.json）。
- 若设置 BOVIN_TRADE_UPSTREAM（或 FREQTRADE_TRADE_UPSTREAM），且路径属于交易类 API（与 bovin trade 挂载的 api_trading 一致，如 /start、/status、/health），
  则转发至该地址。典型场景：主上游为 webserver（数据/回测），交易进程另端口监听，面板仍连 :19090 即可同时用 pair_history 与控制台。
  若请求无 Authorization，使用 BOVIN_PROXY_USER / BOVIN_PROXY_PASSWORD，其次 FREQTRADE_PROXY_*（默认 admin，与 api_server 默认一致）。
"""
import base64
import errno
import json
import os
import sys
from pathlib import Path
from typing import Optional
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

HOSTS = [
    "https://data-api.binance.vision",
    "https://api.binance.com",
    "https://api-gcp.binance.com",
    "https://api1.binance.com",
    "https://api2.binance.com",
    "https://api3.binance.com",
    "https://api4.binance.com",
]

def forward_binance(path_with_query: str, timeout: float = 4.0):
    api_key = os.getenv("BINANCE_API_KEY", "").strip()
    last_err = None
    for base in HOSTS:
        url = f"{base}{path_with_query}"
        try:
            req = urllib.request.Request(url, method="GET")
            req.add_header("User-Agent", "Mozilla/5.0")
            if api_key:
                req.add_header("X-MBX-APIKEY", api_key)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                body = resp.read()
                code = resp.getcode() or 200
                return code, body
        except Exception as err:
            last_err = err
    raise RuntimeError(str(last_err) if last_err else "all upstream failed")


def discover_bovin_upstream_from_user_data() -> str:
    """
    When upstream env is unset, infer http://host:port from user_data JSON
    (same source of truth as Bovin api_server).
    """
    fallback = "http://127.0.0.1:18080"
    raw = (
        os.getenv("BOVIN_USERDATA_DIR", "").strip()
        or os.getenv("FREQTRADE_USERDATA_DIR", "").strip()
    )
    if raw:
        ud = Path(raw)
    else:
        ud = Path(__file__).resolve().parent.parent / "user_data"
    if not ud.is_dir():
        return fallback
    for name in ("config.api.json", "config.json"):
        path = ud / name
        if not path.is_file():
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError):
            continue
        api = data.get("api_server")
        if not isinstance(api, dict):
            continue
        if name != "config.api.json" and not api.get("enabled"):
            continue
        host = str(api.get("listen_ip_address") or "127.0.0.1").strip()
        if host in ("0.0.0.0", "::", ""):
            host = "127.0.0.1"
        try:
            port = int(api.get("listen_port", 8080))
        except (TypeError, ValueError):
            port = 8080
        return f"http://{host}:{port}".rstrip("/")
    return fallback


def discover_freqtrade_upstream_from_user_data() -> str:
    """兼容旧名；等价于 discover_bovin_upstream_from_user_data。"""
    return discover_bovin_upstream_from_user_data()


_RESOLVED_UPSTREAM: Optional[str] = None


def _bovin_upstream_display() -> str:
    global _RESOLVED_UPSTREAM
    if _RESOLVED_UPSTREAM is not None:
        return _RESOLVED_UPSTREAM
    explicit = (
        os.getenv("BOVIN_UPSTREAM", "").strip().rstrip("/")
        or os.getenv("FREQTRADE_UPSTREAM", "").strip().rstrip("/")
    )
    _RESOLVED_UPSTREAM = explicit if explicit else discover_bovin_upstream_from_user_data()
    return _RESOLVED_UPSTREAM


def _freqtrade_upstream_display() -> str:
    """兼容旧名；与 _bovin_upstream_display 相同。"""
    return _bovin_upstream_display()


def reset_resolved_upstream_cache() -> None:
    """For tests / --print-resolved-upstream (avoid mutating process-global cache)."""
    global _RESOLVED_UPSTREAM
    _RESOLVED_UPSTREAM = None


# First path segment after /api/v1/ for routes mounted on api_trading (bovin trade) + /health (needs live RPC).
_TRADING_API_FIRST_SEGMENTS = frozenset(
    {
        "balance",
        "count",
        "daily",
        "entries",
        "exits",
        "forcebuy",
        "forceenter",
        "forceexit",
        "forcesell",
        "health",
        "locks",
        "mix_tags",
        "monthly",
        "pair_candles",
        "pause",
        "performance",
        "profit",
        "profit_all",
        "reload_config",
        "start",
        "stats",
        "status",
        "stop",
        "stopbuy",
        "stopentry",
        "trade",
        "trades",
        "weekly",
        "whitelist",
        "blacklist",
    }
)


def _bovin_trade_upstream_display() -> Optional[str]:
    raw = (
        os.getenv("BOVIN_TRADE_UPSTREAM", "").strip().rstrip("/")
        or os.getenv("FREQTRADE_TRADE_UPSTREAM", "").strip().rstrip("/")
    )
    return raw or None


def _first_segment_after_api_v1(path_with_query: str) -> Optional[str]:
    path = path_with_query.split("?", 1)[0]
    prefix = "/api/v1/"
    if not path.startswith(prefix):
        return None
    tail = path[len(prefix) :].strip("/")
    if not tail:
        return None
    return tail.split("/", 1)[0].lower()


def _route_api_v1_to_trade_upstream(path_with_query: str) -> bool:
    tu = _bovin_trade_upstream_display()
    if not tu:
        return False
    seg = _first_segment_after_api_v1(path_with_query)
    if seg is None:
        return False
    return seg in _TRADING_API_FIRST_SEGMENTS


def forward_bovin_to_base(
    base: str,
    path_with_query: str,
    method: str,
    body: Optional[bytes],
    handler: BaseHTTPRequestHandler,
    timeout: float = 120.0,
):
    base_clean = base.rstrip("/")
    url = f"{base_clean}{path_with_query}"
    auth = handler.headers.get("Authorization")
    if not auth:
        u = os.getenv(
            "BOVIN_PROXY_USER",
            os.getenv("FREQTRADE_PROXY_USER", os.getenv("FREQTRADE_USERNAME", "admin")),
        )
        p = os.getenv(
            "BOVIN_PROXY_PASSWORD",
            os.getenv("FREQTRADE_PROXY_PASSWORD", os.getenv("FREQTRADE_PASSWORD", "admin")),
        )
        token = base64.b64encode(f"{u}:{p}".encode()).decode()
        auth = f"Basic {token}"
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Authorization", auth)
    req.add_header("User-Agent", "Mozilla/5.0")
    if body:
        ct = handler.headers.get("Content-Type", "application/json")
        if ct:
            req.add_header("Content-Type", ct)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.getcode() or 200, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def forward_bovin_core(path_with_query: str, method: str, body: Optional[bytes], handler: BaseHTTPRequestHandler, timeout: float = 120.0):
    tu = _bovin_trade_upstream_display()
    base = tu if _route_api_v1_to_trade_upstream(path_with_query) else _bovin_upstream_display()
    return forward_bovin_to_base(base, path_with_query, method, body, handler, timeout=timeout)


def forward_freqtrade(path_with_query: str, method: str, body: Optional[bytes], handler: BaseHTTPRequestHandler, timeout: float = 120.0):
    """兼容旧名；转发至 Bovin 核心 REST。"""
    return forward_bovin_core(path_with_query, method, body, handler, timeout=timeout)


def humanize_freqtrade_upstream_error(err: BaseException) -> str:
    """Turn urlopen failures into a short hint for panel users (502 JSON body)."""
    upstream = _bovin_upstream_display()
    if isinstance(err, urllib.error.URLError):
        reason = err.reason
        if isinstance(reason, OSError) and reason.errno == errno.ECONNREFUSED:
            return (
                f"无法连接 Bovin REST 上游 {upstream}（连接被拒绝）。"
                "请先在本机启动带 api_server 的 Bovin 核心，"
                "或将环境变量 BOVIN_UPSTREAM（或 FREQTRADE_UPSTREAM）设为实际 API 根地址（如 http://127.0.0.1:你的端口）。"
            )
    text = str(err)
    if "Connection refused" in text or "[Errno 61]" in text:
        return (
            f"无法连接上游 {upstream}（Connection refused）。"
            "请确认该主机端口已有 API 在监听，或修正 BOVIN_UPSTREAM / FREQTRADE_UPSTREAM。"
        )
    return text


class Handler(BaseHTTPRequestHandler):
    def log_message(self, _format, *_args):
        return

    def _cors(self):
        origin = self.headers.get("Origin")
        if origin and origin != "null":
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Credentials", "true")
        else:
            self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _read_body(self):
        try:
            n = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            n = 0
        if n <= 0:
            return None
        return self.rfile.read(n)

    def _handle_freqtrade(self, path_with_query: str, method: str, body: Optional[bytes]):
        try:
            status, resp_body = forward_bovin_core(path_with_query, method, body, self)
            ct = "application/json; charset=utf-8"
            if status >= 400:
                try:
                    json.loads(resp_body.decode("utf-8"))
                except Exception:
                    ct = "text/plain; charset=utf-8"
            self.send_response(status)
            self._cors()
            self.send_header("Content-Type", ct)
            self.send_header("Content-Length", str(len(resp_body)))
            self.end_headers()
            self.wfile.write(resp_body)
        except Exception as err:
            detail = humanize_freqtrade_upstream_error(err)
            payload = json.dumps({"error": detail}, ensure_ascii=False).encode("utf-8")
            self.send_response(502)
            self._cors()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/health":
            trade_u = _bovin_trade_upstream_display()
            health_obj = {
                "ok": True,
                "service": "local-dev-proxy",
                "brand": "bovin",
                "binance_routes": ["GET /api/v1/klines", "GET /api/v1/ticker24hr"],
                "note": (
                    "Other /api/v1/* forwards to bovin_upstream with Basic auth "
                    "(e.g. /panel/binance_klines, /panel/preferences)."
                ),
                "bovin_upstream": _bovin_upstream_display(),
                "freqtrade_upstream": _bovin_upstream_display(),
            }
            if trade_u:
                health_obj["bovin_trade_upstream"] = trade_u
                health_obj["freqtrade_trade_upstream"] = trade_u
                health_obj["trade_routing_note"] = (
                    "Trading-class /api/v1/* (e.g. /start, /status, /health) are forwarded to bovin_trade_upstream; "
                    "data/webserver routes use bovin_upstream."
                )
            payload = json.dumps(health_obj).encode("utf-8")
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        q = f"?{parsed.query}" if parsed.query else ""

        if parsed.path.startswith("/api/v1/klines"):
            query = urllib.parse.parse_qs(parsed.query)
            symbol = (query.get("symbol") or ["BTCUSDT"])[0]
            interval = (query.get("interval") or ["5m"])[0]
            limit = (query.get("limit") or ["500"])[0]
            bpath = (
                f"/api/v3/klines?symbol={urllib.parse.quote(symbol)}"
                f"&interval={urllib.parse.quote(interval)}&limit={urllib.parse.quote(limit)}"
            )
            try:
                status, body = forward_binance(bpath)
                self.send_response(status)
                self._cors()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except Exception as err:
                payload = json.dumps({"error": str(err)}).encode("utf-8")
                self.send_response(502)
                self._cors()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
            return

        if parsed.path.startswith("/api/v1/ticker24hr"):
            query = urllib.parse.parse_qs(parsed.query)
            symbols = (query.get("symbols") or ["[]"])[0]
            safe_chars = '[]",'
            bpath = f"/api/v3/ticker/24hr?symbols={urllib.parse.quote(symbols, safe=safe_chars)}"
            try:
                status, body = forward_binance(bpath)
                self.send_response(status)
                self._cors()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except Exception as err:
                payload = json.dumps({"error": str(err)}).encode("utf-8")
                self.send_response(502)
                self._cors()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
            return

        if parsed.path.startswith("/api/v1/"):
            self._handle_freqtrade(parsed.path + q, "GET", None)
            return

        self.send_response(404)
        self._cors()
        self.end_headers()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        q = f"?{parsed.query}" if parsed.query else ""
        if parsed.path.startswith("/api/v1/klines") or parsed.path.startswith("/api/v1/ticker24hr"):
            self.send_response(404)
            self._cors()
            self.end_headers()
            return
        if parsed.path.startswith("/api/v1/"):
            body = self._read_body()
            self._handle_freqtrade(parsed.path + q, "POST", body)
            return
        self.send_response(404)
        self._cors()
        self.end_headers()

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        q = f"?{parsed.query}" if parsed.query else ""
        if parsed.path.startswith("/api/v1/"):
            body = self._read_body()
            self._handle_freqtrade(parsed.path + q, "DELETE", body)
            return
        self.send_response(404)
        self._cors()
        self.end_headers()


def main():
    global _RESOLVED_UPSTREAM
    _RESOLVED_UPSTREAM = None
    port = int(os.getenv("BINANCE_PROXY_PORT", "19090"))
    # 默认 0.0.0.0：手机/局域网访问 http://<宿主机IP>:前端端口 时，K 线会请求同 IP 的 19090；
    # 若仅绑定 127.0.0.1，这些请求无法到达代理。仅本机调试可设 BINANCE_PROXY_BIND=127.0.0.1
    bind = os.getenv("BINANCE_PROXY_BIND", "0.0.0.0").strip() or "0.0.0.0"
    if bind.lower() in ("localhost",):
        bind = "127.0.0.1"
    try:
        server = HTTPServer((bind, port), Handler)
    except OSError as e:
        if e.errno == errno.EADDRINUSE or "address already in use" in str(e).lower():
            print(
                f"[ERROR] 端口 {port} 已被占用（可能已有本代理在运行）。\n"
                f"  · 无需再启动：浏览器访问 http://127.0.0.1:{port}/health 或局域网 IP 同端口 /health 自检。\n"
                f"  · 若要重启：macOS/Linux 可先执行  lsof -nP -iTCP:{port} -sTCP:LISTEN  查看 PID，再  kill <PID>\n"
                f"  · 或换端口：  BINANCE_PROXY_PORT=19091 python3 .../binance_proxy.py\n"
                f"    （前端需在设置里把行情代理基址改为对应端口，或改 localStorage ft_binance_proxy_base）"
            )
            raise SystemExit(1) from e
        raise
    up = _bovin_upstream_display()
    pub = "127.0.0.1" if bind in ("127.0.0.1", "::1") else bind
    print(f"Local dev proxy on http://{bind}:{port} (try http://{pub}:{port}/health) (Binance + Bovin → {up})")
    server.serve_forever()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ("--print-resolved-upstream", "-U"):
        reset_resolved_upstream_cache()
        explicit = (
            os.getenv("BOVIN_UPSTREAM", "").strip().rstrip("/")
            or os.getenv("FREQTRADE_UPSTREAM", "").strip().rstrip("/")
        )
        print(explicit if explicit else discover_bovin_upstream_from_user_data())
        raise SystemExit(0)
    main()
