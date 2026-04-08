/**
 * 与历史根目录 main.js 中概览轮询（xr）及控制台卡片刷新同向的轻量实现：
 * 拉取核心 REST，写入 uiState，更新 KPI / sysinfo、数据页策略列表与页眉状态，并调用 control-console 渲染策略卡。
 * 轮询间隔：startPanelPolling → panelTick 约每 8s（含 GET /panel/strategy-slots、/show_config、/profit 等）。
 */
import { state, uiState, getNormalizedControlTradesFeedLimit } from "./store/state-core.js";
import { requestAtBase } from "./utils/http.js";
import {
  getPing,
  getShowConfig,
  getHealth,
  getCount,
  getProfit,
  getSysinfo,
  getStatus,
  getPanelStrategies,
  getPanelStrategySlots,
  getPanelAiOverview,
  getDaily
} from "./api/overview.js";
import { getBalance, getWhitelist, getBlacklist, getTradesFeed } from "./api/positions.js";
import { renderControlHeroAndCards, renderControlGovernanceLists } from "./components/control-console.js";
import { i18n } from "./i18n/index.js";
import {
  buildSparkPolylinePath,
  extractBalanceTotal,
  extractBalanceFreeSum,
  seriesBalanceFreeSpark,
  pickStakeCurrency,
  seriesNetWorth,
  seriesDailyAbsProfit,
  seriesDrawdownPercent,
  extractMaxDrawdownPercent,
  formatOpenPositionsSubtitle,
  computeWinRatePercent,
  lastDayAbsProfit
} from "./utils/overview-kpi.js";
import { applyOverviewStrategiesTable } from "./utils/overview-strategies-table.js";
import {
  applyDataStrategiesList,
  buildPanelStrategySlotIdByName,
  extractPanelStrategyListPayload,
  normalizePanelStrategyNames
} from "./utils/data-strategies-list.js";
import { renderOverviewSysinfoInto } from "./utils/overview-sysinfo-html.js";
import { escapeHtml } from "./utils/html-utils.js";

function $(id) {
  return document.getElementById(id);
}

const POSITIONS_STATUS_LOCAL_BASE = "http://127.0.0.1:18080/api/v1";

function t(key) {
  const lang = state.lang || "zh-CN";
  return i18n[lang]?.[key] ?? i18n["zh-CN"]?.[key] ?? key;
}

function tReplace(key, vars) {
  let s = t(key);
  if (vars && typeof vars === "object") {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickFirstNumber(obj, keys) {
  if (!obj || typeof obj !== "object") return null;
  for (const k of keys) {
    const n = toNum(obj[k]);
    if (n != null) return n;
  }
  return null;
}

function pickFirstString(obj, keys) {
  if (!obj || typeof obj !== "object") return "";
  for (const k of keys) {
    const s = String(obj[k] ?? "").trim();
    if (s) return s;
  }
  return "";
}

function unwrapStatusPayload(raw) {
  if (!raw) return raw;
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "object") return raw;
  const body = raw;
  if (Array.isArray(body.data)) return body.data;
  if (body.data && typeof body.data === "object") return body.data;
  return body;
}

function normalizePositionsAndOrders(statusRaw) {
  const src = unwrapStatusPayload(statusRaw);
  if (Array.isArray(src)) return { positions: src, orders: [] };
  if (!src || typeof src !== "object") return { positions: [], orders: [] };
  const positions =
    (Array.isArray(src.positions) && src.positions) ||
    (Array.isArray(src.trades) && src.trades) ||
    (Array.isArray(src.open_trades) && src.open_trades) ||
    [];
  const orders =
    (Array.isArray(src.orders) && src.orders) ||
    (Array.isArray(src.open_orders) && src.open_orders) ||
    (Array.isArray(src.pending_orders) && src.pending_orders) ||
    [];
  return { positions, orders };
}

function renderPositionsSectionFromStatus(statusRaw) {
  const statusTable = $("statusTable");
  const pendingTable = $("pendingTable");
  if (!statusTable && !pendingTable) return;

  const { positions, orders } = normalizePositionsAndOrders(statusRaw);
  const statusRows = positions
    .map((row) => {
      const pair = escapeHtml(pickFirstString(row, ["pair", "symbol", "market"]) || "—");
      const openRate = pickFirstNumber(row, ["open_rate", "openRate", "entry_price", "entryPrice"]);
      const currentRate = pickFirstNumber(row, ["current_rate", "currentRate", "close_rate", "closeRate", "price"]);
      const pnl = pickFirstNumber(row, ["profit_abs", "profitAbs", "unrealized_pnl", "unrealizedPnl", "pnl"]) ?? 0;
      const size = pickFirstNumber(row, ["stake_amount", "stakeAmount", "amount", "size"]);
      return `
        <tr>
          <td>${pair}</td>
          <td class="t-right">${openRate == null ? "—" : openRate.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
          <td class="t-right">${currentRate == null ? "—" : currentRate.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
          <td class="t-right ${pnl >= 0 ? "positive" : "negative"}">${pnl >= 0 ? "+" : ""}${pnl.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
          <td class="t-right">${size == null ? "—" : size.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
          <td class="t-center"><button type="button" class="pos-close-btn">平仓</button></td>
        </tr>
      `;
    })
    .join("");

  const pendingRows = orders
    .map((row) => {
      const orderType = escapeHtml(pickFirstString(row, ["order_type", "type", "side"]) || "—");
      const price = pickFirstNumber(row, ["price", "rate", "limit_price", "limitPrice"]);
      const qty = pickFirstNumber(row, ["amount", "quantity", "qty", "stake_amount", "stakeAmount"]);
      const status = escapeHtml(pickFirstString(row, ["status", "state"]) || "open");
      return `
        <tr>
          <td>${orderType}</td>
          <td class="t-right">${price == null ? "—" : price.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
          <td class="t-right">${qty == null ? "—" : qty.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
          <td class="t-center"><span class="status-chip">${status}</span></td>
          <td class="t-center"><button type="button" class="pos-close-btn">平仓</button></td>
        </tr>
      `;
    })
    .join("");

  if (statusTable) {
    statusTable.innerHTML =
      statusRows ||
      '<tr><td colspan="6" class="empty-row-cell">—</td></tr>';
  }
  if (pendingTable) {
    pendingTable.innerHTML =
      pendingRows ||
      '<tr data-empty-row="pending"><td colspan="5" class="empty-row-cell">无挂单</td></tr>';
  }

  const totalPnl = positions.reduce((sum, row) => {
    const pnl = pickFirstNumber(row, ["profit_abs", "profitAbs", "unrealized_pnl", "unrealizedPnl", "pnl"]) ?? 0;
    return sum + pnl;
  }, 0);
  const exposure = positions.reduce((sum, row) => {
    const s = pickFirstNumber(row, ["stake_amount", "stakeAmount", "amount", "size"]) ?? 0;
    return sum + Math.abs(s);
  }, 0);
  const totalPnlEl = $("posTotalPnl");
  if (totalPnlEl) totalPnlEl.textContent = `${totalPnl >= 0 ? "+" : ""}${totalPnl.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
  const exposureEl = $("posExposure");
  if (exposureEl) exposureEl.textContent = exposure.toLocaleString(undefined, { maximumFractionDigits: 4 });

  const statusInfo = $("statusPageInfo");
  if (statusInfo) statusInfo.textContent = "1 / 1";
  const pendingInfo = $("pendingPageInfo");
  if (pendingInfo) pendingInfo.textContent = "1 / 1";
  const statusPrev = $("statusPrev");
  if (statusPrev) statusPrev.disabled = true;
  const statusNext = $("statusNext");
  if (statusNext) statusNext.disabled = true;
  const pendingPrev = $("pendingPrev");
  if (pendingPrev) pendingPrev.disabled = true;
  const pendingNext = $("pendingNext");
  if (pendingNext) pendingNext.disabled = true;
}

/** @param {unknown} raw */
function parseIsoMs(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return NaN;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : NaN;
}

/**
 * 概览页「运行时间」：按 /health 的 last_process - bot_start 计算，不使用当前时间。
 * @param {unknown} healthRaw
 * @returns {string}
 */
function formatOverviewUptimeFromHealth(healthRaw) {
  if (!healthRaw || typeof healthRaw !== "object") return "—";
  const h = /** @type {Record<string, unknown>} */ (healthRaw);
  const lastMs = parseIsoMs(h.last_process ?? h.lastProcess);
  const startMs = parseIsoMs(h.bot_start ?? h.botStart);
  if (!Number.isFinite(lastMs) || !Number.isFinite(startMs) || lastMs <= startMs) return "—";
  const diffMs = lastMs - startMs;
  const totalHours = Math.floor(diffMs / (3600 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if ((state.lang || "zh-CN") === "en") return `${days}d ${hours}h`;
  return `${days}天 ${hours}小时`;
}

/**
 * 概览风险头「杠杆 / 模式」：取 /show_config 的 trading_mode / margin_mode。
 * @param {unknown} showCfgRaw
 * @returns {string}
 */
function formatTradingModePair(showCfgRaw) {
  if (!showCfgRaw || typeof showCfgRaw !== "object") return "—";
  const sc = /** @type {Record<string, unknown>} */ (showCfgRaw);
  const tradingMode = String(sc.trading_mode ?? sc.tradingMode ?? "").trim();
  const marginMode = String(sc.margin_mode ?? sc.marginMode ?? "").trim();
  if (!tradingMode && !marginMode) return "—";
  if (!tradingMode) return marginMode;
  if (!marginMode) return tradingMode;
  return `${tradingMode} · ${marginMode}`;
}

/**
 * 顶栏文案与角标（与旧版 main.js 顶栏视觉一致：API 延迟 pill、市场说明、系统在线、HTTP 轮询）。
 * @param {boolean} pingOk
 * @param {number} latencyMs
 */
export function applyTopbarDecor(pingOk, latencyMs) {
  const ok = Boolean(pingOk);
  const ms = Math.round(Number(latencyMs) || 0);

  const net = $("topbarNetwork");
  if (net) net.textContent = tReplace("topbar.apiPingPill", { ms });

  const mkt = $("topbarMarket");
  if (mkt) {
    const cfg =
      uiState.lastShowConfig && typeof uiState.lastShowConfig === "object" ? uiState.lastShowConfig : null;
    const rawEx =
      cfg?.exchange?.name ??
      cfg?.exchange ??
      cfg?.exchange_name ??
      cfg?.exchangeName ??
      "";
    const exStr = typeof rawEx === "string" ? rawEx.trim() : String(rawEx || "").trim();
    if (exStr) {
      mkt.textContent = state.lang === "en" ? `Market: ${exStr}` : `市场: ${exStr}`;
    } else {
      mkt.textContent = t("topbar.marketPill");
    }
  }

  const sys = $("topbarSystemText");
  if (sys) sys.textContent = ok ? t("topbar.systemOnline") : t("topbar.systemOffline");

  const rpc = $("rpcLiveBadge");
  if (rpc) {
    rpc.classList.remove("hidden");
    rpc.textContent = t("live.httpPolling");
  }

  /* 数据面板页眉：与 /ping 轮询同源（见 panelTick → applyTopbarDecor） */
  const daNode = $("daNodeLine");
  if (daNode) {
    const label = ok ? t("data.nodeOnline") : t("data.nodeOffline");
    daNode.innerHTML = `<i class="${ok ? "dot ok" : "dot"}"></i>${escapeHtml(label)}`;
  }
  const daLat = $("daLatencyLine");
  if (daLat) {
    daLat.innerHTML = `<i class="${ok ? "dot ok" : "dot"}"></i>${escapeHtml(tReplace("data.latencyLine", { ms }))}`;
  }
  const daNet = $("daNetStatus");
  if (daNet) {
    daNet.textContent = ok ? t("data.netOk") : t("data.netFail");
    daNet.classList.toggle("live", ok);
    daNet.classList.toggle("fallback", !ok);
    daNet.classList.remove("retry");
  }
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

    const settled = await Promise.allSettled([
      getShowConfig(),
      getHealth(),
      getCount(),
      getProfit(),
      getSysinfo(),
      getPanelStrategies(),
      getPanelStrategySlots(),
      getPanelAiOverview(),
      /** 净资产 / 日收益卡：与 profit 同周期轮询，mock 模式下也请求真实接口（与其它 KPI 一致可刷新） */
      getBalance(),
      getDaily(14),
      getWhitelist(),
      getBlacklist(),
      getTradesFeed(getNormalizedControlTradesFeedLimit())
    ]);

    const sc = settled[0];
    const health = settled[1];
    const count = settled[2];
    const profit = settled[3];
    const sysinfo = settled[4];
    const panelStrategies = settled[5];
    const strategySlots = settled[6];
    const aiOverview = settled[7];
    const balanceR = settled[8];
    const dailyR = settled[9];
    const wlR = settled[10];
    const blR = settled[11];
    const tradesFeedR = settled[12];

    if (sc.status === "fulfilled") uiState.lastShowConfig = sc.value;
    if (health.status === "fulfilled") uiState.lastHealth = health.value;
    if (count.status === "fulfilled") uiState.lastCount = count.value;
    if (profit.status === "fulfilled") uiState.lastProfit = profit.value;
    if (sysinfo.status === "fulfilled") uiState.lastSysinfo = sysinfo.value;
    const rawStrategies =
      panelStrategies.status === "fulfilled" && panelStrategies.value != null
        ? extractPanelStrategyListPayload(panelStrategies.value)
        : null;
    const rawSlots =
      strategySlots.status === "fulfilled" && strategySlots.value != null
        ? extractPanelStrategyListPayload(strategySlots.value)
        : null;

    /* 数据面板左侧策略名：优先 /panel/strategies；空时回退 /panel/strategy-slots。 */
    const rawForNames = rawStrategies != null ? rawStrategies : rawSlots;
    if (rawForNames != null) {
      uiState.panelStrategyListAll = normalizePanelStrategyNames(rawForNames, false);
      uiState.panelStrategyList = normalizePanelStrategyNames(rawForNames, true);
      try {
        window.dispatchEvent(
          new CustomEvent("bovin-strategy-slot-names", {
            detail: { names: uiState.panelStrategyList ?? [] }
          })
        );
      } catch {
        /* ignore */
      }
    }
    /* 槽位 id 与编辑 JSON/MML 详情关联：优先 /panel/strategy-slots。 */
    if (rawSlots != null) {
      uiState.panelStrategySlotIdByName = buildPanelStrategySlotIdByName(rawSlots);
      uiState.panelStrategySlotRowsRaw = Array.isArray(rawSlots) ? rawSlots : [];
    }
    if (aiOverview.status === "fulfilled") uiState.lastAiOverview = aiOverview.value;
    if (balanceR.status === "fulfilled" && balanceR.value != null) uiState.lastBalance = balanceR.value;
    if (dailyR.status === "fulfilled" && dailyR.value != null) uiState.lastDaily = dailyR.value;
    if (wlR.status === "fulfilled") uiState.lastWl = wlR.value;
    if (blR.status === "fulfilled") uiState.lastBl = blR.value;
    if (tradesFeedR.status === "fulfilled") uiState.lastTradesMini = tradesFeedR.value;

    const y = uiState.lastCount && typeof uiState.lastCount === "object" ? uiState.lastCount : {};
    const b = uiState.lastProfit && typeof uiState.lastProfit === "object" ? uiState.lastProfit : {};
    const dailyPayload =
      uiState.lastDaily && typeof uiState.lastDaily === "object" ? uiState.lastDaily : {};
    const balancePayload =
      uiState.lastBalance && typeof uiState.lastBalance === "object" ? uiState.lastBalance : {};

    const stake = pickStakeCurrency(balancePayload, dailyPayload);
    const balTotal = extractBalanceTotal(balancePayload);
    const balFree = extractBalanceFreeSum(balancePayload);

    const kpiNet = $("kpiNetWorth");
    if (kpiNet) {
      if (balTotal != null && Number.isFinite(balTotal)) {
        kpiNet.textContent = `${balTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${stake}`;
        kpiNet.classList.remove("positive", "negative");
      } else {
        kpiNet.textContent = "—";
        kpiNet.classList.remove("positive", "negative");
      }
    }

    const kpiProfit = $("kpiProfit");
    if (kpiProfit) {
      const dayP = lastDayAbsProfit(dailyPayload);
      const O = dayP != null ? dayP : 0;
      kpiProfit.textContent = `${O >= 0 ? "+" : ""}${O.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${stake}`;
      kpiProfit.classList.remove("positive", "negative");
      kpiProfit.classList.add(O >= 0 ? "positive" : "negative");
    }

    const kpiDd = $("kpiMaxDrawdown");
    if (kpiDd) {
      const ddp = extractMaxDrawdownPercent(b);
      if (ddp != null && Number.isFinite(ddp)) {
        kpiDd.textContent = `${Math.abs(ddp).toFixed(2)}%`;
        kpiDd.classList.remove("positive");
        kpiDd.classList.add("negative");
      } else {
        kpiDd.textContent = "—";
        kpiDd.classList.remove("positive", "negative");
      }
    }

    const sp1 = $("kpiSpark1");
    if (sp1) sp1.setAttribute("d", buildSparkPolylinePath(seriesNetWorth(dailyPayload, balTotal)));
    const sp2 = $("kpiSpark2");
    if (sp2) sp2.setAttribute("d", buildSparkPolylinePath(seriesDailyAbsProfit(dailyPayload)));
    const eqSer = seriesNetWorth(dailyPayload, balTotal);
    const sp3 = $("kpiSpark3");
    if (sp3) sp3.setAttribute("d", buildSparkPolylinePath(seriesDrawdownPercent(eqSer)));

    const kpiBal = $("kpiBalance");
    if (kpiBal) {
      if (balFree != null && Number.isFinite(balFree)) {
        kpiBal.textContent = `${balFree.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${stake}`;
        kpiBal.classList.remove("positive", "negative");
      } else {
        kpiBal.textContent = "—";
        kpiBal.classList.remove("positive", "negative");
      }
    }
    const sp4 = $("kpiSpark4");
    if (sp4) sp4.setAttribute("d", buildSparkPolylinePath(seriesBalanceFreeSpark(balFree)));

    uiState.lastPing = pingOk ? { status: "pong" } : { status: "down" };

    const kpiBot = $("kpiBotStatus");
    if (kpiBot) {
      kpiBot.classList.remove("muted", "positive", "negative");
      kpiBot.classList.add("muted");
      kpiBot.textContent = tReplace("overview.kpi.openPositionsLine", {
        slot: formatOpenPositionsSubtitle(y)
      });
    }

    const kpi2Em = $("kpiCard2Em");
    if (kpi2Em) {
      const wr = computeWinRatePercent(dailyPayload);
      kpi2Em.classList.remove("muted", "positive", "negative");
      if (wr == null || !Number.isFinite(wr)) {
        kpi2Em.classList.add("muted");
        kpi2Em.textContent = "—";
      } else {
        kpi2Em.textContent = tReplace("overview.kpi.winRateLine", { pct: wr.toFixed(1) });
        kpi2Em.classList.add(wr >= 50 ? "positive" : "negative");
      }
    }

    const kpi3Em = $("kpiCard3Em");
    if (kpi3Em) {
      kpi3Em.textContent = t("overview.kpi.riskUnconfigured");
      kpi3Em.classList.remove("muted", "negative");
      kpi3Em.classList.add("positive");
    }

    const kpi4Em = $("kpiCard4Em");
    if (kpi4Em) {
      kpi4Em.classList.remove("positive", "negative");
      kpi4Em.classList.add("muted");
      if (
        balTotal != null &&
        balFree != null &&
        Number.isFinite(balTotal) &&
        Number.isFinite(balFree) &&
        balTotal > 0
      ) {
        kpi4Em.textContent = tReplace("overview.kpi.balanceRatioLine", {
          pct: ((balFree / balTotal) * 100).toFixed(1)
        });
      } else {
        kpi4Em.textContent = t("overview.kpi.balanceHint");
      }
    }

    renderOverviewSysinfoInto($("sysinfo"), uiState.lastSysinfo, t, tReplace, uiState.lastHealth);

    const heroLatency = $("heroLatency");
    if (heroLatency) heroLatency.textContent = `${Math.round(uiState.lastPingLatencyMs)}ms`;
    const heroUptime = $("heroUptime");
    if (heroUptime) heroUptime.textContent = formatOverviewUptimeFromHealth(uiState.lastHealth);

    applyTopbarDecor(pingOk, uiState.lastPingLatencyMs);

    try {
      let st = null;
      try {
        st = await requestAtBase(POSITIONS_STATUS_LOCAL_BASE, "/status", { method: "GET" });
      } catch {
        st = await getStatus();
      }
      uiState.lastStForRisk = Array.isArray(st) ? st : [];
      renderPositionsSectionFromStatus(st);
    } catch {
      /* ignore */
    }

    const showCfg =
      uiState.lastShowConfig && typeof uiState.lastShowConfig === "object" ? uiState.lastShowConfig : {};
    const profitObj =
      uiState.lastProfit && typeof uiState.lastProfit === "object" ? uiState.lastProfit : {};
    const riskLeverageValue = $("riskLeverageValue");
    if (riskLeverageValue) riskLeverageValue.textContent = formatTradingModePair(showCfg);

    renderControlHeroAndCards(
      dailyPayload,
      showCfg,
      profitObj,
      uiState.lastHealth && typeof uiState.lastHealth === "object" ? uiState.lastHealth : {},
      uiState.lastProxyHealth,
      uiState.strategyBotSnapshots || {}
    );

    applyOverviewStrategiesTable(
      showCfg,
      profitObj,
      y,
      uiState.lastStForRisk || [],
      t,
      tReplace
    );

    applyDataStrategiesList(
      uiState.panelStrategyListAll ?? uiState.panelStrategyList,
      showCfg,
      profitObj,
      t,
      tReplace
    );
  } catch {
    /* 单次失败不打断轮询 */
  }
}

/** 立即执行一轮轮询（供 /start、/pause 等操作成功后刷新 show_config 与策略卡）。 */
export async function runPanelTickOnce() {
  if (!uiState.authed) return;
  return panelTick();
}

/** 仅刷新白/名单并更新治理区 DOM（供隐藏「刷新名单」等手动触发）。 */
export async function refreshGovernanceListsOnly() {
  if (!uiState.authed) return;
  try {
    const [wl, bl] = await Promise.allSettled([getWhitelist(), getBlacklist()]);
    if (wl.status === "fulfilled") uiState.lastWl = wl.value;
    if (bl.status === "fulfilled") uiState.lastBl = bl.value;
    const scGov =
      uiState.lastShowConfig && typeof uiState.lastShowConfig === "object" ? uiState.lastShowConfig : {};
    renderControlGovernanceLists(uiState.lastWl, uiState.lastBl, scGov);
  } catch {
    /* ignore */
  }
}
