/**
 * 基于 fetch 的 HTTP 封装：Bovin REST …/api/v1 + Basic 鉴权。
 */
import { effectiveApiBasePrimary, rememberSuccessfulApiBase } from "../api/config.js";
import { state } from "../store/state-core.js";

export class HttpError extends Error {
  /**
   * @param {string} message
   * @param {{ status: number, url: string, body?: unknown }} init
   */
  constructor(message, init) {
    super(message);
    this.name = "HttpError";
    this.status = init.status;
    this.url = init.url;
    this.body = init.body;
  }
}

function trimBase(base) {
  return String(base || "").trim().replace(/\/+$/, "");
}

function buildUrl(base, path) {
  const p = String(path || "").startsWith("/") ? path : `/${path}`;
  return `${trimBase(base)}${p}`;
}

function basicAuthHeader() {
  const u = String(state.username || "").trim();
  const p = String(state.password || "").trim();
  if (!u && !p) return {};
  try {
    const token = btoa(`${u}:${p}`);
    return { Authorization: `Basic ${token}` };
  } catch {
    return {};
  }
}

async function parseResponseBody(res) {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const text = await res.text();
  if (!text.trim()) return null;
  if (ct.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

/**
 * 对指定 …/api/v1 基址发请求（用于探测多候选基址）。
 * @param {string} baseUrl
 * @param {string} path 以 / 开头，相对 …/api/v1
 * @param {RequestInit & { json?: unknown }} [options]
 */
export async function requestAtBase(baseUrl, path, options = {}) {
  const base = trimBase(baseUrl);
  if (!base) throw new HttpError("缺少 API 基址", { status: 0, url: "" });

  const { json, headers: extraHeaders, signal, method = "GET", ...rest } = options;
  const url = path.startsWith("http") ? path : buildUrl(base, path);

  const headers = {
    Accept: "application/json",
    ...basicAuthHeader(),
    ...Object.fromEntries(
      Object.entries(extraHeaders || {}).filter(([, v]) => v != null && v !== "")
    )
  };

  let body = rest.body;
  if (json !== undefined) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    body = JSON.stringify(json);
  }

  const res = await fetch(url, { ...rest, method, headers, body, signal });

  const data = await parseResponseBody(res);

  if (res.ok) {
    rememberSuccessfulApiBase(base);
    return data;
  }

  throw new HttpError(res.statusText || `HTTP ${res.status}`, {
    status: res.status,
    url,
    body: data
  });
}

/**
 * 使用当前 effectiveApiBasePrimary() 发请求。
 * @param {string} path
 * @param {RequestInit & { json?: unknown }} [options]
 */
export async function request(path, options = {}) {
  const base = effectiveApiBasePrimary();
  if (!base) throw new HttpError("未配置 API 基址（请在设置中填写或检查同源 /api/v1）", { status: 0, url: "" });
  return requestAtBase(base, path, options);
}

export const http = {
  get(path, options) {
    return request(path, { ...options, method: "GET" });
  },
  post(path, json, options) {
    return request(path, { ...options, method: "POST", json });
  },
  put(path, json, options) {
    return request(path, { ...options, method: "PUT", json });
  },
  patch(path, json, options) {
    return request(path, { ...options, method: "PATCH", json });
  },
  delete(path, options) {
    return request(path, { ...options, method: "DELETE" });
  }
};

/**
 * 供 probeApiBasesByPing 使用：仅 GET /ping
 * @param {string} base …/api/v1
 */
export function pingBase(base) {
  return requestAtBase(base, "/ping", { method: "GET" });
}
