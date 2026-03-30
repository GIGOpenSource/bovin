import { i18n } from "./i18n.js";
import { endpointCatalog } from "./endpoint-catalog.js";
import {
  state,
  uiState,
  persistProfileToLocalStorage,
  applyPanelProfileFromPrefs,
  persistApiBindingsLocalSnapshot,
  clearFreqtradePasswordSession,
  normalizeStrategySlots,
  normalizeManualStrategyNames,
  normalizeStrategyHiddenFromConsole,
  normalizeStrategyEntries,
  syncStrategyEntriesDerivedState,
  defaultStrategyEntry
} from "./state-core.js";
import {
  apiUrlBases,
  effectiveApiBasePrimary,
  effectiveWsApiV1Base,
  rememberSuccessfulApiBase,
  isLikelyLocalDevFront,
  localProxyApiV1Base,
  localProxyHealthUrl,
  normalizeUserRestApiV1Base,
  probeApiBasesByPing,
  reorderBasesForPanelPost,
  clearStoredPreferredApiBase
} from "./api-bases.js";
import { createBovinMessageWsClient, buildMessageWsUrl } from "./bovin-message-ws.js";
import { getCachedJsonGet, setCachedJsonGet } from "./response-cache.js";
import { escapeHtml, safeDataIdAttr, sanitizeSvgCoordinate } from "./html-utils.js";
import {
  renderControlHeroAndCards,
  orderedStrategyNames,
  panelBotTradingApisAvailable,
  normalizeBotState,
  resolvePanelConfigSummary
} from "./control-console.js";
import { PANEL_VERSION, PANEL_VERSION_LABEL } from "./version.js";
import {
  drawPanelKlineCanvas,
  ensurePanelKlineCanvas,
  disconnectPanelKlineResizeObserver,
  observePanelKlineResize
} from "./panel-kline-canvas.js";

function t(key) {
  return i18n[state.lang]?.[key] || i18n["zh-CN"]?.[key] || key;
}

function debugPanel(label, err) {
  try {
    if (typeof console !== "undefined" && typeof console.debug === "function") {
      console.debug(`[panel] ${label}`, err ?? "");
    }
  } catch {
    // ignore
  }
}

const $ = (id) => document.getElementById(id);

let topbarPopoverOpen = null;

function closeTopbarPopovers() {
  topbarPopoverOpen = null;
  $("topbarNotifyPopover")?.classList.add("hidden");
  $("topbarAccountPopover")?.classList.add("hidden");
  $("topbarPopoverBackdrop")?.classList.add("hidden");
  $("topbarNotifyBtn")?.setAttribute("aria-expanded", "false");
  $("topbarAccountBtn")?.setAttribute("aria-expanded", "false");
}

async function fetchLocalProxyHealthSnapshot() {
  try {
    const url = localProxyHealthUrl();
    const ctrl = new AbortController();
    const tid = window.setTimeout(() => ctrl.abort(), 2600);
    const r = await fetch(url, { method: "GET", signal: ctrl.signal });
    window.clearTimeout(tid);
    if (!r.ok) return null;
    const j = await r.json();
    return j && typeof j === "object" ? j : null;
  } catch {
    return null;
  }
}

function syncTradingControlDomAvailability() {
  const show = getLiveShowConfigForControl();
  const ok = panelBotTradingApisAvailable(show, uiState.lastProxyHealth, uiState.lastHealth);
  const syncStart = $("btnSyncConfigAndStart");
  if (syncStart) {
    syncStart.disabled = !ok;
    syncStart.title = ok ? "" : t("sc.tradeMode.syncStartBlocked");
  }
  const fe = $("forceEnter");
  if (fe) {
    fe.disabled = !ok;
    fe.title = ok ? "" : t("sc.tradeMode.forceEnterBlocked");
  }
}

function refreshPanelBackendHint() {
  const el = $("panelBackendBaseHint");
  if (!el) return;
  const override = String(state.baseUrl || "").trim();
  const eff = effectiveApiBasePrimary();
  el.textContent = override
    ? state.lang === "en"
      ? `Effective API base: ${eff} (custom URL).`
      : `当前实际请求：${eff}（已使用下方自定义地址）。`
    : state.lang === "en"
      ? `Effective API base: ${eff} (auto: same site + /api/v1; override only if UI and API are on different origins).`
      : `当前实际请求：${eff}（留空为自动：与当前页面同源 /api/v1，适合与 Bovin 同机同端口部署；仅当面板与 API 不同域时再填写下方地址）。`;
}

const AUTH_DEFAULT_USER = "admin";
const AUTH_DEFAULT_PASSWORD = "admin";
const refreshTimers = [];
/** 仅「数据」分区激活时运行，与概览/持仓轮询分离 */
let dataRealtimeIntervalId = null;
let autoRefreshArmed = false;
/** REST 轮询间隔：有 RPC WebSocket 时略放宽，由服务端推送触发增量刷新 */
const POLL_OVERVIEW_MS = 5000;
const POLL_OVERVIEW_WS_MS = 12000;
const POLL_POSITIONS_MS = 7000;
const POLL_POSITIONS_WS_MS = 10000;
let rpcWsClient = null;
/** 忽略上一轮 WebSocket onclose，避免 stop 后立即重连时误清状态 */
let rpcWsSession = null;
let wsPushDebounceTimer = null;
let wsPushDebounceTimerCandle = null;
const EXCHANGE_BOARD_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];
const LOCAL_PROXY_FETCH_TIMEOUT_MS = 1000;
/** 代理连续不可达时暂停时长；过长会拖累恢复，过短会放大抖动 */
const LOCAL_PROXY_CIRCUIT_MS = 22000;
const LOCAL_PROXY_PROBE_TIMEOUT_MS = 420;
/** K 线轮询间隔（实盘刷新）；仅在数据分区激活时注册定时器 */
const DATA_KLINE_POLL_MS = 2500;
/** 同一次轮询内对锁定源的额外重试次数（瞬时失败） */
const DATA_PIN_IMMEDIATE_RETRIES = 1;
/** 连续多少轮轮询仍失败才放弃锁定并重新并发探测（防总换源） */
const DATA_PIN_POLL_FAILS_BEFORE_REBENCH = 4;
/** 仅 REST …/api/v1 多基址 /ping 择优周期（K 线通道锁定后不再定时重测） */
const DATA_SOURCE_PROBE_INTERVAL_MS = 60_000;
const DATA_PANEL_CANDLE_SOURCE_ORDER = [
  "PROXY_BINANCE",
  "BOVIN_BINANCE",
  "BOVIN_OKX",
  "BOVIN_BYBIT",
  "BOVIN_KUCOIN",
  "BOVIN_COINBASE",
  "BOT_RPC"
];
const DATA_PANEL_BOARD_SOURCE_ORDER = ["PROXY_BINANCE", "BOVIN_BINANCE"];
let lwCreateChart = null;
/** @type {ResizeObserver | null} */
let daKlineResizeObs = null;

/**
 * 新建「API 对接」行时的占位骨架；已保存的配置来自 GET /panel/preferences → api_bindings（SQLite），
 * 不会用这里的 llm* 覆盖你在管理面板里选的 DeepSeek 等。
 */
const BINDING_LABEL_MAX = 120;
const DEFAULT_API_BINDING = {
  bindingLabel: "",
  exchangeName: "binance",
  exchangeRestBaseUrl: "",
  exchangeApiKey: "",
  exchangeApiSecret: "",
  exchangePassphrase: "",
  bindToBot: false,
  enabled: true,
  llmProvider: "deepseek",
  llmBaseUrl: "https://api.deepseek.com/v1",
  llmApiKey: "",
  llmModel: "deepseek-chat"
};

/** 弹窗占位与「Base URL / 模型留空保存」时的回退，按服务商区分（避免 DeepSeek 却写入 api.openai.com）。 */
const LLM_DEFAULTS_BY_PROVIDER = {
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  anthropic: { baseUrl: "https://api.anthropic.com/v1", model: "claude-3-5-sonnet-20241022" },
  google: { baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-1.5-flash" },
  deepseek: { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" }
};

function llmDefaultsForProvider(provider) {
  const k = String(provider || "deepseek").toLowerCase();
  return LLM_DEFAULTS_BY_PROVIDER[k] || LLM_DEFAULTS_BY_PROVIDER.deepseek;
}

function normalizeExchangeIdInput(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function normalizeExchangeRestBaseInput(raw) {
  return String(raw ?? "").trim().replace(/\/+$/, "");
}

/** 弹窗内 ccxt 交易所 id（无可见输入时来自隐藏域；新建默认为 binance）。 */
function effectiveExchangeIdInModal() {
  const raw = normalizeExchangeIdInput($("mExchangeName")?.value ?? "");
  return raw || DEFAULT_API_BINDING.exchangeName;
}

function readExchangeRestBaseFromModal() {
  return normalizeExchangeRestBaseInput($("mExchangeRestBaseUrl")?.value ?? "");
}

function syncExchangePassphraseHintForModal() {
  const note = $("mExchangePassphraseNote");
  if (!note) return;
  const id = effectiveExchangeIdInModal();
  if (id === "binance" || id === "binanceusdm" || id === "binancecoinm") {
    note.textContent = t("modal.api.exchangePassphraseHintBinance");
  } else if (["okx", "kucoin", "bitget", "coinbase"].includes(id)) {
    note.textContent = t("modal.api.exchangePassphraseHintPass");
  } else {
    note.textContent = t("modal.api.exchangePassphraseHintDefault");
  }
}

function applyExchangeFieldsFromBinding(editing) {
  const rest = String(editing?.exchangeRestBaseUrl ?? editing?.exchange_rest_base_url ?? "").trim();
  const urlEl = $("mExchangeRestBaseUrl");
  if (urlEl) urlEl.value = rest;
  const idEl = $("mExchangeName");
  if (idEl) {
    idEl.value =
      String(editing?.exchangeName ?? editing?.exchange_name ?? "")
        .trim()
        .toLowerCase() || DEFAULT_API_BINDING.exchangeName;
  }
  syncExchangePassphraseHintForModal();
}

function readExchangeIdFromModal() {
  return effectiveExchangeIdInModal();
}

function staticOverviewStrategiesTbody() {
  const r = escapeHtml(t("mock.status.executing"));
  const p = escapeHtml(t("mock.status.paused"));
  // 与 mockDb.strategy（SampleStrategy）、/panel/strategies 演示列表及控制台策略卡命名一致
  return `
                <tr><td>SampleStrategy</td><td>BTC/USD</td><td class="positive">+$12,450.00</td><td class="positive">+4.20%</td><td>0.85%</td><td>${r}</td></tr>
                <tr><td>RSITrendStrategy</td><td>ETH/USD</td><td class="positive">+$8,120.45</td><td class="positive">+2.81%</td><td>1.12%</td><td>${r}</td></tr>
                <tr><td>MomentumBreakout</td><td>SOL/USD</td><td>$0.00</td><td>0.00%</td><td>0.00%</td><td>${p}</td></tr>
`;
}

function staticRiskMatrix() {
  return `
                  <div class="cell"><span>${escapeHtml(t("overview.risk.bucket.btc"))}</span><b>38.0%</b><div class="bar"><i style="--ds-risk-bar-pct: 38%"></i></div></div>
                  <div class="cell"><span>${escapeHtml(t("overview.risk.bucket.eth"))}</span><b>27.0%</b><div class="bar"><i class="sec" style="--ds-risk-bar-pct: 27%"></i></div></div>
                  <div class="cell"><span>${escapeHtml(t("overview.risk.bucket.alt"))}</span><b>22.0%</b><div class="bar"><i class="dim" style="--ds-risk-bar-pct: 22%"></i></div></div>
                  <div class="cell"><span>${escapeHtml(t("overview.risk.bucket.stable"))}</span><b>13.0%</b><div class="bar"><i style="--ds-risk-bar-pct: 13%"></i></div></div>
`;
}

function staticGovWlItems() {
  return `
                      <div class="item"><strong>BTC/USDT</strong><small>Binance, Coinbase, Kraken</small><button type="button" class="icon-btn"><span class="material-symbols-outlined">close</span></button></div>
                      <div class="item"><strong>ETH/USDT</strong><small>Binance, Coinbase, Kraken</small><button type="button" class="icon-btn"><span class="material-symbols-outlined">close</span></button></div>
                      <div class="item"><strong>SOL/USDT</strong><small>Binance, Bybit</small><button type="button" class="icon-btn"><span class="material-symbols-outlined">close</span></button></div>
                      <button type="button" class="ghost dashed">${escapeHtml(t("sc.gov.addWl"))}</button>
`;
}

function staticGovBlItems() {
  const liq = escapeHtml(t("sc.gov.riskLiq"));
  const vol = escapeHtml(t("sc.gov.riskVol"));
  const title = escapeHtml(t("sc.gov.autoBlTitle"));
  const body = escapeHtml(t("sc.gov.autoBlBody"));
  return `
                      <div class="item"><strong>PEPE/USDT</strong><small>${liq}</small><button type="button" class="icon-btn"><span class="material-symbols-outlined">undo</span></button></div>
                      <div class="item"><strong>DOGE/USDT</strong><small>${vol}</small><button type="button" class="icon-btn"><span class="material-symbols-outlined">undo</span></button></div>
                      <div class="sc-auto-blacklist"><b>${title}</b>${body}</div>
`;
}

function staticScFeedRows() {
  const demo = escapeHtml(t("demo.tag"));
  const design = state.lang === "en" ? "DESIGN" : "设计稿";
  const t1 = escapeHtml(t("mock.feed.configTitle"));
  const s1 = escapeHtml(t("mock.feed.configUpd"));
  const bought = escapeHtml(t("mock.feed.bought"));
  const sold = escapeHtml(t("mock.feed.sold"));
  const mockLine = escapeHtml(t("mock.feed.mockLine"));
  return `
                <div class="feed-row"><i class="ok"></i><div><b>Trend-Follower-Alpha</b><small>${bought}</small><em>12:04 · BINANCE</em></div></div>
                <div class="feed-row"><i class="pri"></i><div><b>${t1}</b><small>${s1}</small><em>11:58 · SYSTEM</em></div></div>
                <div class="feed-row feed-row-demo"><i class="pri"></i><div><b>Arbitrage-Nexus</b><small>${mockLine}</small><em>— · ${design}</em></div></div>
                <div class="feed-row"><i class="ok"></i><div><b>Trend-Follower-Alpha</b><small>${sold}</small><em>11:45 · COINBASE</em></div></div>
`;
}

const KPI_PATH_DEFAULT = [
  "M0 15 Q 10 18, 20 12 T 40 14 T 60 8 T 80 10 T 100 2",
  "M0 18 L 15 15 L 30 17 L 45 10 L 60 12 L 75 5 L 100 2",
  "M0 2 L 20 5 L 40 4 L 60 12 L 80 15 L 100 18"
];

const RISK_STABLE_BASES = new Set([
  "USDT",
  "USDC",
  "BUSD",
  "TUSD",
  "DAI",
  "FDUSD",
  "USDD",
  "USDP",
  "EUR",
  "USD",
  "GBP",
  "TRY"
]);

function riskBucketKeyFromPair(pair) {
  const base = String(pair || "")
    .split("/")[0]
    .trim()
    .toUpperCase();
  if (!base) return "alt";
  if (base === "BTC") return "btc";
  if (base === "ETH") return "eth";
  if (RISK_STABLE_BASES.has(base)) return "stable";
  return "alt";
}

function pad2(v) {
  return String(v).padStart(2, "0");
}

function formatDateTime(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function formatDateCompact(d) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

function timeframeToMs(timeframe) {
  const m = /^(\d+)([mhd])$/i.exec(timeframe || "");
  if (!m) return 5 * 60 * 1000;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === "m") return n * 60 * 1000;
  if (unit === "h") return n * 60 * 60 * 1000;
  return n * 24 * 60 * 60 * 1000;
}

function timeframeToBinanceInterval(timeframe) {
  const tf = String(timeframe || "1h").toLowerCase();
  if (["1m", "3m", "5m", "15m", "30m", "1h", "4h", "1d"].includes(tf)) return tf;
  return "1h";
}

function barsForTimeframe(timeframe) {
  const tf = String(timeframe || "1h").toLowerCase();
  if (tf === "1m") return 400;
  if (tf === "3m") return 320;
  if (tf === "5m") return 280;
  if (tf === "15m") return 220;
  if (tf === "30m") return 180;
  if (tf === "1h") return 140;
  if (tf === "4h") return 110;
  if (tf === "1d") return 90;
  return 140;
}

function clampNum(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function ensureFallbackViewport(rowsLen, timeframe, pair) {
  const key = `${pair}|${timeframe}|${rowsLen}`;
  const base = clampNum(barsForTimeframe(timeframe), 30, Math.max(30, rowsLen));
  if (uiState.fallbackKey !== key) {
    uiState.fallbackKey = key;
    uiState.fallbackBars = base;
    uiState.fallbackOffset = 0;
  }
  uiState.fallbackBars = clampNum(uiState.fallbackBars || base, 30, Math.max(30, rowsLen));
  const maxOffset = Math.max(0, rowsLen - uiState.fallbackBars);
  uiState.fallbackOffset = clampNum(uiState.fallbackOffset || 0, 0, maxOffset);
}

function sliceFallbackRows(rows, timeframe, pair) {
  const len = rows.length;
  ensureFallbackViewport(len, timeframe, pair);
  const bars = uiState.fallbackBars;
  const offset = uiState.fallbackOffset;
  const end = len - offset;
  const start = Math.max(0, end - bars);
  return rows.slice(start, end);
}

/** 与 sliceFallbackRows 相同的视窗 [start, end)，供面板 Canvas 与 MA 对齐 */
function getFallbackSliceBounds(rows, timeframe, pair) {
  const len = rows.length;
  ensureFallbackViewport(len, timeframe, pair);
  const bars = uiState.fallbackBars;
  const offset = uiState.fallbackOffset;
  const end = len - offset;
  const start = Math.max(0, end - bars);
  return { start, end };
}

function pairToBinanceSymbol(pair) {
  const [base, quote] = String(pair || "BTC/USD").toUpperCase().split("/");
  const q = quote === "USD" ? "USDT" : (quote || "USDT");
  return `${base || "BTC"}${q}`;
}

async function fetchJsonWithTimeout(url, timeoutMs = 2800) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

function isProxyUnreachableError(err) {
  if (!err) return false;
  const msg = String(err.message || err || "").toLowerCase();
  const name = String(err.name || "").toLowerCase();
  if (msg === "local_proxy_circuit") return false;
  if (name === "aborterror" || msg.includes("aborted")) return true;
  if (name === "typeerror" && msg.includes("failed to fetch")) return true;
  if (msg.includes("networkerror") || msg.includes("load failed")) return true;
  if (msg.includes("err_connection_refused") || msg.includes("connection refused")) return true;
  return false;
}

function openProxyCircuitFromProbe(reason = "down") {
  uiState.proxyCircuitOpenUntil = Date.now() + LOCAL_PROXY_CIRCUIT_MS;
  if (uiState.proxyStartupHintShown) return;
  uiState.proxyStartupHintShown = true;
  const msg =
    reason === "bad_health"
      ? "binance_proxy 已启动但 /health 异常，K 线将依赖 Bovin /panel 转发。"
      : "未连接 binance_proxy（192.168.77.46:8000）。请执行 python3 frontend/binance_proxy.py，或确保 Bovin /panel/*_klines 可用。";
  logAction(msg);
}

async function probeLocalProxyAndSetCircuit() {
  if (state.mockMode) return;
  const url = localProxyHealthUrl();
  if (!url.toLowerCase().startsWith("http")) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOCAL_PROXY_PROBE_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (resp.ok) {
      uiState.proxyCircuitOpenUntil = 0;
      return;
    }
    openProxyCircuitFromProbe("bad_health");
  } catch {
    openProxyCircuitFromProbe("down");
  } finally {
    clearTimeout(timer);
  }
}

/** 与 Promise.any 同语义；target 为 es2020 时避免依赖引擎内置 */
function promiseAny(promises) {
  return new Promise((resolve, reject) => {
    const list = Array.isArray(promises) ? promises : [];
    let pending = list.length;
    if (pending === 0) {
      reject(new Error("no promises"));
      return;
    }
    const errors = [];
    for (const p of list) {
      Promise.resolve(p).then(resolve, (err) => {
        errors.push(err);
        pending -= 1;
        if (pending === 0) {
          const e = new Error("all rejected");
          e.errors = errors;
          reject(e);
        }
      });
    }
  });
}

function candlesNonEmpty(c) {
  if (!c || typeof c !== "object") return false;
  const flat = flattenCandlesData(c);
  return Array.isArray(flat.data) && flat.data.length > 0;
}

function firstColIndex(lower, names) {
  for (const n of names) {
    const i = lower.indexOf(n);
    if (i >= 0) return i;
  }
  return -1;
}

/** pair_history 返回的 `columns` 中按候选列名（大小写不敏感）定位下标 */
function historyColIndex(columns, candidates) {
  if (!Array.isArray(columns) || !candidates?.length) return -1;
  const lower = columns.map((c) => String(c).toLowerCase());
  for (const name of candidates) {
    const i = lower.indexOf(String(name).toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

function formatHistoryTimestamp(dateRaw) {
  if (dateRaw == null || dateRaw === "") return "-";
  if (typeof dateRaw === "number" && Number.isFinite(dateRaw)) {
    const ms = dateRaw > 1e12 ? dateRaw : dateRaw > 1e9 ? dateRaw * 1000 : dateRaw * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return formatDateTime(d);
  }
  return String(dateRaw);
}

function historySignalIsOne(v) {
  return v === true || v === 1 || v === "1" || Number(v) === 1;
}

function pickCandleField(obj, keys) {
  if (obj == null || typeof obj !== "object") return undefined;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      const v = obj[k];
      if (v != null && v !== "") return v;
    }
    const lk = String(k).toLowerCase();
    for (const rk of Object.keys(obj)) {
      if (String(rk).toLowerCase() === lk) {
        const v = obj[rk];
        if (v != null && v !== "") return v;
      }
    }
  }
  return undefined;
}

function normalizeCandleDateSlot(dtRaw) {
  if (dtRaw == null || dtRaw === "") return null;
  if (typeof dtRaw === "number" && Number.isFinite(dtRaw)) {
    const ms = dtRaw > 1e12 ? dtRaw : dtRaw > 1e9 ? dtRaw * 1000 : null;
    if (ms != null) {
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) return formatDateTime(d);
    }
    return String(dtRaw);
  }
  if (typeof dtRaw === "string") {
    const ts = Date.parse(dtRaw.includes("T") ? dtRaw : dtRaw.replace(" ", "T"));
    if (Number.isFinite(ts)) return formatDateTime(new Date(ts));
    return dtRaw;
  }
  return String(dtRaw);
}

/**
 * 将单行时间列规范为 toLwTime 可消费的 string | number（毫秒或秒级时间戳）。
 */
function normalizeChartRowTime(dt) {
  if (dt == null || dt === "") return null;
  if (typeof dt === "number") {
    if (!Number.isFinite(dt)) return null;
    return dt;
  }
  if (dt instanceof Date) {
    const ms = dt.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  const s = String(dt).trim();
  return s.length ? s : null;
}

/**
 * 规范为图表使用的 [date, open, high, low, close, volume]；无法解析则返回 null。
 * 支持：6/5 元数组、带 OHLC 字段的普通对象（列名大小写不敏感）。
 * 时间列：数值（币安开盘毫秒/秒）、ISO 或 `YYYY-MM-DD HH:mm:ss` 字符串、Date。
 */
function coerceCandleRowToSix(row) {
  if (row == null) return null;
  if (Array.isArray(row)) {
    if (row.length < 5) return null;
    const dtNorm = normalizeChartRowTime(row[0]);
    if (dtNorm == null) return null;
    const o = Number(row[1]);
    const h = Number(row[2]);
    const l = Number(row[3]);
    const c = Number(row[4]);
    const v = row.length >= 6 ? Number(row[5] ?? 0) : 0;
    if (![o, h, l, c].every(Number.isFinite)) return null;
    if (o <= 0 || h <= 0 || l <= 0 || c <= 0) return null;
    return [dtNorm, o, h, l, c, Number.isFinite(v) && v >= 0 ? v : 0];
  }
  if (typeof row === "object") {
    const dtRaw = pickCandleField(row, ["date", "time", "timestamp", "datetime"]);
    const slot = normalizeCandleDateSlot(dtRaw);
    const o = Number(pickCandleField(row, ["open", "o"]));
    const h = Number(pickCandleField(row, ["high", "h"]));
    const l = Number(pickCandleField(row, ["low", "l"]));
    const c = Number(pickCandleField(row, ["close", "c"]));
    let v = Number(pickCandleField(row, ["volume", "vol", "base_volume", "quote_volume"]) ?? 0);
    if (!Number.isFinite(v) || v < 0) v = 0;
    if (![o, h, l, c].every(Number.isFinite)) return null;
    if (o <= 0 || h <= 0 || l <= 0 || c <= 0) return null;
    const dtOut = slot != null ? slot : dtRaw != null ? String(dtRaw) : null;
    if (dtOut == null || dtOut === "") return null;
    return [dtOut, o, h, l, c, v];
  }
  return null;
}

/**
 * 将 /pair_candles、/pair_history 等带 `columns` 的响应按列名映射为 OHLCV 行，再经 coerce 丢弃非法行。
 */
function normalizeCandlesForChart(candles) {
  if (!candles || typeof candles !== "object") return candles;
  const cols = candles.columns;
  const data = candles.data;
  if (!Array.isArray(cols) || !Array.isArray(data) || !data.length) return candles;
  const lower = cols.map((x) => String(x).toLowerCase());
  const di = firstColIndex(lower, ["date", "time", "timestamp", "datetime"]);
  const oi = firstColIndex(lower, ["open", "o"]);
  const hi = firstColIndex(lower, ["high", "h"]);
  const li = firstColIndex(lower, ["low", "l"]);
  const ci = firstColIndex(lower, ["close", "c"]);
  const vi = firstColIndex(lower, ["volume", "vol", "base_volume", "quote_volume"]);
  if (di < 0 || oi < 0 || hi < 0 || li < 0 || ci < 0) return candles;
  const newData = [];
  for (const row of data) {
    if (!Array.isArray(row)) {
      const six = coerceCandleRowToSix(row);
      if (six) newData.push(six);
      continue;
    }
    const tuple = [
      row[di],
      Number(row[oi]),
      Number(row[hi]),
      Number(row[li]),
      Number(row[ci]),
      vi >= 0 ? Number(row[vi] ?? 0) : 0
    ];
    const six = coerceCandleRowToSix(tuple);
    if (six) newData.push(six);
  }
  return { ...candles, data: newData };
}

/** 列映射后再逐行 coerce，兼容无 columns 的纯数组响应与 JSON 对象行。 */
function flattenCandlesData(candles) {
  const step = normalizeCandlesForChart(candles);
  const raw = Array.isArray(step?.data) ? step.data : [];
  const data = [];
  for (const row of raw) {
    const six = coerceCandleRowToSix(row);
    if (six) data.push(six);
  }
  return { ...step, data };
}

/** K 线挂载点尺寸：优先 mount 的 client 尺寸；若为 0（首帧或 CSS 异常）用 .da-candle-strip 扣掉与 inset 一致的边距估算，避免图表画在 0×0 或错误回退尺寸上 */
function klineMountLayoutBox(mount) {
  if (!mount) return { w: 640, h: 308 };
  let w = Math.floor(mount.clientWidth || 0);
  let h = Math.floor(mount.clientHeight || 0);
  if (w < 48 || h < 48) {
    const strip = typeof mount.closest === "function" ? mount.closest(".da-candle-strip") : null;
    if (strip) {
      const sw = Math.floor(strip.clientWidth || 0);
      const sh = Math.floor(strip.clientHeight || 0);
      const insetX = 8 + 56;
      const insetY = 6 + 6;
      if (sw > insetX) w = Math.max(w, sw - insetX);
      if (sh > insetY) h = Math.max(h, sh - insetY);
    }
  }
  return {
    w: Math.max(320, w || 640),
    h: Math.max(220, h || 308)
  };
}

function disconnectKlineResizeObserver() {
  try {
    daKlineResizeObs?.disconnect();
  } catch {
    // ignore
  }
  daKlineResizeObs = null;
}

function observeKlineMountResize(mount, chart) {
  disconnectKlineResizeObserver();
  if (!mount || !chart || typeof ResizeObserver === "undefined") return;
  const ro = new ResizeObserver(() => {
    const { w, h } = klineMountLayoutBox(mount);
    if (w < 160 || h < 120) return;
    try {
      chart.applyOptions({ width: w, height: h });
    } catch {
      // ignore
    }
  });
  ro.observe(mount);
  daKlineResizeObs = ro;
}

/** 已登录时从 Bovin /pair_candles 取 K 线（不依赖外网交易所域名可达）。 */
async function fetchBotPairCandlesForChart(pair, timeframe) {
  if (!uiState.authed || state.mockMode) throw new Error("skip bot candles");
  const raw = await apiCallSwallow(
    `/pair_candles?pair=${encodeURIComponent(pair)}&timeframe=${encodeURIComponent(timeframe)}`
  );
  if (!raw || typeof raw !== "object") throw new Error("no bot response");
  const normalized = flattenCandlesData(raw);
  if (!candlesNonEmpty(normalized)) throw new Error("empty bot candles");
  return {
    pair: String(normalized.pair || pair),
    timeframe: String(normalized.timeframe || timeframe),
    data: normalized.data
  };
}

/** 经 Bovin 服务端转发币安公共 /api/v3/klines（同源、免浏览器 CORS/451）；需有效 API 凭据（与面板登录一致）。 */
async function fetchBovinBinanceKlines(pair, timeframe) {
  if (state.mockMode) throw new Error("skip bovin binance");
  const qs = new URLSearchParams({
    pair: String(pair || "BTC/USDT"),
    timeframe: String(timeframe || "1h"),
    limit: "500"
  });
  const raw = await apiCallSwallow(`/panel/binance_klines?${qs.toString()}`);
  if (!raw || typeof raw !== "object") throw new Error("no bovin binance response");
  const data = Array.isArray(raw.data) ? raw.data : [];
  if (!data.length) throw new Error("empty bovin binance");
  return {
    pair: String(raw.pair || pair),
    timeframe: String(raw.timeframe || timeframe),
    data
  };
}

/** 经 Bovin 转发 KuCoin 公共 /api/v1/market/candles，避免浏览器直连 api.kucoin.com 的 CORS。 */
async function fetchBovinKucoinKlines(pair, timeframe) {
  if (state.mockMode) throw new Error("skip bovin kucoin");
  const qs = new URLSearchParams({
    pair: String(pair || "BTC/USDT"),
    timeframe: String(timeframe || "1h")
  });
  const raw = await apiCallSwallow(`/panel/kucoin_klines?${qs.toString()}`);
  if (!raw || typeof raw !== "object") throw new Error("no bovin kucoin response");
  const data = Array.isArray(raw.data) ? raw.data : [];
  if (!data.length) throw new Error("empty bovin kucoin");
  return {
    pair: String(raw.pair || pair),
    timeframe: String(raw.timeframe || timeframe),
    data
  };
}

async function fetchBovinBybitKlines(pair, timeframe) {
  if (state.mockMode) throw new Error("skip bovin bybit");
  const qs = new URLSearchParams({
    pair: String(pair || "BTC/USDT"),
    timeframe: String(timeframe || "1h")
  });
  const raw = await apiCallSwallow(`/panel/bybit_klines?${qs.toString()}`);
  if (!raw || typeof raw !== "object") throw new Error("no bovin bybit response");
  const data = Array.isArray(raw.data) ? raw.data : [];
  if (!data.length) throw new Error("empty bovin bybit");
  return {
    pair: String(raw.pair || pair),
    timeframe: String(raw.timeframe || timeframe),
    data
  };
}

async function fetchBovinCoinbaseKlines(pair, timeframe) {
  if (state.mockMode) throw new Error("skip bovin coinbase");
  const qs = new URLSearchParams({
    pair: String(pair || "BTC/USD"),
    timeframe: String(timeframe || "1h")
  });
  const raw = await apiCallSwallow(`/panel/coinbase_klines?${qs.toString()}`);
  if (!raw || typeof raw !== "object") throw new Error("no bovin coinbase response");
  const data = Array.isArray(raw.data) ? raw.data : [];
  if (!data.length) throw new Error("empty bovin coinbase");
  return {
    pair: String(raw.pair || pair),
    timeframe: String(raw.timeframe || timeframe),
    data
  };
}

async function fetchBovinOkxKlines(pair, timeframe) {
  if (state.mockMode) throw new Error("skip bovin okx");
  const qs = new URLSearchParams({
    pair: String(pair || "BTC/USDT"),
    timeframe: String(timeframe || "1h")
  });
  const raw = await apiCallSwallow(`/panel/okx_klines?${qs.toString()}`);
  if (!raw || typeof raw !== "object") throw new Error("no bovin okx response");
  const data = Array.isArray(raw.data) ? raw.data : [];
  if (!data.length) throw new Error("empty bovin okx");
  return {
    pair: String(raw.pair || pair),
    timeframe: String(raw.timeframe || timeframe),
    data
  };
}

/** 同源 Bovin 转发币安 24h ticker（避免浏览器直连 api.binance 触发 CORS）。 */
async function fetchBovinBinanceBoard() {
  const raw = await apiCallSwallow("/panel/binance_board");
  if (!raw || typeof raw !== "object") throw new Error("no bovin binance board");
  const board = Array.isArray(raw.board) ? raw.board : [];
  if (!board.length) throw new Error("empty bovin binance board");
  return board;
}

function updateDataNetStatus(mode = "LIVE", retries = 0) {
  uiState.dataNetMode = String(mode || "LIVE").toUpperCase();
  uiState.dataNetRetries = Math.max(0, Number(retries || 0));
  const el = $("daNetStatus");
  if (!el) return;
  el.classList.remove("live", "retry", "fallback");
  const cls = uiState.dataNetMode === "FALLBACK" ? "fallback" : (uiState.dataNetMode === "RETRY" ? "retry" : "live");
  el.classList.add(cls);
  const modeKey = `data.netMode.${uiState.dataNetMode}`;
  const modeLabel = t(modeKey) !== modeKey ? t(modeKey) : uiState.dataNetMode;
  el.textContent = `${modeLabel} · R${uiState.dataNetRetries}`;
}

function updateDataSourceLabel(source = "NONE") {
  const el = $("daDataSource");
  if (!el) return;
  const code = String(source || "NONE").toUpperCase();
  uiState.lastDataSourceCode = code;
  el.textContent = `${t("data.sourceLabel")}: ${code}`;
}

/** 数据区图表上方条（在 #pairData 外），避免角标提示被 overflow/画布挡住 */
function clearDaKlineStatus() {
  const el = $("daKlineStatus");
  if (!el) return;
  el.classList.add("hidden");
  el.innerHTML = "";
}

function showDaKlineStatusText(text) {
  const el = $("daKlineStatus");
  if (!el) return;
  el.classList.remove("hidden");
  el.textContent = String(text ?? "");
}

function showDaKlineStatusHtml(html) {
  const el = $("daKlineStatus");
  if (!el) return;
  el.classList.remove("hidden");
  el.innerHTML = String(html ?? "");
}

function klineStatusRetrySuffix(labelKey = "kline.retry") {
  return `<span class="da-kline-status-actions"><button type="button" class="ghost tiny" data-kline-retry>${escapeHtml(t(labelKey))}</button></span>`;
}

async function fetchLocalProxyKlines(symbol, interval, limit = 500) {
  if (Date.now() < uiState.proxyCircuitOpenUntil) {
    throw new Error("LOCAL_PROXY_CIRCUIT");
  }
  const url = `${localProxyApiV1Base()}/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${encodeURIComponent(String(limit))}`;
  let rows;
  try {
    rows = await fetchJsonWithTimeout(url, LOCAL_PROXY_FETCH_TIMEOUT_MS);
    uiState.proxyCircuitOpenUntil = 0;
  } catch (err) {
    if (isProxyUnreachableError(err)) {
      uiState.proxyCircuitOpenUntil = Date.now() + LOCAL_PROXY_CIRCUIT_MS;
    }
    throw err;
  }
  if (rows && typeof rows === "object" && !Array.isArray(rows)) {
    if (rows.error != null) throw new Error(String(rows.error || "proxy klines error"));
    if (Array.isArray(rows.data)) rows = rows.data;
    else if (Array.isArray(rows.klines)) rows = rows.klines;
    else rows = [];
  }
  if (!Array.isArray(rows) || !rows.length) throw new Error("empty proxy klines");

  const data = [];
  for (const r of rows) {
    if (!Array.isArray(r) || r.length < 5) continue;
    const tOpen = Number(r[0]);
    const o = Number(r[1]);
    const h = Number(r[2]);
    const l = Number(r[3]);
    const c = Number(r[4]);
    const v = r.length >= 6 ? Number(r[5] ?? 0) : 0;
    if (![tOpen, o, h, l, c].every(Number.isFinite)) continue;
    if (o <= 0 || h <= 0 || l <= 0 || c <= 0) continue;
    data.push([tOpen, o, h, l, c, Number.isFinite(v) && v >= 0 ? v : 0]);
  }
  if (!data.length) throw new Error("empty proxy klines parsed");

  const sym = String(symbol || "BTCUSDT").toUpperCase();
  const pair = sym.endsWith("USDT")
    ? `${sym.slice(0, -4)}/USD`
    : sym.endsWith("USDC")
      ? `${sym.slice(0, -4)}/USDC`
      : sym.replace(/USDT/i, "/USD");
  return { pair, timeframe: interval, data };
}

async function fetchLocalProxyBoard() {
  if (Date.now() < uiState.proxyCircuitOpenUntil) {
    throw new Error("LOCAL_PROXY_CIRCUIT");
  }
  const symbols = JSON.stringify(EXCHANGE_BOARD_SYMBOLS);
  const url = `${localProxyApiV1Base()}/ticker24hr?symbols=${encodeURIComponent(symbols)}`;
  let list;
  try {
    list = await fetchJsonWithTimeout(url, LOCAL_PROXY_FETCH_TIMEOUT_MS);
    uiState.proxyCircuitOpenUntil = 0;
  } catch (err) {
    if (isProxyUnreachableError(err)) {
      uiState.proxyCircuitOpenUntil = Date.now() + LOCAL_PROXY_CIRCUIT_MS;
    }
    throw err;
  }
  if (list && typeof list === "object" && !Array.isArray(list)) {
    if (list.error != null) throw new Error(String(list.error || "proxy ticker error"));
    if (Array.isArray(list.data)) list = list.data;
    else list = [];
  }
  return (Array.isArray(list) ? list : []).map((x) => ({
    symbol: String(x.symbol || ""),
    price: Number(x.lastPrice || 0),
    pct: Number(x.priceChangePercent || 0)
  }));
}

function createCandleSourceJobs(pair, timeframe, symbol, interval) {
  const wrap = (label, p) =>
    Promise.resolve(p).then((c) => {
      const merged = { ...(c && typeof c === "object" ? c : {}), pair, timeframe };
      const flat = flattenCandlesData(merged);
      if (!Array.isArray(flat.data) || flat.data.length === 0) throw new Error("empty candles");
      return { label, candles: flat };
    });
  return {
    BOVIN_BINANCE: () => wrap("BOVIN_BINANCE", fetchBovinBinanceKlines(pair, timeframe)),
    BOVIN_OKX: () => wrap("BOVIN_OKX", fetchBovinOkxKlines(pair, timeframe)),
    BOVIN_BYBIT: () => wrap("BOVIN_BYBIT", fetchBovinBybitKlines(pair, timeframe)),
    BOVIN_KUCOIN: () => wrap("BOVIN_KUCOIN", fetchBovinKucoinKlines(pair, timeframe)),
    BOVIN_COINBASE: () => wrap("BOVIN_COINBASE", fetchBovinCoinbaseKlines(pair, timeframe)),
    BOT_RPC: () => wrap("BOT_RPC", fetchBotPairCandlesForChart(pair, timeframe)),
    PROXY_BINANCE: () => wrap("PROXY_BINANCE", fetchLocalProxyKlines(symbol, interval))
  };
}

function createBoardSourceJobs() {
  const wrapBoard = (label, p) =>
    Promise.resolve(p).then((list) => {
      const arr = Array.isArray(list) ? list : [];
      if (!arr.length) throw new Error("empty board");
      return { label, board: arr };
    });
  return {
    BOVIN_BINANCE: () => wrapBoard("BOVIN_BINANCE", fetchBovinBinanceBoard()),
    PROXY_BINANCE: () => wrapBoard("PROXY_BINANCE", fetchLocalProxyBoard())
  };
}

async function fetchWithImmediateRetries(factory, extraRetries) {
  let lastErr;
  const n = Math.max(0, Number(extraRetries) || 0);
  for (let a = 0; a <= n; a++) {
    try {
      return await factory();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/**
 * 锁定源：同轮内重试 + 连续多轮失败才放弃并重新探测，减少偶发超时导致总换源。
 */
async function fetchCandlesFastestAvailable({ pair, timeframe, symbol, interval }) {
  const jobs = createCandleSourceJobs(pair, timeframe, symbol, interval);
  const pin = String(uiState.dataCandleSourcePinned || "").trim();
  if (pin && jobs[pin]) {
    try {
      const out = await fetchWithImmediateRetries(() => jobs[pin](), DATA_PIN_IMMEDIATE_RETRIES);
      uiState.dataCandlePinFailStreak = 0;
      return out;
    } catch {
      uiState.dataCandlePinFailStreak = (uiState.dataCandlePinFailStreak || 0) + 1;
      if (uiState.dataCandlePinFailStreak < DATA_PIN_POLL_FAILS_BEFORE_REBENCH) {
        throw new Error("DATA_PIN_HOLD");
      }
      uiState.dataCandleSourcePinned = "";
      uiState.dataCandlePinFailStreak = 0;
    }
  }

  const benchOut = await benchmarkCandleSources();
  if (benchOut) {
    uiState.dataCandlePinFailStreak = 0;
    return benchOut;
  }

  const preferred = uiState.dataCandleSourceOrder.filter((k) => jobs[k]);
  const rest = DATA_PANEL_CANDLE_SOURCE_ORDER.filter((k) => jobs[k] && !preferred.includes(k));
  const order = [...preferred, ...rest];
  for (const label of order) {
    try {
      const out = await jobs[label]();
      uiState.dataCandleSourcePinned = label;
      uiState.dataCandlePinFailStreak = 0;
      return out;
    } catch {
      // next
    }
  }
  const picked = await promiseAny(order.map((label) => jobs[label]()));
  if (picked && picked.label) uiState.dataCandleSourcePinned = String(picked.label);
  uiState.dataCandlePinFailStreak = 0;
  return picked;
}

async function fetchBoardFastestAvailable() {
  const jobs = createBoardSourceJobs();
  const pin = String(uiState.dataBoardSourcePinned || "").trim();
  if (pin && jobs[pin]) {
    try {
      const out = await fetchWithImmediateRetries(() => jobs[pin](), DATA_PIN_IMMEDIATE_RETRIES);
      uiState.dataBoardPinFailStreak = 0;
      return out;
    } catch {
      uiState.dataBoardPinFailStreak = (uiState.dataBoardPinFailStreak || 0) + 1;
      if (uiState.dataBoardPinFailStreak < DATA_PIN_POLL_FAILS_BEFORE_REBENCH) {
        throw new Error("DATA_PIN_HOLD");
      }
      uiState.dataBoardSourcePinned = "";
      uiState.dataBoardPinFailStreak = 0;
    }
  }

  const benchOut = await benchmarkBoardSources();
  if (benchOut) {
    uiState.dataBoardPinFailStreak = 0;
    return benchOut;
  }

  const preferred = uiState.dataBoardSourceOrder.filter((k) => jobs[k]);
  const rest = DATA_PANEL_BOARD_SOURCE_ORDER.filter((k) => jobs[k] && !preferred.includes(k));
  const order = [...preferred, ...rest];
  for (const label of order) {
    try {
      const out = await jobs[label]();
      uiState.dataBoardSourcePinned = label;
      uiState.dataBoardPinFailStreak = 0;
      return out;
    } catch {
      // next
    }
  }
  const picked = await promiseAny(DATA_PANEL_BOARD_SOURCE_ORDER.map((label) => jobs[label]()));
  if (picked && picked.label) uiState.dataBoardSourcePinned = String(picked.label);
  uiState.dataBoardPinFailStreak = 0;
  return picked;
}

/** 并发探测各 K 线通道延迟；更新排序与锁定；返回延迟最低者的结果（可直接作为本次拉取，避免再请求一次）。 */
async function benchmarkCandleSources() {
  const { pair, timeframe } = getDataSelection();
  const symbol = pairToBinanceSymbol(pair);
  const interval = timeframeToBinanceInterval(timeframe);
  const jobs = createCandleSourceJobs(pair, timeframe, symbol, interval);
  const labels = DATA_PANEL_CANDLE_SOURCE_ORDER.filter((k) => jobs[k]);
  const rows = await Promise.all(
    labels.map(async (label) => {
      const t0 =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      try {
        const out = await jobs[label]();
        const t1 =
          typeof performance !== "undefined" && typeof performance.now === "function"
            ? performance.now()
            : Date.now();
        return { label, ms: t1 - t0, ok: true, out };
      } catch {
        return { label, ms: Number.POSITIVE_INFINITY, ok: false };
      }
    })
  );
  const ok = rows.filter((r) => r.ok).sort((a, b) => a.ms - b.ms);
  const bad = rows.filter((r) => !r.ok).map((r) => r.label);
  uiState.dataCandleSourceOrder = [...ok.map((r) => r.label), ...bad];
  if (!ok.length) {
    uiState.dataCandleSourcePinned = "";
    return null;
  }
  uiState.dataCandleSourcePinned = ok[0].label;
  return ok[0].out;
}

/** 同上，行情条通道。 */
async function benchmarkBoardSources() {
  const jobs = createBoardSourceJobs();
  const labels = DATA_PANEL_BOARD_SOURCE_ORDER.filter((k) => jobs[k]);
  const rows = await Promise.all(
    labels.map(async (label) => {
      const t0 =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      try {
        const out = await jobs[label]();
        const t1 =
          typeof performance !== "undefined" && typeof performance.now === "function"
            ? performance.now()
            : Date.now();
        return { label, ms: t1 - t0, ok: true, out };
      } catch {
        return { label, ms: Number.POSITIVE_INFINITY, ok: false };
      }
    })
  );
  const ok = rows.filter((r) => r.ok).sort((a, b) => a.ms - b.ms);
  const bad = rows.filter((r) => !r.ok).map((r) => r.label);
  uiState.dataBoardSourceOrder = [...ok.map((r) => r.label), ...bad];
  if (!ok.length) {
    uiState.dataBoardSourcePinned = "";
    return null;
  }
  uiState.dataBoardSourcePinned = ok[0].label;
  return ok[0].out;
}

async function pingAuthenticatedApiBase(base) {
  const url = `${String(base).replace(/\/+$/, "")}/ping`;
  const r = await fetch(url, {
    headers: { Authorization: authHeader({}), Accept: "application/json" }
  });
  if (!r.ok) throw new Error(String(r.status));
  await r.json();
}

/**
 * 每分钟（及登录后）：仅对各 REST …/api/v1 基址测 /ping，将最快者写入 ft_api_base_last_ok。
 * K 线/行情条通道不在此重测：由 fetch* 在「无锁定或锁定失败」时探测一次并锁定延迟最低者，之后一直用该通道直至再次失败。
 */
async function runDataPanelLatencyProbe() {
  if (state.mockMode || !uiState.authed || uiState.dataSourceProbeBusy) return;
  if (document.visibilityState === "hidden") return;
  uiState.dataSourceProbeBusy = true;
  try {
    await probeApiBasesByPing(pingAuthenticatedApiBase);
    uiState.dataSourceProbeLastAt = Date.now();
  } catch (e) {
    debugPanel("dataSourceProbe", e);
  } finally {
    uiState.dataSourceProbeBusy = false;
  }
}

function parseTimerange(timerange) {
  const m = /^(\d{8})-(\d{8})$/.exec(timerange || "");
  if (!m) return null;
  const parse = (s) => new Date(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)), 0, 0, 0, 0);
  const start = parse(m[1]);
  const end = parse(m[2]);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
  return { start, end };
}

function defaultRecentTimerange(days = 90) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return `${formatDateCompact(start)}-${formatDateCompact(end)}`;
}

function buildMockSeries({ pair, timeframe, timerange, withSignals = false, maxPoints = 2500 }) {
  const parsed = parseTimerange(timerange) || parseTimerange(defaultRecentTimerange(90));
  const step = timeframeToMs(timeframe);
  const startMs = parsed.start.getTime();
  const endMs = parsed.end.getTime() + (24 * 60 * 60 * 1000 - 1);
  const total = Math.max(1, Math.floor((endMs - startMs) / step) + 1);
  const points = Math.min(total, maxPoints);
  const stride = Math.max(1, Math.ceil(total / points));
  const base = pair.startsWith("ETH") ? 3200 : pair.startsWith("SOL") ? 140 : 64000;
  const rows = [];

  for (let i = 0; i < total; i += stride) {
    const ts = startMs + i * step;
    const wave = Math.sin(i / 18) * (base * 0.008);
    const drift = (i / total) * (base * 0.015);
    const open = base + wave + drift;
    const close = open + Math.sin(i / 7) * (base * 0.0025);
    const high = Math.max(open, close) + base * 0.0018;
    const low = Math.min(open, close) - base * 0.0018;
    const volume = 60 + Math.abs(Math.sin(i / 5)) * 180;
    const date = formatDateTime(new Date(ts));
    if (withSignals) {
      const rsi = 50 + Math.sin(i / 9) * 18;
      const enterLong = i % 47 === 0 ? 1 : 0;
      const exitLong = i % 61 === 0 ? 1 : 0;
      rows.push([
        date,
        Number(open.toFixed(2)),
        Number(high.toFixed(2)),
        Number(low.toFixed(2)),
        Number(close.toFixed(2)),
        Number(volume.toFixed(2)),
        Number(rsi.toFixed(2)),
        enterLong,
        exitLong
      ]);
    } else {
      rows.push([
        date,
        Number(open.toFixed(2)),
        Number(high.toFixed(2)),
        Number(low.toFixed(2)),
        Number(close.toFixed(2)),
        Number(volume.toFixed(2))
      ]);
    }
  }
  return rows;
}

function generateMockTrades(days = 90, count = 220) {
  const pairs = ["BTC/USD", "ETH/USD", "SOL/USD", "ADA/USD"];
  const now = Date.now();
  const span = days * 24 * 60 * 60 * 1000;
  const trades = [];
  for (let i = 0; i < count; i += 1) {
    const closeTs = now - Math.floor((i / count) * span);
    const openTs = closeTs - (30 + (i % 18) * 15) * 60 * 1000;
    const profit = Math.sin(i / 5) * 14 + Math.cos(i / 11) * 5;
    trades.push({
      trade_id: count - i,
      pair: pairs[i % pairs.length],
      open_date: formatDateTime(new Date(openTs)),
      close_date: formatDateTime(new Date(closeTs)),
      profit_abs: Number(profit.toFixed(2))
    });
  }
  return trades;
}

function generateMockLogs(entries = 320) {
  const modules = ["bovin", "rpc.api_server", "strategy", "wallets", "bot"];
  const levels = ["INFO", "INFO", "INFO", "WARNING"];
  const msgs = [
    "mock heartbeat ok",
    "pairlist refresh completed",
    "new candle processed",
    "entry signal detected",
    "risk check passed",
    "periodic status update"
  ];
  const out = [];
  const now = Date.now();
  for (let i = 0; i < entries; i += 1) {
    const ts = now - i * 15 * 60 * 1000;
    out.push([
      formatDateTime(new Date(ts)),
      ts,
      modules[i % modules.length],
      levels[i % levels.length],
      msgs[i % msgs.length]
    ]);
  }
  return out;
}

const mockDb = {
  botState: "running",
  runmode: "dry_run",
  strategy: "SampleStrategy",
  whitelist: ["BTC/USD", "ETH/USD", "SOL/USD"],
  blacklist: ["PEPE/USD"],
  positions: [
    { pair: "BTC/USD", is_short: false, open_rate: 64000, profit_abs: 18.25, open_since: "20m" },
    { pair: "ETH/USD", is_short: false, open_rate: 3200, profit_abs: -4.7, open_since: "1h 10m" }
  ],
  trades: generateMockTrades(90, 220),
  logs: generateMockLogs(320),
  panelUsers: [
    {
      id: 1,
      username: "admin",
      password: "admin",
      menuPermissions: {
        overview: "edit",
        positions: "edit",
        control: "edit",
        data: "edit",
        settings: "edit",
        api: "edit",
        monitor: "edit"
      }
    }
  ]
};

let mockPanelUserIdSeq = 2;

const PANEL_MENU_KEYS = ["overview", "positions", "control", "data", "settings", "monitor", "api"];

function normalizeMenuPermsFromBody(raw) {
  const o = {};
  for (const k of PANEL_MENU_KEYS) {
    const v = raw && raw[k] != null ? String(raw[k]).toLowerCase() : "read";
    if (v === "edit") o[k] = "edit";
    else if (v === "hidden") o[k] = "hidden";
    else o[k] = "read";
  }
  return o;
}

function defaultFullMenuPermissions() {
  const o = {};
  for (const k of PANEL_MENU_KEYS) o[k] = "edit";
  return o;
}

const LS_JWT_ACCESS = "ft_jwt_access";
const LS_JWT_REFRESH = "ft_jwt_refresh";

function readStoredAccessToken() {
  try {
    return String(localStorage.getItem(LS_JWT_ACCESS) || "").trim();
  } catch {
    return "";
  }
}

function readStoredRefreshToken() {
  try {
    return String(localStorage.getItem(LS_JWT_REFRESH) || "").trim();
  } catch {
    return "";
  }
}

function storeApiTokens(accessToken, refreshToken) {
  try {
    if (accessToken) localStorage.setItem(LS_JWT_ACCESS, String(accessToken).trim());
    if (refreshToken) localStorage.setItem(LS_JWT_REFRESH, String(refreshToken).trim());
  } catch {
    // quota / private mode
  }
}

function storeApiAccessTokenOnly(accessToken) {
  try {
    if (accessToken) localStorage.setItem(LS_JWT_ACCESS, String(accessToken).trim());
  } catch {
    // ignore
  }
}

function clearApiTokens() {
  try {
    localStorage.removeItem(LS_JWT_ACCESS);
    localStorage.removeItem(LS_JWT_REFRESH);
  } catch {
    // ignore
  }
}

function buildBasicAuthHeader(username, password) {
  const u = String(username ?? "");
  const p = String(password ?? "");
  const pair = `${u}:${p}`;
  try {
    return `Basic ${btoa(pair)}`;
  } catch {
    const bytes = new TextEncoder().encode(pair);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
    return `Basic ${btoa(bin)}`;
  }
}

/**
 * REST 鉴权：优先短期 JWT（可跨标签）；否则 HTTP Basic。
 * `forceBasic`: 登录等场景须用刚输入的 Basic，禁止沿用本地旧 Bearer（否则会 401 且无法登入）。
 */
function authHeader(opts) {
  const forceBasic = opts && opts.forceBasic === true;
  if (!forceBasic) {
    const jwt = readStoredAccessToken();
    if (jwt) return `Bearer ${jwt}`;
  }
  return buildBasicAuthHeader(state.username, state.password);
}

/**
 * 登录成功后用当前 Basic 换 JWT，使新标签页可用 refresh_token 续期，无需 sessionStorage 密码。
 */
async function exchangeBasicForJwtTokens() {
  if (state.mockMode) return true;
  const u = String(state.username ?? "").trim();
  const p = String(state.password ?? "");
  if (!u || !p) return false;
  const basic = buildBasicAuthHeader(u, p);
  for (const base of apiUrlBases()) {
    try {
      const url = `${base.replace(/\/+$/, "")}/token/login`;
      const r = await fetch(url, {
        method: "POST",
        headers: { Authorization: basic, Accept: "application/json" }
      });
      const raw = await r.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }
      if (r.ok && data?.access_token && data?.refresh_token) {
        storeApiTokens(data.access_token, data.refresh_token);
        rememberSuccessfulApiBase(base);
        return true;
      }
    } catch {
      // try next base
    }
  }
  return false;
}

/** POST /token/refresh；成功则只更新 access_token。 */
async function refreshAccessTokenWithStoredRefresh() {
  const rt = readStoredRefreshToken();
  if (!rt) return false;
  for (const base of apiUrlBases()) {
    try {
      const url = `${base.replace(/\/+$/, "")}/token/refresh`;
      const r = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${rt}`, Accept: "application/json" }
      });
      const raw = await r.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }
      if (r.ok && data?.access_token) {
        storeApiAccessTokenOnly(data.access_token);
        rememberSuccessfulApiBase(base);
        return true;
      }
    } catch {
      // next base
    }
  }
  return false;
}

function isMixedContentApiSetup() {
  if (location.protocol !== "https:") return false;
  const first = String(effectiveApiBasePrimary() || "").trim().toLowerCase();
  return first.startsWith("http:");
}

function shouldShowEnvHintBanner() {
  if (location.protocol === "file:") return true;
  if (isMixedContentApiSetup()) return true;
  const h = String(location.href || "");
  if (/vscode-webview|vscode-resource|vscode-cdn/i.test(h)) return true;
  try {
    if (typeof globalThis.acquireVsCodeApi === "function") return true;
  } catch {
    // ignore
  }
  return false;
}

const FETCH_FAIL_MIXED_CONTENT_HINT =
    "\n\n很可能属于「混合内容」拦截：页面是 HTTPS，API 是 http://127.0.0.1…，浏览器会阻止此类请求（控制台可能显示 mixed content）。请在终端运行 frontend/start_frontend.sh，用 Chrome/Safari 打开 http://127.0.0.1:3000/（地址栏必须是 http://，不要用编辑器的 HTTPS 预览），并确保已启动 binance_proxy.py 与 Bovin。";

const FETCH_FAIL_EDITOR_HINT =
  "\n\n若正在使用 Cursor / VS Code 内置预览：访问本机 HTTP API 常被拦截（Failed to fetch），宿主还可能限制 CSP。请仍改用系统浏览器，通过 http://127.0.0.1:3000/ 打开本页面。";

function fetchFailContextHint() {
  if (isMixedContentApiSetup()) return FETCH_FAIL_MIXED_CONTENT_HINT;
  return FETCH_FAIL_EDITOR_HINT;
}

/** Python http.server 等对 POST 返回 501 HTML；与 Bovin JSON 错误区分。 */
function isPanelPost501StaticServerError(message) {
  const s = String(message || "");
  return (
    /\b501\b/.test(s) &&
    (/Unsupported method/i.test(s) ||
      /NOT_IMPLEMENTED/i.test(s) ||
      /<title>Error response<\/title>/i.test(s) ||
      /Error code: 501/i.test(s))
  );
}

function mountEnvHintBanner() {
  if (document.getElementById("ftEnvHintBanner")) return;
  if (!shouldShowEnvHintBanner()) return;
  const bar = document.createElement("aside");
  bar.id = "ftEnvHintBanner";
  bar.className = "ft-env-hint-banner";
  bar.setAttribute("role", "status");
  const lang = localStorage.getItem("ft_lang") || "zh-CN";
  bar.textContent =
    lang === "en"
      ? "Environment warning: file://, HTTPS preview, or in-editor browser may block http://127.0.0.1 API (mixed content/CSP). Use a system browser at http://127.0.0.1:3000/ with binance_proxy + Bovin, or deploy API behind HTTPS same-origin."
      : "环境提示：HTTPS 预览、file:// 或编辑器内置页访问 http://127.0.0.1 API 常失败（混合内容或 CSP）。请用系统浏览器打开 http://127.0.0.1:3000/，并运行 binance_proxy 与 Bovin；正式环境请同源 HTTPS 反代 API。";
  document.body.insertBefore(bar, document.body.firstChild);
}

async function apiCall(endpoint, method = "GET", body, fetchOpts = {}) {
  if (state.mockMode) {
    return mockApiCall(endpoint, method, body);
  }
  const rawOpts = fetchOpts && typeof fetchOpts === "object" ? fetchOpts : {};
  const panel501Retried = rawOpts.__panelPost501Retried === true;
  const fetchOptsClean = { ...rawOpts };
  delete fetchOptsClean.__panelPost501Retried;

  const forceBasicAuth = fetchOptsClean.forceBasicAuth === true;
  const endpointPath = endpoint.split("?")[0];
  const cacheable =
    method === "GET" &&
    (endpointPath.startsWith("/pair_candles") ||
      endpointPath.startsWith("/pair_history") ||
      endpointPath.startsWith("/panel/binance_klines") ||
      endpointPath.startsWith("/panel/kucoin_klines") ||
      endpointPath.startsWith("/panel/bybit_klines") ||
      endpointPath.startsWith("/panel/coinbase_klines") ||
      endpointPath.startsWith("/panel/okx_klines"));
  let lastErr = null;
  let bases = apiUrlBases();
  if (method === "POST" && endpointPath.startsWith("/panel/")) {
    bases = reorderBasesForPanelPost(bases);
  }
  for (const base of bases) {
    const url = `${base}${endpoint}`;
    if (cacheable) {
      const hit = getCachedJsonGet(url);
      if (hit !== null) return hit;
    }
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const options = {
        method,
        headers: {
          "Authorization": authHeader({ forceBasic: forceBasicAuth }),
          "Content-Type": "application/json"
        }
      };
      if (body) options.body = JSON.stringify(body);
      try {
        const response = await fetch(url, options);
        const raw = await response.text();
        let data = raw;
        try {
          data = JSON.parse(raw);
        } catch {
          // keep text
        }
        if (
          !response.ok &&
          response.status === 401 &&
          attempt === 0 &&
          !forceBasicAuth &&
          readStoredRefreshToken() &&
          (await refreshAccessTokenWithStoredRefresh())
        ) {
          continue;
        }
        if (!response.ok) {
          throw new Error(`${method} ${endpoint} failed: ${response.status} ${JSON.stringify(data)}`);
        }
        if (cacheable) setCachedJsonGet(url, data);
        rememberSuccessfulApiBase(base);
        return data;
      } catch (e) {
        lastErr = e;
        break;
      }
    }
  }
  const baseMsg = lastErr?.message || String(lastErr || "request failed");
  const hint = /Failed to fetch|NetworkError|Load failed/i.test(baseMsg)
    ? ` — 请先运行 python3 frontend/binance_proxy.py，或在设置将 Base URL 改为 http://192.168.77.46:8000/api/v1。${fetchFailContextHint()}`
    : "";
  const panel501 =
    /\b501\b/.test(baseMsg) &&
    /Unsupported method|NOT_IMPLEMENTED|Error response/i.test(baseMsg)
      ? ` — ${t("api.hint.panelPost501")}`
      : "";
  const err = new Error(baseMsg + hint + panel501);
  if (
    !panel501Retried &&
    method === "POST" &&
    endpointPath.startsWith("/panel/") &&
    isPanelPost501StaticServerError(baseMsg)
  ) {
    clearStoredPreferredApiBase();
    try {
      return await apiCall(endpoint, method, body, { ...fetchOptsClean, __panelPost501Retried: true });
    } catch (e2) {
      throw e2;
    }
  }
  throw err;
}

/**
 * 对固定 …/api/v1 基址发请求（多 trade 实例）；空基址回退全局 apiCall。
 * 不写入 ft_api_base_last_ok，避免覆盖主连接探测结果。
 */
async function apiCallAtBase(apiV1Base, endpoint, method = "GET", body, fetchOpts = {}) {
  const baseNorm = String(apiV1Base || "").trim().replace(/\/+$/, "");
  if (!baseNorm) return apiCall(endpoint, method, body, fetchOpts || {});
  if (state.mockMode) return mockApiCall(endpoint, method, body);
  const forceBasicAuth = fetchOpts.forceBasicAuth === true;
  const endpointPath = endpoint.split("?")[0];
  const cacheable =
    method === "GET" &&
    (endpointPath.startsWith("/pair_candles") ||
      endpointPath.startsWith("/pair_history") ||
      endpointPath.startsWith("/panel/binance_klines") ||
      endpointPath.startsWith("/panel/kucoin_klines") ||
      endpointPath.startsWith("/panel/bybit_klines") ||
      endpointPath.startsWith("/panel/coinbase_klines") ||
      endpointPath.startsWith("/panel/okx_klines"));
  const url = `${baseNorm}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  if (cacheable) {
    const hit = getCachedJsonGet(url);
    if (hit !== null) return hit;
  }
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const options = {
      method,
      headers: {
        "Authorization": authHeader({ forceBasic: forceBasicAuth }),
        "Content-Type": "application/json"
      }
    };
    if (body) options.body = JSON.stringify(body);
    try {
      const response = await fetch(url, options);
      const raw = await response.text();
      let data = raw;
      try {
        data = JSON.parse(raw);
      } catch {
        // keep text
      }
      if (
        !response.ok &&
        response.status === 401 &&
        attempt === 0 &&
        !forceBasicAuth &&
        readStoredRefreshToken() &&
        (await refreshAccessTokenWithStoredRefresh())
      ) {
        continue;
      }
      if (!response.ok) {
        throw new Error(`${method} ${endpoint} failed: ${response.status} ${JSON.stringify(data)}`);
      }
      if (cacheable) setCachedJsonGet(url, data);
      return data;
    } catch (e) {
      lastErr = e;
      break;
    }
  }
  const baseMsg = lastErr?.message || String(lastErr || "request failed");
  const hint = /Failed to fetch|NetworkError|Load failed/i.test(baseMsg)
    ? ` — ${fetchFailContextHint()}`
    : "";
  throw new Error(baseMsg + hint);
}

function primaryApiV1BaseNormalized() {
  try {
    const bases = apiUrlBases();
    if (!bases.length) return "";
    return String(bases[0] || "").trim().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

async function refreshStrategyBotSnapshots() {
  if (state.mockMode) {
    uiState.strategyBotSnapshots = {};
    return;
  }
  const primary = primaryApiV1BaseNormalized();
  const entries = normalizeStrategyEntries(state.strategyEntries);
  const jobs = [];
  for (const e of entries) {
    const n = String(e.strategyName || "").trim();
    const b = normalizeUserRestApiV1Base(String(e.strategyRpcBase || "").trim());
    if (!n || !b) continue;
    if (primary && b === primary) continue;
    jobs.push({ n, b });
  }
  if (!jobs.length) {
    uiState.strategyBotSnapshots = {};
    return;
  }
  const settled = await Promise.all(
    jobs.map(async ({ n, b }) => {
      const reqs = await Promise.allSettled([
        apiCallAtBase(b, "/show_config"),
        apiCallAtBase(b, "/count"),
        apiCallAtBase(b, "/health"),
        apiCallAtBase(b, "/status"),
        apiCallAtBase(b, "/profit")
      ]);
      const [sc, ct, hl, st, pf] = reqs;
      const showConfig =
        sc.status === "fulfilled" && sc.value && typeof sc.value === "object" ? sc.value : null;
      const err =
        sc.status === "rejected"
          ? String(sc.reason?.message || sc.reason || "")
          : !showConfig
            ? "show_config unavailable"
            : null;
      return {
        n,
        payload: {
          showConfig,
          count: ct.status === "fulfilled" ? ct.value : null,
          health: hl.status === "fulfilled" ? hl.value : null,
          status: st.status === "fulfilled" && Array.isArray(st.value) ? st.value : [],
          profit: pf.status === "fulfilled" ? pf.value : null,
          error: err
        }
      };
    })
  );
  const out = {};
  for (const { n, payload } of settled) out[n] = payload;
  uiState.strategyBotSnapshots = out;
}

function strategyCardApiBaseFromClickTarget(el) {
  const card = el && typeof el.closest === "function" ? el.closest("[data-strategy-card]") : null;
  if (!card) return "";
  const enc = card.getAttribute("data-strategy-api-base");
  if (!enc) return "";
  try {
    return decodeURIComponent(enc);
  } catch {
    return "";
  }
}

function tryParseApiErrorJsonFromMessage(message) {
  const s = String(message || "");
  const i = s.indexOf("{");
  if (i === -1) return null;
  try {
    return JSON.parse(s.slice(i));
  } catch {
    return null;
  }
}

/** Map 503 runmode guardrails from deps.py to short localized hints for the action log. */
function friendlyBotControlApiError(err) {
  const msg = err?.message || String(err || "");
  const payload = tryParseApiErrorJsonFromMessage(msg);
  const detail = typeof payload?.detail === "string" ? payload.detail : "";
  if (/\b503\b/.test(msg) && detail.includes("Trading mode required")) {
    return `${t("sc.tradeMode.apiErrorShort")} ${detail}`;
  }
  if (/\b503\b/.test(msg) && detail.includes("Webserver mode required")) {
    return `${t("sc.webserverMode.apiErrorShort")} ${detail}`;
  }
  return msg;
}

/**
 * 单端点失败不抛错。trading 模式下 `/strategies`、`/available_pairs`、`/pair_history`
 * 常未注册（仅 webserver 模式提供），避免 `Promise.all` 一处失败导致整页 K 线不拉取。
 */
async function apiCallSwallow(endpoint, method = "GET", body, fetchOpts) {
  try {
    return await apiCall(endpoint, method, body, fetchOpts || {});
  } catch {
    return null;
  }
}

async function fetchStrategiesForDataPanel() {
  let r = await apiCallSwallow("/strategies");
  if (r != null) return r;
  const panel = await apiCallSwallow("/panel/strategies");
  if (panel && Array.isArray(panel.strategies)) return { strategies: panel.strategies };
  return { strategies: [] };
}

/** 公开接口错误信息：避免把整页 HTML 塞进 Error（原 JSON.stringify 会刷屏且难读）。 */
function buildPublicFetchError(method, endpoint, status, raw) {
  const rawStr = typeof raw === "string" ? raw : String(raw ?? "");
  const isHtml = /^\s*<!DOCTYPE/i.test(rawStr) || /^\s*<html/i.test(rawStr);
  if (isHtml) {
    return `${method} ${endpoint} failed: ${status} (HTML — not JSON API; check …/api/v1 base URL)`;
  }
  let parsed = rawStr;
  try {
    parsed = JSON.parse(rawStr);
  } catch {
    parsed = rawStr;
  }
  const snippet =
    typeof parsed === "string"
      ? parsed.length > 120
        ? `${parsed.slice(0, 120)}…`
        : parsed
      : JSON.stringify(parsed);
  const cap = snippet.length > 180 ? `${snippet.slice(0, 180)}…` : snippet;
  return `${method} ${endpoint} failed: ${status} ${cap}`;
}

async function apiCallPublic(endpoint, method = "GET") {
  if (state.mockMode) {
    return mockApiCall(endpoint, method);
  }
  let lastErr = null;
  for (const base of apiUrlBases()) {
    const url = `${base}${endpoint}`;
    try {
      const response = await fetch(url, {
        method,
        credentials: "omit",
        headers: { Accept: "application/json" }
      });
      const raw = await response.text();
      let data = raw;
      try {
        data = JSON.parse(raw);
      } catch {
        // keep text
      }
      if (!response.ok) {
        throw new Error(buildPublicFetchError(method, endpoint, response.status, raw));
      }
      rememberSuccessfulApiBase(base);
      return data;
    } catch (e) {
      lastErr = e;
    }
  }
  const baseMsg = lastErr?.message || String(lastErr || "request failed");
  const hint = /Failed to fetch|NetworkError|Load failed/i.test(baseMsg)
    ? ` — 可启动 binance_proxy.py 后经 http://192.168.77.46:8000/api/v1 访问。${fetchFailContextHint()}`
    : "";
  throw new Error(baseMsg + hint);
}

function mockApiCall(endpoint, method = "GET", body) {
  const now = new Date();
  const nowIso = now.toISOString();
  const endpointPath = endpoint.split("?")[0];
  const query = endpoint.includes("?") ? new URLSearchParams(endpoint.slice(endpoint.indexOf("?") + 1)) : new URLSearchParams();

  if (method === "GET" && endpointPath === "/ping") {
    return { status: "pong" };
  }
  if (method === "GET" && endpointPath === "/show_config") {
    return {
      runmode: mockDb.runmode,
      strategy: mockDb.strategy,
      state: mockDb.botState,
      dry_run: true,
      exchange: "kraken",
      max_open_trades: 10,
      stake_currency: "USD"
    };
  }
  if (method === "GET" && endpointPath === "/panel/strategies") {
    return {
      strategies: ["SampleStrategy", "RSITrendStrategy", "MomentumBreakout", "MeanReversionV2"]
    };
  }
  if (method === "GET" && endpointPath === "/panel/ai_overview") {
    const rules = String(state.strategyRulesOutput || "");
    const tail = rules.length > 4000 ? rules.slice(-4000) : rules;
    return {
      freqaiEnabled: false,
      bovinAiEnabled: false,
      freqaimodel: "",
      bovinAimodel: "",
      freqaimodelPath: "",
      bovinAimodelPath: "",
      freqaiIdentifier: "",
      bovinAiIdentifier: "",
      includeTimeframes: [],
      labelPeriodCandles: null,
      trainPeriodDays: null,
      backtestPeriodDays: null,
      liveRetrainHours: null,
      panelAiTakeover: Boolean(state.aiTakeoverTrading),
      strategyFromConfig: String(mockDb.strategy || ""),
      strategyRulesChars: rules.length,
      strategyRulesTail: tail,
      installedFreqaiModels: [],
      installedBovinAiModels: [],
      maxTrainingDrawdownPct: 0.35,
      max_training_drawdown_pct: 0.35
    };
  }
  if (method === "GET" && endpointPath === "/health") {
    const startupTs = Date.now() - 86400000 * 3 - 3600000 * 5;
    return {
      last_process_loc: "worker_loop",
      last_process_ts: Date.now(),
      bot_startup: nowIso,
      bot_startup_ts: Math.floor(startupTs / 1000)
    };
  }
  if (method === "GET" && endpointPath === "/count") {
    return { current: mockDb.positions.length, max: 10, total_stake: 500 };
  }
  if (method === "GET" && endpointPath === "/profit") {
    const profitTotal = mockDb.trades.reduce((sum, t) => sum + Number(t.profit_abs || 0), 0)
      + mockDb.positions.reduce((sum, p) => sum + Number(p.profit_abs || 0), 0);
    const botStart = Date.now() - 86400000 * 3 - 3600000 * 5;
    return {
      profit_total_abs: profitTotal,
      closed_profit: profitTotal,
      profit_all_coin: profitTotal,
      profit_all_fiat: profitTotal,
      profit_closed_coin: profitTotal,
      profit_closed_fiat: profitTotal,
      winrate: 0.58,
      max_drawdown: 0.082,
      current_drawdown: 0.031,
      cagr: 0.118,
      bot_start_timestamp: Math.floor(botStart / 1000),
      bot_start_date: new Date(botStart).toISOString()
    };
  }
  if (method === "GET" && endpointPath === "/sysinfo") {
    return {
      cpu_pct: [18.3, 22.1, 15.0, 20.4],
      ram_pct: 35.2,
      disk_used_pct: 58.6,
      cpu_load_avg: { "1m": 0.92, "5m": 0.88, "15m": 0.73 },
      cpu_count: 4,
      cpu_avg: 18.95,
      ts: nowIso
    };
  }
  if (method === "GET" && endpointPath === "/logs") {
    return { log_count: mockDb.logs.length, logs: mockDb.logs };
  }
  if (method === "GET" && endpointPath === "/status") {
    return mockDb.positions;
  }
  if (method === "GET" && endpointPath === "/trades") {
    const offset = Number(query.get("offset") || 0);
    const limit = Math.min(Number(query.get("limit") || 80), 300);
    const page = mockDb.trades.slice(offset, offset + limit);
    return {
      trades: page,
      trades_count: page.length,
      total_trades: mockDb.trades.length,
      offset
    };
  }
  if (method === "GET" && endpointPath === "/whitelist") {
    return { whitelist: mockDb.whitelist, length: mockDb.whitelist.length, method: ["StaticPairList"] };
  }
  if (method === "GET" && endpointPath === "/blacklist") {
    return {
      blacklist: mockDb.blacklist,
      blacklist_expanded: mockDb.blacklist,
      errors: {},
      length: mockDb.blacklist.length,
      method: ["StaticPairList"]
    };
  }
  if (method === "POST" && endpointPath === "/blacklist") {
    const added = Array.isArray(body?.blacklist) ? body.blacklist.filter(Boolean) : [];
    added.forEach((pair) => {
      if (!mockDb.blacklist.includes(pair)) mockDb.blacklist.push(pair);
    });
    return { status: "ok", added };
  }
  if (method === "POST" && endpointPath === "/start") {
    mockDb.botState = "running";
    mockDb.logs.unshift([nowIso, Date.now(), "bot", "INFO", "bot state changed to running"]);
    return { status: "starting trader ...", state: mockDb.botState };
  }
  if (method === "POST" && endpointPath === "/pause") {
    mockDb.botState = "paused";
    mockDb.logs.unshift([nowIso, Date.now(), "bot", "INFO", "bot state changed to paused"]);
    return { status: "pausing trader ...", state: mockDb.botState };
  }
  if (method === "POST" && endpointPath === "/stop") {
    mockDb.botState = "stopped";
    mockDb.logs.unshift([nowIso, Date.now(), "bot", "INFO", "bot state changed to stopped"]);
    return { status: "stopping trader ...", state: mockDb.botState };
  }
  if (method === "POST" && endpointPath === "/reload_config") {
    mockDb.logs.unshift([nowIso, Date.now(), "config", "INFO", "configuration reloaded in mock mode"]);
    return { status: "reloading config ...", reloaded: true };
  }
  if (method === "POST" && endpointPath === "/forceenter") {
    const nextId = (mockDb.trades[0]?.trade_id || 100) + 1;
    const pair = body?.pair || "BTC/USD";
    const side = body?.side || "long";
    mockDb.positions.unshift({
      pair,
      is_short: side === "short",
      open_rate: side === "short" ? 64320 : 63820,
      profit_abs: 0.0,
      open_since: "just now"
    });
    mockDb.logs.unshift([nowIso, Date.now(), "trade", "INFO", `forceenter accepted for ${pair} (${side})`]);
    return { status: "force enter accepted", trade_id: nextId, payload: body || {} };
  }
  if (method === "POST" && endpointPath === "/forceexit") {
    mockDb.positions = [];
    mockDb.logs.unshift([nowIso, Date.now(), "trade", "INFO", "forceexit closed all mock positions"]);
    return { status: "force exit accepted", payload: body || {} };
  }
  if (method === "GET" && endpointPath === "/available_pairs") {
    const pairs = ["BTC/USD", "ETH/USD", "SOL/USD", "ADA/USD", "AVAX/USD"];
    return {
      length: pairs.length,
      pairs,
      pair_interval: pairs.map((p) => [p, "5m", "spot"])
    };
  }
  if (method === "GET" && endpointPath === "/strategies") {
    return { strategies: ["SampleStrategy", "RSITrendStrategy", "MomentumBreakout", "MeanReversionV2"] };
  }
  if (method === "GET" && endpointPath === "/plot_config") {
    return {
      main_plot: { ema_fast: {}, ema_slow: {}, bb_upper: {}, bb_lower: {} },
      subplots: { RSI: { rsi: {} }, MACD: { macd: {}, signal: {} } }
    };
  }
  if (method === "GET" && endpointPath === "/pair_candles") {
    const pair = query.get("pair") || "BTC/USD";
    const timeframe = query.get("timeframe") || "5m";
    const timerange = query.get("timerange") || defaultRecentTimerange(90);
    const data = buildMockSeries({ pair, timeframe, timerange, withSignals: false, maxPoints: 2800 });
    return {
      pair,
      timeframe,
      timerange,
      columns: ["date", "open", "high", "low", "close", "volume"],
      data
    };
  }
  if (method === "GET" && endpointPath === "/pair_history") {
    const strategy = query.get("strategy") || mockDb.strategy;
    const pair = query.get("pair") || "BTC/USD";
    const timeframe = query.get("timeframe") || "5m";
    const timerange = query.get("timerange") || defaultRecentTimerange(90);
    const data = buildMockSeries({ pair, timeframe, timerange, withSignals: true, maxPoints: 2400 });
    return {
      strategy,
      pair,
      timeframe,
      timerange,
      columns: ["date", "open", "high", "low", "close", "volume", "rsi", "enter_long", "exit_long"],
      data
    };
  }
  if (method === "GET" && endpointPath === "/panel/binance_board") {
    return {
      board: [
        { symbol: "BTCUSDT", price: 64281.4, pct: 2.15 },
        { symbol: "ETHUSDT", price: 3452.1, pct: 1.82 },
        { symbol: "SOLUSDT", price: 148.6, pct: -0.45 },
        { symbol: "BNBUSDT", price: 592.3, pct: 0.91 },
        { symbol: "XRPUSDT", price: 0.5234, pct: 3.1 }
      ]
    };
  }
  if (method === "POST" && endpointPath === "/panel/strategy-rules/append") {
    const chunk = body && typeof body === "object" ? String(body.chunk || "").trim() : "";
    if (!chunk) return { error: "empty chunk" };
    const ts = new Date().toISOString();
    state.strategyRulesOutput = `${state.strategyRulesOutput}\n\n--- ${ts} ---\n${chunk}`.trim();
    localStorage.setItem("ft_strategy_rules_out", state.strategyRulesOutput);
    refreshControlStrategyConfig();
    return { ok: true, strategyRulesOutput: state.strategyRulesOutput };
  }
  if (method === "POST" && endpointPath === "/panel/auth/login") {
    const u = String(body?.username || "").trim();
    const p = String(body?.password || "");
    const user = mockDb.panelUsers.find((x) => x.username.toLowerCase() === u.toLowerCase());
    if (user && user.password === p) {
      return {
        ok: true,
        userId: user.id,
        username: user.username,
        menuPermissions: { ...user.menuPermissions }
      };
    }
    return { ok: false, detail: "invalid credentials" };
  }
  if (method === "GET" && endpointPath === "/panel/users") {
    return {
      users: mockDb.panelUsers.map(({ password: _pw, ...rest }) => ({
        id: rest.id,
        username: rest.username,
        menuPermissions: { ...rest.menuPermissions }
      })),
      menuKeys: [...PANEL_MENU_KEYS]
    };
  }
  if (method === "POST" && endpointPath === "/panel/users") {
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");
    if (!username || !password) return { ok: false, detail: "missing fields" };
    if (mockDb.panelUsers.some((x) => x.username.toLowerCase() === username.toLowerCase())) {
      return { ok: false, detail: "username exists" };
    }
    const id = mockPanelUserIdSeq++;
    const menuPermissions = normalizeMenuPermsFromBody(body?.menuPermissions);
    mockDb.panelUsers.push({ id, username, password, menuPermissions });
    return { ok: true, user: { id, username, menuPermissions: { ...menuPermissions } } };
  }
  const panelUserPath = endpointPath.match(/^\/panel\/users\/(\d+)$/);
  if (method === "POST" && endpointPath === "/panel/exchange_probe") {
    const exn = String(body?.exchangeName ?? body?.exchange_name ?? "").trim();
    const ek = String(body?.exchangeApiKey ?? body?.exchange_api_key ?? "").trim();
    const es = String(body?.exchangeApiSecret ?? body?.exchange_api_secret ?? "").trim();
    const erb = String(body?.exchangeRestBaseUrl ?? body?.exchange_rest_base_url ?? "").trim();
    const erbLower = erb.toLowerCase();
    const restLooksLikePanel =
      erb &&
      !erbLower.includes("binance.com") &&
      !erbLower.includes("binance.vision") &&
      (erbLower.includes("localhost:3000") ||
        erbLower.includes("127.0.0.1:3000") ||
        erbLower.includes(":19090") ||
        erbLower.includes("/api/v1") ||
        erbLower.replace(/\/+$/, "").endsWith("/api/v1"));
    if (!exn) {
      return { ok: false, exchange: "", detail: "exchangeName required", preview: null };
    }
    if (!ek || !es) {
      return {
        ok: false,
        exchange: exn,
        detail: "exchangeApiKey and exchangeApiSecret required",
        preview: null
      };
    }
    if (restLooksLikePanel) {
      return {
        ok: false,
        exchange: exn.toLowerCase().replace(/\s+/g, "") || "",
        detail:
          "exchangeRestBaseUrl must be the exchange REST origin (e.g. https://api.binance.com), not localhost or the panel.",
        preview: null,
        verifyRoute: "rejected_panel_url_in_rest_field"
      };
    }
    const exNorm = exn.toLowerCase().replace(/\s+/g, "") || "mock";
    return {
      ok: true,
      exchange: exNorm,
      detail: null,
      preview: `[Bovin→${exNorm} REST / ccxt] private API OK (mock)`,
      verifyRoute: "bovin_ccxt_rest",
      effectiveRestRoot: erb || "ccxt_default"
    };
  }
  if (method === "POST" && endpointPath === "/panel/llm_probe") {
    const key = String(body?.llmApiKey ?? body?.llm_api_key ?? "").trim();
    if (!key) {
      return {
        ok: false,
        provider: String(body?.llmProvider ?? body?.llm_provider ?? "deepseek"),
        httpStatus: null,
        detail: "llmApiKey required",
        preview: null
      };
    }
    return {
      ok: true,
      provider: String(body?.llmProvider ?? body?.llm_provider ?? "deepseek"),
      httpStatus: 200,
      detail: null,
      preview: "OK (mock)"
    };
  }
  if (panelUserPath) {
    const uid = Number(panelUserPath[1]);
    if (method === "PATCH") {
      const u = mockDb.panelUsers.find((x) => x.id === uid);
      if (!u) return { ok: false, detail: "not found" };
      if (body.username != null) u.username = String(body.username).trim();
      if (body.password) u.password = String(body.password);
      if (body.menuPermissions != null) {
        u.menuPermissions = normalizeMenuPermsFromBody(body.menuPermissions);
      }
      return {
        ok: true,
        user: { id: u.id, username: u.username, menuPermissions: { ...u.menuPermissions } }
      };
    }
    if (method === "DELETE") {
      if (mockDb.panelUsers.length <= 1) return { ok: false, detail: "last user" };
      mockDb.panelUsers = mockDb.panelUsers.filter((x) => x.id !== uid);
      return { ok: true };
    }
  }
  if (endpointPath === "/panel/preferences") {
    if (method === "GET") {
      return {
        simulation_ui: state.mockMode,
        theme: uiState.theme || "system",
        api_bindings: state.apiBindings,
        baseUrl: state.baseUrl,
        username: state.username,
        password: state.password,
        strategyName: state.strategyName,
        strategyNotes: state.strategyNotes,
        strategyExtraJson: state.strategyExtraJson,
        aiTakeoverTrading: state.aiTakeoverTrading,
        strategyRulesOutput: state.strategyRulesOutput,
        controlShowStrategyCards: state.controlShowStrategyCards,
        strategyAuthorizedAmount: state.strategyAuthorizedAmount,
        strategyTargetAnnualReturnPct: state.strategyTargetAnnualReturnPct,
        strategySlots: normalizeStrategySlots(state.strategySlots),
        manualStrategyNames: normalizeManualStrategyNames(state.manualStrategyNames),
        strategyHiddenFromConsole: normalizeStrategyHiddenFromConsole(state.strategyHiddenFromConsole),
        riskMaxDrawdownLimitPct: state.riskMaxDrawdownLimitPct,
        riskThresholdPct: state.riskThresholdPct,
        riskUseFreqaiLimits: state.riskUseFreqaiLimits,
        strategyEntries: normalizeStrategyEntries(state.strategyEntries)
      };
    }
    if (method === "POST") {
      const b = body && typeof body === "object" ? body : {};
      if (typeof b.simulation_ui === "boolean") {
        state.mockMode = b.simulation_ui;
        localStorage.setItem("ft_mock_mode", state.mockMode ? "1" : "0");
      }
      if (Array.isArray(b.api_bindings)) {
        state.apiBindings = b.api_bindings.map((item) => normalizeApiBindingItem(item));
        persistApiBindingsLocalSnapshot(state.apiBindings);
      }
      if (b.theme && typeof b.theme === "string") uiState.theme = b.theme;
      applyPanelProfileFromPrefs(b);
      updateMockToggleLabel();
      updateDataSourceBadge();
      renderApiBindings();
      setConfigInputs();
      return { ok: true, path: "(mock)", storage: "mock" };
    }
  }

  return { status: "mock route not implemented", key: `${method} ${endpointPath}` };
}

const ACTION_LOG_MAX_LINES = 220;

function logAction(content) {
  const target = $("actionLog");
  if (!target) return;
  const now = new Date().toLocaleTimeString();
  const next = `[${now}] ${content}\n${target.textContent || ""}`;
  const lines = next.split("\n");
  target.textContent = lines.slice(0, ACTION_LOG_MAX_LINES).join("\n");
}

function syncForceSideOptions() {
  const sel = $("forceSide");
  if (!sel) return;
  const long = sel.querySelector("option[value=\"long\"]");
  const short = sel.querySelector("option[value=\"short\"]");
  if (long) long.textContent = t("side.long");
  if (short) short.textContent = t("side.short");
}

function getLiveShowConfigForControl() {
  return uiState.lastShowConfig && typeof uiState.lastShowConfig === "object"
    ? uiState.lastShowConfig
    : state.mockMode
      ? {
          strategy: mockDb.strategy,
          state: mockDb.botState,
          dry_run: true,
          exchange: "mock",
          max_open_trades: 10,
          stake_currency: "USD",
          runmode: mockDb.runmode
        }
      : {};
}

/** 策略配置弹窗「授权金额」旁展示当前机器人的 stake_currency（与 /show_config 一致）。 */
function refreshStrategyAuthorizedAmountStakeHint() {
  const el = $("mStrategyAuthorizedStakeCur");
  if (!el) return;
  const cur = String(getLiveShowConfigForControl()?.stake_currency || "").trim();
  el.textContent = cur ? (state.lang === "en" ? ` (${cur})` : `（${cur}）`) : "";
}

function rerenderControlHeroAndCards() {
  renderControlHeroAndCards(
    uiState.lastDaily || {},
    getLiveShowConfigForControl(),
    uiState.lastProfit || {},
    uiState.lastHealth || {},
    uiState.lastProxyHealth,
    uiState.strategyBotSnapshots || {}
  );
}

function refreshLocaleBoundUi() {
  renderEndpointTable();
  syncForceSideOptions();
  const pingOk = uiState.lastPingOk !== false;
  const lat = Number.isFinite(uiState.lastPingLatencyMs) ? uiState.lastPingLatencyMs : 0;
  refreshTopbarDecor(lat, pingOk);
  setDaHeroTelemetry(pingOk, state.mockMode ? 12 : lat);
  if (state.mockMode) {
    restoreMockOverviewDecor();
    renderGovernanceLists({}, {}, undefined);
    renderScFeedFromTrades({ trades: [] });
  } else {
    renderOverviewStrategiesTableLive(
      uiState.lastShowConfig && typeof uiState.lastShowConfig === "object" ? uiState.lastShowConfig : {},
      uiState.lastProfit || {},
      uiState.lastCount || {}
    );
    if (uiState.lastShowConfig && typeof uiState.lastShowConfig === "object") {
      updateOverviewKpisLive(
        uiState.lastCount || {},
        uiState.lastProfit || {},
        uiState.lastHealth || {},
        uiState.lastPing || {},
        lat
      );
      renderRiskMatrix(uiState.lastStForRisk || []);
    }
    renderGovernanceLists(uiState.lastWl || {}, uiState.lastBl || {}, uiState.lastShowConfig);
    renderScFeedFromTrades(uiState.lastTradesMini || { trades: [] });
  }
  rerenderControlHeroAndCards();
  renderPendingSection();
  if (Array.isArray(uiState.positionsRows)) renderStatusRows(uiState.positionsRows);
  if (state.mockMode && uiState.mockTradesPayload) renderTradesRows(uiState.mockTradesPayload);
  if (!state.mockMode && Array.isArray(uiState.openOrderFlat)) renderOpenOrdersRows(uiState.openOrderFlat);
  if (uiState.lastStrategiesResult != null) {
    renderDataStrategies(uiState.lastStrategiesResult, uiState.lastProfitSummary, uiState.lastActiveStrategyName);
  }
  updateDataNetStatus(uiState.dataNetMode || "LIVE", uiState.dataNetRetries || 0);
  updateDataSourceLabel(uiState.lastDataSourceCode || "NONE");
  if (isDataSectionActive() && uiState.dataCandles?.data?.length) {
    renderDataKlineStripIfVisible(uiState.dataCandles);
  }
  void refreshSettingsBotContext();
}

function applyI18n() {
  document.documentElement.lang = state.lang === "en" ? "en" : "zh-CN";
  document.title = t("doc.title");
  applyTheme();
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    el.setAttribute("placeholder", t(key));
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    el.setAttribute("aria-label", t(key));
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    el.setAttribute("title", t(key));
  });
  const langSel = $("langSwitch");
  if (langSel) langSel.value = state.lang;
  updateLangQuickToggleLabel();
  updatePageHeading();
  updateMockToggleLabel();
  updateDataSourceBadge();
  renderApiBindings();
  renderStrategyEntriesList();
  refreshPanelBackendHint();
  refreshControlStrategyConfig();
  refreshLocaleBoundUi();
  refreshMenuPermissionUi();
  renderPanelUsersList();
  void updateMonitorPanel();
  refreshSettingsDbSourceHint();
  refreshRpcPushBadge();
  syncKlineModeToolbar();
  refreshStrategyAuthorizedAmountStakeHint();
  syncExchangePassphraseHintForModal();
}

function updateLangQuickToggleLabel() {
  const btn = $("langQuickToggle");
  if (!btn) return;
  btn.textContent = state.lang === "en" ? "EN / 中" : "中 / EN";
}

function toggleLanguage() {
  state.lang = state.lang === "zh-CN" ? "en" : "zh-CN";
  localStorage.setItem("ft_lang", state.lang);
  applyI18n();
}

function bindLangQuickToggle() {
  if (uiState.langDelegatedBound) return;
  uiState.langDelegatedBound = true;
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("#langQuickToggle");
    if (!btn) return;
    e.preventDefault();
    toggleLanguage();
  });
}

function updateMockToggleLabel() {
  const btn = $("toggleMock");
  if (!btn) return;
  const on = state.mockMode;
  btn.textContent = `${t("label.toggleMock")}: ${on ? t("label.on") : t("label.off")}`;
  btn.classList.toggle("mock-on", on);
  btn.setAttribute("aria-pressed", on ? "true" : "false");
}

function updateDataSourceBadge() {
  const badge = $("dataSourceBadge");
  if (!badge) return;
  const on = state.mockMode;
  const text = `${t("data.sourceLabel")}: ${on ? t("data.sourcePill.mock") : t("data.sourcePill.live")}`;
  const labelEl = badge.querySelector(".status-pill-label");
  if (labelEl) labelEl.textContent = text;
  else badge.textContent = text;
  badge.classList.toggle("mock", on);
  badge.setAttribute("aria-pressed", on ? "true" : "false");
  badge.setAttribute(
    "aria-label",
    `${t("mock.toggleMockAria")} ${on ? t("data.sourcePill.mock") : t("data.sourcePill.live")}`
  );
}

async function toggleMockMode() {
  state.mockMode = !state.mockMode;
  localStorage.setItem("ft_mock_mode", state.mockMode ? "1" : "0");
  updateMockToggleLabel();
  updateDataSourceBadge();
  persistApiBindingsLocalSnapshot(state.apiBindings);
  logAction(state.mockMode ? t("log.mockOn") : t("log.mockOff"));
  if (state.mockMode) restoreMockOverviewDecor();
  if (!state.mockMode) {
    uiState.dataCandleSourcePinned = "PROXY_BINANCE";
    uiState.dataBoardSourcePinned = "PROXY_BINANCE";
    uiState.dataCandlePinFailStreak = 0;
    uiState.dataBoardPinFailStreak = 0;
  }
  await persistPanelPreferences({ forceFullProfileSync: true });
  if (uiState.authed && !state.mockMode) await loadPanelPreferences();
  refreshOverview();
  refreshPositions();
  refreshLists();
  refreshDataPanel();
}

function renderEndpointTable() {
  const categoryEn = {
    状态: "Status",
    认证: "Auth",
    信息: "Info",
    运行: "Runtime",
    运行控制: "Runtime",
    交易: "Trade",
    交易与资金: "Trading",
    名单: "Lists",
    名单与锁: "Lists & locks",
    分析: "Analytics",
    行情与图表: "Market data",
    策略: "Strategy",
    策略与数据: "Strategy & data",
    日志: "Logs",
    面板: "Panel",
    回测: "Backtest",
    任务与下载: "Jobs & download",
    Pairlist: "Pairlists",
    实时通道: "Realtime",
    其他: "Other"
  };
  /** 旧版 catalog 仅四列时的英文说明回退（新生成的 endpoint-catalog.js 含第 5 列英文） */
  const descEn = {
    服务可用性探测: "Service readiness probe",
    "Bot loop 健康状态": "Bot loop health",
    系统负载信息: "System load info",
    启动交易器: "Start trader",
    暂停新开仓: "Pause new entries",
    停止交易器: "Stop trader",
    重载配置: "Reload config",
    当前持仓: "Current open positions",
    历史交易: "Trade history",
    收益汇总: "Profit summary",
    强制开仓: "Force enter position",
    强制平仓: "Force exit position",
    白名单: "Whitelist",
    黑名单: "Blacklist",
    加入黑名单: "Add to blacklist",
    获取K线数据: "Get candle data",
    获取策略分析历史: "Get analyzed history",
    本地可用回测数据对: "Available local backtest pairs",
    策略列表: "Strategy list",
    图表配置: "Plot config",
    最近日志: "Recent logs",
    "面板配置（user_data SQLite）": "Panel preferences SQLite in user_data",
    "写入 panel_store.sqlite": "Persist to panel_store.sqlite",
    "追加 AI/规则片段到 strategy_rules_output": "Append AI/rule snippet to strategy_rules_output",
    "交易所 24h 行情（对齐 headline）": "Exchange 24h ticker for headline price",
    "扫描 user_data/strategies（交易模式下也可用）":
      "Scan user_data/strategies (available in trade mode)",
    "DeepSeek 风格策略 JSON 与提示词（SQLite 种子，年化目标为设计意图）":
      "DeepSeek-style JSON + prompts (SQLite seeds; annual target is design intent only)",
    "面板账号登录，返回菜单权限": "Panel login; returns menu permissions",
    "列出面板用户与菜单权限": "List panel users and menu permissions",
    新建面板用户: "Create panel user",
    "更新面板用户/权限": "Update panel user / permissions",
    删除面板用户: "Delete panel user"
  };
  const tbody = $("endpointTable");
  if (!tbody) return;
  tbody.innerHTML = endpointCatalog.map((row) => {
    const c0 = state.lang === "en" ? (categoryEn[row[0]] || row[0]) : row[0];
    const c3 =
      state.lang === "en"
        ? row.length >= 5
          ? row[4]
          : descEn[row[3]] || row[3]
        : row[3];
    return `
    <tr>
      <td>${escapeHtml(c0)}</td>
      <td class="mono">${escapeHtml(row[1])}</td>
      <td class="mono">${escapeHtml(row[2])}</td>
      <td>${escapeHtml(c3)}</td>
    </tr>
  `;
  }).join("");
}

function persistActiveSection(sectionId) {
  if (!sectionId) return;
  localStorage.setItem("ft_active_section", sectionId);
  const nextHash = `#${sectionId}`;
  if (location.hash === nextHash) return;
  try {
    const url = new URL(window.location.href);
    url.hash = sectionId;
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    if (location.hash !== nextHash) location.hash = sectionId;
  }
}

function isShowConfigConnectionRefusedError(msg) {
  return /Connection refused|ECONNREFUSED|Errno 61|\[Errno 61\]|urlopen error.*refused/i.test(String(msg || ""));
}

/** 与 binance_proxy 连不上 Bovin 上游时常见的 502 / refused 等（非 401 凭据错误） */
function isLikelyBovinUpstreamUnreachable(msg) {
  const s = String(msg || "");
  if (isShowConfigConnectionRefusedError(s)) return true;
  if (/\b502\b/.test(s)) return true;
  if (/Bad Gateway|upstream|Connection refused|ECONNREFUSED|urlopen error/i.test(s)) return true;
  return false;
}

/**
 * GET /panel/preferences 失败时是否适合退避重试（上游抖动、代理未就绪等）。
 * 401/403/404/422 不重试，避免拖慢鉴权或错误路由的反馈。
 */
function isTransientPanelPrefsError(msg) {
  const s = String(msg || "");
  if (/\b401\b|\b403\b|\b404\b|\b422\b/.test(s)) return false;
  if (isLikelyBovinUpstreamUnreachable(s)) return true;
  if (/Failed to fetch|NetworkError|Load failed|ETIMEDOUT|ECONNRESET|ECONNABORTED/i.test(s)) return true;
  if (/\b500\b|\b502\b|\b503\b|\b504\b|\b429\b/.test(s)) return true;
  return false;
}

const PANEL_PREFS_GET_MAX_ATTEMPTS = 4;
/** 第 2～4 次尝试前的等待（ms），减轻 Bovin / 代理刚启动时的竞态 */
const PANEL_PREFS_GET_RETRY_BACKOFF_MS = [500, 1400, 2800];
let panelPrefsRecoveryTimer = null;
let panelPrefsLastRecoveryAt = 0;

/**
 * 概览轮询发现 API 已通但偏好仍未从库同步时，延迟再拉一次（去抖，避免每 5s 打满）。
 */
function schedulePanelPrefsRecoveryIfNeeded() {
  if (state.mockMode || !uiState.authed || uiState.panelPrefsSyncedFromDb) return;
  const now = Date.now();
  if (now - panelPrefsLastRecoveryAt < 10_000) return;
  if (panelPrefsRecoveryTimer != null) return;
  panelPrefsRecoveryTimer = window.setTimeout(async () => {
    panelPrefsRecoveryTimer = null;
    panelPrefsLastRecoveryAt = Date.now();
    if (state.mockMode || !uiState.authed || uiState.panelPrefsSyncedFromDb) return;
    await loadPanelPreferences();
    if (uiState.panelPrefsSyncedFromDb) {
      void renderPanelUsersListLoaded();
      void refreshSettingsBotContext();
    }
  }, 500);
}

async function refreshSettingsBotContext() {
  const box = $("settingsBotContext");
  if (!box) return;
  if (!uiState.authed) {
    box.classList.add("hidden");
    return;
  }
  box.classList.remove("hidden");
  if (state.mockMode) {
    box.textContent = state.lang === "en"
      ? "Mock mode: bindings are kept in the browser only (no server SQLite)."
      : "模拟模式：对接列表仅保存在浏览器侧，不会写入服务端数据库。";
    return;
  }
  try {
    const cfg = await apiCall("/show_config");
    const ex = escapeHtml(String(cfg?.exchange || "—"));
    const tm = escapeHtml(String(cfg?.trading_mode || ""));
    const dry = cfg?.dry_run === true;
    const line1 = state.lang === "en"
      ? `Below, exchange / LLM rows load from <code>panel_store.sqlite</code> via <code>GET /panel/preferences</code> (persisted with <strong>Save</strong>). Live bot exchange (Bovin <code>/show_config</code>): ${ex}${tm ? ` · ${tm}` : ""}${dry ? " · dry-run" : ""}. Check <strong>Sync to bot config</strong> on one row and save: that row’s exchange id and keys are written to the on-disk main <code>config.json</code> <code>exchange</code> block; restart <code>trade</code>/<code>webserver</code> to reload in-process config.`
      : `下方「对接关系」列表由服务端 <code>user_data/panel_store.sqlite</code> 的 <code>panel_api_binding</code> 表提供（进入本页或保存时会同步）。机器人实盘配置见 Bovin <code>/show_config</code>：${ex}${tm ? ` · ${tm}` : ""}${dry ? " · 模拟盘" : ""}。勾选某一行的「同步到机器人 config」并在保存设置后，会将该行交易所名称与密钥写入磁盘上的主 <code>config.json</code> 的 <code>exchange</code> 段；须重启 <code>trade</code>/<code>webserver</code> 方可在进程内生效。`;
    box.innerHTML = line1;
  } catch (err) {
    const detail = String(err?.message || err);
    const prefsDet = String(uiState.panelPrefsLoadErrorDetail || "");
    const upstreamDup =
      isLikelyBovinUpstreamUnreachable(detail) &&
      !uiState.panelPrefsSyncedFromDb &&
      isLikelyBovinUpstreamUnreachable(prefsDet);
    const refused = isShowConfigConnectionRefusedError(detail);
    const hint = upstreamDup
      ? t("settings.showConfigShortUpstreamDup")
      : refused
        ? t("settings.showConfigHintRefused")
        : t("settings.showConfigHintGeneric");
    box.textContent =
      state.lang === "en"
        ? `Could not load /show_config: ${detail}. ${hint}`
        : `无法读取 /show_config：${detail} ${hint}`;
  }
}

const SETTINGS_SUBTAB_KEY = "ft_settings_subtab";

function menuPermissionFor(key) {
  const m = uiState.menuPermissions;
  if (!m || typeof m !== "object" || !Object.keys(m).length) return "edit";
  if (m[key] === undefined || m[key] === null) return "edit";
  const v = String(m[key]).toLowerCase();
  if (v === "edit") return "edit";
  if (v === "hidden") return "hidden";
  return "read";
}

/** 策略 JSON/MML 槽位写入 panel 偏好：「设置」或「策略 AI 控制台」任一具备编辑即可。 */
function canEditStrategySlots() {
  return menuPermissionFor("settings") === "edit" || menuPermissionFor("control") === "edit";
}

/** 第一个非「不可见」的侧栏菜单 id；若全部不可见则返回 null。 */
function firstVisibleMenuSectionId() {
  for (const k of PANEL_MENU_KEYS) {
    if (menuPermissionFor(k) !== "hidden") return k;
  }
  return null;
}

/** 当前激活分区若对该用户不可见，则切到首个可见分区。 */
function ensureActiveSectionPermitted() {
  const cur = document.querySelector(".section.active")?.id;
  if (!cur || menuPermissionFor(cur) !== "hidden") return;
  const alt = firstVisibleMenuSectionId();
  if (alt != null) switchSection(alt);
}

function persistPanelSession() {
  if (uiState.menuPermissions && typeof uiState.menuPermissions === "object" && Object.keys(uiState.menuPermissions).length) {
    localStorage.setItem("ft_panel_menu_perm", JSON.stringify(uiState.menuPermissions));
  }
  if (uiState.panelUserId != null) localStorage.setItem("ft_panel_uid", String(uiState.panelUserId));
  localStorage.setItem("ft_panel_uname", uiState.panelUsername || "");
}

const STALE_AUTH_HINT_KEY = "ft_stale_auth_hint";

/**
 * ft_panel_auth 在 localStorage 持久化，HTTP Basic 密码多在 sessionStorage。
 * 若未换 JWT：新开标签会丢密码。已存 refresh_token 时由 tryJwtBootstrapFromRefresh 续期，不此处登出。
 */
function fixStalePanelAuthState() {
  if (!uiState.authed || state.mockMode) return;
  if (String(state.password || "").length > 0) return;
  if (readStoredRefreshToken()) return;
  uiState.authed = false;
  localStorage.removeItem("ft_panel_auth");
  clearPanelSession();
  try {
    sessionStorage.setItem(STALE_AUTH_HINT_KEY, "1");
  } catch {
    // ignore
  }
}

/** 新标签页：无 session 密码时用 refresh 换 access，再拉 /panel/preferences。 */
async function tryJwtBootstrapFromRefresh() {
  if (!uiState.authed || state.mockMode) return;
  if (String(state.password || "").length > 0) return;
  const rt = readStoredRefreshToken();
  if (!rt) return;
  const ok = await refreshAccessTokenWithStoredRefresh();
  if (ok) return;
  clearApiTokens();
  uiState.authed = false;
  localStorage.removeItem("ft_panel_auth");
  clearPanelSession();
  try {
    sessionStorage.setItem(STALE_AUTH_HINT_KEY, "1");
  } catch {
    // ignore
  }
}

function consumeStaleLoginHint() {
  try {
    if (sessionStorage.getItem(STALE_AUTH_HINT_KEY) !== "1") return;
    sessionStorage.removeItem(STALE_AUTH_HINT_KEY);
    const el = $("loginError");
    if (el) el.textContent = t("login.reauthRequired");
  } catch {
    // ignore
  }
}

function clearPanelSession() {
  clearApiTokens();
  localStorage.removeItem("ft_panel_menu_perm");
  localStorage.removeItem("ft_panel_uid");
  localStorage.removeItem("ft_panel_uname");
  clearLastKnownApiBindingsSnapshot();
  clearFreqtradePasswordSession();
  uiState.menuPermissions = null;
  uiState.panelUserId = null;
  uiState.panelUsername = "";
}

function refreshMenuPermissionUi() {
  document.body.classList.toggle("perm-no-edit-settings", menuPermissionFor("settings") !== "edit");
  document.body.classList.toggle("perm-no-edit-control", menuPermissionFor("control") !== "edit");
  document.body.classList.toggle("perm-no-edit-positions", menuPermissionFor("positions") !== "edit");
  document.body.classList.toggle("perm-no-edit-data", menuPermissionFor("data") !== "edit");
  document.querySelectorAll(".sidebar-nav .nav-btn").forEach((btn) => {
    const sec = btn.dataset.section;
    if (!sec) return;
    const hideNav = menuPermissionFor(sec) === "hidden";
    btn.classList.toggle("hidden", hideNav);
    btn.setAttribute("aria-hidden", hideNav ? "true" : "false");
    if (hideNav) btn.setAttribute("tabindex", "-1");
    else btn.removeAttribute("tabindex");
  });
  $("openSettings")?.classList.toggle("hidden", menuPermissionFor("settings") === "hidden");
  ensureActiveSectionPermitted();
}

let panelUsersListCache = [];

function menuLabelI18n(key) {
  const map = {
    overview: "nav.overview",
    positions: "nav.positions",
    control: "nav.control",
    data: "nav.data",
    settings: "nav.settings",
    monitor: "nav.monitor",
    api: "nav.api"
  };
  return t(map[key] || key);
}

function summarizeMenuPermissions(perms) {
  if (!perms) return "—";
  const parts = PANEL_MENU_KEYS.map((k) => {
    const raw = String(perms[k] || "").toLowerCase();
    const p =
      raw === "edit"
        ? t("users.perm.edit")
        : raw === "hidden"
          ? t("users.perm.hidden")
          : t("users.perm.read");
    return `${menuLabelI18n(k)}:${p}`;
  });
  return parts.join(" · ");
}

function closePanelUserModal() {
  $("panelUserModal")?.classList.add("hidden");
}

function collectMenuPermissionsFromModal() {
  const raw = {};
  for (const k of PANEL_MENU_KEYS) {
    const sel = $(`puPerm-${k}`);
    const v = sel?.value === "edit" ? "edit" : sel?.value === "hidden" ? "hidden" : "read";
    raw[k] = v;
  }
  return normalizeMenuPermsFromBody(raw);
}

async function savePanelUserFromModal() {
  const username = $("puUsername")?.value?.trim() || "";
  const password = $("puPassword")?.value || "";
  const mode = $("panelUserModal")?.getAttribute("data-mode") || "create";
  const editId = Number($("panelUserModal")?.getAttribute("data-user-id") || "0");
  const perms = collectMenuPermissionsFromModal();
  try {
    if (mode === "create") {
      if (!username || !password) {
        logAction(t("login.error"));
        return;
      }
      const r = await apiCall("/panel/users", "POST", {
        username,
        password,
        menuPermissions: perms
      });
      if (r && r.ok === false) {
        logAction(r.detail === "username exists" ? t("users.duplicateUser") : String(r.detail || "error"));
        return;
      }
    } else if (editId) {
      const body = { menuPermissions: perms, username };
      if (password.trim()) body.password = password;
      const r = await apiCall(`/panel/users/${editId}`, "PATCH", body);
      if (r && r.ok === false) {
        logAction(String(r.detail || "error"));
        return;
      }
      if (r?.user?.menuPermissions && editId === uiState.panelUserId) {
        uiState.menuPermissions = normalizeMenuPermsFromBody(r.user.menuPermissions);
        persistPanelSession();
        refreshMenuPermissionUi();
        applyI18n();
      }
    }
    closePanelUserModal();
    await renderPanelUsersListLoaded();
    await pushSettingsToPanelBackend();
    refreshOverview();
    refreshPositions();
    refreshLists();
    logAction(t("log.configUpdated"));
  } catch (e) {
    logAction(e.message || String(e));
  }
}

function openPanelUserModal(mode, user) {
  const modal = $("panelUserModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("data-mode", mode);
  const title = $("panelUserModalTitle");
  if (title) title.textContent = mode === "create" ? t("users.add") : t("users.edit");
  const uEl = $("puUsername");
  const pEl = $("puPassword");
  if (uEl) {
    uEl.value = user?.username || "";
    uEl.disabled = mode !== "create";
  }
  if (pEl) {
    pEl.value = "";
    pEl.placeholder = mode === "create" ? "" : t("users.passwordOptional");
  }
  modal.setAttribute("data-user-id", user?.id ? String(user.id) : "");
  const permObj = user?.menuPermissions || defaultFullMenuPermissions();
  for (const k of PANEL_MENU_KEYS) {
    const sel = $(`puPerm-${k}`);
    if (sel) {
      const p = String(permObj[k] || "read").toLowerCase();
      sel.value = p === "edit" ? "edit" : p === "hidden" ? "hidden" : "read";
    }
  }
}

async function renderPanelUsersListLoaded() {
  const el = $("panelUsersList");
  if (!el) return;
  try {
    const r = await apiCall("/panel/users");
    panelUsersListCache = r.users || [];
  } catch (e) {
    const msg = String(e?.message || e);
    if (isLikelyBovinUpstreamUnreachable(msg)) {
      el.innerHTML = `<p class="panel-users-upstream-hint">${escapeHtml(t("settings.panelUsersUpstreamOnly"))}</p><p class="panel-users-raw-err">${escapeHtml(msg)}</p>`;
    } else {
      el.innerHTML = `<p class="login-error">${escapeHtml(msg)}</p>`;
    }
    return;
  }
  renderPanelUsersList();
}

function renderPanelUsersList() {
  const el = $("panelUsersList");
  if (!el) return;
  const canEdit = menuPermissionFor("settings") === "edit";
  const hint = $("panelUsersReadonlyHint");
  if (hint) hint.classList.toggle("hidden", canEdit);
  const addBtn = $("addPanelUserBtn");
  if (addBtn) {
    addBtn.disabled = !canEdit;
    addBtn.classList.toggle("is-disabled", !canEdit);
  }
  if (!panelUsersListCache.length) {
    el.innerHTML = `<p class="panel-users-empty muted">${escapeHtml(t("users.title"))}</p>`;
    return;
  }
  const rows = panelUsersListCache
    .map((u) => {
      const uid = safeDataIdAttr(u.id);
      const del = canEdit
        ? (uid
            ? `<button type="button" class="ghost danger-soft panel-user-del" data-panel-user-del="${uid}">${escapeHtml(t("users.delete"))}</button>`
            : `<button type="button" class="ghost danger-soft" disabled>${escapeHtml(t("users.delete"))}</button>`)
        : "";
      const ed = canEdit
        ? (uid
            ? `<button type="button" class="ghost panel-user-edit" data-panel-user-edit="${uid}">${escapeHtml(t("users.edit"))}</button>`
            : `<button type="button" class="ghost" disabled>${escapeHtml(t("users.edit"))}</button>`)
        : "";
      return `
        <div class="bindings-row panel-user-row">
          <div class="panel-user-name"><strong>${escapeHtml(u.username)}</strong></div>
          <div class="panel-user-perms muted">${escapeHtml(summarizeMenuPermissions(u.menuPermissions))}</div>
          <div class="panel-user-actions">${ed}${del}</div>
        </div>`;
    })
    .join("");
  el.innerHTML = rows;
}

function setSettingsTab(tab) {
  const pane =
    tab === "strategy" ? "strategy" : tab === "users" ? "users" : "integrations";
  localStorage.setItem(SETTINGS_SUBTAB_KEY, pane);
  document.querySelectorAll(".settings-dual-tab").forEach((btn) => {
    const on = btn.getAttribute("data-settings-tab") === pane;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  const pInt = $("settingsPanelIntegrations");
  const pStr = $("settingsPanelStrategy");
  const pUsr = $("settingsPanelUsers");
  if (pInt) pInt.classList.toggle("active", pane === "integrations");
  if (pStr) pStr.classList.toggle("active", pane === "strategy");
  if (pUsr) pUsr.classList.toggle("active", pane === "users");
  if (pane === "users") void renderPanelUsersListLoaded();
  if (pane === "strategy") {
    syncStrategyEntriesWithBotAndDiscovered(uiState.lastShowConfig, uiState.panelStrategyList);
    renderStrategyEntriesList();
  }
}

/** 切换到数据区后双 rAF 再量宽高，避免当帧 display 切换导致 mount 为 0 宽或图表未 fit */
function scheduleDataPanelChartLayout() {
  const apply = () => {
    if (!isDataSectionActive()) return;
    const chart = uiState.lwChart;
    const mount = $("daKlineMount");
    if (chart && mount) {
      const { w, h } = klineMountLayoutBox(mount);
      chart.applyOptions({ width: w, height: h });
      try {
        chart.timeScale().fitContent();
      } catch {
        // ignore
      }
    }
    if (uiState.dataCandles?.data?.length) {
      uiState.lwDidInitialFit = false;
      renderDataChartPanel(uiState.dataCandles);
    }
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(apply);
  });
}

function switchSection(sectionId, options = {}) {
  const { skipPersist = false } = options;
  if (sectionId && menuPermissionFor(sectionId) === "hidden") {
    const alt = firstVisibleMenuSectionId();
    if (alt != null && alt !== sectionId) {
      switchSection(alt, options);
      return;
    }
  }
  const el = sectionId && document.getElementById(sectionId);
  if (!el || !el.classList.contains("section")) return;
  document.querySelectorAll(".section").forEach((e) => e.classList.remove("active"));
  document.querySelectorAll(".sidebar-nav .nav-btn").forEach((e) => {
    e.classList.remove("active");
    e.removeAttribute("aria-current");
  });
  el.classList.add("active");
  const navBtn = document.querySelector(`.sidebar-nav .nav-btn[data-section="${sectionId}"]`);
  if (navBtn) {
    navBtn.classList.add("active");
    navBtn.setAttribute("aria-current", "page");
  }
  updatePageHeading(sectionId);
  if (!skipPersist) persistActiveSection(sectionId);
  if (sectionId === "settings") {
    const raw = localStorage.getItem(SETTINGS_SUBTAB_KEY) || "integrations";
    const sub = raw === "strategy" ? "strategy" : raw === "users" ? "users" : "integrations";
    setSettingsTab(sub);
    void loadPanelPreferences();
    void refreshSettingsBotContext();
  }
  if (sectionId === "control") refreshControlStrategyConfig();
  if (sectionId === "monitor") {
    void refreshOverview();
  }
  if (sectionId === "data") {
    void refreshDataPanel().finally(() => {
      scheduleDataPanelChartLayout();
    });
  }
  if (autoRefreshArmed && uiState.authed) {
    syncDataRealtimePollingForSection(sectionId);
  }
}

function resolveInitialSectionId() {
  const fromHash = decodeURIComponent((location.hash || "").replace(/^#/, "").trim());
  const pick = (id) => {
    if (!id || !document.getElementById(id)?.classList.contains("section")) return null;
    if (uiState.authed && menuPermissionFor(id) === "hidden") return firstVisibleMenuSectionId() || "overview";
    return id;
  };
  const a = pick(fromHash);
  if (a) return a;
  const stored = localStorage.getItem("ft_active_section");
  const b = pick(stored);
  if (b) return b;
  const htmlActive = document.querySelector(".section.active")?.id;
  const c = pick(htmlActive);
  if (c) return c;
  return firstVisibleMenuSectionId() || "overview";
}

function syncInitialActiveSection() {
  const id = resolveInitialSectionId();
  switchSection(id, { skipPersist: true });
  persistActiveSection(id);
}

function isDataSectionActive() {
  return document.getElementById("data")?.classList.contains("active");
}

function getActiveSectionId() {
  return document.querySelector(".section.active")?.id || "";
}

function stopDataRealtimeInterval() {
  if (dataRealtimeIntervalId != null) {
    clearInterval(dataRealtimeIntervalId);
    dataRealtimeIntervalId = null;
  }
}

/** 仅在「数据」分区可见且自动刷新开启时轮询 K 线，离开分区即停，减少无效请求与换源抖动。 */
function syncDataRealtimePollingForSection(sectionId) {
  stopDataRealtimeInterval();
  const want =
    sectionId === "data" &&
    autoRefreshArmed &&
    uiState.authed &&
    document.visibilityState !== "hidden";
  if (want) {
    dataRealtimeIntervalId = setInterval(() => void refreshDataRealtime(), DATA_KLINE_POLL_MS);
  }
}

/** 避免在隐藏的数据分区用 0 宽初始化 LightweightCharts；切换 Tab 后再画。 */
function renderDataKlineStripIfVisible(candles) {
  if (!isDataSectionActive()) return;
  renderDataChartPanel(candles);
}

function renderDataMarketStripIfVisible(board) {
  if (!isDataSectionActive()) return;
  renderMarketBoard(board);
}

function syncDataSwitchButtons() {
  const pair = uiState.selectedPair || $("historyPair")?.value?.trim() || "BTC/USD";
  const tf = uiState.selectedTimeframe || $("historyTf")?.value?.trim() || "5m";
  $("daPairButtons")?.querySelectorAll("[data-pair]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-pair") === pair);
  });
  $("daTfButtons")?.querySelectorAll("[data-tf]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-tf") === tf);
  });
}

function setDataPair(pair) {
  const next = String(pair || "").trim() || "BTC/USD";
  uiState.selectedPair = next;
  if ($("historyPair")) $("historyPair").value = next;
  syncDataSwitchButtons();
}

function setDataTimeframe(tf) {
  const next = String(tf || "").trim() || "5m";
  uiState.selectedTimeframe = next;
  if ($("historyTf")) $("historyTf").value = next;
  syncDataSwitchButtons();
}

function getDataSelection() {
  const pairFromSwitch = uiState.selectedPair || $("historyPair")?.value?.trim();
  const tfFromSwitch = uiState.selectedTimeframe || $("historyTf")?.value?.trim();
  return {
    pair: pairFromSwitch || $("historyPair")?.value?.trim() || "BTC/USD",
    timeframe: tfFromSwitch || "5m",
    strategy: $("historyStrategy")?.value?.trim() || "SampleStrategy",
    timerange: $("historyRange")?.value?.trim() || defaultRecentTimerange(30)
  };
}

function tickerLabel(pair, timeframe) {
  return `${String(pair || "BTC/USD").replace("/", "_")}_${String(timeframe || "1h").toUpperCase()}`;
}

function applyRealtimeDrift(candles, seq = 0) {
  const data = Array.isArray(candles?.data) ? candles.data : [];
  if (!data.length) return candles;
  const cloned = { ...(candles || {}), data: data.map((r) => [...r]) };
  const i = cloned.data.length - 1;
  const row = cloned.data[i];
  const open = Number(row?.[1] || 0);
  const high = Number(row?.[2] || open);
  const low = Number(row?.[3] || open);
  const close = Number(row?.[4] || open);
  const vol = Number(row?.[5] || 0);
  const step = Math.sin((Date.now() / 1000) + seq) * Math.max(0.01, open * 0.0007);
  const nextClose = Math.max(0.0001, close + step);
  row[4] = Number(nextClose.toFixed(4));
  row[2] = Number(Math.max(high, nextClose, open).toFixed(4));
  row[3] = Number(Math.min(low, nextClose, open).toFixed(4));
  row[5] = Number((vol + Math.abs(step) * 20).toFixed(2));
  return cloned;
}

function updatePageHeading(sectionId) {
  const titleEl = $("pageTitle");
  const subtitleEl = $("pageSubtitle");
  if (!titleEl) return;
  const activeSection = sectionId
    || document.querySelector(".nav-btn.active")?.dataset.section
    || "overview";
  const activeNavBtn = document.querySelector(`.nav-btn[data-section="${activeSection}"]`);
  const navKey = activeNavBtn?.getAttribute("data-i18n");
  titleEl.textContent = navKey ? t(navKey) : (activeNavBtn?.textContent || t("nav.overview"));
  if (subtitleEl) subtitleEl.textContent = "";
}

function parseApiBindingsFromStorage() {
  const raw = localStorage.getItem("ft_api_bindings");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map((item) => ({ ...DEFAULT_API_BINDING, ...item }));
      }
    } catch {
      // ignore invalid JSON
    }
  }
  // backward compatibility: old single settings -> list row
  if (localStorage.getItem("ft_ex_name") || localStorage.getItem("ft_llm_provider")) {
    return [{
      exchangeName: localStorage.getItem("ft_ex_name") || DEFAULT_API_BINDING.exchangeName,
      exchangeApiKey: localStorage.getItem("ft_ex_api_key") || "",
      exchangeApiSecret: localStorage.getItem("ft_ex_api_secret") || "",
      exchangePassphrase: localStorage.getItem("ft_ex_passphrase") || "",
      llmProvider: localStorage.getItem("ft_llm_provider") || DEFAULT_API_BINDING.llmProvider,
      llmBaseUrl: localStorage.getItem("ft_llm_base_url") || DEFAULT_API_BINDING.llmBaseUrl,
      llmApiKey: localStorage.getItem("ft_llm_api_key") || "",
      llmModel: localStorage.getItem("ft_llm_model") || DEFAULT_API_BINDING.llmModel
    }];
  }
  return [{ ...DEFAULT_API_BINDING }];
}

function normalizeApiBindingItem(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const prov = String(o.llmProvider ?? o.llm_provider ?? "").trim() || DEFAULT_API_BINDING.llmProvider;
  const ld = llmDefaultsForProvider(prov);
  let baseUrl = String(o.llmBaseUrl ?? o.llm_base_url ?? "").trim();
  let model = String(o.llmModel ?? o.llm_model ?? "").trim();
  if (!baseUrl) baseUrl = ld.baseUrl;
  if (!model) model = ld.model;
  const enRaw = o.enabled;
  const enabled =
    enRaw === false || enRaw === 0
      ? false
      : typeof enRaw === "string" && ["0", "false", "no", "off"].includes(String(enRaw).trim().toLowerCase())
        ? false
        : true;
  const labelRaw = String(o.bindingLabel ?? o.binding_label ?? "").trim();
  return {
    ...DEFAULT_API_BINDING,
    bindingLabel: labelRaw.slice(0, BINDING_LABEL_MAX),
    exchangeName: String(o.exchangeName ?? o.exchange_name ?? "").trim(),
    exchangeRestBaseUrl: String(
      o.exchangeRestBaseUrl ?? o.exchange_rest_base_url ?? ""
    ).trim(),
    exchangeApiKey: String(o.exchangeApiKey ?? o.exchange_api_key ?? "").trim(),
    exchangeApiSecret: String(o.exchangeApiSecret ?? o.exchange_api_secret ?? ""),
    exchangePassphrase: String(o.exchangePassphrase ?? o.exchange_passphrase ?? "").trim(),
    bindToBot: Boolean(o.bindToBot ?? o.bind_to_bot),
    enabled,
    llmProvider: prov,
    llmBaseUrl: baseUrl,
    llmApiKey: String(o.llmApiKey ?? o.llm_api_key ?? ""),
    llmModel: model
  };
}

/** 与 ft_pwd_session 同级：仅存本标签页，登出时清除；用于 GET /panel/preferences 失败时避免「假清空」。 */
const API_BINDINGS_LAST_OK_SS = "ft_api_bindings_last_ok";

function persistLastKnownApiBindingsSnapshot(bindings) {
  if (state.mockMode || !Array.isArray(bindings)) return;
  try {
    if (!bindings.length) {
      sessionStorage.removeItem(API_BINDINGS_LAST_OK_SS);
      return;
    }
    sessionStorage.setItem(API_BINDINGS_LAST_OK_SS, JSON.stringify(bindings));
  } catch {
    // quota / private mode
  }
}

function clearLastKnownApiBindingsSnapshot() {
  try {
    sessionStorage.removeItem(API_BINDINGS_LAST_OK_SS);
  } catch {
    // ignore
  }
}

/**
 * GET 偏好失败时恢复对接列表：优先本标签页内上次成功快照（含密钥），其次 localStorage 脱敏副本。
 */
function recoverApiBindingsFromLocalCaches() {
  if (state.mockMode) return [];
  try {
    const rawSs = sessionStorage.getItem(API_BINDINGS_LAST_OK_SS);
    if (rawSs && rawSs.trim()) {
      const parsed = JSON.parse(rawSs);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map((item) => normalizeApiBindingItem(item));
      }
    }
  } catch {
    // ignore
  }
  try {
    const raw = localStorage.getItem("ft_api_bindings");
    if (raw && raw.trim()) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map((item) => normalizeApiBindingItem(item));
      }
    }
  } catch {
    // ignore
  }
  return [];
}

/** 将历史版本中写入 localStorage 的明文绑定密钥重写为脱敏副本（非 mock）。 */
function scrubLegacyLocalStorageBindingSecrets() {
  if (state.mockMode) return;
  try {
    const raw = localStorage.getItem("ft_api_bindings");
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || !arr.length) return;
    persistApiBindingsLocalSnapshot(arr);
  } catch {
    // ignore
  }
}

/** 旧版单行 ft_ex_* / ft_llm_api_key 与 ft_api_bindings 并存时删除重复密钥。 */
function scrubLegacyFlatExchangeKeysFromLocalStorage() {
  try {
    if (!localStorage.getItem("ft_api_bindings")) return;
    for (const k of ["ft_ex_api_key", "ft_ex_api_secret", "ft_ex_passphrase", "ft_llm_api_key"]) {
      try {
        localStorage.removeItem(k);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

function bindingRowTemplate(binding, idx) {
  const canEdit = menuPermissionFor("settings") === "edit";
  const on = binding.enabled !== false;
  const rowClass = on ? "binding-row" : "binding-row binding-row--disabled";
  const dis = canEdit ? "" : " disabled";
  const keyDisplay = binding.exchangeApiKey ? "******" : `(${t("binding.keyEmpty")})`;
  const syncTag = binding.bindToBot
    ? `<span class="binding-sync-pill" title="${escapeHtml(t("binding.syncsToBot"))}">${escapeHtml(t("binding.syncsToBot"))}</span>`
    : "";
  const customLabel = String(binding.bindingLabel || "").trim();
  const titleText = customLabel || `${t("label.mapping")} #${idx + 1}`;
  const exRest = String(binding.exchangeRestBaseUrl || "").trim();
  const exLine =
    exRest && binding.exchangeName
      ? `${binding.exchangeName} · ${exRest.length > 48 ? `${exRest.slice(0, 48)}…` : exRest}`
      : String(binding.exchangeName || "");
  return `
    <div class="${rowClass}" data-binding-idx="${idx}">
      <div class="binding-row-head">
        <div class="binding-row-head-main">
          <span class="binding-row-title">${escapeHtml(titleText)}</span>
        </div>
        <div class="binding-row-head-tools">
          <label class="binding-row-effective">
            <input type="checkbox" class="binding-enabled-cb" data-binding-enabled="${idx}"${on ? " checked" : ""}${dis} />
            <span>${escapeHtml(t("binding.effective"))}</span>
          </label>
          <div class="actions">
            <button type="button" class="ghost" data-binding-edit="${idx}">${escapeHtml(t("btn.edit"))}</button>
            <button type="button" class="ghost binding-remove" data-binding-remove="${idx}">${escapeHtml(t("btn.del"))}</button>
          </div>
        </div>
      </div>
      <div class="binding-summary" role="list">
        <div class="binding-kv" role="listitem">
          <span class="binding-kv-k">${escapeHtml(t("binding.exchange"))}</span>
          <span class="binding-kv-v">${escapeHtml(exLine)}${syncTag}</span>
        </div>
        <div class="binding-kv" role="listitem">
          <span class="binding-kv-k">${escapeHtml(t("label.exchangeApiKey"))}</span>
          <span class="binding-kv-v binding-kv-v--mono">${escapeHtml(keyDisplay)}</span>
        </div>
        <div class="binding-kv binding-kv--span" role="listitem">
          <span class="binding-kv-k">${escapeHtml(t("binding.llm"))}</span>
          <span class="binding-kv-v">${escapeHtml(binding.llmProvider)} / ${escapeHtml(binding.llmModel)}</span>
        </div>
      </div>
    </div>
  `;
}

const MANUAL_STRATEGY_NAME_MAX = 200;

/** 防抖写入 SQLite：避免概览每轮轮询重复 POST /panel/preferences */
let strategyEntriesBackendSyncTimer = null;

function scheduleDebouncedPersistAfterStrategyEntrySync() {
  if (state.mockMode || !uiState.authed) return;
  if (strategyEntriesBackendSyncTimer != null) {
    clearTimeout(strategyEntriesBackendSyncTimer);
  }
  strategyEntriesBackendSyncTimer = window.setTimeout(() => {
    strategyEntriesBackendSyncTimer = null;
    void persistPanelPreferences();
  }, 2000);
}

/**
 * 将当前机器人 config 中的策略类名 + GET /panel/strategies 扫描到的类名并入「设置 → 策略列表」，
 * 与策略 AI 控制台卡片同源；变更后落 localStorage 并防抖 POST，写入 panel_profile.strategy_entries_json。
 */
function syncStrategyEntriesWithBotAndDiscovered(showConfig, panelStrategyList) {
  const list = normalizeStrategyEntries(state.strategyEntries);
  const seen = new Set(list.map((e) => String(e.strategyName || "").trim()).filter(Boolean));
  let changed = false;
  const addIfMissing = (rawName) => {
    const n = String(rawName || "").trim();
    if (!n || seen.has(n)) return;
    list.push(defaultStrategyEntry({ strategyName: n }));
    seen.add(n);
    changed = true;
  };
  addIfMissing(showConfig?.strategy);
  if (Array.isArray(panelStrategyList)) {
    for (const x of panelStrategyList) {
      addIfMissing(x);
    }
  }
  if (!changed) return;
  state.strategyEntries = list;
  syncStrategyEntriesDerivedState();
  persistProfileToLocalStorage();
  scheduleDebouncedPersistAfterStrategyEntrySync();
}

function renderStrategyEntriesList() {
  const root = $("manualStrategiesList");
  if (!root) return;
  const entries = normalizeStrategyEntries(state.strategyEntries);
  const onOff = (on) => (on ? escapeHtml(t("label.on")) : escapeHtml(t("label.off")));
  if (!entries.length) {
    root.innerHTML = `<div class="bindings-empty settings-strategy-empty">${escapeHtml(t("settings.manualStrategiesEmpty"))}</div>`;
    return;
  }
  const canRowClick = menuPermissionFor("settings") === "edit";
  const stakeCur = String(getLiveShowConfigForControl()?.stake_currency || "").trim();
  const rows = entries.map((e) => {
    const nm = String(e.strategyName || "").trim();
    const title = nm || t("settings.strategyEntryUntitled");
    const auth =
      e.strategyAuthorizedAmount != null && Number.isFinite(e.strategyAuthorizedAmount)
        ? stakeCur
          ? `${e.strategyAuthorizedAmount} ${stakeCur}`
          : String(e.strategyAuthorizedAmount)
        : "—";
    const apr =
      e.strategyTargetAnnualReturnPct != null && Number.isFinite(e.strategyTargetAnnualReturnPct)
        ? `${e.strategyTargetAnnualReturnPct}%`
        : "—";
    const rdd =
      e.riskMaxDrawdownLimitPct != null && Number.isFinite(e.riskMaxDrawdownLimitPct)
        ? `${e.riskMaxDrawdownLimitPct}%`
        : "—";
    const rthr =
      e.riskThresholdPct != null && Number.isFinite(e.riskThresholdPct) ? `${e.riskThresholdPct}%` : "—";
    const notes = String(e.strategyNotes || "").trim();
    const notesPrev = notes.length > 48 ? `${notes.slice(0, 48)}…` : notes;
    const rpcShort = String(e.strategyRpcBase || "").trim();
    const rpcDisp =
      rpcShort.length > 40 ? `${escapeHtml(rpcShort.slice(0, 40))}…` : escapeHtml(rpcShort || "—");
    const rowTab = canRowClick ? ' tabindex="0"' : "";
    const rowEditableClass = canRowClick ? " strategy-entry-row--editable" : "";
    const rowHint = canRowClick
      ? ` title="${escapeHtml(t("settings.strategyEntryRowClickHint"))}"`
      : "";
    return `
    <div class="binding-row binding-row--manual-strategy binding-row--strategy-entry strategy-entry-table-row${rowEditableClass}"${rowTab}${rowHint} data-strategy-entry-row="${escapeHtml(e.id)}" role="group" aria-label="${escapeHtml(title)}">
      <div class="strategy-entry-name-head"><span class="mono">${escapeHtml(title)}</span></div>
      <div class="strategy-entry-inline-detail muted">
        <span class="strategy-entry-kv"><span class="strategy-entry-k">${escapeHtml(t("label.strategyAuthorizedAmount"))}</span><b class="strategy-entry-v">${escapeHtml(auth)}</b></span>
        <span class="strategy-entry-kv"><span class="strategy-entry-k">${escapeHtml(t("label.strategyTargetAnnualReturnPct"))}</span><b class="strategy-entry-v">${escapeHtml(apr)}</b></span>
        <span class="strategy-entry-kv"><span class="strategy-entry-k">${escapeHtml(t("settings.entryLineAi"))}</span><span class="strategy-entry-v">${onOff(e.aiTakeoverTrading)}</span></span>
        <span class="strategy-entry-kv"><span class="strategy-entry-k">${escapeHtml(t("settings.entryLineDedicatedRpc"))}</span><span class="strategy-entry-v mono strategy-entry-v--ellipsis">${rpcDisp}</span></span>
        <span class="strategy-entry-kv"><span class="strategy-entry-k">${escapeHtml(t("settings.entryLinePaper"))}</span><span class="strategy-entry-v">${onOff(e.paperTrading)}</span></span>
        <span class="strategy-entry-kv"><span class="strategy-entry-k">${escapeHtml(t("settings.entryLineFreqai"))}</span><span class="strategy-entry-v">${onOff(e.riskUseFreqaiLimits)}</span></span>
        <span class="strategy-entry-kv"><span class="strategy-entry-k">${escapeHtml(t("label.riskMaxDrawdownLimitPct"))}</span><b class="strategy-entry-v">${escapeHtml(rdd)}</b></span>
        <span class="strategy-entry-kv"><span class="strategy-entry-k">${escapeHtml(t("label.riskThresholdPct"))}</span><b class="strategy-entry-v">${escapeHtml(rthr)}</b></span>
        <span class="strategy-entry-kv"><span class="strategy-entry-k">${escapeHtml(t("settings.manualStrategyShowOnConsole"))}</span><span class="strategy-entry-v">${onOff(e.showOnConsole)}</span></span>
        <span class="strategy-entry-kv"><span class="strategy-entry-k">${escapeHtml(t("settings.entryLineStrategyCardGrid"))}</span><span class="strategy-entry-v">${onOff(e.controlShowStrategyCards !== false)}</span></span>
        ${notes ? `<span class="strategy-entry-kv strategy-entry-kv--notes"><span class="strategy-entry-k">${escapeHtml(t("label.strategyNotes"))}</span><span class="strategy-entry-v strategy-entry-v--ellipsis">${escapeHtml(notesPrev)}</span></span>` : ""}
      </div>
      <div class="manual-strategy-row-actions">
        <button type="button" class="ghost manual-strategy-edit-btn" data-strategy-entry-edit="${escapeHtml(e.id)}">${escapeHtml(t("btn.editStrategyConfig"))}</button>
        <button type="button" class="ghost manual-strategy-remove-btn" data-strategy-entry-remove="${escapeHtml(e.id)}">${escapeHtml(t("btn.del"))}</button>
      </div>
    </div>`;
  });
  root.innerHTML = rows.join("");
}

function renameManualStrategySlotKey(oldName, newName) {
  const o = String(oldName || "").trim();
  const n = String(newName || "").trim();
  if (!o || !n || o === n) return;
  if (!state.strategySlots || typeof state.strategySlots !== "object" || Array.isArray(state.strategySlots)) {
    return;
  }
  const slot = state.strategySlots[o];
  if (!slot || typeof slot !== "object") return;
  const next = { ...state.strategySlots };
  delete next[o];
  const existing = next[n] && typeof next[n] === "object" ? next[n] : {};
  const merged = { ...existing };
  if (slot.detailJson && !merged.detailJson) merged.detailJson = slot.detailJson;
  if (slot.mml && !merged.mml) merged.mml = slot.mml;
  next[n] = merged;
  state.strategySlots = normalizeStrategySlots(next);
}

function refreshControlStrategyConfig() {
  const sum = $("controlStrategyConfigSummary");
  const pre = $("controlStrategyRulesOut");
  const sc = getLiveShowConfigForControl();
  const { displayStrategyName, aiOn, paperOn, rulesOutput } = resolvePanelConfigSummary(
    sc?.strategy,
    state.strategyName
  );
  if (sum) {
    sum.textContent = state.lang === "en"
      ? `Name: ${displayStrategyName} · AI takeover: ${aiOn ? "ON" : "OFF"} · Paper (no trade API): ${paperOn ? "ON" : "OFF"} (panel flags).`
      : `策略名：${displayStrategyName} · AI 接管：${aiOn ? "开" : "关"} · 模拟交易（不调交易 API）：${paperOn ? "开" : "关"}（均为面板标记）。`;
  }
  if (pre) {
    pre.textContent = rulesOutput.trim()
      ? rulesOutput
      : (state.lang === "en" ? "(no rule output yet)" : "（暂无规则输出）");
  }
}

function renderApiBindings() {
  const root = $("apiBindingsList");
  if (!root) return;
  if (!state.apiBindings.length) {
    if (!state.mockMode && uiState.authed && !uiState.panelPrefsSyncedFromDb) {
      root.innerHTML = `<div class="bindings-empty bindings-empty--pending">${escapeHtml(t("settings.bindingsUnavailableUpstream"))}</div>`;
      return;
    }
    root.innerHTML = state.lang === "en"
      ? `<div class="bindings-empty">No bindings in DB yet. Use <strong>Add</strong> for Binance keys etc., then <strong>Save settings</strong> — rows go to <code>panel_api_binding</code> in <code>panel_store.sqlite</code>.</div>`
      : `<div class="bindings-empty">数据库中尚无对接关系。点击「新增」添加币安等 API，再点「保存设置」写入 <code>panel_store.sqlite</code> 表 <code>panel_api_binding</code>。</div>`;
    return;
  }
  const showStaleBanner =
    !state.mockMode && uiState.authed && !uiState.panelPrefsSyncedFromDb;
  const banner = showStaleBanner
    ? `<div class="bindings-stale-banner muted" role="status">${escapeHtml(t("settings.apiBindingsStaleCacheBanner"))}</div>`
    : "";
  root.innerHTML = `${banner}${state.apiBindings.map((binding, idx) => bindingRowTemplate(binding, idx)).join("")}`;
}

function openApiBindingModal(idx = -1) {
  uiState.editingBindingIdx = idx;
  const editing = idx >= 0 ? state.apiBindings[idx] : { ...DEFAULT_API_BINDING };
  const dn = String(editing.bindingLabel || "").trim();
  $("modalTitle").textContent =
    idx >= 0
      ? dn
        ? `${t("modal.apiBindingTitleEdit")} — ${dn}`
        : `${t("modal.apiBindingTitleEdit")} #${idx + 1}`
      : t("modal.apiBindingTitleNew");
  const lb = $("mBindingLabel");
  if (lb) lb.value = String(editing.bindingLabel || "").trim().slice(0, BINDING_LABEL_MAX);
  applyExchangeFieldsFromBinding(editing);
  $("mExchangeApiKey").value = editing.exchangeApiKey || "";
  $("mExchangeApiSecret").value = editing.exchangeApiSecret || "";
  $("mExchangePassphrase").value = editing.exchangePassphrase || "";
  const chk = $("mBindToBot");
  if (chk) chk.checked = !!editing.bindToBot;
  const enChk = $("mBindingEnabled");
  if (enChk) enChk.checked = editing.enabled !== false;
  const prov = String(editing.llmProvider || "deepseek").toLowerCase();
  const ld = llmDefaultsForProvider(prov);
  $("mLlmProvider").value = prov;
  $("mLlmBaseUrl").value = (editing.llmBaseUrl && String(editing.llmBaseUrl).trim()) || ld.baseUrl;
  $("mLlmApiKey").value = editing.llmApiKey || "";
  $("mLlmModel").value = (editing.llmModel && String(editing.llmModel).trim()) || ld.model;
  $("apiBindingModal")?.classList.remove("hidden");
}

function closeApiBindingModal() {
  $("apiBindingModal")?.classList.add("hidden");
  uiState.editingBindingIdx = -1;
}

function openStrategyMemoModal(entryId = null) {
  if (menuPermissionFor("settings") !== "edit") return;
  uiState.editingStrategyEntryId = entryId;
  const list = normalizeStrategyEntries(state.strategyEntries);
  const ent = entryId != null ? list.find((e) => e.id === entryId) : null;
  const fill = ent || defaultStrategyEntry();
  const titleEl = $("strategyMemoModalTitle");
  if (titleEl) {
    titleEl.textContent = entryId ? t("modal.strategyEntryEditTitle") : t("modal.strategyEntryNewTitle");
  }
  if ($("mStrategyName")) $("mStrategyName").value = fill.strategyName || "";
  if ($("mStrategyRpcBase")) $("mStrategyRpcBase").value = String(fill.strategyRpcBase || "").trim();
  if ($("mControlShowStrategyCards")) {
    $("mControlShowStrategyCards").checked = fill.controlShowStrategyCards !== false;
  }
  if ($("mStrategyNotes")) $("mStrategyNotes").value = fill.strategyNotes || "";
  if ($("mStrategyExtraJson")) $("mStrategyExtraJson").value = fill.strategyExtraJson || "";
  if ($("mAiTakeoverTrading")) $("mAiTakeoverTrading").checked = !!fill.aiTakeoverTrading;
  if ($("mPaperTrading")) $("mPaperTrading").checked = !!fill.paperTrading;
  if ($("mRiskUseFreqaiLimits")) $("mRiskUseFreqaiLimits").checked = !!fill.riskUseFreqaiLimits;
  if ($("mRiskMaxDrawdownLimitPct")) {
    $("mRiskMaxDrawdownLimitPct").value =
      fill.riskMaxDrawdownLimitPct != null && Number.isFinite(fill.riskMaxDrawdownLimitPct)
        ? String(fill.riskMaxDrawdownLimitPct)
        : "";
  }
  if ($("mRiskThresholdPct")) {
    $("mRiskThresholdPct").value =
      fill.riskThresholdPct != null && Number.isFinite(fill.riskThresholdPct)
        ? String(fill.riskThresholdPct)
        : "";
  }
  if ($("mStrategyAuthorizedAmount")) {
    $("mStrategyAuthorizedAmount").value =
      fill.strategyAuthorizedAmount != null && Number.isFinite(fill.strategyAuthorizedAmount)
        ? String(fill.strategyAuthorizedAmount)
        : "";
  }
  if ($("mStrategyTargetAnnualReturnPct")) {
    $("mStrategyTargetAnnualReturnPct").value =
      fill.strategyTargetAnnualReturnPct != null && Number.isFinite(fill.strategyTargetAnnualReturnPct)
        ? String(fill.strategyTargetAnnualReturnPct)
        : "";
  }
  if ($("mStrategyRulesOutput")) $("mStrategyRulesOutput").value = fill.strategyRulesOutput || "";
  if ($("mStrategyShowOnConsole")) $("mStrategyShowOnConsole").checked = fill.showOnConsole !== false;
  const slotKey = String(fill.strategyName || "").trim();
  const slot =
    slotKey &&
    state.strategySlots &&
    typeof state.strategySlots === "object" &&
    !Array.isArray(state.strategySlots)
      ? state.strategySlots[slotKey] || {}
      : {};
  if ($("mEntrySlotDetailJson")) $("mEntrySlotDetailJson").value = slot.detailJson || "";
  if ($("mEntrySlotMml")) $("mEntrySlotMml").value = slot.mml || "";
  refreshStrategyAuthorizedAmountStakeHint();
  $("strategyMemoModal")?.classList.remove("hidden");
}

function closeStrategyMemoModal() {
  $("strategyMemoModal")?.classList.add("hidden");
  uiState.editingStrategyEntryId = null;
}

function strategySlotModalCandidateNames() {
  const cfg = getLiveShowConfigForControl();
  const active = String(cfg?.strategy || "").trim();
  const settingsName = String(state.strategyName || "").trim();
  return orderedStrategyNames(
    uiState.panelStrategyList,
    active,
    settingsName,
    state.manualStrategyNames
  );
}

function applyStrategySlotFieldsFromState(strategyName) {
  const name = String(strategyName || "").trim();
  const slot =
    state.strategySlots && typeof state.strategySlots === "object" && !Array.isArray(state.strategySlots)
      ? state.strategySlots[name] || {}
      : {};
  if ($("mStrategySlotDetailJson")) $("mStrategySlotDetailJson").value = slot.detailJson || "";
  if ($("mStrategySlotMml")) $("mStrategySlotMml").value = slot.mml || "";
}

/** Build single-select options; preselect ``preferredName`` when present. Returns current select value or "" */
function populateStrategySlotNameSelect(preferredName) {
  const sel = $("mStrategySlotNameSelect");
  if (!(sel instanceof HTMLSelectElement)) return "";
  const pref = String(preferredName || "").trim();
  let names = strategySlotModalCandidateNames();
  if (pref && !names.includes(pref)) {
    names = [pref, ...names];
  }
  if (!names.length && pref) {
    names = [pref];
  }
  if (!names.length) {
    sel.innerHTML = "";
    if ($("mStrategySlotDetailJson")) $("mStrategySlotDetailJson").value = "";
    if ($("mStrategySlotMml")) $("mStrategySlotMml").value = "";
    return "";
  }
  sel.innerHTML = names.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
  const pick = pref && names.includes(pref) ? pref : names[0];
  sel.value = pick;
  applyStrategySlotFieldsFromState(sel.value);
  return sel.value;
}

function openStrategySlotModal(strategyName) {
  if (!canEditStrategySlots()) return;
  const candidates = strategySlotModalCandidateNames();
  const pref = String(strategyName || "").trim();
  if (!pref && !candidates.length) return;
  populateStrategySlotNameSelect(pref || candidates[0] || "");
  $("strategySlotModal")?.classList.remove("hidden");
}

function closeStrategySlotModal() {
  $("strategySlotModal")?.classList.add("hidden");
}

async function saveStrategySlotFromModal() {
  if (!canEditStrategySlots()) return;
  const sel = $("mStrategySlotNameSelect");
  const name = (sel instanceof HTMLSelectElement ? sel.value : "").trim();
  if (!name) {
    closeStrategySlotModal();
    return;
  }
  const dj = ($("mStrategySlotDetailJson")?.value ?? "").trim();
  const mml = ($("mStrategySlotMml")?.value ?? "").trim();
  const prev =
    state.strategySlots && typeof state.strategySlots === "object" && !Array.isArray(state.strategySlots)
      ? state.strategySlots
      : {};
  const next = { ...prev };
  next[name] = {};
  if (dj) next[name].detailJson = dj;
  if (mml) next[name].mml = mml;
  state.strategySlots = normalizeStrategySlots(next);
  closeStrategySlotModal();
  await pushSettingsToPanelBackend();
  rerenderControlHeroAndCards();
  refreshOverview();
  refreshPositions();
  refreshLists();
  logAction(t("log.strategySlotUpdated"));
}

function parseOptionalPercentInput(raw) {
  const s = String(raw ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalAmountInput(raw) {
  const s = String(raw ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

async function saveStrategyMemoFromModal() {
  if (menuPermissionFor("settings") !== "edit") return;
  let nameRaw = String($("mStrategyName")?.value ?? "").trim();
  if (!nameRaw) {
    logAction(t("settings.strategyNameRequired"));
    return;
  }
  if (nameRaw.length > MANUAL_STRATEGY_NAME_MAX) {
    nameRaw = nameRaw.slice(0, MANUAL_STRATEGY_NAME_MAX);
  }
  const dup = normalizeStrategyEntries(state.strategyEntries).some(
    (e) =>
      String(e.strategyName || "").trim() === nameRaw &&
      (!uiState.editingStrategyEntryId || e.id !== uiState.editingStrategyEntryId)
  );
  if (dup) {
    logAction(t("settings.manualStrategyDup"));
    return;
  }
  const patch = {
    strategyName: nameRaw,
    strategyNotes: String($("mStrategyNotes")?.value ?? ""),
    strategyExtraJson: String($("mStrategyExtraJson")?.value ?? ""),
    aiTakeoverTrading: Boolean($("mAiTakeoverTrading")?.checked),
    paperTrading: Boolean($("mPaperTrading")?.checked),
    riskUseFreqaiLimits: Boolean($("mRiskUseFreqaiLimits")?.checked),
    riskMaxDrawdownLimitPct: parseOptionalPercentInput($("mRiskMaxDrawdownLimitPct")?.value),
    riskThresholdPct: parseOptionalPercentInput($("mRiskThresholdPct")?.value),
    strategyAuthorizedAmount: parseOptionalAmountInput($("mStrategyAuthorizedAmount")?.value),
    strategyTargetAnnualReturnPct: parseOptionalPercentInput($("mStrategyTargetAnnualReturnPct")?.value),
    strategyRulesOutput: String($("mStrategyRulesOutput")?.value ?? ""),
    showOnConsole: Boolean($("mStrategyShowOnConsole")?.checked),
    controlShowStrategyCards: Boolean($("mControlShowStrategyCards")?.checked),
    strategyRpcBase: String($("mStrategyRpcBase")?.value ?? "").trim()
  };
  let list = normalizeStrategyEntries(state.strategyEntries);
  const eid = uiState.editingStrategyEntryId;
  if (eid) {
    const ix = list.findIndex((e) => e.id === eid);
    if (ix >= 0) {
      const oldName = String(list[ix].strategyName || "").trim();
      if (oldName && oldName !== nameRaw) renameManualStrategySlotKey(oldName, nameRaw);
      list[ix] = { ...list[ix], ...patch, id: list[ix].id };
    } else {
      list.push(defaultStrategyEntry({ ...patch, id: eid }));
    }
  } else {
    list.push(defaultStrategyEntry(patch));
  }
  state.strategyEntries = list;
  const dj = String($("mEntrySlotDetailJson")?.value ?? "").trim();
  const mml = String($("mEntrySlotMml")?.value ?? "").trim();
  const prevSlots =
    state.strategySlots && typeof state.strategySlots === "object" && !Array.isArray(state.strategySlots)
      ? state.strategySlots
      : {};
  const nextSlots = { ...prevSlots };
  nextSlots[nameRaw] = {};
  if (dj) nextSlots[nameRaw].detailJson = dj;
  if (mml) nextSlots[nameRaw].mml = mml;
  state.strategySlots = normalizeStrategySlots(nextSlots);
  syncStrategyEntriesDerivedState();
  renderStrategyEntriesList();
  refreshControlStrategyConfig();
  closeStrategyMemoModal();
  await pushSettingsToPanelBackend();
  rerenderControlHeroAndCards();
  refreshOverview();
  refreshPositions();
  refreshLists();
  logAction(t("log.configUpdated"));
}

function removeStrategyEntryById(entryId) {
  if (menuPermissionFor("settings") !== "edit") return;
  const eid = String(entryId || "").trim();
  if (!eid) return;
  if (!window.confirm(t("settings.confirmRemoveManualStrategy"))) return;
  const list = normalizeStrategyEntries(state.strategyEntries);
  const victim = list.find((e) => e.id === eid);
  const nm = victim ? String(victim.strategyName || "").trim() : "";
  const next = list.filter((e) => e.id !== eid);
  state.strategyEntries = next.length ? next : [defaultStrategyEntry()];
  if (nm && state.strategySlots && typeof state.strategySlots === "object" && !Array.isArray(state.strategySlots)) {
    const slots = { ...state.strategySlots };
    delete slots[nm];
    state.strategySlots = normalizeStrategySlots(slots);
  }
  syncStrategyEntriesDerivedState();
  persistProfileToLocalStorage();
  void persistPanelPreferences({
    forceFullProfileSync: true,
    forceIncludeApiBindings: true
  });
  renderStrategyEntriesList();
  rerenderControlHeroAndCards();
  logAction(t("log.manualStrategyRemoved"));
}

async function saveApiBindingFromModal() {
  const bindToBot = Boolean($("mBindToBot")?.checked);
  const enabled = $("mBindingEnabled") ? Boolean($("mBindingEnabled").checked) : true;
  const prov = String($("mLlmProvider")?.value || "deepseek").toLowerCase();
  const ld = llmDefaultsForProvider(prov);
  const labelEl = $("mBindingLabel");
  const bindingLabel = String(labelEl?.value ?? "")
    .trim()
    .slice(0, BINDING_LABEL_MAX);
  const exchangeName = readExchangeIdFromModal();
  const item = {
    bindingLabel,
    exchangeName,
    exchangeRestBaseUrl: readExchangeRestBaseFromModal(),
    exchangeApiKey: $("mExchangeApiKey").value.trim(),
    exchangeApiSecret: $("mExchangeApiSecret").value,
    exchangePassphrase: $("mExchangePassphrase").value.trim(),
    bindToBot: enabled ? bindToBot : false,
    enabled,
    llmProvider: prov || DEFAULT_API_BINDING.llmProvider,
    llmBaseUrl: $("mLlmBaseUrl").value.trim() || ld.baseUrl,
    llmApiKey: $("mLlmApiKey").value,
    llmModel: $("mLlmModel").value.trim() || ld.model
  };
  let targetIdx = -1;
  if (uiState.editingBindingIdx >= 0) {
    targetIdx = uiState.editingBindingIdx;
    state.apiBindings[targetIdx] = item;
  } else {
    state.apiBindings.push(item);
    targetIdx = state.apiBindings.length - 1;
  }
  state.apiBindings.forEach((b, i) => {
    b.bindToBot = enabled && i === targetIdx && bindToBot;
  });
  persistApiBindingsLocalSnapshot(state.apiBindings);
  renderApiBindings();
  closeApiBindingModal();
  await pushSettingsToPanelBackend();
  refreshOverview();
  refreshPositions();
  refreshLists();
  logAction(t("log.configUpdated"));
}

/**
 * @param {"hidden"|"loading"|"ok"|"error"} phase
 * @param {string} line1 首行：loading/异常时为整段说明；ok/error 时为交易所行（含标签）
 * @param {string} [line2] 第二行：大模型（ok/error）；缺省则留空（loading/部分错误）
 */
function setLlmProbeFeedback(phase, line1, line2 = "") {
  const feedback = $("llmProbeFeedback");
  const exEl = $("llmProbeExchangeStatusText");
  const llmEl = $("llmProbeLlmStatusText");
  if (!feedback || !exEl || !llmEl) return;
  if (phase === "hidden") {
    feedback.classList.add("hidden");
    feedback.setAttribute("aria-hidden", "true");
    feedback.classList.remove("llm-probe-feedback--loading", "llm-probe-feedback--ok", "llm-probe-feedback--error");
    exEl.textContent = "";
    llmEl.textContent = "";
    return;
  }
  feedback.classList.remove("hidden");
  feedback.setAttribute("aria-hidden", "false");
  feedback.classList.remove("llm-probe-feedback--loading", "llm-probe-feedback--ok", "llm-probe-feedback--error");
  if (phase === "loading") feedback.classList.add("llm-probe-feedback--loading");
  if (phase === "ok") feedback.classList.add("llm-probe-feedback--ok");
  if (phase === "error") feedback.classList.add("llm-probe-feedback--error");
  exEl.textContent = line1;
  llmEl.textContent = line2;
}

function resetApiBindingLlmProbeUi() {
  const probeBtn = $("btnLlmProbe");
  if (probeBtn instanceof HTMLButtonElement) {
    probeBtn.disabled = false;
    probeBtn.textContent = t("btn.llmProbe");
    probeBtn.setAttribute("aria-busy", "false");
  }
  setLlmProbeFeedback("hidden", "", "");
}

/**
 * 并行经 Bovin `POST /panel/exchange_probe`（ccxt 私钥）与 `POST /panel/llm_probe`（OpenAI 兼容）探测，避免浏览器直连的 CORS 问题。
 */
async function probeLlmFromBindingModal() {
  const exchangeName = readExchangeIdFromModal();
  const exchangeRestBaseUrl = readExchangeRestBaseFromModal();
  const exchangeApiKey = String($("mExchangeApiKey")?.value ?? "").trim();
  const exchangeApiSecret = String($("mExchangeApiSecret")?.value ?? "");
  const exchangePassphrase = String($("mExchangePassphrase")?.value ?? "").trim();
  const prov = String($("mLlmProvider")?.value || "deepseek").toLowerCase();
  const ld = llmDefaultsForProvider(prov);
  const baseUrl = String($("mLlmBaseUrl")?.value ?? "").trim() || ld.baseUrl;
  const apiKey = String($("mLlmApiKey")?.value ?? "");
  const model = String($("mLlmModel")?.value ?? "").trim() || ld.model;
  const btn = $("btnLlmProbe");
  const probeLabel = t("btn.llmProbe");
  const labEx = t("llmProbe.label.exchange");
  const labLlm = t("llmProbe.label.llm");
  const failUnknown = t("llmProbe.status.failUnknown");
  setLlmProbeFeedback("loading", t("llmProbe.status.testing"), "");
  if (btn instanceof HTMLButtonElement) {
    btn.disabled = true;
    btn.textContent = t("llmProbe.btn.working");
    btn.setAttribute("aria-busy", "true");
  }
  try {
    const [exSettled, llmSettled] = await Promise.allSettled([
      apiCall("/panel/exchange_probe", "POST", {
        exchangeName,
        exchangeRestBaseUrl,
        exchangeApiKey,
        exchangeApiSecret,
        exchangePassphrase
      }),
      apiCall("/panel/llm_probe", "POST", {
        llmProvider: prov,
        llmBaseUrl: baseUrl,
        llmApiKey: apiKey,
        llmModel: model
      })
    ]);
    debugPanel("binding_probe exchange", exSettled);
    debugPanel("binding_probe llm", llmSettled);

    const exData = exSettled.status === "fulfilled" ? exSettled.value : null;
    const llmData = llmSettled.status === "fulfilled" ? llmSettled.value : null;
    const exErr =
      exSettled.status === "rejected" && exSettled.reason && typeof exSettled.reason === "object" && "message" in exSettled.reason
        ? String(exSettled.reason.message)
        : exSettled.status === "rejected"
          ? String(exSettled.reason)
          : null;
    const llmErr =
      llmSettled.status === "rejected" && llmSettled.reason && typeof llmSettled.reason === "object" && "message" in llmSettled.reason
        ? String(llmSettled.reason.message)
        : llmSettled.status === "rejected"
          ? String(llmSettled.reason)
          : null;

    const exOk = Boolean(exData && exData.ok);
    const llmOk = Boolean(llmData && llmData.ok);

    let exLine = "";
    if (exOk && exData) {
      const rawPv = exData.preview != null ? String(exData.preview) : "";
      const pv = rawPv.length > 200 ? `${rawPv.slice(0, 200)}…` : rawPv;
      exLine =
        state.lang === "en"
          ? (pv ? `OK (${exData.exchange}): ${pv}` : `OK (${exData.exchange}).`)
          : pv
            ? `正常（${exData.exchange}）：${pv}`
            : `正常（${exData.exchange}）。`;
    } else if (exErr) {
      exLine = state.lang === "en" ? `Request error: ${exErr}` : `请求出错：${exErr}`;
    } else {
      const d = exData?.detail != null ? String(exData.detail) : failUnknown;
      exLine = state.lang === "en" ? `Failed: ${d}` : `失败：${d}`;
    }

    let llmLine = "";
    if (llmOk && llmData) {
      const rawPv = llmData.preview != null ? String(llmData.preview) : "";
      const pv = rawPv.length > 200 ? `${rawPv.slice(0, 200)}…` : rawPv;
      llmLine =
        state.lang === "en"
          ? (pv
            ? `OK (${llmData.provider}, HTTP ${llmData.httpStatus}): ${pv}`
            : `OK (${llmData.provider}, HTTP ${llmData.httpStatus}).`)
          : pv
            ? `正常（${llmData.provider}，HTTP ${llmData.httpStatus}）：${pv}`
            : `正常（${llmData.provider}，HTTP ${llmData.httpStatus}）。`;
    } else if (llmErr) {
      llmLine = state.lang === "en" ? `Request error: ${llmErr}` : `请求出错：${llmErr}`;
    } else {
      const d = llmData?.detail != null ? String(llmData.detail) : failUnknown;
      llmLine = state.lang === "en" ? `Failed: ${d}` : `失败：${d}`;
    }

    const exTagged = `${labEx}：${exLine}`;
    const llmTagged = `${labLlm}：${llmLine}`;
    if (exOk && llmOk) {
      setLlmProbeFeedback("ok", exTagged, llmTagged);
      logAction(
        state.lang === "en"
          ? `Binding probe OK — exchange: ${exLine}; LLM: ${llmLine}`
          : `连通性探测成功 — 交易所：${exLine}；大模型：${llmLine}`
      );
    } else {
      setLlmProbeFeedback("error", exTagged, llmTagged);
      logAction(
        state.lang === "en"
          ? `Binding probe failed — exchange: ${exLine}; LLM: ${llmLine}`
          : `连通性探测未全部通过 — 交易所：${exLine}；大模型：${llmLine}`
      );
    }
  } catch (e) {
    debugPanel("binding_probe error", e);
    const msg = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
    const line = state.lang === "en" ? `Request error: ${msg}` : `请求出错：${msg}`;
    setLlmProbeFeedback("error", line, "");
    logAction(state.lang === "en" ? `Binding probe error: ${msg}` : `连通性探测出错：${msg}`);
  } finally {
    if (btn instanceof HTMLButtonElement) {
      btn.disabled = false;
      btn.textContent = probeLabel;
      btn.setAttribute("aria-busy", "false");
    }
  }
}

/* 非模拟模式：对接列表以服务端 DB 为准，不落本地预填。模拟模式仍可用 localStorage 便于离线演示。 */
if (state.mockMode) {
  state.apiBindings = parseApiBindingsFromStorage();
}

function setConfigInputs() {
  if ($("baseUrl")) $("baseUrl").value = state.baseUrl;
  if ($("wsApiV1Base")) $("wsApiV1Base").value = state.wsApiV1Base;
  if ($("wsToken")) $("wsToken").value = state.wsToken;
  if ($("username")) $("username").value = state.username;
  if ($("password")) $("password").value = state.password;
  renderApiBindings();
  renderStrategyEntriesList();
  refreshPanelBackendHint();
  refreshControlStrategyConfig();
  if ($("langSwitch")) $("langSwitch").value = state.lang;
  refreshRpcPushBadge();
}

async function saveConfig() {
  await pushSettingsToPanelBackend();
  logAction(t("log.configUpdated"));
}

async function saveConfigAndRefreshData() {
  await saveConfig();
  stopRpcMessageStream();
  startRpcMessageStream();
  if (autoRefreshArmed) armPollingIntervals();
  refreshOverview();
  refreshPositions();
  refreshLists();
}

function applyAuthView() {
  const loginScreen = $("loginScreen");
  const appRoot = $("appRoot");
  if (uiState.authed) {
    loginScreen?.classList.add("hidden");
    appRoot?.classList.remove("hidden");
  } else {
    loginScreen?.classList.remove("hidden");
    appRoot?.classList.add("hidden");
  }
}

/** 未登录时预填与仓库默认 api_server 一致的 admin，减少本地首次使用摩擦。 */
function prefillDefaultLoginFields() {
  const lu = $("loginUsername");
  const lp = $("loginPassword");
  if (!lu || !lp) return;
  if (!String(lu.value || "").trim()) {
    const fromLs = String(localStorage.getItem("ft_user") || "").trim();
    lu.value = fromLs || AUTH_DEFAULT_USER;
  }
  if (!String(lp.value || "").trim()) {
    try {
      const sess = sessionStorage.getItem("ft_pwd_session");
      if (sess) lp.value = sess;
      else lp.value = AUTH_DEFAULT_PASSWORD;
    } catch {
      lp.value = AUTH_DEFAULT_PASSWORD;
    }
  }
}

async function login(username, password) {
  const u = String(username || "").trim();
  const p = String(password || "");
  /** 去掉旧 JWT，否则 authHeader 会先发 Bearer，登录请求永远过不了 HTTP Basic */
  if (!state.mockMode) {
    clearApiTokens();
  }
  /** 所有 /api/v1 请求（含 /panel/auth/login）都带 HTTP Basic；与面板账号使用同一组凭据，避免在设置里再填一遍 */
  state.username = u;
  state.password = p;
  persistProfileToLocalStorage();
  const loginFetchOpts = { forceBasicAuth: true };

  const finishSession = async () => {
    if (!state.mockMode) {
      await exchangeBasicForJwtTokens();
    }
    uiState.authed = true;
    localStorage.setItem("ft_panel_auth", "1");
    persistPanelSession();
    if ($("loginError")) $("loginError").textContent = "";
    applyAuthView();
    applyI18n();
    renderEndpointTable();
    bindEvents();
    setDataPair($("historyPair")?.value?.trim() || "BTC/USD");
    setDataTimeframe($("historyTf")?.value?.trim() || "5m");
    syncInitialActiveSection();
    setConfigInputs();
    await beginAuthedSession();
    setConfigInputs();
    refreshMenuPermissionUi();
    /** 面板后端表单已隐藏，登录成功后把当前连接/凭据写回 SQLite，等价于原「保存连接」 */
    if (!state.mockMode && uiState.panelPrefsSyncedFromDb) void persistPanelPreferences();
    return true;
  };

  if (state.mockMode) {
    try {
      const r = await apiCall("/panel/auth/login", "POST", { username: u, password: p }, loginFetchOpts);
      if (r?.ok) {
        uiState.panelUserId = r.userId ?? null;
        uiState.panelUsername = r.username || u;
        uiState.menuPermissions =
          r.menuPermissions && typeof r.menuPermissions === "object"
            ? normalizeMenuPermsFromBody(r.menuPermissions)
            : defaultFullMenuPermissions();
        return await finishSession();
      }
    } catch {
      // fall through
    }
    if (u === AUTH_DEFAULT_USER && p === AUTH_DEFAULT_PASSWORD) {
      uiState.panelUserId = 1;
      uiState.panelUsername = u;
      uiState.menuPermissions = defaultFullMenuPermissions();
      return await finishSession();
    }
    if ($("loginError")) $("loginError").textContent = t("login.error");
    return false;
  }

  try {
    const r = await apiCall("/panel/auth/login", "POST", { username: u, password: p }, loginFetchOpts);
    if (r?.ok) {
      uiState.panelUserId = r.userId ?? null;
      uiState.panelUsername = r.username || u;
      uiState.menuPermissions =
        r.menuPermissions && typeof r.menuPermissions === "object"
          ? normalizeMenuPermsFromBody(r.menuPermissions)
          : defaultFullMenuPermissions();
      return await finishSession();
    }
  } catch (e) {
    const msg = String(e?.message || e);
    const isAuthFailure = /\b401\b/.test(msg) || /\b403\b/.test(msg);
    if (!isAuthFailure && u === AUTH_DEFAULT_USER && p === AUTH_DEFAULT_PASSWORD) {
      uiState.panelUserId = null;
      uiState.panelUsername = u;
      uiState.menuPermissions = defaultFullMenuPermissions();
      return await finishSession();
    }
    if ($("loginError")) $("loginError").textContent = isAuthFailure ? t("login.error.apiAuth") : msg;
    return false;
  }

  if ($("loginError")) $("loginError").textContent = t("login.error");
  return false;
}

function logout() {
  closeTopbarPopovers();
  if (panelPrefsRecoveryTimer != null) {
    clearTimeout(panelPrefsRecoveryTimer);
    panelPrefsRecoveryTimer = null;
  }
  if (strategyEntriesBackendSyncTimer != null) {
    clearTimeout(strategyEntriesBackendSyncTimer);
    strategyEntriesBackendSyncTimer = null;
  }
  uiState.authed = false;
  localStorage.removeItem("ft_panel_auth");
  uiState.panelPrefsSyncedFromDb = false;
  uiState.panelPrefsBindingsLoadedFromDb = false;
  clearPanelSession();
  stopAutoRefresh();
  refreshMenuPermissionUi();
  applyAuthView();
  refreshRpcPushBadge();
}

function sparkPathFromValues(vals, width = 100, height = 20) {
  if (!vals.length) return KPI_PATH_DEFAULT[0];
  const clean = vals.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  if (!clean.length) return KPI_PATH_DEFAULT[0];
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const r = max - min || 1e-9;
  return clean.map((v, i) => {
    const x = (i / Math.max(1, clean.length - 1)) * width;
    const y = height - ((v - min) / r) * (height - 4) - 2;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

function restoreMockOverviewDecor() {
  const tb = $("overviewStrategiesBody");
  if (tb) tb.innerHTML = staticOverviewStrategiesTbody();
  const rk = $("riskMatrixCells");
  if (rk) rk.innerHTML = staticRiskMatrix();
  updateRiskLeverageHead(null, []);
  $("kpiSpark1")?.setAttribute("d", KPI_PATH_DEFAULT[0]);
  $("kpiSpark2")?.setAttribute("d", KPI_PATH_DEFAULT[1]);
  $("kpiSpark3")?.setAttribute("d", KPI_PATH_DEFAULT[2]);
  const t1 = $("kpiCard1Title");
  const t2 = $("kpiCard2Title");
  const t3 = $("kpiCard3Title");
  if (t1) t1.textContent = t("overview.kpi.netValue");
  if (t2) t2.textContent = t("overview.kpi.dailyProfit");
  if (t3) t3.textContent = t("overview.kpi.drawdown");
  const e2 = $("kpiCard2Em");
  const e3 = $("kpiCard3Em");
  if (e2) {
    e2.textContent = t("overview.kpi.targetMet");
    e2.className = "positive";
  }
  if (e3) {
    e3.textContent = t("overview.kpi.riskThreshold");
    e3.className = "negative";
  }
  const k3 = $("kpiMaxDrawdown");
  if (k3) {
    k3.textContent = state.lang === "en" ? "8.20%" : "8.20%";
    k3.classList.remove("positive", "negative");
    k3.classList.add("negative");
  }
  const os = $("overviewStrategiesSummary");
  if (os) os.textContent = formatOverviewStrategiesCountsLine(2, 1, 0);
}

function refreshTopbarDecor(latencyMs, pingOk) {
  const net = $("topbarNetwork");
  const mkt = $("topbarMarket");
  const sys = $("topbarSystemText");
  const hintNet = t("topbar.hint.network");
  const hintMkt = t("topbar.hint.market");
  const hintSys = t("topbar.hint.systemBadge");
  if (state.mockMode) {
    if (net) {
      net.textContent = state.lang === "en" ? "API: demo placeholder" : "API: 模拟占位";
      net.setAttribute("title", hintNet);
    }
    if (mkt) {
      mkt.textContent = state.lang === "en" ? "Exchange: demo caption" : "交易所: 模拟说明";
      mkt.setAttribute("title", hintMkt);
    }
    if (sys) {
      sys.textContent = state.lang === "en" ? "System Online" : "系统在线";
      sys.setAttribute("title", hintSys);
    }
    return;
  }
  if (net) {
    net.textContent = pingOk
      ? (state.lang === "en" ? `API ~${Math.round(latencyMs)}ms` : `API 约 ${Math.round(latencyMs)}ms`)
      : (state.lang === "en" ? "API: unreachable" : "API: 不可达");
    net.setAttribute("title", hintNet);
  }
  if (mkt) {
    mkt.textContent = state.lang === "en"
      ? "Market: per bot exchange"
      : "市场: 以机器人交易所为准";
    mkt.setAttribute("title", hintMkt);
  }
  if (sys) {
    sys.textContent = pingOk
      ? (state.lang === "en" ? "System Online" : "系统在线")
      : (state.lang === "en" ? "System Down" : "系统离线");
    sys.setAttribute("title", hintSys);
  }
}

function hydrateThemeFromStorage() {
  const saved = localStorage.getItem("ft_ui_theme_pref");
  if (saved === "system" || saved === "light" || saved === "dark") uiState.theme = saved;
}

function resolveEffectiveTheme() {
  const pref = uiState.theme || localStorage.getItem("ft_ui_theme_pref") || "system";
  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "dark";
  }
}

function themePreferenceIcon() {
  const p = uiState.theme || "system";
  if (p === "light") return "light_mode";
  if (p === "dark") return "dark_mode";
  return "brightness_auto";
}

function applyTheme() {
  const effective = resolveEffectiveTheme();
  document.documentElement.setAttribute("data-theme", effective);
  const btn = $("topbarThemeBtn");
  if (btn) {
    const icon = btn.querySelector(".material-symbols-outlined");
    if (icon) icon.textContent = themePreferenceIcon();
    btn.setAttribute("title", t("topbar.theme.tooltip"));
  }
}

function cycleUiTheme() {
  const order = ["system", "light", "dark"];
  const i = order.indexOf(uiState.theme || "system");
  uiState.theme = order[(i + 1) % order.length];
  localStorage.setItem("ft_ui_theme_pref", uiState.theme);
  applyTheme();
  if (uiState.authed) void persistPanelPreferences({ forceFullProfileSync: true });
  logAction(`${t("aria.theme")}: ${uiState.theme}`);
}

function renderTopbarNotifyBody() {
  const body = $("topbarNotifyBody");
  if (!body) return;
  const rows = uiState.lastLogsSnapshot || [];
  if (!rows.length && state.mockMode) {
    body.innerHTML = `<div class="topbar-popover__muted">${escapeHtml(t("topbar.notify.mockHint"))}</div>`;
    return;
  }
  if (!rows.length) {
    body.innerHTML = `<div class="topbar-popover__muted">${escapeHtml(t("topbar.notify.empty"))}</div>`;
    return;
  }
  const tail = rows.slice(-15).reverse();
  body.innerHTML = tail
    .map((row) => {
      if (Array.isArray(row)) {
        const [time, , moduleName, level, msg] = row;
        return `<div class="log-row"><span class="log-time">${escapeHtml(String(time))}</span><span class="log-level">${escapeHtml(String(level))}</span><span class="log-msg">${escapeHtml(String(moduleName))}: ${escapeHtml(String(msg))}</span></div>`;
      }
      return `<div class="log-row"><span class="log-msg">${escapeHtml(JSON.stringify(row))}</span></div>`;
    })
    .join("");
}

function bindTopbarChrome() {
  if (uiState.topbarChromeBound) return;
  uiState.topbarChromeBound = true;

  if (!uiState.themeMediaBound) {
    uiState.themeMediaBound = true;
    try {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if ((uiState.theme || "system") === "system") applyTheme();
      });
    } catch {
      // ignore
    }
  }

  $("topbarThemeBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeTopbarPopovers();
    cycleUiTheme();
  });

  $("topbarNotifyBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (topbarPopoverOpen === "notify") {
      closeTopbarPopovers();
      return;
    }
    topbarPopoverOpen = "notify";
    $("topbarNotifyBtn")?.setAttribute("aria-expanded", "true");
    $("topbarAccountBtn")?.setAttribute("aria-expanded", "false");
    $("topbarAccountPopover")?.classList.add("hidden");
    renderTopbarNotifyBody();
    $("topbarNotifyPopover")?.classList.remove("hidden");
    $("topbarPopoverBackdrop")?.classList.remove("hidden");
  });

  $("topbarAccountBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (topbarPopoverOpen === "account") {
      closeTopbarPopovers();
      return;
    }
    topbarPopoverOpen = "account";
    $("topbarAccountBtn")?.setAttribute("aria-expanded", "true");
    $("topbarNotifyBtn")?.setAttribute("aria-expanded", "false");
    $("topbarNotifyPopover")?.classList.add("hidden");
    const name = $("topbarAccountName");
    if (name) {
      const u = String(uiState.panelUsername || "").trim();
      name.textContent = u || (state.lang === "en" ? "(no username)" : "（无用户名）");
    }
    $("topbarAccountPopover")?.classList.remove("hidden");
    $("topbarPopoverBackdrop")?.classList.remove("hidden");
  });

  $("topbarPopoverBackdrop")?.addEventListener("click", closeTopbarPopovers);
  $("topbarNotifyDismiss")?.addEventListener("click", closeTopbarPopovers);

  $("topbarAccountSettings")?.addEventListener("click", () => {
    closeTopbarPopovers();
    switchSection("settings");
  });

  $("topbarAccountLogout")?.addEventListener("click", () => {
    closeTopbarPopovers();
    logout();
  });

  document.addEventListener(
    "click",
    (e) => {
      if (!topbarPopoverOpen) return;
      const t = e.target;
      if (
        typeof t?.closest === "function" &&
        t.closest(
          "#topbarNotifyBtn, #topbarAccountBtn, #topbarNotifyPopover, #topbarAccountPopover, #topbarPopoverBackdrop"
        )
      ) {
        return;
      }
      closeTopbarPopovers();
    },
    true
  );

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (topbarPopoverOpen) closeTopbarPopovers();
  });
}

function setHeroMetrics(latencyMs, health) {
  const latEl = $("heroLatency");
  const upEl = $("heroUptime");
  if (!latEl || !upEl) return;
  if (state.mockMode) {
    latEl.textContent = "15ms";
    upEl.textContent = "99.98%";
    return;
  }
  latEl.textContent = `${Math.round(latencyMs)}ms`;
  const boot = Number(health?.bot_start_ts ?? health?.bot_startup_ts ?? NaN);
  if (Number.isFinite(boot) && boot > 0) {
    const sec = Date.now() / 1000 - boot;
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    upEl.textContent = state.lang === "en" ? `${d}d ${h}h up` : `运行 ${d}天 ${h}小时`;
  } else {
    upEl.textContent = "—";
  }
}

function setDaHeroTelemetry(pingOk, latencyMs) {
  const node = $("daNodeLine");
  const lat = $("daLatencyLine");
  if (!node || !lat) return;
  if (state.mockMode) {
    node.innerHTML = `<i class="dot ok"></i>${escapeHtml(t("data.nodeActiveMock"))}`;
    lat.innerHTML = `<i class="dot"></i>${escapeHtml(t("data.latencyMock"))}`;
    return;
  }
  node.innerHTML = pingOk
    ? `<i class="dot ok"></i>${state.lang === "en" ? "NODE ONLINE" : "节点在线"}`
    : `<i class="dot"></i>${state.lang === "en" ? "NODE DOWN" : "节点离线"}`;
  lat.innerHTML = `<i class="dot"></i>${state.lang === "en" ? "LATENCY" : "延迟"}: ${Math.round(latencyMs)}MS`;
}

function buildRiskBucketCellsFromPositions(rows) {
  const total = rows.reduce((s, t) => s + Number(t.stake_amount || 0), 0) || 0;
  if (!total) return [];
  const buckets = { btc: 0, eth: 0, stable: 0, alt: 0 };
  for (const t of rows) {
    const k = riskBucketKeyFromPair(t.pair);
    buckets[k] += Number(t.stake_amount || 0);
  }
  const order = ["btc", "eth", "alt", "stable"];
  return order
    .map((key) => ({
      key,
      label: t(`overview.risk.bucket.${key}`),
      pct: (buckets[key] / total) * 100
    }))
    .filter((c) => c.pct >= 0.05)
    .sort((a, b) => b.pct - a.pct);
}

function updateRiskLeverageHead(showConfig, statusRows) {
  const el = $("riskLeverageValue");
  if (!el) return;
  if (state.mockMode) {
    el.textContent = state.lang === "en" ? "Demo" : "演示";
    return;
  }
  const tm = String(showConfig?.trading_mode || "").toLowerCase();
  if (tm === "spot" || tm === "") {
    el.textContent = t("overview.risk.spot");
    return;
  }
  let maxLev = 0;
  for (const row of statusRows || []) {
    const L = Number(row.leverage || 0);
    if (L > maxLev) maxLev = L;
  }
  const mm = showConfig?.margin_mode != null ? String(showConfig.margin_mode) : "";
  if (maxLev > 0) {
    const x = maxLev >= 10 ? String(Math.round(maxLev)) : maxLev.toFixed(1);
    el.textContent = mm ? `${x}x · ${mm}` : `${x}x`;
    return;
  }
  el.textContent = [tm ? tm.toUpperCase() : "", mm].filter(Boolean).join(" · ") || "—";
}

function renderRiskMatrix(rows) {
  const rk = $("riskMatrixCells");
  if (!rk) return;
  if (state.mockMode) {
    rk.innerHTML = staticRiskMatrix();
    return;
  }
  const cells = buildRiskBucketCellsFromPositions(rows);
  if (!cells.length) {
    rk.innerHTML = `<div class="cell"><span>${escapeHtml(t("overview.risk.noOpenStake"))}</span><b>0%</b><div class="bar"><i style="--ds-risk-bar-pct: 0%"></i></div></div>`;
    return;
  }
  rk.innerHTML = cells.map((c, idx) => {
    const barClass = idx === 1 ? "sec" : idx === 2 ? "dim" : "";
    const pct = Math.min(100, Math.max(0, c.pct));
    return `<div class="cell"><span>${escapeHtml(c.label)}</span><b>${c.pct.toFixed(1)}%</b><div class="bar"><i class="${barClass}" style="--ds-risk-bar-pct: ${pct.toFixed(1)}%"></i></div></div>`;
  }).join("");
}

function formatOverviewStrategiesCountsLine(run, pause, err) {
  return t("overview.strategies.counts")
    .replace(/\{run\}/g, String(run))
    .replace(/\{pause\}/g, String(pause))
    .replace(/\{err\}/g, String(err));
}

function updateOverviewStrategiesSummaryFromBot(showConfig) {
  const os = $("overviewStrategiesSummary");
  if (!os) return;
  if (state.mockMode) {
    os.textContent = formatOverviewStrategiesCountsLine(2, 1, 0);
    return;
  }
  const st = normalizeBotState(showConfig?.state);
  const run = st === "running" ? 1 : 0;
  const pause = st === "paused" ? 1 : 0;
  os.textContent = formatOverviewStrategiesCountsLine(run, pause, 0);
}

function renderOverviewStrategiesTableLive(showConfig, profit, count) {
  const tb = $("overviewStrategiesBody");
  if (!tb) return;
  if (state.mockMode) {
    tb.innerHTML = staticOverviewStrategiesTbody();
    updateOverviewStrategiesSummaryFromBot(showConfig);
    return;
  }
  const st = normalizeBotState(showConfig?.state);
  const isRunning = st === "running";
  updateOverviewStrategiesSummaryFromBot(showConfig);
  if (!isRunning) {
    tb.innerHTML = `<tr><td colspan="6" class="t-center muted">${escapeHtml(t("overview.strategies.empty"))}</td></tr>`;
    return;
  }
  const p = extractProfitAll(profit);
  const name = escapeHtml(String(showConfig?.strategy || "").trim() || "—");
  const core = escapeHtml(showConfig?.stake_currency || showConfig?.exchange || "—");
  const pnl = Number(
    p.profit_all_coin ?? p.profit_all_fiat ?? profit?.profit_all_coin ?? profit?.profit_all_fiat ?? 0
  );
  const ratioRaw = p.profit_all_ratio != null ? Number(p.profit_all_ratio) : NaN;
  const pctFromRpc = p.profit_all_percent != null ? Number(p.profit_all_percent) : NaN;
  const pnlPct = Number.isFinite(pctFromRpc) ? pctFromRpc : Number.isFinite(ratioRaw) ? ratioRaw * 100 : NaN;
  const pnlPctStr = Number.isFinite(pnlPct) ? `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%` : "—";
  const pnlPctCls = Number.isFinite(pnlPct) ? (pnlPct >= 0 ? "positive" : "negative") : "";
  const curDd = p.current_drawdown != null ? Number(p.current_drawdown) : NaN;
  const ddPct = Number.isFinite(curDd) ? curDd * 100 : NaN;
  const ddStr = Number.isFinite(ddPct) ? `${ddPct.toFixed(2)}%` : "—";
  const stCol = escapeHtml(
    [showConfig?.dry_run === true ? "DRY" : "LIVE", showConfig?.trading_mode].filter(Boolean).join(" · ") ||
      String(count?.current ?? "—")
  );
  const pnlCls = pnl >= 0 ? "positive" : "negative";
  tb.innerHTML = `<tr><td>${name}</td><td>${core}</td><td class="${pnlCls}">${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}</td><td class="${pnlPctCls}">${pnlPctStr}</td><td>${ddStr}</td><td>${stCol}</td></tr>`;
}

/** Normalize /profit payload (flat or { all: {...} }). */
function extractProfitAll(profit) {
  if (!profit || typeof profit !== "object") return {};
  if (profit.all && typeof profit.all === "object") return profit.all;
  return profit;
}

/**
 * KPI card 3: max drawdown from RPC + configured / Bovin AI limits (mock + live).
 */
function updateKpiDrawdownAndRisk(profit) {
  const t3 = $("kpiCard3Title");
  const e3 = $("kpiCard3Em");
  const mdEl = $("kpiMaxDrawdown");
  if (t3) t3.textContent = t("overview.kpi.drawdown");
  const p = extractProfitAll(profit);
  const mdRaw = p.max_drawdown != null ? Number(p.max_drawdown) : NaN;
  const curRaw = p.current_drawdown != null ? Number(p.current_drawdown) : NaN;
  const mdAbs = Number.isFinite(mdRaw) ? Math.abs(mdRaw) : NaN;
  const curAbs = Number.isFinite(curRaw) ? Math.abs(curRaw) : NaN;
  if (mdEl) {
    mdEl.classList.remove("positive", "negative");
    if (Number.isFinite(mdAbs)) {
      mdEl.textContent = `${(mdAbs * 100).toFixed(2)}%`;
      mdEl.classList.add("negative");
    } else {
      mdEl.textContent = "—";
    }
  }
  const aiOv = uiState.lastAiOverview && typeof uiState.lastAiOverview === "object" ? uiState.lastAiOverview : {};
  const faCapRaw = aiOv.maxTrainingDrawdownPct ?? aiOv.max_training_drawdown_pct;
  const faCap = faCapRaw != null ? Number(faCapRaw) : null;
  const faCapOk = faCap != null && Number.isFinite(faCap);
  const manualLimit = state.riskMaxDrawdownLimitPct;
  const wantFa = Boolean(state.riskUseFreqaiLimits);
  const useFa = wantFa && faCapOk;
  let ddLimitPct = null;
  if (useFa) ddLimitPct = faCap * 100;
  else if (manualLimit != null && Number.isFinite(manualLimit)) ddLimitPct = manualLimit;
  const thrPct = state.riskThresholdPct != null && Number.isFinite(state.riskThresholdPct) ? state.riskThresholdPct : null;
  const parts = [];
  if (ddLimitPct != null) {
    const limLabel = useFa
      ? state.lang === "en"
        ? "Bovin AI cap"
        : "Bovin AI 上限"
      : state.lang === "en"
        ? "DD limit"
        : "回撤上限";
    parts.push(`${limLabel} ${ddLimitPct.toFixed(1)}%`);
  }
  if (thrPct != null) {
    parts.push(`${state.lang === "en" ? "Risk thr" : "风险阈"} ${thrPct.toFixed(1)}%`);
  }
  if (e3) {
    e3.textContent = parts.length
      ? parts.join(" · ")
      : t("overview.kpi.riskUnconfigured");
    let breach = false;
    if (Number.isFinite(mdAbs) && ddLimitPct != null && mdAbs > ddLimitPct / 100 + 1e-9) breach = true;
    if (!breach && Number.isFinite(curAbs) && thrPct != null && curAbs > thrPct / 100 + 1e-9) breach = true;
    e3.classList.remove("positive", "negative");
    e3.classList.add(breach ? "negative" : "positive");
  }
}

function updateOverviewKpisLive(count, profit, health, ping, latencyMs) {
  const t1 = $("kpiCard1Title");
  const t2 = $("kpiCard2Title");
  const e2 = $("kpiCard2Em");
  if (state.mockMode) return;
  if (t1) t1.textContent = state.lang === "en" ? "Open trades" : "未平仓";
  $("kpiBotStatus").textContent = count?.max != null ? `max ${count.max}` : (ping?.status || "—");
  if (t2) t2.textContent = state.lang === "en" ? "Total profit (bot)" : "总收益 (机器人)";
  if (e2) {
    const pAll = extractProfitAll(profit);
    const wrv = profit?.winrate != null ? profit.winrate : pAll.winrate;
    const wr = wrv != null ? (Number(wrv) * 100).toFixed(1) : "—";
    e2.textContent = `${state.lang === "en" ? "Win" : "胜率"} ${wr}%`;
    e2.className = Number(wrv || 0) >= 0.5 ? "positive" : "negative";
  }
  updateKpiDrawdownAndRisk(profit);
}

function updateSparklinesFromDaily(dailyPayload) {
  if (state.mockMode) return;
  const data = dailyPayload?.data;
  if (!Array.isArray(data) || !data.length) return;
  const profits = data.map((r) => Number(r.abs_profit ?? 0));
  const stake = data.map((r) => Number(r.starting_balance ?? 0));
  const p1 = $("kpiSpark1");
  const p2 = $("kpiSpark2");
  const p3 = $("kpiSpark3");
  if (p1) p1.setAttribute("d", sparkPathFromValues(stake.slice(-14)));
  if (p2) p2.setAttribute("d", sparkPathFromValues(profits.slice(-14)));
  if (p3) p3.setAttribute("d", sparkPathFromValues(profits.map((v) => -Math.min(0, v)).slice(-14)));
}

function renderGovernanceLists(wl, bl, showConfig) {
  const pol = $("scGovPolicy");
  if (pol) {
    if (state.mockMode) {
      pol.textContent = t("sc.gov.policy");
    } else {
      const cfg = showConfig && typeof showConfig === "object" ? showConfig : {};
      const ex = String(cfg.exchange ?? "").trim();
      const st = String(cfg.strategy ?? "").trim();
      const hasCfg = ex || st;
      if (hasCfg) {
        const mode = cfg.dry_run ? t("freq.dryRun") : t("freq.live");
        pol.textContent =
          state.lang === "en"
            ? `RPC pairlist · ${ex || "—"} · ${st || "—"} · ${mode}`
            : `RPC 名单 · 交易所 ${ex || "—"} · 策略 ${st || "—"} · ${mode}`;
      } else {
        pol.textContent =
          state.lang === "en"
            ? "Pairlist from Bovin /whitelist and /blacklist"
            : "名单来自 Bovin /whitelist、/blacklist（刷新总览后同步）";
      }
    }
  }
  const wEl = $("scGovernanceWlItems");
  const bEl = $("scGovernanceBlItems");
  const cWl = $("scWlCount");
  const cBl = $("scBlCount");
  if (!wEl || !bEl) return;
  if (state.mockMode) {
    wEl.innerHTML = staticGovWlItems();
    bEl.innerHTML = staticGovBlItems();
    if (cWl) cWl.textContent = `12 ${t("sc.gov.pairs")}`;
    if (cBl) cBl.textContent = `42 ${t("sc.gov.pairs")}`;
    return;
  }
  const wlp = wl?.whitelist || [];
  const blp = bl?.blacklist || [];
  if (cWl) cWl.textContent = `${wlp.length} ${t("sc.gov.pairs")}`;
  if (cBl) cBl.textContent = `${blp.length} ${t("sc.gov.pairs")}`;
  wEl.innerHTML = wlp.slice(0, 40).map((p) => `
    <div class="item"><strong>${escapeHtml(p)}</strong><small>${escapeHtml(t("pairlist.whitelistTag"))}</small><button type="button" class="icon-btn" disabled aria-label="readonly"><span class="material-symbols-outlined">lock</span></button></div>
  `).join("") + `<button type="button" class="ghost dashed" disabled>${escapeHtml(t("pairlist.addRpc"))}</button>`;
  bEl.innerHTML = blp.slice(0, 40).map((p) => `
    <div class="item"><strong>${escapeHtml(p)}</strong><small>${escapeHtml(t("pairlist.blacklistTag"))}</small><button type="button" class="icon-btn" disabled aria-label="readonly"><span class="material-symbols-outlined">lock</span></button></div>
  `).join("") + `<div class="sc-auto-blacklist"><b>Bovin</b> ${state.lang === "en" ? "Live pairlist from RPC." : "名单数据来自 RPC。"}</div>`;
}

function renderScFeedFromTrades(tradesPayload) {
  const wrap = $("scFeedRows");
  if (!wrap) return;
  if (state.mockMode) {
    wrap.innerHTML = staticScFeedRows();
    return;
  }
  const rows = Array.isArray(tradesPayload?.trades) ? tradesPayload.trades : [];
  const lines = rows.slice(0, 10).map((tr) => {
    const cls = Number(tr.close_profit_abs || tr.profit_abs || 0) >= 0 ? "ok" : "pri";
    const profit = Number(tr.close_profit_abs ?? tr.profit_abs ?? 0).toFixed(stakeDisplayDecimals(tr));
    return `<div class="feed-row"><i class="${cls}"></i><div><b>${escapeHtml(tr.strategy || "trade")}</b><small>${escapeHtml(tr.pair || "")} · ${profit}</small><em>${escapeHtml(tr.close_date || tr.open_date || "")}</em></div></div>`;
  }).join("");
  const emptyRow = `<div class="feed-row"><i class="pri"></i><div><b>${escapeHtml(t("mock.noTrades"))}</b><small>—</small><em>—</em></div></div>`;
  wrap.innerHTML = lines || emptyRow;
}

function stakeDisplayDecimals(t) {
  const v = Math.abs(Number(t.close_profit_abs ?? t.profit_abs ?? 0));
  return v >= 1 ? 2 : 4;
}

function setDaVolumeBars(candles) {
  const el = $("daVolBars");
  if (!el || state.mockMode) return;
  const data = (candles?.data || []).slice(-8);
  if (!data.length) return;
  const vols = data.map((r) => Number(r[5] || 0));
  const mx = Math.max(...vols, 1e-12);
  el.innerHTML = vols
    .map((v) => {
      const h = Math.min(100, Math.max(10, (v / mx) * 100));
      return `<i style="--da-vol-h: ${h.toFixed(1)}%"></i>`;
    })
    .join("");
}

function refreshSettingsDbSourceHint() {
  const el = $("settingsDbSourceHint");
  if (!el) return;
  if (state.mockMode || !uiState.authed) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  if (uiState.panelPrefsSyncedFromDb) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.classList.remove("hidden");
  let text = t("settings.prefsLoadFailed");
  const det = String(uiState.panelPrefsLoadErrorDetail || "");
  if (det && isLikelyBovinUpstreamUnreachable(det)) {
    text += `\n\n${t("settings.prefsLoadFailedUpstreamNote")}`;
  }
  if (/\b401\b/.test(det) || /\b403\b/.test(det)) {
    text += `\n\n${t("settings.prefs401Hint")}`;
  }
  if (/\b404\b/.test(det)) {
    text += `\n\n${t("settings.prefs404Hint")}`;
  }
  if (det) {
    const clip = det.length > 380 ? `${det.slice(0, 380)}…` : det;
    text += `\n\n${t("settings.prefsTechnicalDetail")}\n${clip}`;
  }
  el.textContent = text;
}

async function persistPanelPreferences(opts = {}) {
  if (!uiState.authed) return;
  /**
   * 未从库成功 GET /panel/preferences 时，内存中的 strategyEntries / slots 等可能未与 SQLite 对齐。
   * 隐式保存（策略防抖、登录后顺带写入等）禁止 POST，否则会覆盖 panel_profile / 对接表。
   * 用户显式操作（保存连接、对接弹窗、同步按钮、换主题/模拟开关等）传 forceFullProfileSync: true。
   */
  const forceFull = opts.forceFullProfileSync === true;
  if (!forceFull && !uiState.panelPrefsSyncedFromDb) {
    debugPanel("persistPanelPreferences skipped: prefs not loaded from DB (avoid SQLite clobber)", null);
    refreshSettingsDbSourceHint();
    return;
  }
  try {
    /**
     * api_bindings 整表替换：仅当 (1) 用户显式保存设置/对接 或 (2) 已确认 GET 响应里带回过 api_bindings 数组时，
     * 才附带该字段；否则省略（服务端 save_panel_state 收到 null 不删表）。
     * 避免：GET 成功但响应缺 api_bindings、或从未加载时内存为 []，把库表清空。
     */
    const forceBindings = opts.forceIncludeApiBindings === true;
    const sendBindings =
      forceBindings ||
      (uiState.panelPrefsSyncedFromDb && uiState.panelPrefsBindingsLoadedFromDb);
    const payload = {
      simulation_ui: state.mockMode,
      theme: uiState.theme || "system",
      baseUrl: state.baseUrl,
      username: state.username,
      password: state.password,
      strategyName: state.strategyName,
      strategyNotes: state.strategyNotes,
      strategyExtraJson: state.strategyExtraJson,
      aiTakeoverTrading: state.aiTakeoverTrading,
      strategyRulesOutput: state.strategyRulesOutput,
      riskMaxDrawdownLimitPct: state.riskMaxDrawdownLimitPct,
      riskThresholdPct: state.riskThresholdPct,
      riskUseFreqaiLimits: state.riskUseFreqaiLimits,
      controlShowStrategyCards: state.controlShowStrategyCards,
      strategyAuthorizedAmount: state.strategyAuthorizedAmount,
      strategyTargetAnnualReturnPct: state.strategyTargetAnnualReturnPct,
      strategySlots: normalizeStrategySlots(state.strategySlots),
      manualStrategyNames: normalizeManualStrategyNames(state.manualStrategyNames),
      strategyHiddenFromConsole: normalizeStrategyHiddenFromConsole(state.strategyHiddenFromConsole),
      strategyEntries: normalizeStrategyEntries(state.strategyEntries)
    };
    if (sendBindings) {
      payload.api_bindings = state.apiBindings;
    }
    const res = await apiCall("/panel/preferences", "POST", payload);
    uiState.panelPrefsSyncedFromDb = true;
    uiState.panelPrefsLoadErrorDetail = "";
    if (Object.prototype.hasOwnProperty.call(payload, "api_bindings") && Array.isArray(payload.api_bindings)) {
      persistLastKnownApiBindingsSnapshot(state.apiBindings);
    }
    if (sendBindings) {
      uiState.panelPrefsBindingsLoadedFromDb = true;
    }
    const ecs = res?.exchange_config_sync;
    if (ecs?.applied) {
      logAction(
        `${t("settings.exchangeSyncApplied")}: ${ecs.exchange || ""} → ${ecs.path || ""}`
      );
    } else if (
      ecs &&
      (ecs.reason === "write_failed" ||
        ecs.reason === "read_failed" ||
        ecs.reason === "config_file_not_found")
    ) {
      logAction(`${t("settings.exchangeSyncFailed")}: ${ecs.detail || ecs.reason}`);
    }
    refreshSettingsDbSourceHint();
  } catch (err) {
    logAction(`panel/preferences: ${err.message}`);
  }
}

function syncSettingsConnectionFromDom() {
  const bu = $("baseUrl");
  const wsb = $("wsApiV1Base");
  const wst = $("wsToken");
  const un = $("username");
  const pw = $("password");
  if (bu) state.baseUrl = bu.value.trim().replace(/\/$/, "");
  if (wsb) state.wsApiV1Base = wsb.value.trim().replace(/\/$/, "");
  if (wst) state.wsToken = wst.value.trim();
  /**
   * 设置区里 username/password 多为 hidden，且密码常故意不写入 DOM（仅靠 session 与 state）。
   * 若用空串覆盖 state，随后 POST /panel/preferences 会带空 Basic 密码 → 401，保存静默失败，
   * 界面仍显示刚改的 api_bindings，刷新后从库加载为空。
   */
  if (un) {
    const u = un.value.trim();
    if (u) state.username = u;
  }
  if (pw && pw.value !== "") state.password = pw.value;
}

async function pushSettingsToPanelBackend() {
  syncSettingsConnectionFromDom();
  persistProfileToLocalStorage();
  persistApiBindingsLocalSnapshot(state.apiBindings);
  await persistPanelPreferences({
    forceFullProfileSync: true,
    forceIncludeApiBindings: true
  });
  refreshPanelBackendHint();
}

async function loadPanelPreferences() {
  if (!uiState.authed) return;
  let lastErr = null;
  for (let attempt = 0; attempt < PANEL_PREFS_GET_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      const prevMsg = String(lastErr?.message || lastErr);
      if (!isTransientPanelPrefsError(prevMsg)) break;
      const wait = PANEL_PREFS_GET_RETRY_BACKOFF_MS[attempt - 1];
      if (wait == null) break;
      await new Promise((resolve) => {
        setTimeout(resolve, wait);
      });
    }
    try {
      const prefs = await apiCall("/panel/preferences");
      if (typeof prefs?.simulation_ui === "boolean") {
        state.mockMode = prefs.simulation_ui;
        localStorage.setItem("ft_mock_mode", state.mockMode ? "1" : "0");
        updateMockToggleLabel();
        updateDataSourceBadge();
      }
      if (Array.isArray(prefs?.api_bindings)) {
        state.apiBindings = prefs.api_bindings.map((item) => normalizeApiBindingItem(item));
        persistApiBindingsLocalSnapshot(state.apiBindings);
        persistLastKnownApiBindingsSnapshot(state.apiBindings);
        renderApiBindings();
        uiState.panelPrefsBindingsLoadedFromDb = true;
      } else {
        uiState.panelPrefsBindingsLoadedFromDb = false;
        debugPanel(
          "panel/preferences GET: missing or invalid api_bindings; will not implicit-POST bindings",
          prefs ? Object.keys(prefs) : null
        );
      }
      if (prefs?.theme && typeof prefs.theme === "string") {
        uiState.theme = prefs.theme;
        localStorage.setItem("ft_ui_theme_pref", prefs.theme);
      }
      applyPanelProfileFromPrefs(prefs);
      syncStrategyEntriesWithBotAndDiscovered(uiState.lastShowConfig, uiState.panelStrategyList);
      setConfigInputs();
      applyTheme();
      uiState.panelPrefsSyncedFromDb = true;
      uiState.panelPrefsLoadErrorDetail = "";
      if (attempt > 0) {
        logAction(
          state.lang === "en"
            ? `panel/preferences: recovered after ${attempt + 1} attempt(s).`
            : `panel/preferences：第 ${attempt + 1} 次请求后已从数据库恢复。`
        );
      }
      refreshSettingsDbSourceHint();
      return;
    } catch (err) {
      lastErr = err;
      debugPanel(`panel/preferences GET attempt ${attempt + 1}`, err);
      const em = String(err?.message || err);
      if (!isTransientPanelPrefsError(em)) break;
    }
  }
  const err = lastErr;
  const em = String(err?.message || err);
  logAction(`panel/preferences GET: ${em}`);
  uiState.panelPrefsSyncedFromDb = false;
  uiState.panelPrefsBindingsLoadedFromDb = false;
  uiState.panelPrefsLoadErrorDetail = em;
  /** 避免假清空：优先 sessionStorage 上次成功拉取的完整列表，其次 localStorage 脱敏副本。 */
  if (!state.mockMode && !state.apiBindings.length) {
    const recovered = recoverApiBindingsFromLocalCaches();
    if (recovered.length) {
      state.apiBindings = recovered;
    }
  }
  if (
    !state.mockMode &&
    /\b401\b/.test(em) &&
    !String(state.password || "").length &&
    !readStoredRefreshToken() &&
    !readStoredAccessToken() &&
    uiState.authed
  ) {
    uiState.authed = false;
    localStorage.removeItem("ft_panel_auth");
    clearPanelSession();
    try {
      sessionStorage.setItem(STALE_AUTH_HINT_KEY, "1");
    } catch {
      // ignore
    }
    applyAuthView();
    consumeStaleLoginHint();
  }
  if (state.mockMode && !state.apiBindings.length) {
    state.apiBindings = parseApiBindingsFromStorage().filter(
      (b) => String(b.exchangeName || "").trim() || String(b.exchangeApiKey || "").trim()
    );
  }
  renderApiBindings();
  renderStrategyEntriesList();
  setConfigInputs();
  refreshSettingsDbSourceHint();
}

async function applyExchangeTickerToHeader(pair) {
  if (state.mockMode || !pair) return;
  const priceNow = $("daPriceNow");
  const priceChg = $("daPriceChg");
  const label = $("daChgLabel");
  const prefixEl = label?.querySelector?.(".da-chg-prefix");
  try {
    const t = await apiCall(`/panel/ticker?pair=${encodeURIComponent(pair)}`);
    uiState.lastTicker = t;
    const last = Number(t?.last);
    const pct = t?.percentage != null ? Number(t.percentage) : null;
    if (priceNow && Number.isFinite(last)) {
      priceNow.textContent = last >= 1 ? last.toLocaleString(undefined, { maximumFractionDigits: 2 }) : last.toFixed(6);
    }
    if (pct != null && Number.isFinite(pct)) {
      const chgTxt = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
      const cls = pct < 0 ? "negative" : "positive";
      if (prefixEl) {
        prefixEl.textContent = state.lang === "en" ? "24h Chg (exchange) " : "24h 涨跌(交易所) ";
      }
      if (priceChg) {
        priceChg.textContent = chgTxt;
        priceChg.classList.remove("positive", "negative");
        priceChg.classList.add(cls);
      }
    }
  } catch (err) {
    debugPanel("ticker header", err);
  }
}

function renderOpenOrdersRows(flat) {
  const target = $("pendingTable");
  if (!target) return;
  const rows = Array.isArray(flat) ? flat : [];
  uiState.openOrderFlat = rows;
  uiState.pendingTotalPages = Math.max(1, Math.ceil(rows.length / uiState.pendingPageSize));
  if (uiState.pendingPage > uiState.pendingTotalPages) uiState.pendingPage = uiState.pendingTotalPages;
  if (uiState.pendingPage < 1) uiState.pendingPage = 1;
  const start = (uiState.pendingPage - 1) * uiState.pendingPageSize;
  const pageRows = rows.slice(start, start + uiState.pendingPageSize);
  target.innerHTML = pageRows.map(({ trade: tr, order: o }) => {
    const tid = safeDataIdAttr(tr.trade_id);
    const cancelBtn = tid
      ? `<button type="button" class="ghost" data-cancel-open-order="${tid}">${escapeHtml(t("btn.cancelOrder"))}</button>`
      : `<button type="button" class="ghost" disabled>${escapeHtml(t("btn.cancelOrder"))}</button>`;
    return `
    <tr>
      <td><span class="mono">${escapeHtml(o.order_type || "order")}</span> <small>${escapeHtml(tr.pair || "")}</small></td>
      <td class="t-right">${Number(o.safe_price || 0).toFixed(6)}</td>
      <td class="t-right">${Number(o.amount || 0).toFixed(6)}</td>
      <td class="t-center"><span class="status-chip">${escapeHtml(o.status || "")}</span></td>
      <td class="t-center">${cancelBtn}</td>
    </tr>
  `;
  }).join("") || `<tr><td colspan="5" class="t-center">${escapeHtml(t("orders.noOpenOrders"))}</td></tr>`;
  updatePendingPager();
}

function renderPendingSection() {
  const pt = $("pendingSectionTitle");
  if (pt) {
    pt.textContent = state.mockMode ? t("positions.pendingMock") : t("positions.pendingLive");
  }
  if (state.mockMode) return;
  renderOpenOrdersRows(uiState.openOrderFlat || []);
}

function renderStatusRows(data) {
  const rows = Array.isArray(data) ? data : [];
  uiState.positionsRows = rows;
  const totalPnl = rows.reduce((s, t) => s + Number(t.total_profit_abs ?? t.profit_abs ?? 0), 0);
  if ($("posTotalPnl")) $("posTotalPnl").textContent = `${totalPnl >= 0 ? "+" : ""}$${Math.abs(totalPnl).toFixed(2)}`;
  const exposure = rows.reduce((s, t) => s + Number(t.stake_amount ?? t.open_trade_value ?? 0), 0);
  if ($("posExposure")) {
    $("posExposure").textContent = state.mockMode
      ? `$${(rows.length * 71445.06).toFixed(2)}`
      : `$${exposure.toFixed(2)}`;
  }
  uiState.positionsTotalPages = Math.max(1, Math.ceil(rows.length / uiState.positionsPageSize));
  if (uiState.positionsPage > uiState.positionsTotalPages) uiState.positionsPage = uiState.positionsTotalPages;
  if (uiState.positionsPage < 1) uiState.positionsPage = 1;
  const start = (uiState.positionsPage - 1) * uiState.positionsPageSize;
  const pageRows = rows.slice(start, start + uiState.positionsPageSize);
  $("statusTable").innerHTML = pageRows.map((tr) => {
    const pnl = Number(tr.total_profit_abs ?? tr.profit_abs ?? 0);
    const cur = Number(tr.current_rate ?? 0);
    const fakeCur = (Number(tr.open_rate || 0) * (1 + (Number(tr.profit_abs || 0) / 1000)));
    const dispCur = state.mockMode ? fakeCur : cur;
    const levRaw = tr.leverage != null && Number(tr.leverage) > 0
      ? `${Number(tr.leverage)}x`
      : (tr.is_short ? t("side.short") : t("side.long"));
    const modeLbl = tr.trading_mode ? String(tr.trading_mode) : "";
    const sub = state.mockMode
      ? (tr.is_short ? t("pos.crossLev") : t("pos.isoLev"))
      : `${levRaw} · ${modeLbl}`.trim();
    const amt = Number(tr.amount ?? 0);
    const base = tr.base_currency || "";
    const sz = state.mockMode
      ? (tr.pair?.startsWith("BTC") ? "1.5000 BTC" : tr.pair?.startsWith("ETH") ? "10.000 ETH" : "100.000 SOL")
      : `${amt.toFixed(4)} ${base}`.trim();
    const pairEsc = escapeHtml(tr.pair || "-");
    const szEsc = escapeHtml(sz);
    const closeId = safeDataIdAttr(tr.trade_id);
    const closeBtn = closeId
      ? `<button type="button" class="ghost" data-close-trade="${closeId}">${escapeHtml(t("btn.closePos"))}</button>`
      : `<button type="button" class="ghost" disabled>${escapeHtml(t("btn.closePos"))}</button>`;
    return `
    <tr>
      <td>
        <div class="pair-cell">
          <strong>${pairEsc}</strong>
          <small>${escapeHtml(sub)}</small>
        </div>
      </td>
      <td class="t-right">${Number(tr.open_rate || 0).toFixed(4)}</td>
      <td class="t-right">${dispCur.toFixed(4)}</td>
      <td class="t-right ${pnl >= 0 ? "positive" : "negative"}">${pnl >= 0 ? "+" : ""}$${Math.abs(pnl).toFixed(2)}</td>
      <td class="t-right">${szEsc}</td>
      <td class="t-center">${closeBtn}</td>
    </tr>
  `;
  }).join("");
  updateStatusPager();
}

function renderTradesRows(data) {
  uiState.mockTradesPayload = data;
  const rows = Array.isArray(data?.trades) ? data.trades : (Array.isArray(data) ? data : []);
  uiState.pendingRows = rows;
  uiState.pendingTotalPages = Math.max(1, Math.ceil(rows.length / uiState.pendingPageSize));
  if (uiState.pendingPage > uiState.pendingTotalPages) uiState.pendingPage = uiState.pendingTotalPages;
  if (uiState.pendingPage < 1) uiState.pendingPage = 1;
  const start = (uiState.pendingPage - 1) * uiState.pendingPageSize;
  const pageRows = rows.slice(start, start + uiState.pendingPageSize);
  const target = $("pendingTable") || $("tradesTable");
  if (!target) return;
  target.innerHTML = pageRows.map((row, idx) => {
    const buyLabel = escapeHtml(t("orders.limitBuy"));
    const sellLabel = escapeHtml(t("orders.limitSell"));
    const pend = escapeHtml(t("orders.pending"));
    const canc = escapeHtml(t("orders.canceled"));
    const sideHtml = Number(row.profit_abs || 0) >= 0
      ? `<span class="positive">${buyLabel}</span>`
      : `<span class="negative">${sellLabel}</span>`;
    const stHtml = idx < 2
      ? `<span class="status-chip">${pend}</span>`
      : `<span class="status-chip muted">${canc}</span>`;
    return `
    <tr>
      <td>${sideHtml} <small>${escapeHtml(row.pair ?? "-")}</small></td>
      <td class="t-right">$${(Math.abs(Number(row.profit_abs || 0)) * 5000 + 63500).toFixed(2)}</td>
      <td class="t-right">${idx % 2 === 0 ? "0.500 BTC" : "5.200 ETH"}</td>
      <td class="t-center">${stHtml}</td>
      <td class="t-center"><button type="button" class="ghost">${escapeHtml(t("btn.edit"))}</button> <button type="button" class="ghost">${escapeHtml(t("btn.closePos"))}</button></td>
    </tr>
  `;
  }).join("");
  updatePendingPager();
}

function updateStatusPager() {
  const info = $("statusPageInfo");
  const prev = $("statusPrev");
  const next = $("statusNext");
  if (!info || !prev || !next) return;
  info.textContent = `${uiState.positionsPage} / ${uiState.positionsTotalPages}`;
  prev.disabled = uiState.positionsPage <= 1;
  next.disabled = uiState.positionsPage >= uiState.positionsTotalPages;
}

function updatePendingPager() {
  const info = $("pendingPageInfo");
  const prev = $("pendingPrev");
  const next = $("pendingNext");
  if (!info || !prev || !next) return;
  info.textContent = `${uiState.pendingPage} / ${uiState.pendingTotalPages}`;
  prev.disabled = uiState.pendingPage <= 1;
  next.disabled = uiState.pendingPage >= uiState.pendingTotalPages;
}

function i18nReplace(str, map) {
  let s = String(str ?? "");
  Object.entries(map || {}).forEach(([k, v]) => {
    s = s.split(`{{${k}}}`).join(String(v));
  });
  return s;
}

/** 各核心使用率：通俗文案（避免 cpu0 等术语）。 */
function formatCpuLoadPerCoreDisplay(arr) {
  if (!Array.isArray(arr) || !arr.length) return "—";
  const first = arr[0];
  if (!(first && typeof first === "object" && "cpu" in first && "pct" in first)) return formatTelemetryValue(arr);
  return arr
    .map((x) => {
      const idx = Number(x.cpu);
      const p = Number(x.pct).toFixed(1);
      if (state.lang === "en") {
        return `Core ${idx}: ${p}%`;
      }
      const human = Number.isFinite(idx) ? idx + 1 : x.cpu;
      return `第 ${human} 核约 ${p}%`;
    })
    .join(state.lang === "en" ? " · " : "，");
}

/** 系统遥测：固定顺序 + 普通人能看懂的标题；隐藏与 cpu_load 重复的 cpu_pct。 */
function buildSysinfoFriendlyRows(data) {
  const rows = [];
  const ram = Number(data.ram_pct);
  if (Number.isFinite(ram)) {
    rows.push({
      key: t("overview.telemetry.friendly.ramLabel"),
      val: i18nReplace(t("overview.telemetry.friendly.ramVal"), { pct: ram.toFixed(1) })
    });
  }
  const avg = Number(data.cpu_avg);
  if (Number.isFinite(avg)) {
    rows.push({
      key: t("overview.telemetry.friendly.cpuAvgLabel"),
      val: i18nReplace(t("overview.telemetry.friendly.cpuAvgVal"), { pct: avg.toFixed(1) })
    });
  }
  if (data.cpu_load_avg && typeof data.cpu_load_avg === "object" && !Array.isArray(data.cpu_load_avg)) {
    rows.push({
      key: t("overview.telemetry.friendly.loadAvgLabel"),
      val: formatCpuLoadAvgForDisplay(data.cpu_load_avg, data.cpu_count)
    });
  }
  const ncpu = Number(data.cpu_count);
  if (Number.isFinite(ncpu)) {
    rows.push({
      key: t("overview.telemetry.friendly.cpuCountLabel"),
      val: i18nReplace(t("overview.telemetry.friendly.cpuCountVal"), { n: ncpu })
    });
  }
  if (Array.isArray(data.cpu_load) && data.cpu_load.length) {
    rows.push({
      key: t("overview.telemetry.friendly.perCoreLabel"),
      val: formatCpuLoadPerCoreDisplay(data.cpu_load)
    });
  }
  const consumed = new Set(["ram_pct", "cpu_avg", "cpu_load_avg", "cpu_count", "cpu_load", "cpu_pct"]);
  for (const [k, v] of Object.entries(data)) {
    if (consumed.has(k)) continue;
    rows.push({ key: k, val: formatTelemetryValue(v) });
  }
  return rows;
}

/** 将 cpu_load_avg 显示为可读句子（网页上不再是一坨 JSON）。 */
function formatCpuLoadAvgForDisplay(obj, cpuCount) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return JSON.stringify(obj);
  const m1 = Number(obj["1m"]);
  const m5 = Number(obj["5m"]);
  const m15 = Number(obj["15m"]);
  const sep = state.lang === "en" ? " · " : "，";
  const parts = [];
  if (Number.isFinite(m1)) parts.push(`${t("overview.telemetry.loadAvg.1m")} ${m1.toFixed(2)}`);
  if (Number.isFinite(m5)) parts.push(`${t("overview.telemetry.loadAvg.5m")} ${m5.toFixed(2)}`);
  if (Number.isFinite(m15)) parts.push(`${t("overview.telemetry.loadAvg.15m")} ${m15.toFixed(2)}`);
  if (!parts.length) return JSON.stringify(obj);
  let out = parts.join(sep);
  const n = Number(cpuCount);
  if (Number.isFinite(n) && n > 0 && Number.isFinite(m1)) {
    const r = m1 / n;
    const hintKey =
      r >= 1.2
        ? "overview.telemetry.loadAvg.hint.heavy"
        : r >= 0.85
          ? "overview.telemetry.loadAvg.hint.busy"
          : r >= 0.5
            ? "overview.telemetry.loadAvg.hint.moderate"
            : "overview.telemetry.loadAvg.hint.light";
    const coresLine = t("overview.telemetry.loadAvg.coresLine")
      .replace(/\{\{n\}\}/g, String(n))
      .replace(/\{\{hint\}\}/g, t(hintKey));
    out += (state.lang === "en" ? ". " : "。") + coresLine;
  }
  return out;
}

/** 概览遥测值：数组含对象时不能用 join（会得到 [object Object]）。 */
function formatTelemetryValue(v) {
  if (v == null) return "—";
  if (Array.isArray(v)) {
    if (v.length === 0) return "";
    const first = v[0];
    if (typeof first === "object" && first !== null && !Array.isArray(first)) {
      const loadLike = v.every((x) => x && typeof x === "object" && "cpu" in x && "pct" in x);
      if (loadLike) {
        return v.map((x) => `cpu${x.cpu} ${Number(x.pct).toFixed(1)}%`).join(", ");
      }
      return v.map((x) => JSON.stringify(x)).join(", ");
    }
    return v.map((x) => String(x)).join(", ");
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function renderSysinfoPanel(data, health) {
  const target = $("sysinfo");
  if (!target) return;
  if (!data || typeof data !== "object") {
    target.textContent = "-";
    return;
  }
  if (data.warning) {
    const d = String(data.detail || "").trim();
    const is404 = /\b404\b/.test(d);
    const detailHtml = is404
      ? escapeHtml(t("overview.sysinfo.hint404"))
      : escapeHtml(d.length > 280 ? `${d.slice(0, 280)}…` : d);
    target.innerHTML = `<div class="telemetry-grid telemetry-grid--unavailable">
      <div class="telemetry-unavailable-msg">${escapeHtml(t("overview.sysinfo.unavailable"))}</div>
      <div class="telemetry-unavailable-detail muted">${detailHtml}</div>
    </div>`;
    return;
  }
  const h = health && typeof health === "object" ? health : {};
  const healthLine =
    h.last_process_loc ||
    (h.last_process != null && h.last_process !== "" ? String(h.last_process) : "") ||
    (h.bot_startup != null ? String(h.bot_startup) : "");
  const head =
    healthLine !== ""
      ? `<div class="telemetry-row"><span class="telemetry-key">${escapeHtml(t("overview.telemetry.botHealth"))}</span><span class="telemetry-val">${escapeHtml(healthLine)}</span></div>`
      : "";
  const body = buildSysinfoFriendlyRows(data)
    .map(
      ({ key, val }) =>
        `<div class="telemetry-row"><span class="telemetry-key">${escapeHtml(key)}</span><span class="telemetry-val">${escapeHtml(val)}</span></div>`
    )
    .join("");
  target.innerHTML = `<div class="telemetry-grid telemetry-grid--sysinfo">${head}${body}</div>`;
}

function formatBytes(n) {
  if (!Number.isFinite(n) || n < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let x = n;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i += 1;
  }
  return `${x.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatUptimeFromMs(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (state.lang === "en") {
    const parts = [];
    if (d) parts.push(`${d}d`);
    parts.push(`${h}h`);
    parts.push(`${m}m`);
    return parts.join(" ");
  }
  if (d) return `${d}天${h}小时${m}分`;
  if (h) return `${h}小时${m}分`;
  return `${m}分`;
}

function resolveBotStartUnixSec(health, profit) {
  const h = health && typeof health === "object" ? health : {};
  const p = profit && typeof profit === "object" ? profit : {};
  const ts = h.bot_startup_ts ?? h.bot_start_ts ?? p.bot_start_timestamp ?? null;
  return typeof ts === "number" && ts > 0 ? ts : null;
}

async function updateMonitorPanel() {
  const set = (id, text) => {
    const el = $(id);
    if (el) el.textContent = text;
  };
  const sys = uiState.lastSysinfo && typeof uiState.lastSysinfo === "object" ? uiState.lastSysinfo : {};
  const health = uiState.lastHealth && typeof uiState.lastHealth === "object" ? uiState.lastHealth : {};
  const profit = uiState.lastProfit && typeof uiState.lastProfit === "object" ? uiState.lastProfit : {};

  const ram = Number(sys.ram_pct);
  set("monitorRam", Number.isFinite(ram) ? `${ram.toFixed(1)}%` : "—");

  let diskLine = "—";
  if (sys.warning) {
    diskLine = "—";
  } else if (Number.isFinite(Number(sys.disk_used_pct))) {
    diskLine = `${Number(sys.disk_used_pct).toFixed(1)}%${
      state.mockMode ? ` · ${t("monitor.disk.mockNote")}` : ""
    }`;
  } else {
    diskLine = t("monitor.disk.naServer");
  }
  set("monitorDiskServer", diskLine);

  let browserStorage = "—";
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      const u = est.usage ?? 0;
      const q = est.quota ?? 0;
      browserStorage = q ? `${formatBytes(u)} / ${formatBytes(q)}` : formatBytes(u);
    } else {
      browserStorage = t("monitor.browserStorage.noApi");
    }
  } catch {
    browserStorage = t("monitor.browserStorage.err");
  }
  set("monitorStorageBrowser", browserStorage);

  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  let bw = t("monitor.bandwidth.na");
  if (conn && typeof conn.downlink === "number" && conn.downlink > 0) {
    const eff = conn.effectiveType ? ` · ${conn.effectiveType}` : "";
    bw =
      state.lang === "en"
        ? `${conn.downlink} Mbps (downlink)${eff}`
        : `↓ 约 ${conn.downlink} Mbps（浏览器估算）${eff}`;
  }
  set("monitorBandwidth", bw);

  const lat = Number(uiState.lastPingLatencyMs);
  set(
    "monitorLatency",
    uiState.lastPingOk === false
      ? t("monitor.latency.down")
      : Number.isFinite(lat)
        ? `${Math.round(lat)} ms`
        : "—"
  );

  const cagr = Number(profit.cagr);
  set(
    "monitorCagr",
    Number.isFinite(cagr) ? `${(cagr * 100).toFixed(2)}%` : t("monitor.cagr.na")
  );

  const startSec = resolveBotStartUnixSec(health, profit);
  const uptimeMs = startSec != null ? Date.now() - startSec * 1000 : null;
  set(
    "monitorUptime",
    uptimeMs != null && uptimeMs >= 0 ? formatUptimeFromMs(uptimeMs) : t("monitor.uptime.na")
  );
}

function renderLogsPanel(data) {
  const target = $("logs");
  if (!target) return;
  const rows = Array.isArray(data?.logs) ? data.logs : [];
  uiState.lastLogsSnapshot = rows;
  if (!rows.length) {
    target.textContent = "-";
    uiState.logsTotalPages = 1;
    uiState.logsPage = 1;
    updateLogsPager();
    return;
  }
  const totalPages = Math.max(1, Math.ceil(rows.length / uiState.logsPageSize));
  uiState.logsTotalPages = totalPages;
  if (uiState.logsPage > totalPages) uiState.logsPage = totalPages;
  if (uiState.logsPage < 1) uiState.logsPage = 1;
  const start = (uiState.logsPage - 1) * uiState.logsPageSize;
  const pageRows = rows.slice(start, start + uiState.logsPageSize);
  target.innerHTML = pageRows.map((row) => {
    if (Array.isArray(row)) {
      const [time, , moduleName, level, msg] = row;
      return `<div class="log-row"><span class="log-time">${escapeHtml(time)}</span><span class="log-level">${escapeHtml(level)}</span><span class="log-module">${escapeHtml(moduleName)}</span><span class="log-msg">${escapeHtml(msg)}</span></div>`;
    }
    return `<div class="log-row"><span class="log-msg">${escapeHtml(JSON.stringify(row))}</span></div>`;
  }).join("");
  updateLogsPager();
}

function toLwTime(dateLike, fallbackIdx = 0) {
  if (dateLike instanceof Date) {
    const ms = dateLike.getTime();
    if (Number.isFinite(ms)) {
      const sec = Math.floor(ms / 1000);
      if (sec > 946684800 && sec < 5000000000) return sec;
    }
  }
  if (typeof dateLike === "number" && Number.isFinite(dateLike)) {
    const n = Math.floor(dateLike);
    const sec = n > 1_000_000_000_000 ? Math.floor(n / 1000) : n;
    if (sec > 946684800 && sec < 5000000000) return sec;
  }
  const raw = String(dateLike ?? "").trim();
  if (/^\d{10,13}$/.test(raw)) {
    const n = Number(raw);
    const sec = raw.length >= 13 ? Math.floor(n / 1000) : n;
    if (sec > 946684800) return sec;
  }
  const ts = Date.parse(raw.includes("T") ? raw : raw.replace(" ", "T"));
  if (Number.isFinite(ts)) return Math.floor(ts / 1000);
  return Math.floor(Date.now() / 1000) - fallbackIdx * 60;
}

function normalizeMonotonicTimes(times) {
  const out = [];
  let last = -Infinity;
  for (let i = 0; i < times.length; i++) {
    let t = Number(times[i]);
    if (!Number.isFinite(t)) t = last + 1;
    if (t <= last) t = last + 1;
    last = t;
    out.push(t);
  }
  return out;
}

function loadLightweightCharts() {
  if (lwCreateChart) return Promise.resolve(lwCreateChart);
  const g = typeof globalThis !== "undefined" ? globalThis : window;
  const globalLw = g?.LightweightCharts;
  if (globalLw?.createChart) {
    lwCreateChart = globalLw.createChart;
    uiState.lwLoadFailed = false;
    uiState.lwLoadErrorInfo = "";
    return Promise.resolve(lwCreateChart);
  }
  uiState.lwLoadFailed = true;
  uiState.lwLoadErrorInfo = "chart lib missing (check vendor/ script) or use external browser";
  return Promise.resolve(null);
}

function ensureLightweightChart() {
  const mount = $("daKlineMount");
  if (!mount) return null;
  if (!lwCreateChart) {
    loadLightweightCharts().then((createChart) => {
      if (!createChart) return;
      if (uiState.dataCandles?.data?.length) {
        renderDataKlineStripIfVisible(uiState.dataCandles);
      } else {
        void refreshDataPanel();
      }
    });
    if (!lwCreateChart) return null;
  }
  const { w: width, h: height } = klineMountLayoutBox(mount);
  if (uiState.lwChart && uiState.lwMount === mount) {
    uiState.lwChart.applyOptions({ width, height });
    return uiState.lwChart;
  }
  if (uiState.lwChart) {
    try { uiState.lwChart.remove(); } catch {}
  }
  // 新建图表前清空挂载点（去掉 SVG / 面板 Canvas 等），切勿在 createChart 之后再 innerHTML=''，否则会删掉库插入的 DOM
  mount.innerHTML = "";
  try {
    uiState.lwMount = mount;
    uiState.lwChart = lwCreateChart(mount, {
      width,
      height,
      layout: { background: { color: "transparent" }, textColor: "#8c90a2", fontSize: 10 },
      grid: { vertLines: { color: "rgba(66,70,86,0.2)" }, horzLines: { color: "rgba(66,70,86,0.2)" } },
      rightPriceScale: { borderColor: "rgba(66,70,86,0.25)" },
      timeScale: { borderColor: "rgba(66,70,86,0.25)", timeVisible: true, secondsVisible: false },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true
      }
    });
    uiState.lwCandles = uiState.lwChart.addCandlestickSeries({
      upColor: "#4edea3",
      downColor: "#ffb4ab",
      borderDownColor: "#ffb4ab",
      borderUpColor: "#4edea3",
      wickDownColor: "#ffb4ab",
      wickUpColor: "#4edea3",
      priceLineVisible: true
    });
    uiState.lwMA7 = uiState.lwChart.addLineSeries({ color: "#f1d06e", lineWidth: 2, priceLineVisible: false });
    uiState.lwMA25 = uiState.lwChart.addLineSeries({ color: "#9c5aff", lineWidth: 2, priceLineVisible: false });
    uiState.lwEMA = uiState.lwChart.addLineSeries({ color: "#5cc8ff", lineWidth: 1.5, priceLineVisible: false, visible: uiState.showEMA });
    uiState.lwBollMid = uiState.lwChart.addLineSeries({ color: "#9c5aff", lineWidth: 1.2, priceLineVisible: false, visible: uiState.showBOLL });
    uiState.lwBollUpper = uiState.lwChart.addLineSeries({ color: "#ffb86b", lineWidth: 1, priceLineVisible: false, visible: uiState.showBOLL });
    uiState.lwBollLower = uiState.lwChart.addLineSeries({ color: "#4edea3", lineWidth: 1, priceLineVisible: false, visible: uiState.showBOLL });
    uiState.lwVolume = uiState.lwChart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      scaleMargins: { top: 0.78, bottom: 0 }
    });
    uiState.lwChart.subscribeCrosshairMove((param) => {
      const box = $("daOhlcFloat");
      if (!box) return;
      const point = param?.point;
      const data = param?.seriesData?.get(uiState.lwCandles);
      if (!point || !data) {
        box.classList.add("hidden");
        return;
      }
      box.classList.remove("hidden");
      box.style.left = `${Math.max(8, point.x + 12)}px`;
      box.style.top = `${Math.max(8, point.y + 12)}px`;
      box.textContent = `O:${Number(data.open).toFixed(2)} H:${Number(data.high).toFixed(2)} L:${Number(data.low).toFixed(2)} C:${Number(data.close).toFixed(2)}`;
    });
    observeKlineMountResize(mount, uiState.lwChart);
    return uiState.lwChart;
  } catch {
    disconnectKlineResizeObserver();
    uiState.lwLoadFailed = true;
    uiState.lwLoadErrorInfo = "chart init failed (api mismatch or invalid module)";
    try { uiState.lwChart?.remove(); } catch {}
    uiState.lwChart = null;
    return null;
  }
}

function calcEMA(values, period = 12) {
  const k = 2 / (period + 1);
  let ema = null;
  return values.map((v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    if (ema == null) {
      ema = n;
    } else {
      ema = n * k + ema * (1 - k);
    }
    return ema;
  });
}

function calcBoll(values, period = 20, multi = 2) {
  const out = values.map((_, i) => {
    if (i < period - 1) return null;
    const win = values.slice(i - period + 1, i + 1).map(Number);
    const mean = win.reduce((s, v) => s + v, 0) / win.length;
    const variance = win.reduce((s, v) => s + ((v - mean) ** 2), 0) / win.length;
    const std = Math.sqrt(variance);
    return { mid: mean, up: mean + multi * std, low: mean - multi * std };
  });
  return out;
}

function renderDrawings() {
  const layer = $("daDrawLayer");
  if (!layer) return;
  const maxPx = 32768;
  layer.innerHTML = uiState.drawings.map((d) => {
    if (d.type === "trend") {
      const x1 = sanitizeSvgCoordinate(d.x1, maxPx);
      const y1 = sanitizeSvgCoordinate(d.y1, maxPx);
      const x2 = sanitizeSvgCoordinate(d.x2, maxPx);
      const y2 = sanitizeSvgCoordinate(d.y2, maxPx);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#8ab4ff" stroke-width="1.6" />`;
    }
    const y = sanitizeSvgCoordinate(d.y, maxPx);
    return `<line x1="0" y1="${y}" x2="100%" y2="${y}" stroke="#ffb86b" stroke-width="1.2" stroke-dasharray="4 4" />`;
  }).join("");
}

function bindDrawLayer() {
  const layer = $("daDrawLayer");
  if (!layer || layer.dataset.bound === "1") return;
  layer.dataset.bound = "1";
  layer.addEventListener("click", (e) => {
    const rect = layer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (uiState.drawMode === "hline") {
      uiState.drawings.push({ type: "hline", y });
      renderDrawings();
      return;
    }
    if (uiState.drawMode === "trend") {
      if (!uiState.drawBuffer) {
        uiState.drawBuffer = { x1: x, y1: y };
      } else {
        uiState.drawings.push({ type: "trend", ...uiState.drawBuffer, x2: x, y2: y });
        uiState.drawBuffer = null;
        renderDrawings();
      }
    }
  });
}

function renderFallbackKlineSvg(rows, ma7, ma25) {
  const w = 1000;
  const h = 320;
  const padL = 20;
  const padR = 16;
  const padT = 12;
  const padB = 18;
  const bodyW = w - padL - padR;
  const bodyH = h - padT - padB;
  const n = Math.max(1, rows.length);
  const step = bodyW / n;
  const candleW = Math.max(1.2, Math.min(8, step * 0.62));
  const highs = rows.map((r) => Number(r?.[2] || 0));
  const lows = rows.map((r) => Number(r?.[3] || 0));
  let maxV = Math.max(...highs, 1);
  let minV = Math.min(...lows, maxV * 0.99);
  if (!(maxV > minV)) {
    maxV += 1;
    minV -= 1;
  }
  const range = maxV - minV;
  const yOf = (v) => padT + ((maxV - Number(v || 0)) / range) * bodyH;
  const xOf = (i) => padL + i * step + step * 0.5;
  const candles = rows.map((r, i) => {
    const o = Number(r?.[1] || 0);
    const hi = Number(r?.[2] || 0);
    const lo = Number(r?.[3] || 0);
    const c = Number(r?.[4] || 0);
    const x = xOf(i);
    const yHi = yOf(hi);
    const yLo = yOf(lo);
    const yO = yOf(o);
    const yC = yOf(c);
    const top = Math.min(yO, yC);
    const rectH = Math.max(1, Math.abs(yO - yC));
    const color = c >= o ? "#4edea3" : "#ffb4ab";
    return `<line x1="${x.toFixed(2)}" y1="${yHi.toFixed(2)}" x2="${x.toFixed(2)}" y2="${yLo.toFixed(2)}" stroke="${color}" stroke-width="1.2" />
<rect x="${(x - candleW / 2).toFixed(2)}" y="${top.toFixed(2)}" width="${candleW.toFixed(2)}" height="${rectH.toFixed(2)}" fill="${color}" />`;
  }).join("");
  const maPath = (arr) => {
    const pts = arr.map((v, i) => (v == null ? null : `${xOf(i).toFixed(2)},${yOf(v).toFixed(2)}`)).filter(Boolean);
    return pts.length >= 2 ? `M ${pts.join(" L ")}` : "";
  };
  const ma7d = maPath(ma7);
  const ma25d = maPath(ma25);
  return `<svg class="da-fallback-kline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="fallback-kline">
<rect x="0" y="0" width="${w}" height="${h}" fill="transparent" />
${candles}
${ma7d ? `<path d="${ma7d}" stroke="#f1d06e" stroke-width="1.5" fill="none" />` : ""}
${ma25d ? `<path d="${ma25d}" stroke="#9c5aff" stroke-width="1.5" fill="none" />` : ""}
</svg>`;
}

function bindFallbackKlineInteractions(sourceRows, timeframe, pair) {
  const mount = $("daKlineMount");
  if (!mount) return;
  mount.classList.add("fallback-interactive");
  mount.onwheel = (e) => {
    e.preventDefault();
    ensureFallbackViewport(sourceRows.length, timeframe, pair);
    const zoomFactor = e.deltaY < 0 ? 0.88 : 1.14;
    const nextBars = clampNum(Math.round(uiState.fallbackBars * zoomFactor), 30, Math.max(30, sourceRows.length));
    uiState.fallbackBars = nextBars;
    const maxOffset = Math.max(0, sourceRows.length - nextBars);
    uiState.fallbackOffset = clampNum(uiState.fallbackOffset, 0, maxOffset);
    if (uiState.dataCandles) renderDataChartPanel(uiState.dataCandles);
  };
  mount.onmousedown = (e) => {
    uiState.fallbackDragging = true;
    uiState.fallbackDragStartX = e.clientX;
    uiState.fallbackDragStartOffset = uiState.fallbackOffset;
    uiState.fallbackDragRowsLen = sourceRows.length;
    uiState.fallbackDragTimeframe = timeframe;
    uiState.fallbackDragPair = pair;
    mount.style.cursor = "grabbing";
  };
  if (!uiState.fallbackGlobalBound) {
    uiState.fallbackGlobalBound = true;
    window.addEventListener("mouseup", () => {
      uiState.fallbackDragging = false;
      const m = $("daKlineMount");
      if (m) m.style.cursor = "";
    });
    window.addEventListener("mousemove", (e) => {
      if (!uiState.fallbackDragging) return;
      const m = $("daKlineMount");
      if (!m) return;
      ensureFallbackViewport(uiState.fallbackDragRowsLen, uiState.fallbackDragTimeframe, uiState.fallbackDragPair);
      const width = Math.max(1, m.clientWidth || 1);
      const dx = e.clientX - uiState.fallbackDragStartX;
      const barsPerPx = uiState.fallbackBars / width;
      const deltaBars = Math.round(dx * barsPerPx);
      const maxOffset = Math.max(0, uiState.fallbackDragRowsLen - uiState.fallbackBars);
      uiState.fallbackOffset = clampNum(uiState.fallbackDragStartOffset + deltaBars, 0, maxOffset);
      if (uiState.dataCandles) renderDataChartPanel(uiState.dataCandles);
    });
  }
}

const PREFER_SVG_KLINE_LS = "ft_prefer_svg_kline";
const PREFER_PANEL_KLINE_LS = "ft_prefer_panel_kline";

function readPreferSvgKlineFromStorage() {
  try {
    return localStorage.getItem(PREFER_SVG_KLINE_LS) === "1";
  } catch {
    return false;
  }
}

function readPreferPanelKlineFromStorage() {
  try {
    return localStorage.getItem(PREFER_PANEL_KLINE_LS) === "1";
  } catch {
    return false;
  }
}

function persistPreferSvgKline(on) {
  uiState.preferSvgKline = on;
  if (on) uiState.preferPanelKline = false;
  try {
    localStorage.setItem(PREFER_SVG_KLINE_LS, on ? "1" : "0");
    if (on) localStorage.setItem(PREFER_PANEL_KLINE_LS, "0");
  } catch {
    // ignore
  }
}

function persistPreferPanelKline(on) {
  uiState.preferPanelKline = on;
  if (on) uiState.preferSvgKline = false;
  try {
    localStorage.setItem(PREFER_PANEL_KLINE_LS, on ? "1" : "0");
    if (on) localStorage.setItem(PREFER_SVG_KLINE_LS, "0");
  } catch {
    // ignore
  }
}

function persistPreferLightweightKline() {
  uiState.preferPanelKline = false;
  uiState.preferSvgKline = false;
  try {
    localStorage.setItem(PREFER_PANEL_KLINE_LS, "0");
    localStorage.setItem(PREFER_SVG_KLINE_LS, "0");
  } catch {
    // ignore
  }
}

function syncKlineModeToolbar() {
  const lw = $("daKlineModeLw");
  const panel = $("daKlineModePanel");
  const svg = $("daKlineModeSvg");
  if (!lw || !panel || !svg) return;
  const p = uiState.preferPanelKline;
  const s = uiState.preferSvgKline;
  lw.classList.toggle("active", !p && !s);
  panel.classList.toggle("active", Boolean(p));
  svg.classList.toggle("active", Boolean(s) && !p);
}

function retryKlineRenderer() {
  disconnectKlineResizeObserver();
  disconnectPanelKlineResizeObserver($("daKlineMount"));
  uiState.lwLoadFailed = false;
  uiState.lwLoadErrorInfo = "";
  uiState.lwDidInitialFit = false;
  lwCreateChart = null;
  try { uiState.lwChart?.remove(); } catch {}
  uiState.lwChart = null;
  uiState.lwCandles = null;
  uiState.lwMA7 = null;
  uiState.lwMA25 = null;
  uiState.lwEMA = null;
  uiState.lwBollMid = null;
  uiState.lwBollUpper = null;
  uiState.lwBollLower = null;
  uiState.lwVolume = null;
  refreshDataPanel();
}

function renderDataChartPanel(candles) {
  const target = $("pairData");
  if (!target) return;
  candles = flattenCandlesData(candles);
  const sel = getDataSelection();
  const shellPair = String(candles?.pair || sel.pair || "BTC/USD").trim();
  const shellTf = String(candles?.timeframe || sel.timeframe || "5m").trim();
  const shellKey = `${shellPair}\u001f${shellTf}`;
  let candleRows = Array.isArray(candles?.data) ? candles.data : [];
  if (!candleRows.length && !state.mockMode) {
    const prev = uiState.dataCandles;
    const prevKey = `${String(prev?.pair || "").trim()}\u001f${String(prev?.timeframe || "").trim()}`;
    if (prev && Array.isArray(prev.data) && prev.data.length && prevKey === shellKey) {
      candles = prev;
      candleRows = prev.data;
    }
  }
  const fallbackPair = shellPair;
  const fallbackTf = shellTf;
  if (!candleRows.length && state.mockMode) {
    const timerange = defaultRecentTimerange(15);
    candleRows = buildMockSeries({
      pair: fallbackPair,
      timeframe: fallbackTf,
      timerange,
      withSignals: false,
      maxPoints: 500
    });
  }
  const latest = candleRows[candleRows.length - 1];
  const prev = candleRows[candleRows.length - 2];
  const close = Number(latest?.[4] || 0);
  const prevClose = Number(prev?.[4] || close || 1);
  const pct = prevClose ? ((close - prevClose) / prevClose) * 100 : 0;
  const priceNow = $("daPriceNow");
  const priceChg = $("daPriceChg");
  const symbol = $("daSymbolTicker");
  const chgLabel = $("daChgLabel");
  if (symbol) symbol.textContent = tickerLabel(fallbackPair, fallbackTf);
  if (state.mockMode) {
    const prefixEl = chgLabel?.querySelector?.(".da-chg-prefix");
    if (prefixEl) prefixEl.textContent = `${t("kline.barDelta")} `;
    if (priceNow) priceNow.textContent = close.toFixed(2);
    if (priceChg) {
      priceChg.textContent = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
      priceChg.classList.remove("positive", "negative");
      priceChg.classList.add(pct >= 0 ? "positive" : "negative");
    }
  } else {
    if (priceNow) priceNow.textContent = close.toFixed(2);
    void applyExchangeTickerToHeader(fallbackPair);
  }
  let mini = candleRows
    .map((r) => coerceCandleRowToSix(r))
    .filter(Boolean)
    .map((r) => {
      const open = Number(r[1]);
      const high = Number(r[2]);
      const low = Number(r[3]);
      const closeV = Number(r[4]);
      const vol = Number(r[5] ?? 0);
      const h = Math.max(open, high, low, closeV);
      const l = Math.min(open, high, low, closeV);
      return [r[0], open, h, l, closeV, Number.isFinite(vol) ? vol : 0];
    })
    .slice(-barsForTimeframe(fallbackTf));
  /** 与数据源顺序无关：按 K 线时间升序，避免 setData 因乱序/重复时间异常 */
  if (mini.length) {
    const keyed = mini.map((r, idx) => ({ r, k: toLwTime(r?.[0], mini.length - idx) }));
    keyed.sort((a, b) => a.k - b.k);
    mini = keyed.map((x) => x.r);
  }
  const closes = mini.map((r) => Number(r[4] || 0));
  const movingAverage = (arr, period) => arr.map((_, i) => {
    if (i < period - 1) return null;
    const win = arr.slice(i - period + 1, i + 1);
    const sum = win.reduce((s, v) => s + Number(v || 0), 0);
    return sum / period;
  });
  const ma7 = movingAverage(closes, 7);
  const ma25 = movingAverage(closes, 25);
  const ma7Val = ma7[ma7.length - 1];
  const ma25Val = ma25[ma25.length - 1];
  const ema12 = calcEMA(closes, 12);
  const boll = calcBoll(closes, 20, 2);
  const needShell = !target.querySelector("#daKlineMount") || target.dataset.daShellKey !== shellKey;
  if (needShell) {
    disconnectKlineResizeObserver();
    uiState.lwDidInitialFit = false;
    try { uiState.lwChart?.remove(); } catch {}
    uiState.lwChart = null;
    uiState.lwMount = null;
    uiState.lwCandles = null;
    uiState.lwMA7 = null;
    uiState.lwMA25 = null;
    uiState.lwEMA = null;
    uiState.lwBollMid = null;
    uiState.lwBollUpper = null;
    uiState.lwBollLower = null;
    uiState.lwVolume = null;
    target.dataset.daShellKey = shellKey;
    target.innerHTML = `
    <div class="da-candle-strip">
      <div id="daKlineMount" class="da-kline-mount"></div>
      <svg id="daDrawLayer" class="da-draw-layer"></svg>
      <div id="daKlineHint" class="da-kline-hint hidden"></div>
      <div class="da-ma-legend">
        <span class="ma7">MA(7): ${ma7Val == null ? "-" : Number(ma7Val).toFixed(2)}</span>
        <span class="ma25">MA(25): ${ma25Val == null ? "-" : Number(ma25Val).toFixed(2)}</span>
      </div>
      <div id="daOhlcFloat" class="da-ohlc-float hidden"></div>
    </div>
  `;
  } else {
    const leg7 = target.querySelector(".da-ma-legend .ma7");
    const leg25 = target.querySelector(".da-ma-legend .ma25");
    const ma7Text = `MA(7): ${ma7Val == null ? "-" : Number(ma7Val).toFixed(2)}`;
    const ma25Text = `MA(25): ${ma25Val == null ? "-" : Number(ma25Val).toFixed(2)}`;
    if (leg7) leg7.textContent = ma7Text;
    if (leg25) leg25.textContent = ma25Text;
  }
  if (uiState.preferPanelKline && mini.length) {
    disconnectKlineResizeObserver();
    try {
      uiState.lwChart?.remove();
    } catch {
      // ignore
    }
    uiState.lwChart = null;
    uiState.lwCandles = null;
    uiState.lwMA7 = null;
    uiState.lwMA25 = null;
    uiState.lwEMA = null;
    uiState.lwBollMid = null;
    uiState.lwBollUpper = null;
    uiState.lwBollLower = null;
    uiState.lwVolume = null;
    uiState.lwMount = null;
    uiState.lwDidInitialFit = false;
    const mountPanel = $("daKlineMount");
    if (mountPanel) {
      const cv = ensurePanelKlineCanvas(mountPanel);
      const { start, end } = getFallbackSliceBounds(mini, fallbackTf, fallbackPair);
      drawPanelKlineCanvas(cv, {
        mini,
        viewStart: start,
        viewEnd: end,
        ma7,
        ma25,
        pair: fallbackPair,
        tf: fallbackTf
      });
      bindFallbackKlineInteractions(mini, fallbackTf, fallbackPair);
      observePanelKlineResize(mountPanel, () => {
        if (uiState.dataCandles) renderDataChartPanel(uiState.dataCandles);
      });
    }
    clearDaKlineStatus();
    if ($("daKlineHint")) $("daKlineHint").classList.add("hidden");
    setDaVolumeBars(candles);
    bindDrawLayer();
    renderDrawings();
    return;
  }
  disconnectPanelKlineResizeObserver($("daKlineMount"));
  if ((uiState.preferSvgKline || uiState.lwLoadFailed) && mini.length) {
    disconnectKlineResizeObserver();
    try {
      uiState.lwChart?.remove();
    } catch {
      // ignore
    }
    uiState.lwChart = null;
    uiState.lwCandles = null;
    uiState.lwMA7 = null;
    uiState.lwMA25 = null;
    uiState.lwEMA = null;
    uiState.lwBollMid = null;
    uiState.lwBollUpper = null;
    uiState.lwBollLower = null;
    uiState.lwVolume = null;
    uiState.lwMount = null;
    uiState.lwDidInitialFit = false;
    const mountSvg = $("daKlineMount");
    const hintSvg = $("daKlineHint");
    if (mountSvg) {
      const viewRows = sliceFallbackRows(mini, fallbackTf, fallbackPair);
      const vCloses = viewRows.map((r) => Number(r[4] || 0));
      const vMa = (arr, period) => arr.map((_, i) => {
        if (i < period - 1) return null;
        const win = arr.slice(i - period + 1, i + 1);
        const sum = win.reduce((s, v) => s + Number(v || 0), 0);
        return sum / period;
      });
      mountSvg.innerHTML = renderFallbackKlineSvg(viewRows, vMa(vCloses, 7), vMa(vCloses, 25));
      bindFallbackKlineInteractions(mini, fallbackTf, fallbackPair);
    }
    if (hintSvg) hintSvg.classList.add("hidden");
    clearDaKlineStatus();
    setDaVolumeBars(candles);
    bindDrawLayer();
    renderDrawings();
    return;
  }
  const chart = ensureLightweightChart();
  if (!chart || !uiState.lwCandles || !uiState.lwMA7 || !uiState.lwMA25 || !uiState.lwVolume) {
    const hint = $("daKlineHint");
    const mount = $("daKlineMount");
    if (mount && mini.length) {
      const tf = fallbackTf;
      const pair = fallbackPair;
      const viewRows = sliceFallbackRows(mini, tf, pair);
      const vCloses = viewRows.map((r) => Number(r[4] || 0));
      const vMa = (arr, period) => arr.map((_, i) => {
        if (i < period - 1) return null;
        const win = arr.slice(i - period + 1, i + 1);
        const sum = win.reduce((s, v) => s + Number(v || 0), 0);
        return sum / period;
      });
      mount.innerHTML = renderFallbackKlineSvg(viewRows, vMa(vCloses, 7), vMa(vCloses, 25));
      bindFallbackKlineInteractions(mini, tf, pair);
    }
    if (hint) {
      if (mini.length && mount) {
        clearDaKlineStatus();
        hint.classList.add("hidden");
      } else if (!mini.length && !state.mockMode) {
        const noRows = !candleRows.length;
        const msg = noRows ? t("kline.noData") : t("kline.malformedRows");
        const rowHtml = `${escapeHtml(msg)} <button type="button" class="ghost tiny" data-kline-retry>${escapeHtml(t("kline.retry"))}</button>`;
        hint.innerHTML = rowHtml;
        showDaKlineStatusHtml(`${escapeHtml(msg)} ${klineStatusRetrySuffix()}`);
        hint.classList.remove("hidden");
      } else if (uiState.lwLoadFailed) {
        const detail = uiState.lwLoadErrorInfo ? `<span class="mono">${escapeHtml(uiState.lwLoadErrorInfo)}</span>` : "";
        const rowHtml = `${escapeHtml(t("kline.cdnFallback"))} ${detail} <button type="button" class="ghost tiny" data-kline-retry>${escapeHtml(t("kline.retry"))}</button>`;
        hint.innerHTML = rowHtml;
        showDaKlineStatusHtml(
          `${escapeHtml(t("kline.cdnFallback"))} ${detail} ${klineStatusRetrySuffix()}`
        );
        hint.classList.remove("hidden");
      } else {
        const loadMsg = t("kline.loading");
        hint.textContent = loadMsg;
        showDaKlineStatusText(loadMsg);
        hint.classList.remove("hidden");
      }
    }
    setDaVolumeBars(candles);
    return;
  }
  {
    const kM = $("daKlineMount");
    if (kM) {
      kM.classList.remove("fallback-interactive");
      kM.onwheel = null;
      kM.onmousedown = null;
    }
  }
  // 库已就绪但解析后无有效 OHLC：须提示，否则仅 setData([]) 会呈现「空白专业图」且无文案
  if (!mini.length && !state.mockMode) {
    const hintEarly = $("daKlineHint");
    if (hintEarly) {
      const noRowsEarly = !candleRows.length;
      const msgEarly = noRowsEarly ? t("kline.noData") : t("kline.malformedRows");
      const rowHtmlEarly = `${escapeHtml(msgEarly)} <button type="button" class="ghost tiny" data-kline-retry>${escapeHtml(t("kline.retry"))}</button>`;
      hintEarly.innerHTML = rowHtmlEarly;
      hintEarly.classList.remove("hidden");
      showDaKlineStatusHtml(`${escapeHtml(msgEarly)} ${klineStatusRetrySuffix()}`);
    }
    try {
      uiState.lwCandles?.setData([]);
      uiState.lwMA7?.setData([]);
      uiState.lwMA25?.setData([]);
      uiState.lwEMA?.setData([]);
      uiState.lwBollMid?.setData([]);
      uiState.lwBollUpper?.setData([]);
      uiState.lwBollLower?.setData([]);
      uiState.lwVolume?.setData([]);
    } catch {
      // ignore
    }
    setDaVolumeBars(candles);
    return;
  }
  clearDaKlineStatus();
  if ($("daKlineHint")) $("daKlineHint").classList.add("hidden");
  const rawTimes = mini.map((r, idx) => toLwTime(r?.[0], mini.length - idx));
  const times = normalizeMonotonicTimes(rawTimes);
  const cData = mini.map((r, idx) => ({
    time: times[idx],
    open: Number(r?.[1] || 0),
    high: Number(r?.[2] || 0),
    low: Number(r?.[3] || 0),
    close: Number(r?.[4] || 0)
  }));
  const ma7Data = ma7.map((v, idx) => v == null ? null : ({ time: times[idx], value: Number(v) })).filter(Boolean);
  const ma25Data = ma25.map((v, idx) => v == null ? null : ({ time: times[idx], value: Number(v) })).filter(Boolean);
  const emaData = ema12.map((v, idx) => v == null ? null : ({ time: times[idx], value: Number(v) })).filter(Boolean);
  const bollMidData = boll.map((v, idx) => v == null ? null : ({ time: times[idx], value: Number(v.mid) })).filter(Boolean);
  const bollUpData = boll.map((v, idx) => v == null ? null : ({ time: times[idx], value: Number(v.up) })).filter(Boolean);
  const bollLowData = boll.map((v, idx) => v == null ? null : ({ time: times[idx], value: Number(v.low) })).filter(Boolean);
  const vData = mini.map((r, idx) => {
    const up = Number(r?.[4] || 0) >= Number(r?.[1] || 0);
    return {
      time: times[idx],
      value: Number(r?.[5] || 0),
      color: up ? "rgba(78,222,163,0.55)" : "rgba(255,180,171,0.55)"
    };
  });
  try {
    uiState.lwCandles.setData(cData);
    uiState.lwMA7.setData(ma7Data);
    uiState.lwMA25.setData(ma25Data);
    uiState.lwEMA?.setData(emaData);
    uiState.lwBollMid?.setData(bollMidData);
    uiState.lwBollUpper?.setData(bollUpData);
    uiState.lwBollLower?.setData(bollLowData);
    uiState.lwEMA?.applyOptions({ visible: uiState.showEMA });
    uiState.lwBollMid?.applyOptions({ visible: uiState.showBOLL });
    uiState.lwBollUpper?.applyOptions({ visible: uiState.showBOLL });
    uiState.lwBollLower?.applyOptions({ visible: uiState.showBOLL });
    uiState.lwVolume.setData(vData);
    if (mini.length && (needShell || !uiState.lwDidInitialFit)) {
      chart.timeScale().fitContent();
      uiState.lwDidInitialFit = true;
    }
  } catch (err) {
    disconnectKlineResizeObserver();
    uiState.lwLoadFailed = true;
    uiState.lwLoadErrorInfo = String(err?.message || err || "setData failed");
    try {
      uiState.lwChart?.remove();
    } catch {
      // ignore
    }
    uiState.lwChart = null;
    uiState.lwCandles = null;
    uiState.lwMA7 = null;
    uiState.lwMA25 = null;
    uiState.lwEMA = null;
    uiState.lwBollMid = null;
    uiState.lwBollUpper = null;
    uiState.lwBollLower = null;
    uiState.lwVolume = null;
    uiState.lwMount = null;
    const mount = $("daKlineMount");
    const hint = $("daKlineHint");
    if (mount && mini.length) {
      const viewRows = sliceFallbackRows(mini, fallbackTf, fallbackPair);
      const vCloses = viewRows.map((r) => Number(r[4] || 0));
      const vMa = (arr, period) => arr.map((_, i) => {
        if (i < period - 1) return null;
        const win = arr.slice(i - period + 1, i + 1);
        const sum = win.reduce((s, v) => s + Number(v || 0), 0);
        return sum / period;
      });
      mount.innerHTML = renderFallbackKlineSvg(viewRows, vMa(vCloses, 7), vMa(vCloses, 25));
      bindFallbackKlineInteractions(mini, fallbackTf, fallbackPair);
    }
    if (hint) {
      const failHtml = `${escapeHtml(t("kline.setDataFail"))} <span class="mono">${escapeHtml(uiState.lwLoadErrorInfo)}</span> <button type="button" class="ghost tiny" data-kline-retry>${escapeHtml(t("kline.retryShort"))}</button>`;
      hint.innerHTML = failHtml;
      hint.classList.remove("hidden");
      showDaKlineStatusHtml(
        `${escapeHtml(t("kline.setDataFail"))} <span class="mono">${escapeHtml(uiState.lwLoadErrorInfo)}</span> ${klineStatusRetrySuffix("kline.retryShort")}`
      );
    }
  }
  bindDrawLayer();
  renderDrawings();
  setDaVolumeBars(candles);
}

function clearDataPanelErrors() {
  const target = $("availablePairs");
  if (!target) return;
  target.querySelectorAll(".da-inline-error").forEach((el) => el.remove());
}

function parseStrategies(strategiesResult) {
  if (Array.isArray(strategiesResult)) return strategiesResult.map((s) => String(s || "").trim()).filter(Boolean);
  if (Array.isArray(strategiesResult?.strategies)) {
    return strategiesResult.strategies.map((s) => String(typeof s === "string" ? s : s?.name || "").trim()).filter(Boolean);
  }
  if (strategiesResult?.strategies && typeof strategiesResult.strategies === "object") {
    return Object.keys(strategiesResult.strategies).filter(Boolean);
  }
  return [];
}

function renderDataStrategies(strategiesResult, profitSummary, activeStrategyName) {
  const list = $("data")?.querySelector(".da-strategy-list");
  const badge = $("data")?.querySelector(".da-left-head span");
  if (!list) return;
  const names = parseStrategies(strategiesResult);
  if (badge) badge.textContent = t("data.strategiesBadge").replace("{count}", String(names.length || 0));
  if (!names.length) {
    list.innerHTML = `<div class="da-strategy-card"><strong>${escapeHtml(t("data.noStrategy"))}</strong><em>0.0%</em><small>${escapeHtml(t("data.waitingStrategies"))}</small></div>`;
    return;
  }
  const act = String(activeStrategyName || "").trim();
  const wrAll = profitSummary?.winrate != null ? (Number(profitSummary.winrate) * 100).toFixed(1) : null;
  const prAll = profitSummary?.profit_all_ratio != null ? Number(profitSummary.profit_all_ratio) * 100 : null;
  list.innerHTML = names.slice(0, 12).map((name, idx) => {
    if (state.mockMode) {
      const base = (name.charCodeAt(0) + name.length * 11 + idx * 7) % 100;
      const winRate = 42 + (base % 36);
      const perfRaw = ((base % 28) - 9) / 10;
      const perf = `${perfRaw >= 0 ? "+" : ""}${perfRaw.toFixed(1)}%`;
      return `
      <div class="da-strategy-card">
        <strong>${escapeHtml(name)}</strong>
        <em class="${perfRaw >= 0 ? "" : "negative"}">${perf}</em>
        <small>${escapeHtml(t("data.winRate"))}: ${winRate}%</small>
      </div>
    `;
    }
    const isActive = act && name === act;
    const perfNum = isActive && prAll != null && Number.isFinite(prAll) ? prAll : null;
    const perfTxt = perfNum == null ? "—" : `${perfNum >= 0 ? "+" : ""}${perfNum.toFixed(2)}%`;
    const emCls = perfNum != null && perfNum < 0 ? "negative" : "";
    const winTxt = isActive && wrAll != null ? wrAll : "—";
    return `
      <div class="da-strategy-card">
        <strong>${escapeHtml(name)}</strong>
        <em class="${emCls}">${perfTxt}</em>
        <small>${escapeHtml(t("data.winRate"))}: ${winTxt}%${isActive ? "" : escapeHtml(t("data.strategyInactive"))}</small>
      </div>
    `;
  }).join("");
}

function renderMarketBoard(items) {
  const target = $("daMarketBoard");
  if (!target) return;
  const html = (Array.isArray(items) ? items : []).slice(0, 8).map((x) => {
    const symbol = String(x.symbol || "").replace("USDT", "/USD");
    const pct = Number(x.pct || 0);
    const price = Number(x.price || 0);
    return `<button class="chip ${pct >= 0 ? "up" : "down"}" data-market-pair="${escapeHtml(symbol)}"><b>${escapeHtml(symbol)}</b><em>${price.toFixed(2)}</em><i>${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%</i></button>`;
  }).join("");
  target.innerHTML = html || `<span class="chip">${escapeHtml(t("data.marketLoading"))}</span>`;
}

async function refreshDataRealtime() {
  if (!uiState.authed || !isDataSectionActive()) return;
  if (document.visibilityState === "hidden") return;
  if (uiState.dataRealtimeBusy) return;
  const { pair, timeframe } = getDataSelection();
  const symbol = pairToBinanceSymbol(pair);
  const interval = timeframeToBinanceInterval(timeframe);
  uiState.dataRealtimeBusy = true;
  try {
    let candles;
    let board = [];
    if (state.mockMode) {
      candles = await apiCall(`/pair_candles?pair=${encodeURIComponent(pair)}&timeframe=${encodeURIComponent(timeframe)}`);
      uiState.dataTickSeq += 1;
      candles = applyRealtimeDrift(candles, uiState.dataTickSeq);
      updateDataNetStatus("LIVE", 0);
      updateDataSourceLabel("MOCK");
      {
        const brd = await apiCallSwallow("/panel/binance_board");
        board = Array.isArray(brd?.board) ? brd.board : [];
      }
    } else {
      const [cRes, bRes] = await Promise.all([
        fetchCandlesFastestAvailable({ pair, timeframe, symbol, interval }).then(
          (r) => ({ ok: true, label: r.label, candles: r.candles }),
          (e) => ({ ok: false, hold: String(e?.message || e) === "DATA_PIN_HOLD" })
        ),
        fetchBoardFastestAvailable().then(
          (r) => ({ ok: true, board: r.board }),
          (e) => ({ ok: false, board: [], hold: String(e?.message || e) === "DATA_PIN_HOLD" })
        )
      ]);
      if (cRes.ok) {
        candles = cRes.candles;
        updateDataNetStatus("LIVE", 0);
        updateDataSourceLabel(cRes.label);
      } else if (!cRes.hold) {
        updateDataNetStatus("FALLBACK", Math.max(1, uiState.dataNetRetries));
        updateDataSourceLabel("NONE");
      }
      if (bRes.ok) {
        board = bRes.board || [];
        if (board.length) uiState.lastDataMarketBoard = board;
      } else if (bRes.hold) {
        board = Array.isArray(uiState.lastDataMarketBoard) ? uiState.lastDataMarketBoard : [];
      } else {
        board = [];
      }
    }
    const selRtKey = `${pair}\u001f${timeframe}`;
    if (!state.mockMode && candles && (!Array.isArray(candles.data) || !candles.data.length)) {
      const prev = uiState.dataCandles;
      const prevKey = `${String(prev?.pair || "").trim()}\u001f${String(prev?.timeframe || "").trim()}`;
      if (prev && Array.isArray(prev.data) && prev.data.length && prevKey === selRtKey) {
        candles = prev;
      }
    }
    if (Array.isArray(candles?.data) && candles.data.length) {
      uiState.dataCandles = { ...candles, pair, timeframe };
    } else if (!uiState.dataCandles?.data?.length) {
      uiState.dataCandles = candles;
    }
    /** 仅当与当前选中的 pair/tf 一致时才沿用全局缓存，避免切换品种后失败请求仍画出旧 K 线 */
    const stale = uiState.dataCandles;
    const staleKey = `${String(stale?.pair || "").trim()}\u001f${String(stale?.timeframe || "").trim()}`;
    const staleOk = Boolean(
      stale && Array.isArray(stale.data) && stale.data.length && staleKey === selRtKey
    );
    const toRender =
      Array.isArray(candles?.data) && candles.data.length
        ? uiState.dataCandles
        : staleOk
          ? stale
          : candles || { pair, timeframe, data: [] };
    uiState.selectedPair = toRender?.pair || pair;
    setDataPair(toRender?.pair || pair);
    setDataTimeframe(toRender?.timeframe || timeframe);
    renderDataKlineStripIfVisible(toRender);
    renderDataMarketStripIfVisible(board);
  } catch {
    // keep last chart when realtime tick fails
    updateDataNetStatus("FALLBACK", Math.max(1, uiState.dataNetRetries));
    updateDataSourceLabel("NONE");
  } finally {
    uiState.dataRealtimeBusy = false;
  }
}

function buildFallbackDataPanel(pair = "BTC/USD", timeframe = "1h") {
  const timerange = defaultRecentTimerange(30);
  const candleData = buildMockSeries({ pair, timeframe, timerange, withSignals: false, maxPoints: 240 });
  const historyData = buildMockSeries({ pair, timeframe, timerange, withSignals: true, maxPoints: 240 });
  return {
    candles: {
      pair,
      timeframe,
      timerange,
      columns: ["date", "open", "high", "low", "close", "volume"],
      data: candleData
    },
    history: {
      pair,
      timeframe,
      timerange,
      columns: ["date", "open", "high", "low", "close", "volume", "rsi", "enter_long", "exit_long"],
      data: historyData
    }
  };
}

function csvEscapeCell(val) {
  const s = String(val ?? "");
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportPairHistoryCsv() {
  const h = uiState.dataHistory;
  const data = Array.isArray(h?.data) ? h.data : [];
  if (!data.length) {
    logAction(t("log.csvNoData"));
    return;
  }
  const width = Math.max(
    1,
    ...data.map((r) => (Array.isArray(r) ? r.length : 0)),
    Array.isArray(h.columns) ? h.columns.length : 0
  );
  const cols =
    Array.isArray(h.columns) && h.columns.length
      ? h.columns.slice(0, width)
      : [];
  while (cols.length < width) cols.push(`col${cols.length}`);
  const lines = [
    cols.map(csvEscapeCell).join(","),
    ...data.map((row) => {
      const r = Array.isArray(row) ? row : [];
      return cols.map((_, i) => csvEscapeCell(r[i])).join(",");
    })
  ];
  const csv = "\ufeff" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const pair = String(h.pair || uiState.selectedPair || "pair").replace(/[/:]/g, "_");
  const tf = String(h.timeframe || uiState.selectedTimeframe || "tf").replace(/[/:]/g, "_");
  const name = `pair_history_${pair}_${tf}.csv`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
    logAction(`${t("log.csvExported")} ${name}`);
}

function buildHistoryLogRows(history, fallbackPair = "BTC/USD") {
  const rawData = Array.isArray(history?.data) ? history.data : [];
  const cols = Array.isArray(history?.columns) ? history.columns : [];
  const pairLabel = String(history?.pair || fallbackPair || "BTC/USD").trim() || "BTC/USD";

  const cell = (row, idx) => {
    if (!Array.isArray(row) || idx < 0 || idx >= row.length) return null;
    return row[idx];
  };

  const rowFromValues = (ts, open, close, volume, type, typeKind) => {
    const delta =
      Number.isFinite(open) && open !== 0 && Number.isFinite(close)
        ? ((close - open) / open) * 100
        : NaN;
    return {
      ts,
      pair: pairLabel,
      type,
      typeKind,
      close: Number.isFinite(close) ? close : NaN,
      volume: Number.isFinite(volume) ? volume : NaN,
      delta
    };
  };

  if (cols.length) {
    const di = historyColIndex(cols, ["date"]);
    const oi = historyColIndex(cols, ["open", "o"]);
    const ci = historyColIndex(cols, ["close", "c"]);
    const vi = historyColIndex(cols, ["volume", "vol", "base_volume", "quote_volume"]);
    const enterLong = historyColIndex(cols, ["enter_long"]);
    const exitLong = historyColIndex(cols, ["exit_long"]);
    const enterShort = historyColIndex(cols, ["enter_short"]);
    const exitShort = historyColIndex(cols, ["exit_short"]);

    return rawData.slice().reverse().map((row) => {
      if (!Array.isArray(row)) {
        return rowFromValues("-", NaN, NaN, NaN, "—", "neutral");
      }
      const dateRaw = di >= 0 ? cell(row, di) : cell(row, 0);
      const ts = formatHistoryTimestamp(dateRaw);
      const open = Number(cell(row, oi));
      const close = Number(cell(row, ci));
      const volume = Number(cell(row, vi));

      const ex =
        historySignalIsOne(cell(row, exitLong)) || historySignalIsOne(cell(row, exitShort));
      const en =
        historySignalIsOne(cell(row, enterLong)) || historySignalIsOne(cell(row, enterShort));
      let type = "—";
      let typeKind = "neutral";
      if (ex) {
        type = "SELL";
        typeKind = "sell";
      } else if (en) {
        type = "BUY";
        typeKind = "buy";
      }

      return rowFromValues(ts, open, close, volume, type, typeKind);
    });
  }

  // 无 columns 时兼容旧版固定列序（date, o, h, l, c, v, …, enter_long, exit_long）
  return rawData.slice().reverse().map((row) => {
    if (!Array.isArray(row)) {
      return rowFromValues("-", NaN, NaN, NaN, "—", "neutral");
    }
    const ts = formatHistoryTimestamp(row?.[0]);
    const open = Number(row?.[1]);
    const close = Number(row?.[4]);
    const volume = Number(row?.[5]);
    const en = historySignalIsOne(row?.[7]);
    const ex = historySignalIsOne(row?.[8]);
    const delta =
      Number.isFinite(open) && open !== 0 && Number.isFinite(close)
        ? ((close - open) / open) * 100
        : NaN;
    const type = ex ? "SELL" : en ? "BUY" : "—";
    const typeKind = type === "SELL" ? "sell" : type === "BUY" ? "buy" : "neutral";
    return {
      ts,
      pair: pairLabel,
      type,
      typeKind,
      close: Number.isFinite(close) ? close : NaN,
      volume: Number.isFinite(volume) ? volume : NaN,
      delta
    };
  });
}

function renderDataHistoryPanel(pairsResult, history, pair = "BTC/USD") {
  const target = $("availablePairs");
  if (!target) return;
  const length = Number(pairsResult?.length || 0);
  const pairs = Array.isArray(pairsResult?.pairs) ? pairsResult.pairs : [];
  const intervals = Array.isArray(pairsResult?.pair_interval) ? pairsResult.pair_interval : [];
  const rows = buildHistoryLogRows(history, pair);
  const key = `${pair}|${history?.timeframe || ""}|${rows.length}`;
  if (uiState.historyLogsKey !== key) {
    uiState.historyLogsKey = key;
    uiState.historyLogsPage = 1;
  }
  uiState.historyLogsRows = rows;
  uiState.historyLogsTotalPages = Math.max(1, Math.ceil(rows.length / uiState.historyLogsPageSize));
  if (uiState.historyLogsPage > uiState.historyLogsTotalPages) uiState.historyLogsPage = uiState.historyLogsTotalPages;
  if (uiState.historyLogsPage < 1) uiState.historyLogsPage = 1;
  const start = (uiState.historyLogsPage - 1) * uiState.historyLogsPageSize;
  const pageRows = rows.slice(start, start + uiState.historyLogsPageSize);
  const logRows = pageRows.map((r) => {
    const tagCls =
      r.typeKind === "buy" ? "buy" : r.typeKind === "sell" ? "sell" : "neutral";
    const closeStr = Number.isFinite(r.close) ? r.close.toFixed(2) : "—";
    const volStr = Number.isFinite(r.volume) ? r.volume.toFixed(2) : "—";
    const deltaStr = Number.isFinite(r.delta)
      ? `${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(2)}%`
      : "—";
    const deltaCls = !Number.isFinite(r.delta)
      ? ""
      : r.delta >= 0
        ? "positive"
        : "negative";
    return `
    <tr>
      <td>${escapeHtml(r.ts)}</td>
      <td>${escapeHtml(r.pair)}</td>
      <td><span class="da-tag ${tagCls}">${escapeHtml(r.type)}</span></td>
      <td class="t-right">${closeStr}</td>
      <td class="t-right">${volStr}</td>
      <td class="t-right ${deltaCls}">${deltaStr}</td>
    </tr>
  `;
  }).join("");
  const th = (k) => escapeHtml(t(k));
  target.innerHTML = `
    <div class="da-chart-live">
      <div class="pill">${th("history.pill.length")} <b>${length}</b></div>
      <div class="pill">${th("history.pill.pairs")} <b>${pairs.length}</b></div>
      <div class="pill">${th("history.pill.rows")} <b>${intervals.length}</b></div>
    </div>
    <div class="da-table-wrap da-table-wrap-logs">
      <table class="da-mini-table da-history-table">
        <thead><tr><th>${th("history.th.time")}</th><th>${th("history.th.pair")}</th><th>${th("history.th.type")}</th><th class="t-right">${th("history.th.execPrice")}</th><th class="t-right">${th("history.th.volume")}</th><th class="t-right">${th("history.th.delta")}</th></tr></thead>
        <tbody>${logRows || "<tr><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td></tr>"}</tbody>
      </table>
    </div>
    <div class="da-history-pager">
      <button type="button" class="ghost" data-history-prev ${uiState.historyLogsPage <= 1 ? "disabled" : ""}>${th("btn.prevPage")}</button>
      <span class="pager-info">${uiState.historyLogsPage} / ${uiState.historyLogsTotalPages}</span>
      <button type="button" class="ghost" data-history-next ${uiState.historyLogsPage >= uiState.historyLogsTotalPages ? "disabled" : ""}>${th("btn.nextPage")}</button>
    </div>
  `;
}

function prependDataPanelError(message) {
  const target = $("availablePairs");
  if (!target) return;
  const msg = `<div class="da-inline-error">${escapeHtml(message)}</div>`;
  target.insertAdjacentHTML("afterbegin", msg);
}

function updateLogsPager() {
  const info = $("logsPageInfo");
  const prev = $("logsPrev");
  const next = $("logsNext");
  if (!info || !prev || !next) return;
  info.textContent = `${uiState.logsPage} / ${uiState.logsTotalPages}`;
  prev.disabled = uiState.logsPage <= 1;
  next.disabled = uiState.logsPage >= uiState.logsTotalPages;
}

async function refreshOverview() {
  try {
    uiState.lastProxyHealth = await fetchLocalProxyHealthSnapshot();
    const t0 = performance.now();
    let ping = { status: "down" };
    try {
      ping = await apiCallPublic("/ping");
    } catch {
      ping = { status: "down" };
    }
    uiState.lastPingLatencyMs = performance.now() - t0;

    const [showConfigR, healthR, countR, profitR, sysR, logsR, panelStratR, aiOvR] =
      await Promise.allSettled([
        apiCall("/show_config"),
        apiCall("/health"),
        apiCall("/count"),
        apiCall("/profit"),
        apiCallPublic("/sysinfo"),
        apiCall("/logs"),
        apiCall("/panel/strategies"),
        apiCall("/panel/ai_overview")
      ]);
    const pingPong = ping?.status === "pong";
    /** 顶栏「在线」：/ping 成功，或已能打通需鉴权的核心接口（避免个别部署上 ping 异常但机器人正常） */
    const coreApiOk =
      showConfigR.status === "fulfilled" ||
      healthR.status === "fulfilled" ||
      countR.status === "fulfilled";
    const pingOk = pingPong || coreApiOk;
    const pingForUi = pingOk && !pingPong ? { ...ping, status: "pong" } : ping;

    const showConfig = showConfigR.status === "fulfilled" ? showConfigR.value : {};
    uiState.panelStrategyList =
      panelStratR.status === "fulfilled" && Array.isArray(panelStratR.value?.strategies)
        ? panelStratR.value.strategies
        : null;
    const health = healthR.status === "fulfilled" ? healthR.value : {};
    const count = countR.status === "fulfilled" ? countR.value : {};
    const profit = profitR.status === "fulfilled" ? profitR.value : {};
    uiState.lastAiOverview = aiOvR.status === "fulfilled" && aiOvR.value && typeof aiOvR.value === "object" ? aiOvR.value : null;
    const sys = sysR.status === "fulfilled"
      ? sysR.value
      : {
        warning: "sysinfo unavailable",
        detail: String(sysR.reason?.message || sysR.reason || "")
      };
    const logs = logsR.status === "fulfilled" ? logsR.value : { warning: "logs unavailable" };

    let daily = {};
    let tradesMini = { trades: [] };
    let wl = {};
    let bl = {};
    let stForRisk = [];
    if (!state.mockMode) {
      const sec = await Promise.allSettled([
        apiCall("/daily?timescale=14"),
        apiCall("/trades?limit=12&order_by_id=false"),
        apiCall("/whitelist"),
        apiCall("/blacklist"),
        apiCall("/status")
      ]);
      if (sec[0].status === "fulfilled") daily = sec[0].value;
      if (sec[1].status === "fulfilled") tradesMini = sec[1].value;
      if (sec[2].status === "fulfilled") wl = sec[2].value;
      if (sec[3].status === "fulfilled") bl = sec[3].value;
      if (sec[4].status === "fulfilled" && Array.isArray(sec[4].value)) stForRisk = sec[4].value;
    }

    uiState.lastPingOk = pingOk;
    uiState.lastPing = pingForUi;
    uiState.lastShowConfig = showConfig;
    syncStrategyEntriesWithBotAndDiscovered(showConfig, uiState.panelStrategyList);
    uiState.lastProfit = profit;
    uiState.lastCount = count;
    uiState.lastHealth = health;
    uiState.lastDaily = daily;
    uiState.lastStForRisk = stForRisk;
    uiState.lastWl = wl;
    uiState.lastBl = bl;
    uiState.lastTradesMini = tradesMini;

    if (!state.mockMode) {
      updateOverviewKpisLive(count, profit, health, pingForUi, uiState.lastPingLatencyMs);
    } else {
      $("kpiBotStatus").textContent = pingForUi.status || "unknown";
      updateKpiDrawdownAndRisk(profit);
    }
    $("kpiOpenTrades").textContent = count.current ?? count.open_trades ?? "-";
    const p = Number(
      profit.profit_all_coin ??
        profit.profit_all_fiat ??
        profit.profit_closed_coin ??
        profit.profit_closed_fiat ??
        profit.profit_total_abs ??
        profit.closed_profit ??
        0
    );
    const profitEl = $("kpiProfit");
    profitEl.textContent = `${p.toFixed(2)}`;
    profitEl.classList.remove("positive", "negative");
    profitEl.classList.add(p >= 0 ? "positive" : "negative");
    uiState.lastSysinfo = sys;
    renderSysinfoPanel(sys, health);
    renderLogsPanel(logs);
    void updateMonitorPanel();

    updateRiskLeverageHead(showConfig, stForRisk);
    renderRiskMatrix(stForRisk);
    renderOverviewStrategiesTableLive(showConfig, profit, count);
    updateSparklinesFromDaily(daily);
    renderGovernanceLists(wl, bl, showConfig);
    renderScFeedFromTrades(tradesMini);
    await refreshStrategyBotSnapshots();
    renderControlHeroAndCards(
      daily,
      showConfig,
      profit,
      health,
      uiState.lastProxyHealth,
      uiState.strategyBotSnapshots || {}
    );
    syncTradingControlDomAvailability();
    refreshTopbarDecor(uiState.lastPingLatencyMs, pingOk);
    setHeroMetrics(uiState.lastPingLatencyMs, health);
    setDaHeroTelemetry(pingOk, uiState.lastPingLatencyMs);
    refreshControlStrategyConfig();
    refreshStrategyAuthorizedAmountStakeHint();
    const stratPane = $("settingsPanelStrategy");
    if (stratPane?.classList.contains("active")) renderStrategyEntriesList();

    if (
      showConfig.runmode === "webserver" &&
      !state.mockMode &&
      !uiState.webserverModeNotified &&
      !panelBotTradingApisAvailable(showConfig, uiState.lastProxyHealth, health)
    ) {
      uiState.webserverModeNotified = true;
      logAction(`${t("log.webserverMode")} ${t("log.webserverModeTradeHint")}`);
    }
    if (!state.mockMode && uiState.authed && pingOk && !uiState.panelPrefsSyncedFromDb) {
      schedulePanelPrefsRecoveryIfNeeded();
    }
    logAction(t("log.overviewOk"));
  } catch (err) {
    logAction(`${t("log.overviewFail")}: ${err.message}`);
  }
}

async function refreshPositions() {
  try {
    const [status, trades] = await Promise.all([apiCall("/status"), apiCall("/trades?limit=300")]);
    renderStatusRows(status);
    if (state.mockMode) {
      renderTradesRows(trades);
    } else {
      const flat = [];
      const rows = Array.isArray(status) ? status : [];
      for (const t of rows) {
        for (const o of t.orders || []) {
          if (o.is_open) flat.push({ trade: t, order: o });
        }
      }
      uiState.openOrderFlat = flat;
    }
    renderPendingSection();
    logAction(t("log.positionsOk"));
  } catch (err) {
    logAction(`${t("log.positionsFail")}: ${err.message}`);
  }
}

async function refreshLists() {
  try {
    const [w, b] = await Promise.all([apiCall("/whitelist"), apiCall("/blacklist")]);
    $("whitelist").textContent = JSON.stringify(w, null, 2);
    $("blacklist").textContent = JSON.stringify(b, null, 2);
  } catch (err) {
    logAction(`${t("log.listFail")}: ${err.message}`);
  }
}

async function refreshDataPanel() {
  if (uiState.dataPanelBusy) {
    uiState.dataPanelRefreshQueued = true;
    return;
  }
  uiState.dataPanelRefreshQueued = false;
  uiState.dataPanelBusy = true;
  uiState.dataRefreshToken += 1;
  const requestToken = uiState.dataRefreshToken;
  const { pair, timeframe, strategy, timerange } = getDataSelection();
  const historyUrl = `/pair_history?strategy=${encodeURIComponent(strategy)}&pair=${encodeURIComponent(pair)}&timeframe=${encodeURIComponent(timeframe)}&timerange=${encodeURIComponent(timerange)}`;
  try {
    const [strategies, pairs, history] = await Promise.all([
      fetchStrategiesForDataPanel(),
      apiCallSwallow("/available_pairs"),
      apiCallSwallow(historyUrl)
    ]);
    const pairsResult = pairs || { length: 0, pairs: [], pair_interval: [] };
    const historyResult =
      history && typeof history === "object"
        ? {
            ...history,
            data: Array.isArray(history.data) ? history.data : []
          }
        : {
            pair,
            timeframe,
            timerange,
            columns: [],
            data: []
          };
    const botMetaDegraded = pairs == null || history == null;
    let candles;
    let board = [];
    if (state.mockMode) {
      candles = await apiCall(`/pair_candles?pair=${encodeURIComponent(pair)}&timeframe=${encodeURIComponent(timeframe)}`);
      {
        const brd = await apiCallSwallow("/panel/binance_board");
        board = Array.isArray(brd?.board) ? brd.board : [];
      }
      updateDataSourceLabel("MOCK");
    } else {
      const symbol = pairToBinanceSymbol(pair);
      const interval = timeframeToBinanceInterval(timeframe);
      try {
        const fast = await fetchCandlesFastestAvailable({ pair, timeframe, symbol, interval });
        candles = fast.candles;
        updateDataSourceLabel(fast.label);
      } catch (e) {
        if (String(e?.message || e) === "DATA_PIN_HOLD") {
          const prev = uiState.dataCandles;
          const k = `${String(pair).trim()}\u001f${String(timeframe).trim()}`;
          const pk = `${String(prev?.pair || "").trim()}\u001f${String(prev?.timeframe || "").trim()}`;
          if (prev && Array.isArray(prev.data) && prev.data.length && pk === k) {
            candles = prev;
          } else {
            candles = { pair, timeframe, data: [] };
          }
        } else {
          candles = { pair, timeframe, data: [] };
          updateDataSourceLabel("NONE");
        }
      }
      // webserver 模式下 /pair_candles 不可用（503）；同页已请求的 /pair_history 可用，用其 OHLC 填图
      if (!candlesNonEmpty(candles) && historyResult?.columns?.length && Array.isArray(historyResult.data) && historyResult.data.length) {
        const fromHist = flattenCandlesData(historyResult);
        if (candlesNonEmpty(fromHist)) {
          candles = {
            pair: String(fromHist.pair || pair),
            timeframe: String(fromHist.timeframe || timeframe),
            data: fromHist.data
          };
          updateDataSourceLabel("PAIR_HISTORY");
        }
      }
      try {
        const bfast = await fetchBoardFastestAvailable();
        board = bfast.board;
        if (Array.isArray(board) && board.length) uiState.lastDataMarketBoard = board;
      } catch (e) {
        if (String(e?.message || e) === "DATA_PIN_HOLD") {
          board = Array.isArray(uiState.lastDataMarketBoard) ? uiState.lastDataMarketBoard : [];
        } else {
          board = [];
        }
      }
    }
    if (requestToken !== uiState.dataRefreshToken) return;
    uiState.dataPairs = pairsResult;
    uiState.dataCandles = candles;
    uiState.dataHistory = historyResult;
    uiState.selectedPair = candles?.pair || pair;
    setDataPair(candles?.pair || pair);
    setDataTimeframe(candles?.timeframe || timeframe);
    let profitEx = {};
    let activeStr = "";
    if (!state.mockMode) {
      const [scx, pfx] = await Promise.allSettled([apiCall("/show_config"), apiCall("/profit")]);
      if (scx.status === "fulfilled") activeStr = scx.value?.strategy || "";
      if (pfx.status === "fulfilled") profitEx = pfx.value || {};
    }
    renderDataStrategies(strategies, profitEx, activeStr);
    uiState.lastStrategiesResult = strategies;
    uiState.lastProfitSummary = profitEx;
    uiState.lastActiveStrategyName = activeStr;
    clearDataPanelErrors();
    renderDataHistoryPanel(pairsResult, historyResult, candles?.pair || "BTC/USD");
    renderDataKlineStripIfVisible(candles);
    renderDataMarketStripIfVisible(board);
    updateDataNetStatus(botMetaDegraded ? "RETRY" : "LIVE", botMetaDegraded ? 1 : 0);
  } catch (err) {
    if (requestToken !== uiState.dataRefreshToken) return;
    const fallbackPairs = uiState.dataPairs || { length: 0, pairs: [], pair_interval: [] };
    setDataPair(pair || uiState.selectedPair || "BTC/USD");
    setDataTimeframe(timeframe || uiState.selectedTimeframe || "5m");
    clearDataPanelErrors();
    if (state.mockMode) {
      const fallback = buildFallbackDataPanel(pair || "BTC/USD", timeframe || "5m");
      renderDataKlineStripIfVisible(fallback.candles);
      renderDataHistoryPanel(fallbackPairs, fallback.history, pair || "BTC/USD");
    } else {
      const selKeyCatch = `${String(pair || "BTC/USD").trim()}\u001f${String(timeframe || "5m").trim()}`;
      const curKeyCatch = `${String(uiState.dataCandles?.pair || "").trim()}\u001f${String(uiState.dataCandles?.timeframe || "").trim()}`;
      const keepCandles = uiState.dataCandles?.data?.length && curKeyCatch === selKeyCatch;
      if (keepCandles) {
        renderDataKlineStripIfVisible(uiState.dataCandles);
      } else {
        const symbol = pairToBinanceSymbol(pair || "BTC/USD");
        const interval = timeframeToBinanceInterval(timeframe || "5m");
        let degradedCandles = { pair, timeframe, data: [] };
        try {
          degradedCandles = await fetchLocalProxyKlines(symbol, interval);
          degradedCandles = { ...degradedCandles, pair: pair || degradedCandles.pair, timeframe: timeframe || degradedCandles.timeframe };
          updateDataSourceLabel("PROXY_BINANCE_DEGRADED");
        } catch {
          updateDataSourceLabel("NONE");
        }
        renderDataKlineStripIfVisible(degradedCandles);
      }
      renderDataHistoryPanel(fallbackPairs, uiState.dataHistory || { data: [] }, pair || "BTC/USD");
    }
    renderDataMarketStripIfVisible([]);
    prependDataPanelError(`${t("label.loadFailed")}: ${err.message}`);
    updateDataNetStatus("FALLBACK", Math.max(1, Number(err?.retries || 0)));
    if (state.mockMode) updateDataSourceLabel("MOCK");
  } finally {
    if (requestToken === uiState.dataRefreshToken) {
      uiState.dataPanelBusy = false;
    }
    if (uiState.dataPanelRefreshQueued) {
      uiState.dataPanelRefreshQueued = false;
      refreshDataPanel();
    }
  }
}

function bindEvents() {
  if (uiState.eventsBound) return;
  uiState.eventsBound = true;
  bindTopbarChrome();
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchSection(btn.dataset.section));
  });
  window.addEventListener("hashchange", () => {
    const id = decodeURIComponent((location.hash || "").replace(/^#/, "").trim());
    if (!id || !document.getElementById(id)?.classList.contains("section")) return;
    if (document.querySelector(".section.active")?.id === id) return;
    switchSection(id, { skipPersist: true });
    localStorage.setItem("ft_active_section", id);
  });
  $("savePanelBackend")?.addEventListener("click", () => void saveConfigAndRefreshData());
  $("langSwitch")?.addEventListener("change", (e) => {
    state.lang = e.target.value;
    localStorage.setItem("ft_lang", state.lang);
    applyI18n();
    renderEndpointTable();
  });
  bindLangQuickToggle();
  $("toggleMock")?.addEventListener("click", toggleMockMode);
  $("dataSourceBadge")?.addEventListener("click", toggleMockMode);
  $("daKlineModeLw")?.addEventListener("click", () => {
    persistPreferLightweightKline();
    uiState.lwLoadFailed = false;
    syncKlineModeToolbar();
    if (uiState.dataCandles) renderDataChartPanel(uiState.dataCandles);
  });
  $("daKlineModePanel")?.addEventListener("click", () => {
    persistPreferPanelKline(true);
    syncKlineModeToolbar();
    if (uiState.dataCandles) renderDataChartPanel(uiState.dataCandles);
  });
  $("daKlineModeSvg")?.addEventListener("click", () => {
    persistPreferSvgKline(true);
    syncKlineModeToolbar();
    if (uiState.dataCandles) renderDataChartPanel(uiState.dataCandles);
  });
  $("openSettings")?.addEventListener("click", () => switchSection("settings"));
  $("monitorRefreshBtn")?.addEventListener("click", () => void refreshOverview());
  $("addApiBinding")?.addEventListener("click", () => {
    openApiBindingModal(-1);
  });
  $("apiBindingsList")?.addEventListener("change", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || !el.classList.contains("binding-enabled-cb")) return;
    if (menuPermissionFor("settings") !== "edit") return;
    const idx = Number(el.getAttribute("data-binding-enabled"));
    if (!Number.isFinite(idx) || idx < 0 || idx >= state.apiBindings.length) return;
    const b = state.apiBindings[idx];
    b.enabled = el.checked;
    if (!el.checked && b.bindToBot) b.bindToBot = false;
    persistApiBindingsLocalSnapshot(state.apiBindings);
    renderApiBindings();
    void persistPanelPreferences({
      forceFullProfileSync: true,
      forceIncludeApiBindings: true
    });
  });
  $("apiBindingsList")?.addEventListener("click", (e) => {
    const editBtn = e.target.closest("[data-binding-edit]");
    if (editBtn) {
      const idx = Number(editBtn.getAttribute("data-binding-edit"));
      openApiBindingModal(idx);
      return;
    }
    const btn = e.target.closest("[data-binding-remove]");
    if (!btn) return;
    const idx = Number(btn.getAttribute("data-binding-remove"));
    state.apiBindings.splice(idx, 1);
    if (!state.apiBindings.length) state.apiBindings = [{ ...DEFAULT_API_BINDING }];
    persistApiBindingsLocalSnapshot(state.apiBindings);
    renderApiBindings();
    void persistPanelPreferences({
      forceFullProfileSync: true,
      forceIncludeApiBindings: true
    });
  });
  $("closeApiBindingModal")?.addEventListener("click", closeApiBindingModal);
  $("btnLlmProbe")?.addEventListener("click", () => void probeLlmFromBindingModal());
  $("saveApiBindingModal")?.addEventListener("click", () => void saveApiBindingFromModal());
  $("apiBindingModal")?.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-mask")) closeApiBindingModal();
  });
  document.querySelectorAll(".settings-dual-tab").forEach((btn) => {
    btn.addEventListener("click", () => setSettingsTab(btn.getAttribute("data-settings-tab") || "integrations"));
  });
  $("addPanelUserBtn")?.addEventListener("click", () => {
    if (menuPermissionFor("settings") !== "edit") return;
    openPanelUserModal("create", null);
  });
  $("closePanelUserModal")?.addEventListener("click", closePanelUserModal);
  $("savePanelUserModal")?.addEventListener("click", () => void savePanelUserFromModal());
  $("panelUserModal")?.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-mask")) closePanelUserModal();
  });
  $("panelUsersList")?.addEventListener("click", (e) => {
    const ed = e.target.closest("[data-panel-user-edit]");
    if (ed) {
      const idStr = safeDataIdAttr(ed.getAttribute("data-panel-user-edit"));
      if (!idStr) return;
      const id = Number(idStr);
      const user = panelUsersListCache.find((x) => x.id === id);
      if (user) openPanelUserModal("edit", user);
      return;
    }
    const del = e.target.closest("[data-panel-user-del]");
    if (!del) return;
    const idStr = safeDataIdAttr(del.getAttribute("data-panel-user-del"));
    if (!idStr) return;
    const id = Number(idStr);
    void (async () => {
      if (!window.confirm(t("users.confirmDelete"))) return;
      try {
        const r = await apiCall(`/panel/users/${id}`, "DELETE");
        if (r && r.ok === false) {
          logAction(t("users.lastUserError"));
          return;
        }
        await renderPanelUsersListLoaded();
      } catch (err) {
        if (/\b400\b/.test(String(err.message))) logAction(t("users.lastUserError"));
        else logAction(err.message || String(err));
      }
    })();
  });
  $("newManualStrategyBtn")?.addEventListener("click", () => openStrategyMemoModal(null));
  $("settingsPanelStrategy")?.addEventListener("click", (e) => {
    const delBtn = e.target.closest("[data-strategy-entry-remove]");
    if (delBtn) {
      if (menuPermissionFor("settings") !== "edit") return;
      e.preventDefault();
      e.stopPropagation();
      const rid = delBtn.getAttribute("data-strategy-entry-remove");
      if (rid) removeStrategyEntryById(rid);
      return;
    }
    const editBtn = e.target.closest("[data-strategy-entry-edit]");
    if (editBtn) {
      if (menuPermissionFor("settings") !== "edit") return;
      e.preventDefault();
      e.stopPropagation();
      const id = editBtn.getAttribute("data-strategy-entry-edit");
      if (id) openStrategyMemoModal(id);
      return;
    }
    const row = e.target.closest("[data-strategy-entry-row]");
    if (row && menuPermissionFor("settings") === "edit") {
      const id = row.getAttribute("data-strategy-entry-row");
      if (id) openStrategyMemoModal(id);
    }
  });
  $("settingsPanelStrategy")?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (e.target.closest("button")) return;
    const row = e.target.closest("[data-strategy-entry-row].strategy-entry-row--editable");
    if (!row) return;
    e.preventDefault();
    if (menuPermissionFor("settings") !== "edit") return;
    const id = row.getAttribute("data-strategy-entry-row");
    if (id) openStrategyMemoModal(id);
  });
  $("btnSyncConfigAndStart")?.addEventListener("click", async () => {
    try {
      const entries = normalizeStrategyEntries(state.strategyEntries);
      const paperPrimary = Boolean(entries[0]?.paperTrading);
      if (
        !paperPrimary &&
        !panelBotTradingApisAvailable(
          getLiveShowConfigForControl(),
          uiState.lastProxyHealth,
          uiState.lastHealth
        )
      ) {
        logAction(t("sc.tradeMode.syncStartBlocked"));
        return;
      }
      await persistPanelPreferences({
        forceFullProfileSync: true,
        forceIncludeApiBindings: true
      });
      if (paperPrimary) {
        logAction(t("log.syncStartPaperSkipped"));
        refreshControlStrategyConfig();
        rerenderControlHeroAndCards();
        return;
      }
      const r = await apiCall("/start", "POST");
      logAction(`${t("log.syncStart")} ${JSON.stringify(r)}`);
      refreshControlStrategyConfig();
    } catch (e) {
      logAction(friendlyBotControlApiError(e));
    }
  });
  $("btnSyncConfigOnly")?.addEventListener("click", async () => {
    try {
      await persistPanelPreferences({
        forceFullProfileSync: true,
        forceIncludeApiBindings: true
      });
      logAction(t("log.configUpdated"));
      refreshControlStrategyConfig();
    } catch (e) {
      logAction(e.message);
    }
  });
  $("closeStrategyMemoModal")?.addEventListener("click", () => closeStrategyMemoModal());
  $("saveStrategyMemoModal")?.addEventListener("click", () => void saveStrategyMemoFromModal());
  $("strategyMemoModal")?.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-mask")) closeStrategyMemoModal();
  });
  $("closeStrategySlotModal")?.addEventListener("click", () => closeStrategySlotModal());
  $("saveStrategySlotModal")?.addEventListener("click", () => void saveStrategySlotFromModal());
  $("mStrategySlotNameSelect")?.addEventListener("change", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLSelectElement)) return;
    applyStrategySlotFieldsFromState(el.value);
  });
  $("strategySlotModal")?.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-mask")) closeStrategySlotModal();
  });
  $("logoutBtn")?.addEventListener("click", logout);
  $("logsPrev")?.addEventListener("click", () => {
    if (uiState.logsPage > 1) {
      uiState.logsPage -= 1;
      refreshOverview();
    }
  });
  $("logsNext")?.addEventListener("click", () => {
    if (uiState.logsPage < uiState.logsTotalPages) {
      uiState.logsPage += 1;
      refreshOverview();
    }
  });
  $("statusPrev")?.addEventListener("click", () => {
    if (uiState.positionsPage > 1) {
      uiState.positionsPage -= 1;
      renderStatusRows(uiState.positionsRows);
    }
  });
  $("statusNext")?.addEventListener("click", () => {
    if (uiState.positionsPage < uiState.positionsTotalPages) {
      uiState.positionsPage += 1;
      renderStatusRows(uiState.positionsRows);
    }
  });
  $("pendingPrev")?.addEventListener("click", () => {
    if (uiState.pendingPage > 1) {
      uiState.pendingPage -= 1;
      if (state.mockMode) renderTradesRows(uiState.mockTradesPayload);
      else renderOpenOrdersRows(uiState.openOrderFlat);
    }
  });
  $("pendingNext")?.addEventListener("click", () => {
    if (uiState.pendingPage < uiState.pendingTotalPages) {
      uiState.pendingPage += 1;
      if (state.mockMode) renderTradesRows(uiState.mockTradesPayload);
      else renderOpenOrdersRows(uiState.openOrderFlat);
    }
  });

  if (!uiState.tradeActionDelegation) {
    uiState.tradeActionDelegation = true;
    $("appRoot")?.addEventListener("click", async (e) => {
      const closeBtn = e.target.closest("[data-close-trade]");
      if (closeBtn) {
        e.preventDefault();
        const id = safeDataIdAttr(closeBtn.getAttribute("data-close-trade"));
        if (!id) return;
        try {
          await apiCall("/forceexit", "POST", { tradeid: id });
          logAction(`forceexit ${id}`);
          refreshPositions();
        } catch (err) {
          logAction(err.message);
        }
        return;
      }
      const cancelOB = e.target.closest("[data-cancel-open-order]");
      if (cancelOB) {
        e.preventDefault();
        const tid = safeDataIdAttr(cancelOB.getAttribute("data-cancel-open-order"));
        if (!tid) return;
        try {
          await apiCall(`/trades/${encodeURIComponent(tid)}/open-order`, "DELETE");
          logAction(`cancel open order trade ${tid}`);
          refreshPositions();
        } catch (err) {
          logAction(err.message);
        }
      }
    });
  }

  $("daTuneBtn")?.addEventListener("click", () => {
    uiState.tuneStep = ((uiState.tuneStep || 0) + 1) % 5;
    const s = uiState.tuneStep;
    const svgOn = s === 4;
    persistPreferSvgKline(svgOn);
    if (svgOn) {
      uiState.showEMA = true;
      uiState.showBOLL = false;
      logAction(t("log.tuneLocalSvg"));
    } else {
      uiState.showEMA = s === 1 || s === 3;
      uiState.showBOLL = s === 2 || s === 3;
      logAction(
        `${t("log.tune")} ${s + 1}/5: EMA ${uiState.showEMA ? t("label.on") : t("label.off")}, BOLL ${uiState.showBOLL ? t("label.on") : t("label.off")}`
      );
    }
    if (uiState.dataCandles) renderDataKlineStripIfVisible(uiState.dataCandles);
  });
  $("scFeedAuditBtn")?.addEventListener("click", () => {
    switchSection("overview");
    logAction(t("log.logsHint"));
  });

  if (!uiState.controlConsoleDelegation) {
    uiState.controlConsoleDelegation = true;
    $("appRoot")?.addEventListener("click", async (e) => {
      const cardsRoot = $("controlStrategyCards");
      const slotBtn =
        cardsRoot && cardsRoot.contains(e.target)
          ? e.target.closest("[data-strategy-slot-edit]")
          : null;
      if (slotBtn && canEditStrategySlots()) {
        e.preventDefault();
        const n = slotBtn.getAttribute("data-strategy-slot-edit");
        if (n) openStrategySlotModal(n);
        return;
      }
      const act =
        cardsRoot && cardsRoot.contains(e.target) ? e.target.closest(".action-btn") : null;
      if (act && !act.disabled) {
        const method = act.getAttribute("data-method");
        const endpoint = act.getAttribute("data-endpoint");
        if (method && endpoint) {
          e.preventDefault();
          const cardBase = strategyCardApiBaseFromClickTarget(act);
          try {
            const result = cardBase
              ? await apiCallAtBase(cardBase, endpoint, method)
              : await apiCall(endpoint, method);
            logAction(`${method} ${endpoint}${cardBase ? ` @ ${cardBase}` : ""} => ${JSON.stringify(result)}`);
          } catch (err) {
            logAction(friendlyBotControlApiError(err));
          }
          return;
        }
      }
      const fx =
        cardsRoot && cardsRoot.contains(e.target)
          ? e.target.closest("[data-control-force-exit]")
          : null;
      if (fx && !fx.disabled) {
        e.preventDefault();
        const tradeIdInput = $("forceExitTradeId");
        if (!tradeIdInput) return;
        const payload = { tradeid: tradeIdInput.value };
        const cardBase = strategyCardApiBaseFromClickTarget(fx);
        try {
          const result = cardBase
            ? await apiCallAtBase(cardBase, "/forceexit", "POST", payload)
            : await apiCall("/forceexit", "POST", payload);
          logAction(`forceexit${cardBase ? ` @ ${cardBase}` : ""} => ${JSON.stringify(result)}`);
        } catch (err) {
          logAction(friendlyBotControlApiError(err));
        }
        return;
      }
    });
  }

  $("forceEnter")?.addEventListener("click", async () => {
    const forcePair = $("forcePair");
    const forceSide = $("forceSide");
    if (!forcePair || !forceSide) return;
    const payload = { pair: forcePair.value, side: forceSide.value };
    try {
      const result = await apiCall("/forceenter", "POST", payload);
      logAction(`forceenter => ${JSON.stringify(result)}`);
    } catch (err) {
      logAction(err.message);
    }
  });

  $("loadLists")?.addEventListener("click", refreshLists);

  $("addBlacklist")?.addEventListener("click", async () => {
    const blacklistPair = $("blacklistPair");
    if (!blacklistPair) return;
    const pair = blacklistPair.value.trim();
    if (!pair) return;
    try {
      const result = await apiCall("/blacklist", "POST", { blacklist: [pair] });
      logAction(`blacklist add => ${JSON.stringify(result)}`);
      refreshLists();
    } catch (err) {
      logAction(err.message);
    }
  });

  $("exportHistoryCsv")?.addEventListener("click", exportPairHistoryCsv);

  $("loadPairs")?.addEventListener("click", async () => {
    try {
      clearDataPanelErrors();
      const result = await apiCall("/available_pairs");
      uiState.dataPairs = result;
      renderDataHistoryPanel(result, uiState.dataHistory, uiState.dataCandles?.pair || $("historyPair")?.value || "BTC/USD");
      updateDataNetStatus("LIVE", 0);
    } catch (err) {
      prependDataPanelError(err.message);
      updateDataNetStatus("FALLBACK", 1);
    }
  });

  $("daPairButtons")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-pair]");
    if (!btn) return;
    const pair = btn.getAttribute("data-pair");
    if (!pair) return;
    setDataPair(pair);
    refreshDataPanel();
  });

  $("daTfButtons")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tf]");
    if (!btn) return;
    const tf = btn.getAttribute("data-tf");
    if (!tf) return;
    setDataTimeframe(tf);
    refreshDataPanel();
  });

  $("daMarketBoard")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-market-pair]");
    if (!btn) return;
    const pair = btn.getAttribute("data-market-pair");
    if (!pair) return;
    setDataPair(pair);
    refreshDataPanel();
  });

  $("loadPairHistory")?.addEventListener("click", async () => {
    const strategyInput = $("historyStrategy");
    const pairInput = $("historyPair");
    const tfInput = $("historyTf");
    const rangeInput = $("historyRange");
    if (!strategyInput || !pairInput || !tfInput || !rangeInput) return;
    const strategy = strategyInput.value;
    const pair = pairInput.value;
    const timeframe = tfInput.value;
    const timerange = rangeInput.value;
    setDataPair(pair || uiState.selectedPair || "BTC/USD");
    setDataTimeframe(timeframe || uiState.selectedTimeframe || "5m");
    clearDataPanelErrors();
    try {
      const candles = await apiCall(`/pair_candles?pair=${encodeURIComponent(pair)}&timeframe=${encodeURIComponent(timeframe)}`);
      const history = await apiCall(`/pair_history?strategy=${encodeURIComponent(strategy)}&pair=${encodeURIComponent(pair)}&timeframe=${encodeURIComponent(timeframe)}&timerange=${encodeURIComponent(timerange)}`);
      uiState.dataCandles = candles;
      uiState.dataHistory = history;
      setDataPair(candles?.pair || pair);
      setDataTimeframe(candles?.timeframe || timeframe);
      renderDataKlineStripIfVisible(candles);
      renderDataHistoryPanel(uiState.dataPairs || { length: 0, pairs: [], pair_interval: [] }, history, pair);
      updateDataNetStatus("LIVE", 0);
    } catch (err) {
      const fallback = buildFallbackDataPanel(pair || "BTC/USD", timeframe || "5m");
      renderDataKlineStripIfVisible(fallback.candles);
      renderDataHistoryPanel(uiState.dataPairs || { length: 0, pairs: [], pair_interval: [] }, fallback.history, pair || "BTC/USD");
      prependDataPanelError(err.message);
      updateDataNetStatus("FALLBACK", 1);
    }
  });

  $("availablePairs")?.addEventListener("click", (e) => {
    if (e.target.closest("[data-history-prev]")) {
      if (uiState.historyLogsPage > 1) {
        uiState.historyLogsPage -= 1;
        renderDataHistoryPanel(uiState.dataPairs || { length: 0, pairs: [], pair_interval: [] }, uiState.dataHistory, uiState.selectedPair || "BTC/USD");
      }
      return;
    }
    if (e.target.closest("[data-history-next]")) {
      if (uiState.historyLogsPage < uiState.historyLogsTotalPages) {
        uiState.historyLogsPage += 1;
        renderDataHistoryPanel(uiState.dataPairs || { length: 0, pairs: [], pair_interval: [] }, uiState.dataHistory, uiState.selectedPair || "BTC/USD");
      }
    }
  });

  document.querySelector("#data .da-chart-body")?.addEventListener("click", (e) => {
    if (!e.target.closest("[data-kline-retry]")) return;
    retryKlineRenderer();
  });
}

function bindAuthEvents() {
  $("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = $("loginUsername")?.value?.trim() || "";
    const password = $("loginPassword")?.value || "";
    try {
      await login(username, password);
    } catch (err) {
      const msg = String(err?.message || err);
      const el = $("loginError");
      if (el) el.textContent = msg || t("login.error");
    }
  });
}

function refreshRpcPushBadge() {
  const el = $("rpcLiveBadge");
  if (!el) return;
  if (!uiState.authed || state.mockMode) {
    el.classList.add("hidden");
    el.title = "";
    el.removeAttribute("data-state");
    return;
  }
  el.classList.remove("hidden");
  const hasTok = Boolean(String(state.wsToken || "").trim());
  if (!hasTok) {
    el.dataset.state = "poll";
    el.textContent = t("live.rpcPolling");
    el.title = t("live.rpcBadgeTitleNoToken");
    return;
  }
  if (uiState.rpcWsConnected) {
    el.dataset.state = "on";
    el.textContent = t("live.rpcBadge");
    el.title = t("live.rpcBadgeTitleOn");
    return;
  }
  el.dataset.state = "off";
  el.textContent = t("live.rpcReconnecting");
  el.title = t("live.rpcBadgeTitleWsDown");
}

function stopRpcMessageStream() {
  rpcWsSession = null;
  if (rpcWsClient) {
    rpcWsClient.stop();
    rpcWsClient = null;
  }
  uiState.rpcWsConnected = false;
  refreshRpcPushBadge();
}

function handleBovinWsMessage(msg) {
  const type = msg?.type;
  if (!type || type === "analyzed_df") return;
  if (!uiState.authed || state.mockMode) return;
  if (document.visibilityState === "hidden") return;
  if (type === "new_candle") {
    if (wsPushDebounceTimerCandle) clearTimeout(wsPushDebounceTimerCandle);
    wsPushDebounceTimerCandle = setTimeout(() => {
      wsPushDebounceTimerCandle = null;
      if (isDataSectionActive()) void refreshDataRealtime();
    }, 450);
    return;
  }
  if (wsPushDebounceTimer) clearTimeout(wsPushDebounceTimer);
  wsPushDebounceTimer = setTimeout(() => {
    wsPushDebounceTimer = null;
    void refreshPositions();
    void refreshOverview();
  }, 400);
}

function startRpcMessageStream() {
  stopRpcMessageStream();
  if (!uiState.authed || state.mockMode) return;
  if (!String(state.wsToken || "").trim()) {
    refreshRpcPushBadge();
    return;
  }
  refreshRpcPushBadge();
  const session = Symbol("rpcWs");
  rpcWsSession = session;
  rpcWsClient = createBovinMessageWsClient({
    getUrl: () => {
      if (!uiState.authed || state.mockMode) return null;
      const tok = String(state.wsToken || "").trim();
      if (!tok) return null;
      return buildMessageWsUrl(effectiveWsApiV1Base(), tok);
    },
    onOpen: () => {
      if (rpcWsSession !== session) return;
      uiState.rpcWsConnected = true;
      refreshRpcPushBadge();
      if (autoRefreshArmed) armPollingIntervals();
    },
    onClose: () => {
      if (rpcWsSession !== session) return;
      uiState.rpcWsConnected = false;
      refreshRpcPushBadge();
      if (autoRefreshArmed) armPollingIntervals();
    },
    onError: () => {},
    onMessage: handleBovinWsMessage,
    onSkip: () => refreshRpcPushBadge()
  });
  rpcWsClient.start();
}

function armPollingIntervals() {
  while (refreshTimers.length) {
    clearInterval(refreshTimers.pop());
  }
  if (!autoRefreshArmed || !uiState.authed || document.visibilityState === "hidden") return;
  const ovMs = uiState.rpcWsConnected ? POLL_OVERVIEW_WS_MS : POLL_OVERVIEW_MS;
  const posMs = uiState.rpcWsConnected ? POLL_POSITIONS_WS_MS : POLL_POSITIONS_MS;
  refreshTimers.push(setInterval(refreshOverview, ovMs));
  refreshTimers.push(setInterval(refreshPositions, posMs));
  refreshTimers.push(setInterval(() => void runDataPanelLatencyProbe(), DATA_SOURCE_PROBE_INTERVAL_MS));
  syncDataRealtimePollingForSection(getActiveSectionId());
}

function startAutoRefresh() {
  if (!uiState.authed || autoRefreshArmed) return;
  if (document.visibilityState === "hidden") return;
  autoRefreshArmed = true;
  refreshOverview();
  refreshPositions();
  refreshLists();
  /** 登录后预拉 K 线/历史（写入 uiState）；图表仅在「数据」分区可见时绘制，避免 0 宽初始化。 */
  void refreshDataPanel();
  if (isDataSectionActive()) {
    void refreshDataRealtime();
  }
  armPollingIntervals();
  startRpcMessageStream();
}

async function beginAuthedSession() {
  await loadPanelPreferences();
  if (!state.mockMode) {
    await probeLocalProxyAndSetCircuit();
    void runDataPanelLatencyProbe();
  }
  await renderPanelUsersListLoaded();
  if (state.mockMode) restoreMockOverviewDecor();
  refreshMenuPermissionUi();
  startAutoRefresh();
}

function stopAutoRefresh() {
  stopRpcMessageStream();
  stopDataRealtimeInterval();
  while (refreshTimers.length) {
    clearInterval(refreshTimers.pop());
  }
  autoRefreshArmed = false;
}

async function init() {
  document.documentElement.dataset.panelVersion = PANEL_VERSION;
  document.querySelector('meta[name="panel-version"]')?.setAttribute("content", PANEL_VERSION);
  const verEl = $("appVersionLabel");
  if (verEl) verEl.textContent = PANEL_VERSION_LABEL;
  hydrateThemeFromStorage();
  applyTheme();
  scrubLegacyLocalStorageBindingSecrets();
  scrubLegacyFlatExchangeKeysFromLocalStorage();
  document.addEventListener("visibilitychange", () => {
    if (!uiState.authed) return;
    if (document.visibilityState === "hidden") {
      stopAutoRefresh();
    } else if (autoRefreshArmed) {
      armPollingIntervals();
      startRpcMessageStream();
    } else {
      startAutoRefresh();
    }
  });
  mountEnvHintBanner();
  bindAuthEvents();
  bindLangQuickToggle();
  fixStalePanelAuthState();
  await tryJwtBootstrapFromRefresh();
  consumeStaleLoginHint();
  applyAuthView();
  if (!uiState.authed) {
    applyI18n();
    prefillDefaultLoginFields();
    return;
  }
  applyI18n();
  renderEndpointTable();
  bindEvents();
  if (readPreferPanelKlineFromStorage()) {
    uiState.preferPanelKline = true;
    uiState.preferSvgKline = false;
  } else if (readPreferSvgKlineFromStorage()) {
    uiState.preferSvgKline = true;
    uiState.preferPanelKline = false;
    uiState.tuneStep = 4;
  }
  syncKlineModeToolbar();
  setDataPair($("historyPair")?.value?.trim() || "BTC/USD");
  setDataTimeframe($("historyTf")?.value?.trim() || "5m");
  syncInitialActiveSection();
  updateDataNetStatus("LIVE", 0);
  updateDataSourceLabel("NONE");
  setConfigInputs();
  await beginAuthedSession();
  setConfigInputs();
}

void init();
