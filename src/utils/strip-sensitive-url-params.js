/**
 * 从 location.search 中移除登录相关参数，避免凭据留在地址栏（可被日志、Referer 泄露）。
 * 保留 hash 与其它 query（如 mock=1）。
 */
export function stripSensitiveQueryParamsFromUrl() {
  try {
    const url = new URL(window.location.href);
    let changed = false;
    for (const key of ["username", "password"]) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (!changed) return;
    const qs = url.searchParams.toString();
    const next = `${url.pathname}${qs ? `?${qs}` : ""}${url.hash || ""}`;
    window.history.replaceState(window.history.state, "", next);
  } catch {
    /* ignore */
  }
}
