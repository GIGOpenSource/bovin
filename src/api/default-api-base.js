/** 线上服务器地址 */
const PROD_REST_ORIGIN = "http://101.32.179.223:8680";
const PROD_DOWNLOAD_REST_ORIGIN = "http://101.32.179.223:8681";

/** 本地服务器地址 */
const LOCAL_REST_ORIGIN = "http://127.0.0.1:8680";
const LOCAL_DOWNLOAD_REST_ORIGIN = "http://127.0.0.1:8681";

/** 判断是否为本地环境（localhost、127.0.0.1、局域网 IP） */
function isLocalEnv() {
  try {
    if (typeof location === "undefined") return false;
    const host = String(location.hostname || "").toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
    if (isPrivateOrLoopbackLanIPv4(host)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function isPrivateOrLoopbackLanIPv4(hostname) {
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

/** 根据当前页面所在环境自动选择本地或线上服务器地址 */
function pickOrigin(localOrigin, prodOrigin) {
  return isLocalEnv() ? localOrigin : prodOrigin;
}

export const DEFAULT_REST_ORIGIN = pickOrigin(LOCAL_REST_ORIGIN, PROD_REST_ORIGIN);
export const DEFAULT_REST_API_V1_BASE = `${DEFAULT_REST_ORIGIN}/api-trade/v1`;

/** 下载数据专用的 API 端口 */
export const DOWNLOAD_DATA_REST_ORIGIN = pickOrigin(LOCAL_DOWNLOAD_REST_ORIGIN, PROD_DOWNLOAD_REST_ORIGIN);
export const DOWNLOAD_DATA_API_V1_BASE = `${DOWNLOAD_DATA_REST_ORIGIN}/api-web/v1`;
