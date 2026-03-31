/**
 * REST …/api/v1 基址解析、候选与 WebSocket 推导（纯前端，无服务端逻辑）。
 */
import { state } from "../store/state-core.js";

export const LOCAL_API_PROXY_BASE = "http://192.168.77.46:8000/api/v1";

/** 直连 Bovin api_server 时的默认 …/api/v1（WebSocket 等须走可连通的源） */
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

/** 是否为 RFC1918 / 回环 IPv4（用于 HTTP 下推断本机/局域网） */
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
 * HTTP 开发场景下常用聚合 …/api/v1 基址（与当前页 host 协议/网段相关）。
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

/** 清除「上次成功 REST 基址」 */
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
 * 本地开发代理根 origin（无路径）。HTTPS 页宜用当前 origin，避免混合内容。
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
 * POST /panel/* 须到达真实 API；本地静态页同源 …/api/v1 常返回 501。HTTP 开发时把已知代理基址提前。
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
    if (typeof location !== "undefined" && location.protocol === "https:" && same && !override) {
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
