/** 判断是否为开发环境 */
function isDevEnv() {
  try {
    if (typeof location === "undefined") return false;
    const host = String(location.hostname || "").toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
    if (location.port === "9999") return true;
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

const PROD_ORIGIN = "https://www.prbgame.com";

export const DEFAULT_REST_ORIGIN = PROD_ORIGIN;
export const DEFAULT_REST_API_V1_BASE = isDevEnv() ? "/api-trade/v1" : `${PROD_ORIGIN}/api-trade/v1`;

export const DOWNLOAD_DATA_REST_ORIGIN = PROD_ORIGIN;
export const DOWNLOAD_DATA_API_V1_BASE = isDevEnv() ? "/api-web/v1" : `${PROD_ORIGIN}/api-web/v1`;
