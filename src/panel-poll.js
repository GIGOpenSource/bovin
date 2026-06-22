/**
 * 与历史根目录 main.js 中概览轮询（xr）及控制台卡片刷新同向的轻量实现：
 * 拉取核心 REST，写入 uiState，更新 KPI / sysinfo、数据页策略列表与页眉状态，并调用 control-console 渲染策略卡。
 * 轮询间隔：startPanelPolling → panelTick 约每 8s（含 GET /panel/strategy-slots、/show_config、/profit 等）。
 */
import { state, uiState, getNormalizedControlTradesFeedLimit } from "./store/state-core.js";
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
import { Modal, message } from "ant-design-vue";
import {
  getBalance,
  getWhitelist,
  getBlacklist,
  getTradesFeed,
  getClosedTrades,
  getProfitAll,
  postForceExit,
  postForceSell,
  postTradeReload,
  deleteTrade,
  deleteTradeOpenOrder,
} from "./api/positions.js";
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
  lastDayAbsProfit,
  computeRiskExposureBucketsPercent
} from "./utils/overview-kpi.js";
import { applyOverviewStrategiesTable } from "./utils/overview-strategies-table.js";
import {
  buildPanelStrategySlotIdByName,
  extractPanelStrategyListPayload,
  normalizePanelStrategyNames
} from "./utils/data-strategies-list.js";
import { renderOverviewSysinfoInto } from "./utils/overview-sysinfo-html.js";
import { escapeHtml } from "./utils/html-utils.js";

function $(id) {
  return document.getElementById(id);
}

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

/** @param {HTMLElement | null} el */
function renderRiskExposureMatrix(el, balancePayload) {
  if (!el) return;
  const { stable, btc, eth, alt } = computeRiskExposureBucketsPercent(balancePayload);
  const fmt = (n) => `${Number(n).toFixed(2)}%`;
  const barPct = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return "0%";
    return `${Math.min(100, Math.max(0, v))}%`;
  };
  const L = (key) => escapeHtml(t(key));
  el.innerHTML = `<div class="cell">
    <span data-i18n="overview.risk.bucket.stable">${L("overview.risk.bucket.stable")}</span>
    <b>${escapeHtml(fmt(stable))}</b>
    <div class="bar"><i style="--ds-risk-bar-pct: ${barPct(stable)}"></i></div>
  </div>
  <div class="cell">
    <span data-i18n="overview.risk.bucket.btc">${L("overview.risk.bucket.btc")}</span>
    <b>${escapeHtml(fmt(btc))}</b>
    <div class="bar"><i class="sec" style="--ds-risk-bar-pct: ${barPct(btc)}"></i></div>
  </div>
  <div class="cell">
    <span data-i18n="overview.risk.bucket.eth">${L("overview.risk.bucket.eth")}</span>
    <b>${escapeHtml(fmt(eth))}</b>
    <div class="bar"><i class="dim" style="--ds-risk-bar-pct: ${barPct(eth)}"></i></div>
  </div>
  <div class="cell">
    <span data-i18n="overview.risk.bucket.alt">${L("overview.risk.bucket.alt")}</span>
    <b>${escapeHtml(fmt(alt))}</b>
    <div class="bar"><i class="ter" style="--ds-risk-bar-pct: ${barPct(alt)}"></i></div>
  </div>`;
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

/** @param {unknown} t trade 或带 trade_id 的 order */
function tradeIdFromTrade(t) {
  if (!t || typeof t !== "object") return null;
  const id = /** @type {Record<string, unknown>} */ (t).trade_id ?? /** @type {Record<string, unknown>} */ (t).tradeId;
  if (id == null || id === "") return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
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

/** 未平仓 trade：显式 `is_open === true`，或无该字段时视为未平仓（兼容旧接口） */
function isOpenTrade(t) {
  return Boolean(t && typeof t === "object" && (t.is_open === true || !("is_open" in t)));
}

/**
 * GET /status 中提取杠杆：优先响应顶层（或 `data`），否则取首个未平仓 trade 上的 `leverage`。
 * @param {unknown} raw
 * @returns {number | null}
 */
function extractLeverageFromStatusPayload(raw) {
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const o = /** @type {Record<string, unknown>} */ (raw);
    const top = pickFirstNumber(o, ["leverage", "Leverage", "leverage_ratio", "leverageRatio"]);
    if (top != null && top > 0) return top;
    const data = o.data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const dv = pickFirstNumber(/** @type {Record<string, unknown>} */ (data), [
        "leverage",
        "Leverage",
        "leverage_ratio",
        "leverageRatio"
      ]);
      if (dv != null && dv > 0) return dv;
    }
  }
  const src = unwrapStatusPayload(raw);
  if (src && typeof src === "object" && !Array.isArray(src)) {
    const o = /** @type {Record<string, unknown>} */ (src);
    const v = pickFirstNumber(o, ["leverage", "Leverage", "leverage_ratio", "leverageRatio"]);
    if (v != null && v > 0) return v;
  }
  const tradeList = Array.isArray(src)
    ? src
    : src && typeof src === "object"
      ? /** @type {Record<string, unknown>} */ (src).trades ??
        /** @type {Record<string, unknown>} */ (src).open_trades ??
        /** @type {Record<string, unknown>} */ (src).positions ??
        []
      : [];
  if (!Array.isArray(tradeList)) return null;
  for (const t of tradeList) {
    if (!t || typeof t !== "object") continue;
    if (!isOpenTrade(t)) continue;
    const lv = pickFirstNumber(/** @type {Record<string, unknown>} */ (t), [
      "leverage",
      "Leverage",
      "leverage_ratio",
      "leverageRatio"
    ]);
    if (lv != null && lv > 0) return lv;
  }
  return null;
}

/**
 * Freqtrade GET /status 常为「未平仓 trade 数组」，每个 trade 内有嵌套 `orders`。
 * 待成交：仅在 **未平仓 trade** 下收集子订单，且子订单 `is_open === true` 才展示（入场限价成交通常为 closed / is_open false，不占用待成交）。
 */
function ordersFromOpenTradesNested(trades) {
  if (!Array.isArray(trades)) return [];
  const out = [];
  for (const t of trades) {
    if (!isOpenTrade(t)) continue;
    const nested = t.orders;
    if (!Array.isArray(nested)) continue;
    const tid = tradeIdFromTrade(t);
    for (const o of nested) {
      if (o && o.is_open === true) {
        out.push({
          ...o,
          __forceexit_trade_id: tid,
        });
      }
    }
  }
  return out;
}

/** 顶层 orders 与未平仓 trade 按 pair / trade_id 关联，补全撤单用的 trade_id */
function enrichOrderWithForceExitContext(order, openTrades) {
  let tid = tradeIdFromTrade(order);
  if (tid == null) {
    const pair = pickFirstString(order, ["pair"]);
    if (pair) {
      const tr = openTrades.find(
        (x) => isOpenTrade(x) && pickFirstString(x, ["pair"]) === pair
      );
      if (tr) tid = tradeIdFromTrade(tr);
    }
  }
  return { ...order, __forceexit_trade_id: tid };
}

function dedupeOrdersById(list) {
  const seen = new Set();
  const out = [];
  for (const o of list) {
    const id = String(pickFirstString(o, ["order_id", "orderId", "id"]) || "");
    const key = id || `__idx_${out.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(o);
  }
  return out;
}

function normalizePositionsAndOrders(statusRaw) {
  const src = unwrapStatusPayload(statusRaw);
  if (Array.isArray(src)) {
    const positions = src.filter(isOpenTrade);
    const nested = ordersFromOpenTradesNested(src);
    const orders = dedupeOrdersById(nested);
    return { positions, orders };
  }
  if (!src || typeof src !== "object") return { positions: [], orders: [] };
  const positionsRaw =
    (Array.isArray(src.positions) && src.positions) ||
    (Array.isArray(src.trades) && src.trades) ||
    (Array.isArray(src.open_trades) && src.open_trades) ||
    [];
  const positions = positionsRaw.filter(isOpenTrade);
  /** 顶层 `orders`（若有）+ 未平仓 trade 下嵌套 `orders`，子单须 `is_open === true` */
  const topFlat = Array.isArray(src.orders)
    ? src.orders.filter((o) => o && o.is_open === true).map((o) => enrichOrderWithForceExitContext(o, positionsRaw))
    : [];
  const nested = ordersFromOpenTradesNested(positionsRaw);
  const orders = dedupeOrdersById([...topFlat, ...nested]);
  return { positions, orders };
}

function renderPositionsSectionFromStatus(statusRaw, profitAll = null, balance = null) {
  const botComparisonTable = $("botComparisonTable");
  const openTradesTable = $("openTradesTable");
  if (!botComparisonTable && !openTradesTable) return;

  const { positions, orders } = normalizePositionsAndOrders(statusRaw);
  uiState.positionsRows = positions;
  
  const showCfg = uiState.lastShowConfig && typeof uiState.lastShowConfig === "object" ? uiState.lastShowConfig : {};
  const botName = showCfg.bot_name || "freqtrade";
  const isDryRun = showCfg.dry_run === true;
  
  const maxOpenTrades = showCfg.max_open_trades ?? 3;
  const allData = profitAll?.all || {};
  const tradeCount = allData.trade_count ?? 0;
  const closedTradeCount = allData.closed_trade_count ?? 0;
  const openTradeCount = tradeCount - closedTradeCount;
  
  const profitAllFiat = allData.profit_all_fiat ?? 0;
  const profitClosedFiat = allData.profit_closed_fiat ?? 0;
  const profitAllPercent = allData.profit_all_percent ?? 0;
  const profitClosedPercent = allData.profit_closed_percent ?? 0;
  const winningTrades = allData.winning_trades ?? 0;
  const losingTrades = allData.losing_trades ?? 0;
  
  const unrealizedFiat = profitAllFiat - profitClosedFiat;
  const unrealizedPercent = profitAllPercent - profitClosedPercent;
  
  const openPnlClass = unrealizedPercent >= 0 ? "positive" : "negative";
  const closedPnlClass = profitClosedPercent >= 0 ? "positive" : "negative";
  
  const openPnlDisplay = unrealizedPercent >= 0 
    ? `+${unrealizedPercent.toFixed(2)}% (${unrealizedFiat.toFixed(3)})` 
    : `${unrealizedPercent.toFixed(2)}% (${unrealizedFiat.toFixed(3)})`;
  const closedPnlDisplay = profitClosedPercent >= 0 
    ? `+${profitClosedPercent.toFixed(2)}% (${profitClosedFiat.toFixed(3)})` 
    : `${profitClosedPercent.toFixed(2)}% (${profitClosedFiat.toFixed(3)})`;
  
  const totalBot = balance?.total_bot ?? 0;
  const modeText = isDryRun ? "dry" : "live";
  const balanceDisplay = `${totalBot.toLocaleString(undefined, { maximumFractionDigits: 3 })} USDT(${modeText})`;
  
  const botComparisonRows = `
    <tr>
      <td>${escapeHtml(botName)}</td>
      <td><span class="status-chip green">Dry</span> <span>${openTradeCount}/${maxOpenTrades}</span></td>
      <td class="t-right"><span class="pnl-box ${openPnlClass}">${openPnlDisplay}</span></td>
      <td class="t-right"><span class="pnl-box ${closedPnlClass}">${closedPnlDisplay}</span></td>
      <td class="t-right">${balanceDisplay}</td>
      <td class="t-right">${winningTrades}/${losingTrades}</td>
    </tr>
  `;

  const openTradesRows = positions
    .map((row) => {
      const tid = pickFirstNumber(row, ["trade_id", "tradeId"]);
      const isShort = row.is_short === true;
      const sideText = isShort ? "Short" : "Long";
      const idText = tid != null ? `${tid} | ${sideText}` : "—";
      const pair = escapeHtml(pickFirstString(row, ["pair", "symbol", "market"]) || "—");
      const amount = pickFirstNumber(row, ["amount", "quantity", "qty"]) ?? 0;
      const stakeAmount = pickFirstNumber(row, ["stake_amount", "stakeAmount"]) ?? 0;
      const leverage = pickFirstNumber(row, ["leverage", "Leverage"]) ?? 1;
      const stakeDisplay = stakeAmount > 0 ? `${stakeAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${leverage}x)` : "—";
      const openRate = pickFirstNumber(row, ["open_rate", "openRate", "entry_price", "entryPrice"]);
      const currentRate = pickFirstNumber(row, ["current_rate", "currentRate", "price"]);
      const pnlPct = pickFirstNumber(row, ["profit_pct", "profitPct", "unrealized_pnl_pct", "unrealizedPnlPct"]) ?? 0;
      const pnlAbs = pickFirstNumber(row, ["profit_abs", "profitAbs", "unrealized_pnl", "unrealizedPnl"]) ?? 0;
      const pnlDisplay = pnlPct >= 0 ? `+${pnlPct.toFixed(2)}% (${pnlAbs.toFixed(3)})` : `${pnlPct.toFixed(2)}% (${pnlAbs.toFixed(3)})`;
      const openDate = pickFirstString(row, ["open_date", "openDate", "open_timestamp", "openTimestamp"]);
      const canExit = tid != null;
      const exitAttr = canExit ? ` data-forceexit-tradeid="${tid}"` : "";
      
      return `
        <tr>
          <td>7</td>
          <td>${idText}</td>
          <td>${pair}</td>
          <td class="t-right">${amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
          <td class="t-right">${stakeDisplay}</td>
          <td class="t-right">${openRate == null ? "—" : openRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
          <td class="t-right">${currentRate == null ? "—" : currentRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
          <td class="t-right"><span class="pnl-box ${pnlPct >= 0 ? "positive" : "negative"}">${pnlDisplay}</span></td>
          <td class="t-right">${openDate || "—"}</td>
          <td class="t-center">
            <div class="action-dropdown">
              <button type="button" class="action-icon-btn"${canExit ? "" : " disabled"}><span class="action-icon-dots">⋮</span></button>
              <div class="action-dropdown-menu">
                <button type="button" class="dropdown-item" data-action="forceexit-limit" data-tradeid="${tid}"><span class="dropdown-icon">⊗</span> 强制退出限制</button>
                <button type="button" class="dropdown-item" data-action="forceexit-market" data-tradeid="${tid}"><span class="dropdown-icon">⊗</span> 强制退出市场</button>
                <button type="button" class="dropdown-item" data-action="forceexit-partial" data-tradeid="${tid}"><span class="dropdown-icon">⊗</span> 强制退出部分</button>
                ${row.has_open_orders === true ? `<button type="button" class="dropdown-item" data-action="cancel-open-order" data-tradeid="${tid}"><span class="dropdown-icon">⊗</span> 取消挂单</button>` : ""}
                <button type="button" class="dropdown-item" data-action="increase-position" data-tradeid="${tid}"><span class="dropdown-icon">⊕</span> 提升仓位</button>
                <button type="button" class="dropdown-item" data-action="reload" data-tradeid="${tid}"><span class="dropdown-icon">↻</span> 重新加载</button>
                <button type="button" class="dropdown-item" data-action="delete-trade" data-tradeid="${tid}"><span class="dropdown-icon">🗑</span> 删除交易</button>
                <button type="button" class="dropdown-item" data-action="close-menu"><span class="dropdown-icon">✕</span> 关闭操作菜单</button>
              </div>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  if (botComparisonTable) {
    botComparisonTable.innerHTML = botComparisonRows;
  }

  if (openTradesTable) {
    openTradesTable.innerHTML =
      openTradesRows ||
      `<tr>
        <td colspan="10" class="t-center">暂无数据</td>
      </tr>`;
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
  if (totalPnlEl) {
    const pnlAbs = Math.abs(totalPnl).toLocaleString(undefined, { maximumFractionDigits: 4 });
    totalPnlEl.textContent = totalPnl >= 0 ? `+$${pnlAbs}` : `-$${pnlAbs}`;
  }
  const exposureEl = $("posExposure");
  if (exposureEl) exposureEl.textContent = `$${exposure.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;

  const openInfo = $("openPageInfo");
  if (openInfo) openInfo.textContent = "1 / 1";
  const openPrev = $("openPrev");
  if (openPrev) openPrev.disabled = true;
  const openNext = $("openNext");
  if (openNext) openNext.disabled = true;
  
  setTimeout(setupActionDropdowns, 0);
}

function renderClosedTradesFromApi(tradesRaw) {
  const closedTradesTable = $("closedTradesTable");
  if (!closedTradesTable) return;

  const trades = Array.isArray(tradesRaw?.trades) ? tradesRaw.trades : [];
  const closedTrades = trades.filter(t => t && typeof t === "object" && t.is_open === false);

  const closedTradesRows = closedTrades
    .map((row) => {
      const tid = pickFirstNumber(row, ["trade_id", "tradeId"]);
      const isShort = row.is_short === true;
      const sideText = isShort ? "Short" : "Long";
      const idText = tid != null ? `${tid} | ${sideText}` : "—";
      const pair = escapeHtml(pickFirstString(row, ["pair", "symbol", "market"]) || "—");
      const amount = pickFirstNumber(row, ["amount", "quantity", "qty"]) ?? 0;
      const stakeAmount = pickFirstNumber(row, ["stake_amount", "stakeAmount"]) ?? 0;
      const leverage = pickFirstNumber(row, ["leverage", "Leverage"]) ?? 1;
      const stakeDisplay = stakeAmount > 0 ? `${stakeAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${leverage}x)` : "—";
      const openRate = pickFirstNumber(row, ["open_rate", "openRate", "entry_price", "entryPrice"]);
      const closeRate = pickFirstNumber(row, ["close_rate", "closeRate"]);
      const pnlPct = pickFirstNumber(row, ["profit_pct", "profitPct"]) ?? 0;
      const pnlAbs = pickFirstNumber(row, ["profit_abs", "profitAbs", "close_profit", "closeProfit"]) ?? 0;
      const pnlDisplay = pnlPct >= 0 ? `+${pnlPct.toFixed(2)}% (${pnlAbs.toFixed(3)})` : `${pnlPct.toFixed(2)}% (${pnlAbs.toFixed(3)})`;
      const openDate = pickFirstString(row, ["open_date", "openDate", "open_timestamp", "openTimestamp"]);
      const closeDate = pickFirstString(row, ["close_date", "closeDate", "close_timestamp", "closeTimestamp"]);
      const exitReason = escapeHtml(pickFirstString(row, ["exit_reason", "exitReason"]) || "—");
      const exitReasonText = exitReason 

      return `
        <tr>
          <td>${idText}</td>
          <td>${pair}</td>
          <td class="t-right">${amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
          <td class="t-right">${stakeDisplay}</td>
          <td class="t-right">${openRate == null ? "—" : openRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
          <td class="t-right">${closeRate == null ? "—" : closeRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
          <td class="t-right"><span class="pnl-box ${pnlPct >= 0 ? "positive" : "negative"}">${pnlDisplay}</span></td>
          <td class="t-right">${openDate || "—"}</td>
          <td class="t-right">${closeDate || "—"}</td>
          <td>${exitReasonText}</td>
        </tr>
      `;
    })
    .join("");

  if (closedTradesTable) {
    closedTradesTable.innerHTML =
      closedTradesRows ||
      `<tr>
        <td colspan="10" class="t-center">暂无数据</td>
      </tr>`;
  }

  const closedInfo = $("closedPageInfo");
  if (closedInfo) closedInfo.textContent = "1 / 1";
  const closedPrev = $("closedPrev");
  if (closedPrev) closedPrev.disabled = true;
  const closedNext = $("closedNext");
  if (closedNext) closedNext.disabled = true;
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
 * 将 /status 的杠杆格式化为「(1.0x)」类后缀（供插在 futures 后）。
 * @param {unknown} lev
 * @returns {string}
 */
function formatLeverageForRiskHead(lev) {
  if (lev == null || lev === "") return "";
  const n = Number(lev);
  if (Number.isFinite(n) && n > 0) {
    return `(${n.toFixed(1)}x)`;
  }
  const s = String(lev).trim();
  if (!s) return "";
  const core = /x$/i.test(s) ? s : `${s}x`;
  return `(${core})`;
}

/**
 * 概览风险头「杠杆 / 模式」：取 /show_config 的 trading_mode / margin_mode；
 * 合约模式下在 `futures` 后附加 GET /status 的 leverage（如 futures (10.0x) · cross）。
 * @param {unknown} showCfgRaw
 * @param {number | null | undefined} statusLeverage
 * @returns {string}
 */
function formatTradingModePair(showCfgRaw, statusLeverage) {
  if (!showCfgRaw || typeof showCfgRaw !== "object") return "—";
  const sc = /** @type {Record<string, unknown>} */ (showCfgRaw);
  const tradingMode = String(sc.trading_mode ?? sc.tradingMode ?? "").trim();
  const marginMode = String(sc.margin_mode ?? sc.marginMode ?? "").trim();
  if (!tradingMode && !marginMode) return "—";
  let left = tradingMode;
  if (tradingMode && /futures/i.test(tradingMode) && statusLeverage != null && statusLeverage !== "") {
    const suf = formatLeverageForRiskHead(statusLeverage);
    if (suf) left = `${tradingMode} ${suf}`;
  }
  if (!marginMode) return left || "—";
  if (!left) return marginMode;
  return `${left} · ${marginMode}`;
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

let positionsForceExitDelegationBound = false;
let positionsCancelOrderDelegationBound = false;
let positionsPendingCancelAllDelegationBound = false;

function bindPositionsForceExitDelegationOnce() {
  if (positionsForceExitDelegationBound) return;
  positionsForceExitDelegationBound = true;
  document.addEventListener(
    "click",
    (ev) => {
      const raw = ev.target instanceof Element ? ev.target.closest("#positions #statusTable .pos-close-btn") : null;
      const btn = raw instanceof HTMLButtonElement ? raw : null;
      if (!btn || btn.disabled) return;
      const tradeid = btn.getAttribute("data-forceexit-tradeid");
      if (!tradeid || tradeid === "") return;
      ev.preventDefault();
      ev.stopPropagation();
      Modal.confirm({
        title: t("positions.forceExitTitle"),
        content: t("positions.forceExitConfirm"),
        okText: t("btn.confirm"),
        cancelText: t("btn.cancel"),
        okType: "primary",
        async onOk() {
          try {
            await postForceExit({
              tradeid: Number(tradeid),
            });
            await runPanelTickOnce();
            message.success(t("positions.forceExitOk"));
          } catch (e) {
            const msg = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
            message.error(msg || t("positions.forceExitFail"));
            throw e;
          }
        },
        onCancel() {},
      });
    },
    true
  );
}

function bindPositionsCancelOrderDelegationOnce() {
  if (positionsCancelOrderDelegationBound) return;
  positionsCancelOrderDelegationBound = true;
  document.addEventListener(
    "click",
    (ev) => {
      const raw = ev.target instanceof Element ? ev.target.closest("#positions #pendingTable .pos-cancel-order-btn") : null;
      const btn = raw instanceof HTMLButtonElement ? raw : null;
      if (!btn || btn.disabled) return;
      const tradeid = btn.getAttribute("data-cancel-tradeid");
      if (!tradeid || tradeid === "") return;
      ev.preventDefault();
      ev.stopPropagation();
      Modal.confirm({
        title: t("positions.cancelOrderTitle"),
        content: t("positions.cancelOrderConfirm"),
        okText: t("btn.confirm"),
        cancelText: t("btn.cancel"),
        okType: "primary",
        async onOk() {
          try {
            await deleteTradeOpenOrder(tradeid);
            await runPanelTickOnce();
            message.success(t("positions.cancelOrderOk"));
          } catch (e) {
            const msg = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
            message.error(msg || t("positions.cancelOrderFail"));
            throw e;
          }
        },
        onCancel() {},
      });
    },
    true
  );
}

function bindPendingCancelAllDelegationOnce() {
  if (positionsPendingCancelAllDelegationBound) return;
  positionsPendingCancelAllDelegationBound = true;
  document.addEventListener(
    "click",
    (ev) => {
      const raw = ev.target instanceof Element ? ev.target.closest("#positions #pendingCancelAllBtn") : null;
      const btn = raw instanceof HTMLButtonElement ? raw : null;
      if (!btn || btn.disabled) return;
      const ids = Array.isArray(uiState.lastPendingOpenOrderTradeIds)
        ? [...uiState.lastPendingOpenOrderTradeIds]
        : [];
      if (ids.length === 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      Modal.confirm({
        title: t("positions.cancelAllModalTitle"),
        content: t("positions.cancelAllModalConfirm"),
        okText: t("btn.confirm"),
        cancelText: t("btn.cancel"),
        okType: "primary",
        async onOk() {
          try {
            for (let i = 0; i < ids.length; i++) {
              await deleteTradeOpenOrder(ids[i]);
            }
            await runPanelTickOnce();
            message.success(t("positions.cancelAllOk"));
          } catch (e) {
            const msg = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
            message.error(msg || t("positions.cancelAllFail"));
            throw e;
          }
        },
        onCancel() {},
      });
    },
    true
  );
}

export function startPanelPolling() {
  bindPositionsForceExitDelegationOnce();
  bindPositionsCancelOrderDelegationOnce();
  bindPendingCancelAllDelegationOnce();
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

function getCurrentSectionId() {
  const activeSection = document.querySelector("section.section.active");
  return activeSection?.id || "overview";
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

    const currentSection = getCurrentSectionId();
    
    const globalRequests = [
      getShowConfig(),
      getHealth(),
      getCount(),
      getProfit(),
      getSysinfo()
    ];

    let sectionRequests = [];
    let sectionRequestNames = [];

    if (currentSection === "overview" || currentSection === "control") {
      sectionRequests.push(
        getPanelStrategies(),
        getPanelStrategySlots(),
        getPanelAiOverview(),
        getBalance(),
        getDaily(14),
        getWhitelist(),
        getBlacklist(),
        getTradesFeed(getNormalizedControlTradesFeedLimit())
      );
      sectionRequestNames = ["panelStrategies", "strategySlots", "aiOverview", "balance", "daily", "whitelist", "blacklist", "tradesFeed"];
    } else if (currentSection === "positions") {
      sectionRequests.push(
        getBalance(),
        getTradesFeed(getNormalizedControlTradesFeedLimit()),
        getClosedTrades(),
        getProfitAll()
      );
      sectionRequestNames = ["balance", "tradesFeed", "closedTrades", "profitAll"];
    }

    const settled = await Promise.allSettled([...globalRequests, ...sectionRequests]);

    const sc = settled[0];
    const health = settled[1];
    const count = settled[2];
    const profit = settled[3];
    const sysinfo = settled[4];
    
    let panelStrategies, strategySlots, aiOverview, balanceR, dailyR, wlR, blR, tradesFeedR;
    let idx = 5;
    
    if (sectionRequestNames.includes("panelStrategies")) panelStrategies = settled[idx++];
    if (sectionRequestNames.includes("strategySlots")) strategySlots = settled[idx++];
    if (sectionRequestNames.includes("aiOverview")) aiOverview = settled[idx++];
    if (sectionRequestNames.includes("balance")) balanceR = settled[idx++];
    if (sectionRequestNames.includes("daily")) dailyR = settled[idx++];
    if (sectionRequestNames.includes("whitelist")) wlR = settled[idx++];
    if (sectionRequestNames.includes("blacklist")) blR = settled[idx++];
    if (sectionRequestNames.includes("tradesFeed")) tradesFeedR = settled[idx++];

    if (sc.status === "fulfilled") uiState.lastShowConfig = sc.value;
    if (health.status === "fulfilled") uiState.lastHealth = health.value;
    if (count.status === "fulfilled") uiState.lastCount = count.value;
    if (profit.status === "fulfilled") uiState.lastProfit = profit.value;
    if (sysinfo.status === "fulfilled") uiState.lastSysinfo = sysinfo.value;

    if (currentSection === "overview" || currentSection === "control") {
      const rawStrategies =
        panelStrategies.status === "fulfilled" && panelStrategies.value != null
          ? extractPanelStrategyListPayload(panelStrategies.value)
          : null;
      const rawSlots =
        strategySlots.status === "fulfilled" && strategySlots.value != null
          ? extractPanelStrategyListPayload(strategySlots.value)
          : null;

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
      if (rawSlots != null) {
        uiState.panelStrategySlotIdByName = buildPanelStrategySlotIdByName(rawSlots);
        uiState.panelStrategySlotRowsRaw = Array.isArray(rawSlots) ? rawSlots : [];
      }
      if (aiOverview.status === "fulfilled") uiState.lastAiOverview = aiOverview.value;
      if (dailyR.status === "fulfilled" && dailyR.value != null) uiState.lastDaily = dailyR.value;
      if (wlR.status === "fulfilled") uiState.lastWl = wlR.value;
      if (blR.status === "fulfilled") uiState.lastBl = blR.value;
    }

    if (currentSection === "overview" || currentSection === "control" || currentSection === "positions") {
      if (balanceR.status === "fulfilled" && balanceR.value != null) uiState.lastBalance = balanceR.value;
      if (tradesFeedR.status === "fulfilled") uiState.lastTradesMini = tradesFeedR.value;
    }

    const y = uiState.lastCount && typeof uiState.lastCount === "object" ? uiState.lastCount : {};
    const b = uiState.lastProfit && typeof uiState.lastProfit === "object" ? uiState.lastProfit : {};
    const dailyPayload =
      uiState.lastDaily && typeof uiState.lastDaily === "object" ? uiState.lastDaily : {};
    const balancePayload =
      uiState.lastBalance && typeof uiState.lastBalance === "object" ? uiState.lastBalance : {};

    applyTopbarDecor(pingOk, uiState.lastPingLatencyMs);
    uiState.lastPing = pingOk ? { status: "pong" } : { status: "down" };

    if (currentSection === "overview") {
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

      renderRiskExposureMatrix($("riskMatrixCells"), balancePayload);

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
    }

    let statusLeverageForRisk = /** @type {number | null} */ (null);
    if (currentSection === "positions") {
      const balanceR = settled[5];
      const closedTradesR = settled[7];
      const profitAllR = settled[8];
      
      const balance = balanceR && balanceR.status === "fulfilled" && balanceR.value != null ? balanceR.value : null;
      const profitAll = profitAllR && profitAllR.status === "fulfilled" && profitAllR.value != null ? profitAllR.value : null;
      
      try {
        const st = await getStatus();
        statusLeverageForRisk = extractLeverageFromStatusPayload(st);
        uiState.lastStForRisk = Array.isArray(st) ? st : [];
        renderPositionsSectionFromStatus(st, profitAll, balance);
      } catch {
        statusLeverageForRisk = null;
      }
      try {
        if (closedTradesR && closedTradesR.status === "fulfilled" && closedTradesR.value != null) {
          renderClosedTradesFromApi(closedTradesR.value);
        }
      } catch {}
    }

    const showCfg =
      uiState.lastShowConfig && typeof uiState.lastShowConfig === "object" ? uiState.lastShowConfig : {};
    const profitObj =
      uiState.lastProfit && typeof uiState.lastProfit === "object" ? uiState.lastProfit : {};

    if (currentSection === "overview") {
      const riskLeverageValue = $("riskLeverageValue");
      if (riskLeverageValue) riskLeverageValue.textContent = formatTradingModePair(showCfg, statusLeverageForRisk);

      applyOverviewStrategiesTable(
        showCfg,
        profitObj,
        y,
        uiState.lastStForRisk || [],
        t,
        tReplace
      );
    }

    if (currentSection === "control") {
      renderControlHeroAndCards(
        dailyPayload,
        showCfg,
        profitObj,
        uiState.lastHealth && typeof uiState.lastHealth === "object" ? uiState.lastHealth : {},
        uiState.lastProxyHealth,
        uiState.strategyBotSnapshots || {}
      );
    }
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

function setupActionDropdowns() {
  document.querySelectorAll(".action-icon-btn").forEach(btn => {
    btn.removeEventListener("click", toggleDropdown);
    btn.addEventListener("click", toggleDropdown);
  });
  
  document.querySelectorAll(".dropdown-item").forEach(item => {
    item.removeEventListener("click", handleDropdownAction);
    item.addEventListener("click", handleDropdownAction);
  });
  
  document.removeEventListener("click", closeAllDropdowns);
  document.addEventListener("click", closeAllDropdowns);
}

let activeDropdownBtn = null;

function toggleDropdown(e) {
  e.stopPropagation();
  const dropdown = this.parentElement.querySelector(".action-dropdown-menu");
  
  if (dropdown) {
    closeAllDropdowns();
    if (dropdown.style.display === "block") {
      dropdown.style.display = "none";
      activeDropdownBtn = null;
    } else {
      activeDropdownBtn = this;
      updateDropdownPosition();
      dropdown.style.display = "block";
      window.addEventListener("scroll", updateDropdownPosition);
    }
  }
}

function updateDropdownPosition() {
  if (!activeDropdownBtn) return;
  const dropdown = activeDropdownBtn.parentElement.querySelector(".action-dropdown-menu");
  if (dropdown) {
    const rect = activeDropdownBtn.getBoundingClientRect();
    dropdown.style.left = `${rect.right - 190}px`;
    dropdown.style.top = `${rect.bottom + 4}px`;
  }
}

function closeAllDropdowns() {
  document.querySelectorAll(".action-dropdown-menu").forEach(menu => {
    menu.style.display = "none";
  });
  activeDropdownBtn = null;
  window.removeEventListener("scroll", updateDropdownPosition);
}

function handleDropdownAction(e) {
  e.stopPropagation();
  const action = this.dataset.action;
  const tradeId = this.dataset.tradeid;
  
  if (action === "close-menu") {
    const menu = this.parentElement;
    if (menu) {
      menu.style.display = "none";
    }
    activeDropdownBtn = null;
    window.removeEventListener("scroll", updateDropdownPosition);
    return;
  }
  
  if (action === "forceexit-limit") {
    handleForceExit(tradeId, "limit");
  } else if (action === "forceexit-market") {
    handleForceExit(tradeId, "market");
  } else if (action === "forceexit-partial") {
    handleForceExit(tradeId, "partial");
  } else if (action === "cancel-open-order") {
    Modal.confirm({
      title: "取消挂单",
      content: "确定取消挂单吗？",
      okText: "确认",
      cancelText: "取消",
      async onOk() {
        try {
          await deleteTradeOpenOrder(tradeId);
          message.success("取消挂单成功");
          runPanelTickOnce();
        } catch (e) {
          message.error("取消挂单失败");
        }
      }
    });
  } else if (action === "increase-position") {
    if (window.openIncreasePositionModal) {
      const tradeIdNum = Number(tradeId);
      const row = uiState.positionsRows.find(t => 
        Number(t.trade_id) === tradeIdNum || Number(t.id) === tradeIdNum || 
        String(t.trade_id) === String(tradeId) || String(t.id) === String(tradeId)
      );
      const pair = row?.pair || row?.symbol || row?.market || "";
      window.openIncreasePositionModal(tradeId, pair);
    }
  } else if (action === "reload") {
    handleReload(tradeId);
  } else if (action === "delete-trade") {
    handleDeleteTrade(tradeId);
  }
  
  closeAllDropdowns();
}

async function handleForceExit(tradeId, type) {
  if (!tradeId) return;
  
  const tradeIdNum = Number(tradeId);
  const row = uiState.positionsRows.find(t => 
    Number(t.trade_id) === tradeIdNum || Number(t.id) === tradeIdNum || 
    String(t.trade_id) === String(tradeId) || String(t.id) === String(tradeId)
  );
  const amount = row?.amount != null ? parseFloat(row.amount) : null;
  
  if (type === "partial") {
    if (window.openForceExitModal) {
      const pair = row?.pair || "";
      const currentAmount = row?.amount || "0.04";
      const baseCurrency = row?.base_currency || "ETH";
      const currentRate = row?.current_rate || row?.currentRate || 0;
      window.openForceExitModal(tradeId, pair, currentAmount, baseCurrency, currentRate);
    }
  } else if (type === "limit" || type === "market") {
    const orderTypeName = type === "limit" ? "限价单" : "市价单";
    Modal.confirm({
      title: "强制退出交易",
      content: `此操作无法撤销。\n\n真的要用${orderTypeName}平掉这笔交易吗？`,
      okText: "确认",
      cancelText: "取消",
      async onOk() {
        try {
          await postForceSell(tradeId, type, amount);
          message.success("强制退出成功");
          runPanelTickOnce();
        } catch (e) {
          message.error("强制退出失败");
        }
      }
    });
  } else {
    try {
      await postForceExit({ tradeid: Number(tradeId) });
      message.success(t("msg.forceExitSuccess"));
      runPanelTickOnce();
    } catch (e) {
      message.error(t("msg.forceExitFailed"));
    }
  }
}

async function handleDeleteTrade(tradeId) {
  if (!tradeId) return;
  
  Modal.confirm({
    title: "删除交易",
    content: "此操作无法撤销。\n\n确定要删除这笔交易吗？",
    okText: "确认",
    cancelText: "取消",
    async onOk() {
      try {
        await deleteTrade(tradeId);
        message.success("删除成功");
        runPanelTickOnce();
      } catch (e) {
        message.error("删除失败");
      }
    }
  });
}

async function handleReload(tradeId) {
  if (!tradeId) return;
  try {
    await postTradeReload(tradeId);
    message.success("重新加载成功");
    runPanelTickOnce();
  } catch (e) {
    message.error("重新加载失败");
  }
}
