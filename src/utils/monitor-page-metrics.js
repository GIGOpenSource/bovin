/**
 * 系统监控页：GET /sysinfo 驱动主机内存/CPU；磁盘项固定文案（API 无磁盘指标）；其余用浏览器能力与 uiState 缓存。
 */
import { getSysinfo, getPing } from "../api/monitor.js";
import { i18n } from "../i18n/index.js";
import { state, uiState } from "../store/state-core.js";
import { parseSysinfoPayload } from "./overview-sysinfo-html.js";
import { computeEstimatedAnnualReturn } from "../components/control-console.js";

function t(key) {
  const lang = state.lang || "zh-CN";
  return i18n[lang]?.[key] ?? i18n["zh-CN"]?.[key] ?? key;
}

function fmtPct1(n) {
  if (n == null || !Number.isFinite(n)) return null;
  return `${n.toFixed(1)}%`;
}

function formatBytes(n) {
  if (n == null || !Number.isFinite(n) || n < 0) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${u[i]}`;
}

function formatUptimeFromStartSec(tsSec) {
  if (tsSec == null || !Number.isFinite(tsSec) || tsSec <= 0) return null;
  const startMs = tsSec > 1e12 ? tsSec : Math.round(tsSec * 1000);
  const diffMs = Date.now() - startMs;
  if (!Number.isFinite(diffMs) || diffMs < 0) return null;
  const totalMins = Math.floor(diffMs / (60 * 1000));
  const days = Math.floor(totalMins / (60 * 24));
  const hours = Math.floor((totalMins % (60 * 24)) / 60);
  const mins = totalMins % 60;
  if (state.lang === "en") return `${days}d ${hours}h ${mins}m`;
  return `${days}天 ${hours}小时 ${mins}分`;
}

let refreshButtonBound = false;

/**
 * 拉取 /sysinfo、/ping 并刷新监控页各指标 DOM（需在已登录且面板已挂载后调用）。
 */
export async function refreshMonitorPageMetrics() {
  if (!uiState.authed) return;

  const ramEl = document.getElementById("monitorRam");
  const diskEl = document.getElementById("monitorDiskServer");
  const storageEl = document.getElementById("monitorStorageBrowser");
  const bwEl = document.getElementById("monitorBandwidth");
  const latEl = document.getElementById("monitorLatency");
  const cagrEl = document.getElementById("monitorCagr");
  const uptimeEl = document.getElementById("monitorUptime");

  let latMs = null;
  const sysPromise = getSysinfo().catch(() => null);
  const pingPromise = (async () => {
    const t0 = performance.now();
    try {
      await getPing();
      latMs = performance.now() - t0;
    } catch {
      latMs = null;
    }
  })();
  const raw = await Promise.all([sysPromise, pingPromise]).then(([r]) => r);
  const view = parseSysinfoPayload(raw);

  if (ramEl) {
    const ramS = fmtPct1(view?.ram ?? null);
    const cpuS = fmtPct1(view?.cpuAvg ?? null);
    if (ramS && cpuS) ramEl.textContent = `${ramS} · CPU ${cpuS}`;
    else if (ramS) ramEl.textContent = ramS;
    else if (cpuS) ramEl.textContent = `CPU ${cpuS}`;
    else ramEl.textContent = "—";
  }

  if (diskEl) {
    diskEl.textContent = t("monitor.disk.unavailable");
  }

  if (storageEl) {
    try {
      const est = await navigator.storage?.estimate?.();
      if (est && (est.usage != null || est.quota != null)) {
        const u = est.usage ?? 0;
        const q = est.quota ?? 0;
        storageEl.textContent =
          q > 0 ? `${formatBytes(u)} / ${formatBytes(q)}` : formatBytes(u);
      } else {
        storageEl.textContent = "—";
      }
    } catch {
      storageEl.textContent = "—";
    }
  }

  if (bwEl) {
    const c = /** @type {NetworkInformation & { rtt?: number } | undefined} */ (navigator.connection);
    if (c && (c.downlink != null || c.effectiveType)) {
      const parts = [];
      if (typeof c.downlink === "number" && Number.isFinite(c.downlink)) {
        parts.push(`${c.downlink} Mbps`);
      }
      if (c.effectiveType) parts.push(String(c.effectiveType));
      if (typeof c.rtt === "number" && Number.isFinite(c.rtt)) {
        parts.push(`RTT ~${Math.round(c.rtt)}ms`);
      }
      bwEl.textContent = parts.length ? parts.join(" · ") : "—";
    } else {
      bwEl.textContent = "—";
    }
  }

  if (latEl) {
    latEl.textContent =
      latMs != null && Number.isFinite(latMs) ? `${Math.round(latMs)}ms` : "—";
  }

  if (cagrEl) {
    const profit = uiState.lastProfit && typeof uiState.lastProfit === "object" ? uiState.lastProfit : {};
    const daily = uiState.lastDaily && typeof uiState.lastDaily === "object" ? uiState.lastDaily : {};
    const health = uiState.lastHealth && typeof uiState.lastHealth === "object" ? uiState.lastHealth : {};
    const ann = computeEstimatedAnnualReturn(profit, daily, health);
    if (ann != null && Number.isFinite(ann)) {
      const pct = ann * 100;
      cagrEl.textContent = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
      cagrEl.classList.toggle("positive", pct >= 0);
      cagrEl.classList.toggle("negative", pct < 0);
    } else {
      cagrEl.textContent = t("monitor.cagr.na");
      cagrEl.classList.remove("positive", "negative");
    }
  }

  if (uptimeEl) {
    const h = uiState.lastHealth && typeof uiState.lastHealth === "object" ? uiState.lastHealth : {};
    const p = uiState.lastProfit && typeof uiState.lastProfit === "object" ? uiState.lastProfit : {};
    const ts =
      Number(h.bot_startup_ts ?? h.bot_start_ts ?? p.bot_start_timestamp ?? NaN);
    const line = formatUptimeFromStartSec(ts);
    uptimeEl.textContent = line ?? t("monitor.uptime.na");
  }
}

/** 文档委托：刷新按钮（避免重挂载后失效） */
export function bindMonitorRefreshButtonOnce() {
  if (refreshButtonBound) return;
  refreshButtonBound = true;
  document.addEventListener("click", (ev) => {
    const raw = ev.target instanceof Element ? ev.target.closest("#monitorRefreshBtn") : null;
    if (!raw) return;
    ev.preventDefault();
    void refreshMonitorPageMetrics();
  });
}
