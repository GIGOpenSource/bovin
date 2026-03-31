/**
 * 与历史根目录 main.js 中概览轮询（xr）及控制台卡片刷新同向的轻量实现：
 * 拉取核心 REST，写入 uiState，更新 KPI / sysinfo，并调用 control-console 渲染策略卡。
 */
import { http } from "./utils/http.js";
import { state, uiState } from "./store/state-core.js";
import {
  getPing,
  getShowConfig,
  getHealth,
  getCount,
  getProfit,
  getSysinfo,
  getStatus,
  getPanelStrategies,
  getPanelAiOverview
} from "./api/overview.js";
import { renderControlHeroAndCards } from "./components/control-console.js";

function $(id) {
  return document.getElementById(id);
}

let pollTimer = null;
const POLL_MS = 8000;

export function startPanelPolling() {
  stopPanelPolling();
  void panelTick();
  pollTimer = window.setInterval(() => {
    void panelTick();
  }, POLL_MS);
}

export function stopPanelPolling() {
  if (pollTimer != null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function panelTick() {
  if (!uiState.authed) return;

  try {
    const pingStarted = performance.now();
    let pingOk = false;
    try {
      const p = await getPing();
      pingOk = p?.status === "pong";
    } catch {
      pingOk = false;
    }
    uiState.lastPingLatencyMs = performance.now() - pingStarted;
    uiState.lastPingOk = pingOk;

    const [sc, health, count, profit, sysinfo, strategies, aiOverview] = await Promise.allSettled([
      getShowConfig(),
      getHealth(),
      getCount(),
      getProfit(),
      getSysinfo(),
      getPanelStrategies(),
      getPanelAiOverview()
    ]);

    if (sc.status === "fulfilled") uiState.lastShowConfig = sc.value;
    if (health.status === "fulfilled") uiState.lastHealth = health.value;
    if (count.status === "fulfilled") uiState.lastCount = count.value;
    if (profit.status === "fulfilled") uiState.lastProfit = profit.value;
    if (sysinfo.status === "fulfilled") uiState.lastSysinfo = sysinfo.value;
    if (
      strategies.status === "fulfilled" &&
      strategies.value &&
      typeof strategies.value === "object" &&
      Array.isArray(strategies.value.strategies)
    ) {
      uiState.panelStrategyList = strategies.value.strategies;
    }
    if (aiOverview.status === "fulfilled") uiState.lastAiOverview = aiOverview.value;

    const y = uiState.lastCount && typeof uiState.lastCount === "object" ? uiState.lastCount : {};
    const b = uiState.lastProfit && typeof uiState.lastProfit === "object" ? uiState.lastProfit : {};

    const kpiOpen = $("kpiOpenTrades");
    if (kpiOpen) kpiOpen.textContent = y.current ?? y.open_trades ?? "-";

    const kpiProfit = $("kpiProfit");
    if (kpiProfit) {
      const O = Number(
        b.profit_all_coin ??
          b.profit_all_fiat ??
          b.profit_closed_coin ??
          b.profit_closed_fiat ??
          b.profit_total_abs ??
          b.closed_profit ??
          0
      );
      kpiProfit.textContent = `${O.toFixed(2)}`;
      kpiProfit.classList.remove("positive", "negative");
      kpiProfit.classList.add(O >= 0 ? "positive" : "negative");
    }

    uiState.lastPing = pingOk ? { status: "pong" } : { status: "down" };

    const kpiBot = $("kpiBotStatus");
    if (kpiBot) {
      kpiBot.textContent = state.mockMode
        ? uiState.lastPing.status || "unknown"
        : pingOk
          ? "pong"
          : "down";
    }

    const sysEl = $("sysinfo");
    if (sysEl && uiState.lastSysinfo != null) {
      const raw = uiState.lastSysinfo;
      sysEl.textContent =
        typeof raw === "object" ? JSON.stringify(raw, null, 2) : String(raw);
    }

    const heroLatency = $("heroLatency");
    if (heroLatency) heroLatency.textContent = `${Math.round(uiState.lastPingLatencyMs)}ms`;

    const net = $("topbarNetwork");
    if (net) {
      net.textContent =
        state.lang === "en"
          ? `ping ${Math.round(uiState.lastPingLatencyMs)}ms · ${pingOk ? "up" : "down"}`
          : `延迟 ${Math.round(uiState.lastPingLatencyMs)}ms · ${pingOk ? "可达" : "不可达"}`;
    }

    let daily = uiState.lastDaily;
    if (!state.mockMode) {
      try {
        daily = await http.get("/daily?timescale=14");
        uiState.lastDaily = daily;
      } catch {
        /* 保留上次 */
      }
    }

    try {
      const st = await getStatus();
      uiState.lastStForRisk = Array.isArray(st) ? st : [];
    } catch {
      /* ignore */
    }

    renderControlHeroAndCards(
      daily && typeof daily === "object" ? daily : {},
      uiState.lastShowConfig && typeof uiState.lastShowConfig === "object" ? uiState.lastShowConfig : {},
      uiState.lastProfit && typeof uiState.lastProfit === "object" ? uiState.lastProfit : {},
      uiState.lastHealth && typeof uiState.lastHealth === "object" ? uiState.lastHealth : {},
      uiState.lastProxyHealth,
      uiState.strategyBotSnapshots || {}
    );
  } catch {
    /* 单次失败不打断轮询 */
  }
}
