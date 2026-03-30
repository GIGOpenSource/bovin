import { state } from "./state-core.js";

export const LOCAL_API_PROXY_BASE = "http://192.168.77.46:8000/api/v1";

/** 与 binance_proxy 默认 FREQTRADE_UPSTREAM 对齐；REST 走 :19090 时 WebSocket 须直连 Bovin api_server */
export const DEFAULT_BOVIN_UPSTREAM_API_V1 = "http://192.168.77.46:8000/api/v1";

/**
 * 用户在设置里填写的 REST 根地址：若只写了 `http://host:port` 而未带 `/api/v1`，
 * 面板会把请求发到错误路径（常见 404），GET /panel/preferences 失败。
 */
export function normalizeUserRestApiV1Base(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const noTrail = s.replace(/\/+$/, "");
  const low = noTrail.toLowerCase();
  if (low.endsWith("/api/v1")) return noTrail;
  if (low.endsWith("/api")) return `${noTrail}/v1`;
  return `${noTrail}/api/v1`;
}

const LS_LAST_OK_BASE = "ft_api_base_last_ok";

/** 是否为 RFC1918 / 回环 IPv4（用于 HTTP 下推断「代理应连宿主机哪台」） */
export function isPrivateOrLoopbackLanIPv4(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (!h || h.includes(":")) return false;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const p = m.slice(1, 5).map((x) => Number(x));
  if (p.some((n) => n > 255)) return false;
  const [a, b] = p;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 127) return true;
  return false;
}

/**
 * HTTP 场景下直连 binance_proxy / 聚合端口的 /api/v1（无反代时）。
 * - 本机：192.168.77.46:8000
 * - 手机访问 http://192.168.x.x:3000 时：须连宿主机 192.168.x.x:19090（不能写 127.0.0.1）
 */
export function httpDevProxyBase() {
  try {
    if (typeof location !== "undefined" && location.protocol === "http:") {
      const host = String(location.hostname || "");
      const hl = host.toLowerCase();
      if (hl === "localhost" || hl === "127.0.0.1" || hl === "[::1]") {
        return LOCAL_API_PROXY_BASE.replace(/\/+$/, "");
      }
      if (isPrivateOrLoopbackLanIPv4(host)) {
        return `http://192.168.77.46:8000/api/v1`.replace(/\/+$/, "");
      }
    }
  } catch {
    // ignore
  }
  return LOCAL_API_PROXY_BASE.replace(/\/+$/, "");
}

export function rememberSuccessfulApiBase(base) {
  if (!base) return;
  try {
    localStorage.setItem(LS_LAST_OK_BASE, base.replace(/\/+$/, ""));
  } catch {
    // quota / private mode
  }
}

/** 清除「上次成功 REST 基址」，避免静态页 :3000 的 GET 成功把 POST 永远钉死在 501。 */
export function clearStoredPreferredApiBase() {
  try {
    localStorage.removeItem(LS_LAST_OK_BASE);
  } catch {
    // ignore
  }
}

function readPreferredBase() {
  try {
    return String(localStorage.getItem(LS_LAST_OK_BASE) || "").trim().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export function sameOriginApiV1Base() {
  try {
    const { protocol, origin } = window.location;
    if (protocol === "http:" || protocol === "https:") {
      return `${String(origin || "").replace(/\/$/, "")}/api/v1`;
    }
  } catch {
    // ignore
  }
  return "";
}

/**
 * binance_proxy 根地址（无路径）。
 * HTTPS 页面必须用当前 origin（配合 serve_https_lan 反代 /api/v1 与 /health），
 * 否则 fetch http://192.168.77.46:8000 会触发混合内容，K 线实时链路失败。
 */
export function localDevProxyOrigin() {
  try {
    if (typeof location !== "undefined" && location.protocol === "https:") {
      const o = String(location.origin || "").replace(/\/$/, "");
      if (o) return o;
    }
  } catch {
    // ignore
  }
  try {
    if (typeof location !== "undefined" && location.protocol === "http:") {
      const host = String(location.hostname || "");
      const hl = host.toLowerCase();
      if (hl === "localhost" || hl === "127.0.0.1" || hl === "[::1]") {
        const raw = String(localStorage.getItem("ft_binance_proxy_base") || "").trim().replace(/\/+$/, "");
        return raw || "http://192.168.77.46:8000";
      }
      if (isPrivateOrLoopbackLanIPv4(host)) {
        const raw = String(localStorage.getItem("ft_binance_proxy_base") || "").trim().replace(/\/+$/, "");
        if (raw) return raw;
        return `http://192.168.77.46:8000`;
      }
    }
  } catch {
    // ignore
  }
  try {
    const raw = String(localStorage.getItem("ft_binance_proxy_base") || "").trim().replace(/\/+$/, "");
    return raw || "http://192.168.77.46:8000";
  } catch {
    return "http://192.168.77.46:8000";
  }
}

export function localProxyApiV1Base() {
  return `${localDevProxyOrigin().replace(/\/+$/, "")}/api/v1`;
}

export function localProxyHealthUrl() {
  return `${localDevProxyOrigin().replace(/\/+$/, "")}/health`;
}

/** 本地静态页（如 :3000）或本机 IP 访问时，允许回退到常见本机 API 端口 */
export function isLikelyLocalDevFront() {
  try {
    const h = String(location.hostname || "").toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
  } catch {
    return false;
  }
}

export function httpNeedsDevProxyFallback() {
  try {
    if (typeof location === "undefined" || location.protocol !== "http:") return false;
    return isLikelyLocalDevFront() || isPrivateOrLoopbackLanIPv4(location.hostname || "");
  } catch {
    return false;
  }
}

/**
 * POST /panel/* 须由 Bovin 或 binance_proxy 处理；同源静态页 …/api/v1 常对 POST 返回 501。
 * 「上次成功基址」若指向前端端口会排在首位导致失败；本地 http 开发时把聚合代理提前。
 */
export function reorderBasesForPanelPost(bases) {
  const arr = Array.isArray(bases) ? bases.filter(Boolean) : [];
  if (!arr.length) return arr;
  try {
    if (typeof location === "undefined" || location.protocol !== "http:") return arr;
    if (!httpNeedsDevProxyFallback()) return arr;
    const dev = httpDevProxyBase().replace(/\/+$/, "");
    const norm = (b) => String(b || "").replace(/\/+$/, "");
    const ix = arr.findIndex((b) => norm(b) === dev);
    // 候选里没有当前页面对应的 binance_proxy（例如仅 192.168.77.46:8000 而页面在 192.168.*），POST 会先打同源静态页 → 501
    if (ix === -1) {
      return [dev, ...arr];
    }
    if (ix === 0) return arr;
    const copy = [...arr];
    const [d] = copy.splice(ix, 1);
    return [d, ...copy];
  } catch {
    return arr;
  }
}

/**
 * 所有候选 REST …/api/v1 基址（去重、未按「上次成功」重排），供延迟探测与每分钟择优。
 */
export function apiUrlBasesCandidates() {
  const devFallback = httpDevProxyBase();
  const override = normalizeUserRestApiV1Base(String(state.baseUrl || "").trim());
  let bases;
  if (override) {
    bases = [override];
    if (!override.includes(":8000")) bases.push(devFallback);
    bases = [...new Set(bases)];
  } else {
    const same = sameOriginApiV1Base();
    bases = [];
    if (same) bases.push(same);
    if (!same || httpNeedsDevProxyFallback()) {
      if (!bases.includes(devFallback)) bases.push(devFallback);
    }
    if (!bases.length) bases = [devFallback];
    try {
      if (
        location.protocol === "http:" &&
        httpNeedsDevProxyFallback() &&
        same &&
        devFallback !== same &&
        bases.includes(devFallback) &&
        bases.includes(same)
      ) {
        bases = [devFallback, ...bases.filter((b) => b !== devFallback)];
      }
    } catch {
      // ignore
    }
  }
  const same = sameOriginApiV1Base();
  try {
    if (
      typeof location !== "undefined" &&
      location.protocol === "https:" &&
      same &&
      !override
    ) {
      // 用户显式填了 Bovin Base URL 时不要用同源盖住：否则静态页 …/api/v1 会先于真实 API，POST /panel/* → 501
      const rest = bases.filter((b) => b !== same);
      bases = [same, ...rest];
    }
  } catch {
    // ignore
  }
  return bases;
}

export function apiUrlBases() {
  const bases = apiUrlBasesCandidates();
  let preferred = readPreferredBase();
  try {
    if (
      typeof location !== "undefined" &&
      location.protocol === "https:" &&
      preferred &&
      preferred.toLowerCase().startsWith("http:")
    ) {
      preferred = "";
    }
  } catch {
    // ignore
  }
  if (preferred && bases.includes(preferred)) {
    return [preferred, ...bases.filter((b) => b !== preferred)];
  }
  return bases;
}

/**
 * 对各候选基址并发探测 GET /ping 延迟，将最快可达的写入 localStorage（与 apiCall 成功时一致）。
 * `pingOnce(base)` 应返回成功解析的 JSON 或抛错。
 */
export async function probeApiBasesByPing(pingOnce) {
  const bases = apiUrlBasesCandidates().filter(Boolean);
  if (!bases.length || typeof pingOnce !== "function") return null;
  const tasks = bases.map(async (base) => {
    const b = String(base || "").replace(/\/+$/, "");
    const t0 =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
    try {
      await pingOnce(b);
      const t1 =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      return { base: b, ms: t1 - t0, ok: true };
    } catch {
      return { base: b, ms: Number.POSITIVE_INFINITY, ok: false };
    }
  });
  const rows = await Promise.all(tasks);
  const ok = rows.filter((r) => r.ok).sort((a, b) => a.ms - b.ms);
  if (ok.length) {
    rememberSuccessfulApiBase(ok[0].base);
    return {
      fastest: ok[0].base,
      fastestMs: Math.round(ok[0].ms),
      ranked: ok.map((r) => ({ base: r.base, ms: Math.round(r.ms) }))
    };
  }
  return null;
}

export function effectiveApiBasePrimary() {
  const list = apiUrlBases();
  return list[0] || "";
}

/**
 * 从指向 binance_proxy :19090 的 REST 基址推导同 host 的 Bovin api_server（默认 :18080）…/api/v1。
 * 局域网用 http://192.168.x.x:19090 时须得到 http://192.168.x.x:18080，不能写死 127.0.0.1。
 */
export function bovinUpstreamApiV1From19090RestBase(rest) {
  const raw = String(rest || "").trim().replace(/\/+$/, "");
  if (!raw || !raw.toLowerCase().includes(":19090")) return null;
  try {
    const u = new URL(raw.includes("://") ? raw : `http://${raw}`);
    if (u.port !== "19090") return DEFAULT_BOVIN_UPSTREAM_API_V1;
    const host = u.hostname;
    if (!host) return DEFAULT_BOVIN_UPSTREAM_API_V1;
    
    return `${u.protocol}//192.168.77.46:8000/api/v1`.replace(/\/+$/, "");
  } catch {
    return DEFAULT_BOVIN_UPSTREAM_API_V1;
  }
}

/**
 * WebSocket 使用的 REST 根（…/api/v1）。聚合代理仅支持 HTTP，WS 须直连 Bovin。
 * - 可填 `state.wsApiV1Base` 覆盖；
 * - 留空且当前 REST 经 :19090 代理时，推导 http://<同 host>:18080/api/v1（与 httpDevProxyBase 主机一致）。
 */
export function effectiveWsApiV1Base() {
  const override = String(state.wsApiV1Base || "").trim().replace(/\/+$/, "");
  if (override) return override;
  const rest = effectiveApiBasePrimary();
  if (!rest) return DEFAULT_BOVIN_UPSTREAM_API_V1;
  const low = rest.toLowerCase();
  if (low.includes(":8000")) {
    const derived = bovinUpstreamApiV1From19090RestBase(rest);
    return (derived || DEFAULT_BOVIN_UPSTREAM_API_V1).replace(/\/+$/, "");
  }
  try {
    const dev = httpDevProxyBase().toLowerCase();
    if (rest.toLowerCase() === dev) {
      const derived = bovinUpstreamApiV1From19090RestBase(rest);
      return (derived || DEFAULT_BOVIN_UPSTREAM_API_V1).replace(/\/+$/, "");
    }
  } catch {
    // ignore
  }
  return rest.replace(/\/+$/, "");
}
