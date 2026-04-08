import { i18n } from "../i18n/index.js";
import {
  state,
  uiState,
  normalizeStrategyEntries,
  getNormalizedControlTradesFeedLimit,
} from "../store/state-core.js";
import { normalizeUserRestApiV1Base } from "../api/config.js";
import { getTradesFeed } from "../api/positions.js";
import { escapeHtml } from "../utils/html-utils.js";
import { pairsFromBlacklistPayload, pairsFromWhitelistPayload } from "../utils/pairlist-parse.js";

function t(key) {
  return i18n[state.lang]?.[key] || i18n["zh-CN"]?.[key] || key;
}

const $ = (id) => document.getElementById(id);

/** 策略卡操作按钮图标（不依赖 Material Symbols 字体，避免回退成英文 ligature 文本） */
function actionIconSvg(kind) {
  const wrap = (inner) =>
    `<span class="sc-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor" focusable="false">${inner}</svg></span>`;
  if (kind === "pause") {
    return wrap('<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>');
  }
  if (kind === "stop") {
    return wrap('<path d="M6 6h12v12H6V6z"/>');
  }
  if (kind === "play") {
    return wrap('<path d="M8 5v14l11-7L8 5z"/>');
  }
  return "";
}

function alertIconSvg(kind) {
  if (kind === "warning") {
    return `<span class="anticon sc-alert-anticon" aria-hidden="true"><svg viewBox="64 64 896 896" focusable="false"><path fill="currentColor" d="M511.5 175.6a35.31 35.31 0 0 1 61 0l353.4 611.9c13.7 23.8-3.4 53.5-30.5 53.5H158.6c-27.1 0-44.2-29.7-30.5-53.5l353.4-611.9zM512 406c-22.1 0-40 17.9-40 40v176c0 22.1 17.9 40 40 40s40-17.9 40-40V446c0-22.1-17.9-40-40-40zm0 364a48 48 0 1 0 0-96 48 48 0 0 0 0 96z"></path></svg></span>`;
  }
  if (kind === "info") {
    return `<span class="anticon sc-alert-anticon" aria-hidden="true"><svg viewBox="64 64 896 896" focusable="false"><path fill="currentColor" d="M512 140a372 372 0 1 0 0 744 372 372 0 0 0 0-744zm0 664a292 292 0 1 1 0-584 292 292 0 0 1 0 584zm-36-414a36 36 0 1 0 72 0 36 36 0 0 0-72 0zm76 334h-80V470h80v254z"></path></svg></span>`;
  }
  if (kind === "swap") {
    return `<span class="anticon sc-alert-anticon" aria-hidden="true"><svg viewBox="64 64 896 896" focusable="false"><path fill="currentColor" d="M848 504H280.8l67.6-67.6a40 40 0 0 0-56.6-56.6l-136 136a40 40 0 0 0 0 56.6l136 136a40 40 0 1 0 56.6-56.6L280.8 584H848a40 40 0 1 0 0-80zM176 440h567.2l-67.6 67.6a40 40 0 1 0 56.6 56.6l136-136a40 40 0 0 0 0-56.6l-136-136a40 40 0 1 0-56.6 56.6l67.6 67.6H176a40 40 0 1 0 0 80z"></path></svg></span>`;
  }
  if (kind === "hidden") {
    return `<span class="anticon sc-alert-anticon" aria-hidden="true"><svg viewBox="64 64 896 896" focusable="false"><path fill="currentColor" d="M942.2 486.2C847.6 346.5 694.9 256 512 256c-53.4 0-104.3 7.8-151.9 22.2l62.6 62.6A373 373 0 0 1 512 332c149.5 0 277.8 79.4 353.8 180-32.6 43.1-72 81.8-116.6 113.6l54.7 54.7c55.3-39.5 103.8-88.2 138.3-148.1a40 40 0 0 0 0-45.8zM130.8 181.1l97.7 97.7C156.4 330 96.7 411.9 81.8 486.2a40 40 0 0 0 0 45.8C176.4 671.7 329.1 762.2 512 762.2c82 0 157.8-18.3 225.2-51.7l106 106a38 38 0 0 0 53.7-53.7L184.5 127.4a38 38 0 0 0-53.7 53.7zm289.7 289.7 122.7 122.7A84 84 0 0 1 512 600c-48.6 0-88-39.4-88-88 0-11.2 2.1-21.9 6.5-31.2z"></path></svg></span>`;
  }
  return "";
}

function resolveBotStartUnixSec(health, profit) {
  const h = health && typeof health === "object" ? health : {};
  const p = profit && typeof profit === "object" ? profit : {};
  const ts = h.bot_startup_ts ?? h.bot_start_ts ?? p.bot_start_timestamp ?? null;
  return typeof ts === "number" && ts > 0 ? ts : null;
}

/**
 * Annual return estimate from live stats (no hardcoded rate):
 * 1) GET /profit cagr when meaningful
 * 2) Compound-annualize profit_all_ratio over first_trade→latest (or bot start→now)
 * 3) Compound daily rel_profit over the /daily window, scaled to 365 days
 */
export function computeEstimatedAnnualReturn(profit, dailyPayload, health) {
  const p = profit && typeof profit === "object" ? profit : {};
  const tc = Number(p.trade_count ?? p.closed_trade_count ?? 0);
  const cagr = Number(p.cagr);
  if (Number.isFinite(cagr) && (tc > 0 || cagr !== 0)) {
    return cagr;
  }

  const ratio = Number(p.profit_all_ratio);
  const nowSec = Math.floor(Date.now() / 1000);
  const firstTs = Number(p.first_trade_timestamp);
  const latestTs = Number(p.latest_trade_timestamp);
  const botStart = resolveBotStartUnixSec(health, p);
  const startSec = firstTs > 0 ? firstTs : botStart;
  const endSec = latestTs > 0 ? Math.max(latestTs, nowSec) : nowSec;
  if (startSec != null && startSec > 0 && endSec > startSec && Number.isFinite(ratio)) {
    const years = (endSec - startSec) / (365.25 * 86400);
    if (years >= 1 / 365.25) {
      const base = 1 + ratio;
      if (base > 0) {
        const ann = base ** (1 / years) - 1;
        if (Number.isFinite(ann)) return ann;
      }
    }
  }

  const rows = Array.isArray(dailyPayload?.data) ? dailyPayload.data : [];
  if (rows.length > 0) {
    let prod = 1;
    let k = 0;
    for (const r of rows) {
      const rp = Number(r.rel_profit);
      if (!Number.isFinite(rp)) continue;
      prod *= 1 + rp;
      k += 1;
    }
    if (k > 0 && prod > 0) {
      const ann = prod ** (365 / k) - 1;
      if (Number.isFinite(ann)) return ann;
    }
  }

  if (Number.isFinite(cagr)) return cagr;
  return null;
}

function formatAnnualReturnLabel(annual) {
  if (!Number.isFinite(annual)) return { text: t("monitor.cagr.na"), cls: "" };
  const pct = annual * 100;
  const text = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
  const cls = pct < 0 ? "negative" : "positive";
  return { text, cls };
}

export function normalizeBotState(raw) {
  const s = String(raw || "").toLowerCase();
  if (s === "running") return "running";
  if (s === "paused") return "paused";
  if (s === "stopped") return "stopped";
  if (s.includes("reload")) return "reload";
  return s || "stopped";
}

/**
 * show_config 仍为 webserver，但 GET /api/v1/health 已由 binance_proxy 转发到交易进程并成功时，
 * 说明 /start、/pause 等同样会走交易副上游（无需依赖代理根路径 GET /health 是否被面板拉取到）。
 */
function healthIndicatesTradeProcessRelay(botHealth) {
  const h = botHealth && typeof botHealth === "object" ? botHealth : {};
  const tsOk = (k) => {
    const v = Number(h[k]);
    return Number.isFinite(v) && v > 0;
  };
  if (tsOk("last_process_ts") || tsOk("bot_startup_ts") || tsOk("bot_start_ts")) return true;
  const lp = h.last_process;
  if (typeof lp === "string" && lp.trim()) return true;
  return false;
}

/**
 * Bot-control routes (/start, /pause, …) exist on bovin trade (dry_run/live), not on webserver.
 * When using binance_proxy with BOVIN_TRADE_UPSTREAM, GET /health on the proxy exposes
 * `bovin_trade_upstream` — then trading calls are routed to the trade process while /show_config
 * may still come from webserver.
 */
export function panelBotTradingApisAvailable(showConfig, proxyHealth, botHealth) {
  if (state.mockMode) return true;
  const rm = String(showConfig?.runmode || "").toLowerCase();
  if (rm === "live" || rm === "dry_run") return true;
  const ph = proxyHealth && typeof proxyHealth === "object" ? proxyHealth : {};
  const tu = String(ph.bovin_trade_upstream || ph.freqtrade_trade_upstream || "").trim();
  if (tu) return true;
  if (rm === "webserver" && healthIndicatesTradeProcessRelay(botHealth)) return true;
  return false;
}

function runmodeNonTradingBannerHtml(showConfig, proxyHealth, botHealth) {
  if (panelBotTradingApisAvailable(showConfig, proxyHealth, botHealth)) return "";
  return `<article class="sc-card sc-card-alert" role="status"><div class="sc-alert sc-alert--stack">
      ${alertIconSvg("warning")}
      <div class="sc-alert-text"><span>${escapeHtml(t("sc.tradeMode.bannerTitle"))}</span>
      <p class="muted sc-alert-sub">${escapeHtml(t("sc.tradeMode.bannerBody"))}</p></div>
    </div></article>`;
}

/** show_config 为 webserver，但本地代理已将交易 API 转发至 bovin trade 时提示（避免误以为仍不可控）。 */
function webserverTradeRelayInfoHtml(showConfig, proxyHealth, botHealth) {
  const rm = String(showConfig?.runmode || "").toLowerCase();
  if (rm !== "webserver" || !panelBotTradingApisAvailable(showConfig, proxyHealth, botHealth)) return "";
  const ph = proxyHealth && typeof proxyHealth === "object" ? proxyHealth : {};
  const tu = String(ph.bovin_trade_upstream || ph.freqtrade_trade_upstream || "").trim();
  const sub = escapeHtml(
    tu
      ? t("sc.tradeMode.splitRelayBody").replace("{url}", tu)
      : t("sc.tradeMode.splitRelayBodyImplicit")
  );
  return `<article class="sc-card sc-card--info-soft" role="status"><div class="sc-alert sc-alert--stack">
      ${alertIconSvg("swap")}
      <div class="sc-alert-text"><span>${escapeHtml(t("sc.tradeMode.splitRelayTitle"))}</span>
      <p class="muted sc-alert-sub mono">${sub}</p></div>
    </div></article>`;
}

function labelBotState(raw) {
  const n = normalizeBotState(raw);
  if (n === "running") return t("freq.state.running");
  if (n === "stopped") return t("freq.state.stopped");
  if (n === "paused") return t("freq.state.paused");
  if (n === "reload") return t("freq.state.reload");
  const z = String(raw || "").trim();
  return z ? `${t("freq.state.other")}: ${z}` : "—";
}

export function orderedStrategyNames(panelList, activeName, settingsStrategyName, manualNames) {
  const manual = Array.isArray(manualNames)
    ? manualNames.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  const seen = new Set();
  const names = [];
  for (const n of manual) {
    if (seen.has(n)) continue;
    seen.add(n);
    names.push(n);
  }
  if (Array.isArray(panelList)) {
    for (const x of panelList) {
      const n = String(x || "").trim();
      if (!n || seen.has(n)) continue;
      seen.add(n);
      names.push(n);
    }
  }
  const a = String(activeName || "").trim();
  const s = String(settingsStrategyName || "").trim();
  if (a && !seen.has(a)) {
    names.unshift(a);
    seen.add(a);
  }
  if (s && !seen.has(s)) {
    names.push(s);
    seen.add(s);
  }
  const uniq = [...new Set(names.map((x) => String(x || "").trim()).filter(Boolean))];
  if (!uniq.length && a) uniq.push(a);
  if (!uniq.length && s) uniq.push(s);
  uniq.sort((x, y) => {
    if (x === a) return -1;
    if (y === a) return 1;
    return x.localeCompare(y);
  });
  return uniq;
}

function panelEntryForStrategy(className) {
  const n = String(className || "").trim();
  const list = normalizeStrategyEntries(state.strategyEntries);
  return list.find((e) => String(e.strategyName || "").trim() === n) || null;
}

/**
 * 控制台「面板策略配置」摘要：与策略卡 KPI / 纸质交易 / 规则文本同源
 *（优先当前机器人 config 策略类名，再回退设置中的策略名与全局 state）。
 */
export function resolvePanelConfigSummary(showConfigStrategy, settingsStrategyName) {
  const active = String(showConfigStrategy || "").trim();
  const settings = String(settingsStrategyName || "").trim();
  const cardName = active || settings;
  const displayStrategyName = cardName || "—";
  const { aiOn } = resolvePrimaryCardKpiFields(cardName, settings);
  const ent = cardName ? panelEntryForStrategy(cardName) : null;
  const paperOn = ent ? Boolean(ent.paperTrading) : Boolean(state.paperTrading);
  const rulesOutput = ent
    ? String(ent.strategyRulesOutput ?? "")
    : String(state.strategyRulesOutput ?? "");
  return { displayStrategyName, aiOn, paperOn, rulesOutput };
}

function finiteKpiNumber(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 策略行是否在 KPI 维度有「实质内容」（用于主卡与设置焦点行的智能合并）。 */
function entryHasExplicitKpiContent(ent) {
  if (!ent) return false;
  if (ent.aiTakeoverTrading === true) return true;
  if (finiteKpiNumber(ent.strategyAuthorizedAmount) != null) return true;
  if (finiteKpiNumber(ent.strategyTargetAnnualReturnPct) != null) return true;
  if (String(ent.strategyNotes || "").trim()) return true;
  return false;
}

/**
 * 主卡 KPI 数据源：优先当前策略条目，空缺时回退到设置里正在编辑的策略名对应条目（如「AI 接管」），再回退全局 state。
 */
function resolvePrimaryCardKpiFields(name, settingsName) {
  const nm = String(name || "").trim();
  const primary = panelEntryForStrategy(nm);
  const sn = String(settingsName || "").trim();
  const focus = sn && sn !== nm ? panelEntryForStrategy(sn) : null;

  const authAmt =
    finiteKpiNumber(primary?.strategyAuthorizedAmount) ??
    finiteKpiNumber(focus?.strategyAuthorizedAmount) ??
    finiteKpiNumber(state.strategyAuthorizedAmount);
  const aprPct =
    finiteKpiNumber(primary?.strategyTargetAnnualReturnPct) ??
    finiteKpiNumber(focus?.strategyTargetAnnualReturnPct) ??
    finiteKpiNumber(state.strategyTargetAnnualReturnPct);
  const notes =
    String(primary?.strategyNotes || "").trim() ||
    String(focus?.strategyNotes || "").trim() ||
    String(state.strategyNotes || "").trim();

  let aiOn;
  if (entryHasExplicitKpiContent(primary)) {
    aiOn = Boolean(primary.aiTakeoverTrading);
  } else if (focus) {
    aiOn = Boolean(focus.aiTakeoverTrading);
  } else {
    aiOn = Boolean(state.aiTakeoverTrading);
  }

  return { aiOn, authAmt, aprPct, notes };
}

/** 单张策略卡上的面板 KPI：仅用该条目 + 全局回退（不与「设置焦点」条目交叉合并）。 */
function resolveCardEntryKpiFields(name) {
  const ent = panelEntryForStrategy(String(name || "").trim());
  const authAmt =
    finiteKpiNumber(ent?.strategyAuthorizedAmount) ?? finiteKpiNumber(state.strategyAuthorizedAmount);
  const aprPct =
    finiteKpiNumber(ent?.strategyTargetAnnualReturnPct) ??
    finiteKpiNumber(state.strategyTargetAnnualReturnPct);
  const notes =
    String(ent?.strategyNotes || "").trim() || String(state.strategyNotes || "").trim();
  const aiOn = ent ? Boolean(ent.aiTakeoverTrading) : Boolean(state.aiTakeoverTrading);
  return { aiOn, authAmt, aprPct, notes };
}

function parseStrategySlotDetailRoot(strategyName) {
  const slots =
    state.strategySlots && typeof state.strategySlots === "object" && !Array.isArray(state.strategySlots)
      ? state.strategySlots
      : {};
  const raw = String(slots[String(strategyName || "").trim()]?.detailJson ?? "").trim();
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    return o && typeof o === "object" && !Array.isArray(o) ? o : null;
  } catch {
    return null;
  }
}

/**
 * 与机器人当前策略类名一致时用 /show_config；否则用该卡「策略槽位」JSON 中的 bovinBotParameters / strategyParameterHints。
 */
function mergeStrategyKpiSnapshot(strategyName, showConfig) {
  const nm = String(strategyName || "").trim();
  const active = String(showConfig?.strategy ?? "").trim();
  const live = Boolean(active && nm === active);
  const root = parseStrategySlotDetailRoot(nm);
  const bp =
    root?.bovinBotParameters && typeof root.bovinBotParameters === "object"
      ? root.bovinBotParameters
      : null;
  const hints =
    root?.strategyParameterHints && typeof root.strategyParameterHints === "object"
      ? root.strategyParameterHints
      : null;
  const pick = (scKey, bpKey) => {
    if (live && showConfig && Object.prototype.hasOwnProperty.call(showConfig, scKey)) {
      const v = showConfig[scKey];
      if (v != null && v !== "") return v;
    }
    if (bp && Object.prototype.hasOwnProperty.call(bp, bpKey)) {
      const v = bp[bpKey];
      if (v != null && v !== "") return v;
    }
    return null;
  };
  let minimalRoi =
    live && showConfig?.minimal_roi && typeof showConfig.minimal_roi === "object"
      ? showConfig.minimal_roi
      : null;
  if (!minimalRoi && bp?.minimal_roi && typeof bp.minimal_roi === "object") {
    minimalRoi = bp.minimal_roi;
  }
  return {
    timeframe: pick("timeframe", "timeframe"),
    stoploss: pick("stoploss", "stoploss"),
    minimalRoi,
    trailing_stop: pick("trailing_stop", "trailing_stop"),
    trailing_stop_positive: pick("trailing_stop_positive", "trailing_stop_positive"),
    trailing_stop_positive_offset: pick(
      "trailing_stop_positive_offset",
      "trailing_stop_positive_offset"
    ),
    use_exit_signal: pick("use_exit_signal", "use_exit_signal"),
    exit_profit_only: pick("exit_profit_only", "exit_profit_only"),
    ignore_roi_if_entry_signal: pick("ignore_roi_if_entry_signal", "ignore_roi_if_entry_signal"),
    rsiBuy: hints != null ? hints.buy_rsi ?? hints.buy_rsi_threshold : null,
    rsiSell: hints != null ? hints.sell_rsi ?? hints.sell_rsi_threshold : null,
    rsiShort: hints != null ? hints.short_rsi ?? hints.short_rsi_threshold : null,
    rsiExitShort: hints != null ? hints.exit_short_rsi ?? hints.exit_short_rsi_threshold : null,
  };
}

function formatMinimalRoiBrief(roi) {
  if (!roi || typeof roi !== "object") return null;
  const entries = Object.entries(roi)
    .map(([k, v]) => ({ m: Number(k), r: Number(v) }))
    .filter((x) => Number.isFinite(x.m) && Number.isFinite(x.r))
    .sort((a, b) => a.m - b.m);
  if (!entries.length) return null;
  return entries.slice(0, 6).map((e) => `${e.m}m→${(e.r * 100).toFixed(1)}%`).join(" · ");
}

function formatStoplossRatioLabel(sl) {
  const n = Number(sl);
  if (!Number.isFinite(n)) return null;
  return `${(n * 100).toFixed(1)}%`;
}

function formatTrailingKpiValue(snap, on, off, dash) {
  const ts = snap.trailing_stop;
  if (ts === true) {
    const p = snap.trailing_stop_positive;
    const o = snap.trailing_stop_positive_offset;
    const pp =
      p != null && Number.isFinite(Number(p)) ? formatStoplossRatioLabel(Number(p)) : null;
    const oo =
      o != null && Number.isFinite(Number(o)) ? formatStoplossRatioLabel(Number(o)) : null;
    if (pp && oo) return `${on} (+${pp} / ${oo})`;
    if (pp) return `${on} (+${pp})`;
    return on;
  }
  if (ts === false) return off;
  return dash;
}

function formatRsiFourPack(snap, dash) {
  const pick = (v) => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? String(Math.trunc(n)) : null;
  };
  const a = pick(snap.rsiBuy);
  const b = pick(snap.rsiSell);
  const c = pick(snap.rsiShort);
  const d = pick(snap.rsiExitShort);
  if (a == null && b == null && c == null && d == null) return dash;
  return `${a ?? dash} / ${b ?? dash} / ${c ?? dash} / ${d ?? dash}`;
}

function formatExitRoiTriple(snap, on, off, dash) {
  const f = (x) => (x === true ? on : x === false ? off : dash);
  return `${f(snap.use_exit_signal)} · ${f(snap.exit_profit_only)} · ${f(snap.ignore_roi_if_entry_signal)}`;
}

/** Per-entry preference: full /panel/strategies-style card vs short notice. */
function entryWantsStrategyGrid(className) {
  const ent = panelEntryForStrategy(className);
  if (ent) return ent.controlShowStrategyCards !== false;
  return true;
}

/**
 * 策略卡底部操作区：暂停/停止/启动的展示由 state（normalize 后为 running → 暂停+停止，否则 → 启动）。
 * `tradeTargetActive` 与敞口「非当前 config 策略」同源：仅当本卡对应当前可驱动的机器人/config 目标时，启停可点。
 * `tradeDisabledHint` 可选，用于专用 RPC 离线等非「非当前 config」场景覆盖按钮 title。
 * 「编辑配置」POST …/api/v1/panel/preferences（空 JSON）；强制平仓等仍按原逻辑。仅当非当前 config 目标时沿用 operable；当前 config 卡不做 API/模拟盘等权限限制。
 * 交易键与次要操作分块渲染。
 */
function buildStrategyCardActionsHtml({
  operable,
  botRunning,
  disabledHint,
  tradeTargetActive = true,
  tradeDisabledHint,
}) {
  const hint = String(disabledHint || "").trim();
  const secondaryOperable = tradeTargetActive ? true : operable;
  const secondaryLockAttr = secondaryOperable ? "" : ` disabled title="${escapeHtml(hint)}"`;
  const tradeHint =
    tradeTargetActive ? "" : String(tradeDisabledHint || t("sc.strategy.notConfigTradeHint")).trim();
  const tradeLockAttr = tradeTargetActive ? "" : ` disabled title="${escapeHtml(tradeHint)}"`;
  const pauseBtn = `<button type="button" class="ghost action-btn" data-method="POST" data-control-op="pause" data-endpoint="/pause"${tradeLockAttr}>${actionIconSvg("pause")}<span data-i18n="sc.pause">${escapeHtml(t("sc.pause"))}</span></button>`;
  const stopBtn = `<button type="button" class="danger action-btn" data-method="POST" data-control-op="stop" data-endpoint="/stop"${tradeLockAttr}>${actionIconSvg("stop")}<span data-i18n="sc.stop">${escapeHtml(t("sc.stop"))}</span></button>`;
  const startBtn = `<button type="button" class="primary action-btn sc-wide" data-method="POST" data-control-op="start" data-endpoint="/start"${tradeLockAttr}>${actionIconSvg("play")}<span data-i18n="sc.startStrategy">${escapeHtml(t("sc.startStrategy"))}</span></button>`;
  const pauseStop = botRunning ? `${pauseBtn}${stopBtn}` : startBtn;
  const tradeLockedClass = tradeTargetActive ? "" : " sc-actions--locked";
  const tradeRow = `<div class="sc-actions two sc-actions--trade${tradeLockedClass}">${pauseStop}</div>`;
  const reloadBtn = `<button type="button" class="ghost action-btn" data-method="POST" data-endpoint="/panel/preferences"${secondaryLockAttr}><span data-i18n="sc.editConfig">${escapeHtml(t("sc.editConfig"))}</span></button>`;
  const backtestBtn = `<button type="button" class="ghost" disabled title="${escapeHtml(t("sc.backtest"))}" data-i18n="sc.backtest">${escapeHtml(t("sc.backtest"))}</button>`;
  const forceBtn = `<button type="button" class="danger-soft" data-control-force-exit="1"${secondaryLockAttr} data-i18n="sc.forceCloseAll">${escapeHtml(t("sc.forceCloseAll"))}</button>`;
  const secondaryLockedClass = secondaryOperable ? "" : " sc-actions--locked";
  const secondaryRow = `<div class="sc-actions two sc-actions--secondary${secondaryLockedClass}">${reloadBtn}${backtestBtn}${forceBtn}</div>`;
  return `<div class="sc-actions-stack">${tradeRow}${secondaryRow}</div>`;
}

function formatStrategyGridOffCard(name, showConfig) {
  const title = escapeHtml(t("sc.strategy.entryGridOff").replace("{name}", name));
  const sub = escapeHtml(t("sc.strategy.entryGridOffHint"));
  const botRunning = normalizeBotState(showConfig?.state) === "running";
  const activeGlobal = String(showConfig?.strategy || "").trim();
  const tradeTargetActive = Boolean(activeGlobal && name === activeGlobal);
  const actions = buildStrategyCardActionsHtml({
    operable: false,
    botRunning,
    disabledHint: t("sc.strategy.entryGridOffHint"),
    tradeTargetActive,
  });
  return `<article class="sc-card sc-card-alert sc-card--strategy-grid-off" data-strategy-card="${escapeHtml(name)}">
    <div class="sc-alert sc-alert--stack">
      ${alertIconSvg("hidden")}
      <div class="sc-alert-text"><strong>${title}</strong><p class="muted sc-alert-sub">${sub}</p></div>
    </div>
    ${actions}
  </article>`;
}

/**
 * 策略卡 KPI：与 /show_config 或槽位 JSON 中的策略参数一致（周期、止损、ROI 等），
 * 避免「测试 AI 接管」等非当前 config 策略卡相对 SampleStrategy 主卡缺行。
 * 面板项（AI 接管、授权额等）按该卡对应 strategyEntries 条目展示。
 */
function formatPanelStrategyKpisHtml(name, stakeCur, showConfig) {
  const { aiOn, authAmt, aprPct, notes } = resolveCardEntryKpiFields(name);
  const cfg = showConfig && typeof showConfig === "object" ? showConfig : {};
  const snap = mergeStrategyKpiSnapshot(name, cfg);
  const on = escapeHtml(t("label.on"));
  const off = escapeHtml(t("label.off"));
  const dash = "—";
  const dashE = escapeHtml(dash);
  const tfRaw = snap.timeframe != null ? String(snap.timeframe).trim() : "";
  const tfVal = tfRaw ? escapeHtml(tfRaw) : dashE;
  const slLbl = formatStoplossRatioLabel(snap.stoploss);
  const slVal = slLbl ? escapeHtml(slLbl) : dashE;
  const roiBrief = formatMinimalRoiBrief(snap.minimalRoi);
  const roiVal = roiBrief ? escapeHtml(roiBrief) : dashE;
  const trailLabel = escapeHtml(t("sc.strategy.kpiTrailing"));
  const trailVal = escapeHtml(formatTrailingKpiValue(snap, t("label.on"), t("label.off"), dash));
  const exitLabel = escapeHtml(t("sc.strategy.kpiExitRoiBundle"));
  const exitVal = escapeHtml(formatExitRoiTriple(snap, t("label.on"), t("label.off"), dash));
  const rsiLabel = escapeHtml(t("sc.strategy.kpiRsiHyperopt"));
  const rsiVal = escapeHtml(formatRsiFourPack(snap, dash));
  const aiLabel = escapeHtml(t("sc.strategy.kpiPanelAiTakeover"));
  const aiVal = aiOn ? on : off;
  const amtLabel = escapeHtml(t("sc.strategy.kpiAuthAmount"));
  let amtVal = dashE;
  if (authAmt != null && Number.isFinite(authAmt)) {
    const u = String(stakeCur || "").trim();
    amtVal = escapeHtml(u ? `${authAmt} ${u}` : String(authAmt));
  }
  const aprLabel = escapeHtml(t("sc.strategy.kpiTargetAnnual"));
  let aprVal = dashE;
  if (aprPct != null && Number.isFinite(aprPct)) {
    aprVal = escapeHtml(`${aprPct}%`);
  }
  const memoLabel = escapeHtml(t("sc.strategy.kpiNotesMemo"));
  const notesDisp =
    notes.length > 140 ? `${escapeHtml(notes.slice(0, 140))}…` : escapeHtml(notes || dash);
  return `<div class="sc-card-kpis" data-panel-kpis="1">
    <div class="sc-card-kpi-row"><span class="sc-card-kpi-k">${escapeHtml(t("sc.strategy.kpiTimeframe"))}</span><span class="sc-card-kpi-v mono">${tfVal}</span></div>
    <div class="sc-card-kpi-row"><span class="sc-card-kpi-k">${escapeHtml(t("sc.strategy.kpiStoploss"))}</span><span class="sc-card-kpi-v">${slVal}</span></div>
    <div class="sc-card-kpi-row sc-card-kpi-row--memo"><span class="sc-card-kpi-k">${escapeHtml(t("sc.strategy.kpiMinimalRoi"))}</span><span class="sc-card-kpi-v sc-card-kpi-memo mono">${roiVal}</span></div>
    <div class="sc-card-kpi-row"><span class="sc-card-kpi-k">${trailLabel}</span><span class="sc-card-kpi-v">${trailVal}</span></div>
    <div class="sc-card-kpi-row"><span class="sc-card-kpi-k">${exitLabel}</span><span class="sc-card-kpi-v mono">${exitVal}</span></div>
    <div class="sc-card-kpi-row"><span class="sc-card-kpi-k">${rsiLabel}</span><span class="sc-card-kpi-v mono">${rsiVal}</span></div>
    <div class="sc-card-kpi-row"><span class="sc-card-kpi-k">${aiLabel}</span><span class="sc-card-kpi-v">${aiVal}</span></div>
    <div class="sc-card-kpi-row"><span class="sc-card-kpi-k">${amtLabel}</span><span class="sc-card-kpi-v">${amtVal}</span></div>
    <div class="sc-card-kpi-row"><span class="sc-card-kpi-k">${aprLabel}</span><span class="sc-card-kpi-v">${aprVal}</span></div>
    <div class="sc-card-kpi-row sc-card-kpi-row--memo"><span class="sc-card-kpi-k">${memoLabel}</span><span class="sc-card-kpi-v sc-card-kpi-memo">${notesDisp}</span></div>
  </div>`;
}

function formatStrategySlotRowHtml(name) {
  const raw = state.strategySlots;
  const slots =
    raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const slot = slots[name] || {};
  const hasJ = Boolean(String(slot.detailJson || "").trim());
  const hasM = Boolean(String(slot.mml || "").trim());
  const badges = [];
  if (hasJ) {
    badges.push(
      `<span class="sc-slot-tag sc-slot-tag--json">${escapeHtml(t("sc.strategy.slotJson"))}</span>`
    );
  }
  if (hasM) {
    badges.push(
      `<span class="sc-slot-tag sc-slot-tag--mml">${escapeHtml(t("sc.strategy.slotMml"))}</span>`
    );
  }
  const bd = badges.length
    ? `<div class="sc-slot-badges">${badges.join("")}</div>`
    : `<span class="muted sc-slot-empty">${escapeHtml(t("sc.strategy.slotEmpty"))}</span>`;
  const sid =
    uiState.panelStrategySlotIdByName && typeof uiState.panelStrategySlotIdByName === "object"
      ? String(uiState.panelStrategySlotIdByName[name] || "").trim()
      : "";
  const sidAttr = sid ? ` data-strategy-slot-id="${escapeHtml(sid)}"` : "";
  const btn = `<button type="button" class="ghost sc-strategy-slot-btn" data-strategy-slot-edit="${escapeHtml(name)}"${sidAttr}>${escapeHtml(t("sc.strategy.editSlot"))}</button>`;
  return `<div class="sc-strategy-slot-row">${bd}${btn}</div>`;
}

export function aggregateForStrategy(statusRows, name, activeName) {
  const rows = Array.isArray(statusRows) ? statusRows : [];
  let stake = 0;
  let openCount = 0;
  const active = String(activeName || "").trim();
  for (const tr of rows) {
    const sn = String(tr.strategy || "").trim();
    const match = sn === name || (!sn && active && name === active);
    if (!match) continue;
    stake += Number(tr.stake_amount ?? tr.open_trade_value ?? 0);
    if (tr.is_open !== false) openCount += 1;
  }
  return { openCount, stake };
}

export function renderControlStrategyCards(
  showConfig,
  profit,
  count,
  statusRows,
  panelStrategies,
  proxyHealth,
  botHealth,
  strategyBotSnapshots = {}
) {
  const root = $("controlStrategyCards");
  if (!root) return;
  const chipSep = " · ";
  const activeGlobal = String(showConfig?.strategy || "").trim();
  const settingsName = String(state.strategyName || "").trim();
  const diskSet = new Set(
    (Array.isArray(panelStrategies) ? panelStrategies : [])
      .map((x) => String(x || "").trim())
      .filter(Boolean)
  );
  const manualSet = new Set(
    (Array.isArray(state.manualStrategyNames) ? state.manualStrategyNames : [])
      .map((x) => String(x || "").trim())
      .filter(Boolean)
  );
  const names = orderedStrategyNames(
    panelStrategies,
    activeGlobal,
    settingsName,
    state.manualStrategyNames
  );
  if (!names.length) {
    root.innerHTML = `${webserverTradeRelayInfoHtml(showConfig, proxyHealth, botHealth)}${runmodeNonTradingBannerHtml(showConfig, proxyHealth, botHealth)}<article class="sc-card sc-card-alert"><div class="sc-alert">${alertIconSvg("info")}<span>${escapeHtml(t("sc.strategy.noFiles"))}</span></div></article>`;
    return;
  }
  const hiddenSet = new Set(
    (Array.isArray(state.strategyHiddenFromConsole) ? state.strategyHiddenFromConsole : [])
      .map((x) => String(x || "").trim())
      .filter(Boolean)
  );
  const visibleNames = names.filter((n) => {
    const key = String(n || "").trim();
    return key && !hiddenSet.has(key);
  });
  if (!visibleNames.length) {
    root.innerHTML = `${webserverTradeRelayInfoHtml(showConfig, proxyHealth, botHealth)}${runmodeNonTradingBannerHtml(showConfig, proxyHealth, botHealth)}<article class="sc-card sc-card-alert"><div class="sc-alert">${alertIconSvg("hidden")}<span>${escapeHtml(t("sc.strategy.allHiddenByPref"))}</span></div></article>`;
    return;
  }
  if (visibleNames.length > 0 && visibleNames.every((n) => !entryWantsStrategyGrid(n))) {
    const namesLine = visibleNames.map((n) => escapeHtml(n)).join(" · ");
    const lead = escapeHtml(t("sc.strategy.allVisibleGridOffLead"));
    root.innerHTML = `${webserverTradeRelayInfoHtml(showConfig, proxyHealth, botHealth)}${runmodeNonTradingBannerHtml(showConfig, proxyHealth, botHealth)}<article class="sc-card sc-card-alert"><div class="sc-alert sc-alert--stack">
      ${alertIconSvg("hidden")}
      <div class="sc-alert-text"><span>${lead}</span><p class="mono sc-alert-names">${namesLine}</p>
      <p class="muted sc-alert-sub">${escapeHtml(t("sc.strategy.entryGridOffHint"))}</p></div>
    </div></article>`;
    return;
  }
  const stakeCurGlobal = String(showConfig?.stake_currency || "").trim();

  /** 机器人跑的是 config 策略 A，设置焦点是面板条目 B 且开启 AI 接管：主卡切到 B，运行态与 /start 等与同一进程对齐。 */
  const settingsFocusEntry = settingsName ? panelEntryForStrategy(settingsName) : null;
  const aiTakeoverSettingsFocus =
    Boolean(settingsName) &&
    Boolean(activeGlobal) &&
    activeGlobal !== settingsName &&
    Boolean(settingsFocusEntry?.aiTakeoverTrading);

  root.innerHTML = `${webserverTradeRelayInfoHtml(showConfig, proxyHealth, botHealth)}${runmodeNonTradingBannerHtml(showConfig, proxyHealth, botHealth)}${visibleNames
    .map((name) => {
      if (!entryWantsStrategyGrid(name)) {
        return formatStrategyGridOffCard(name, showConfig);
      }
      const ent = panelEntryForStrategy(name);
      const rowBase = normalizeUserRestApiV1Base(String(ent?.strategyRpcBase || "").trim());
      const snap = strategyBotSnapshots && strategyBotSnapshots[name] ? strategyBotSnapshots[name] : null;
      const hasDedicated = Boolean(rowBase);
      const dedicatedOk = hasDedicated && snap?.showConfig && typeof snap.showConfig === "object";

      const showCfgForCard =
        hasDedicated && dedicatedOk
          ? snap.showConfig
          : hasDedicated && !dedicatedOk
            ? {}
            : showConfig;
      const countForCard =
        hasDedicated && dedicatedOk ? snap.count || {} : count;
      const profitForCard =
        hasDedicated && dedicatedOk ? snap.profit || {} : profit;
      const statusForCard =
        hasDedicated && dedicatedOk ? (Array.isArray(snap.status) ? snap.status : []) : statusRows;
      const healthForCard =
        hasDedicated && dedicatedOk ? snap.health || {} : botHealth;

      const activeForAgg =
        hasDedicated && dedicatedOk
          ? String(showCfgForCard?.strategy || "").trim()
          : activeGlobal;

      const isAiTakeoverSettingsPrimary = aiTakeoverSettingsFocus && name === settingsName;
      const isConfigStrategy =
        !hasDedicated &&
        Boolean(activeGlobal) &&
        name === activeGlobal &&
        !(aiTakeoverSettingsFocus && name !== settingsName);
      const isPanelOnlyFocus =
        !hasDedicated && !activeGlobal && Boolean(settingsName) && name === settingsName;

      let metricsActive;
      if (hasDedicated) metricsActive = Boolean(dedicatedOk);
      else metricsActive = isConfigStrategy || isPanelOnlyFocus || isAiTakeoverSettingsPrimary;

      const maxOpenRaw = showCfgForCard?.max_open_trades ?? countForCard?.max;
      let maxOpen = 0;
      if (maxOpenRaw != null && maxOpenRaw !== "" && maxOpenRaw !== "unlimited") {
        const n = Number(maxOpenRaw);
        if (Number.isFinite(n) && n > 0) maxOpen = n;
      }
      const curOpen = Number(countForCard?.current ?? countForCard?.open_trades ?? 0);
      const slotPct = maxOpen > 0 ? Math.min(100, (curOpen / maxOpen) * 100) : 0;
      const dryLabel = showCfgForCard?.dry_run ? t("freq.dryRun") : t("freq.live");
      const exch = String(showCfgForCard?.exchange || "—");
      const stateLabel = labelBotState(showCfgForCard?.state);
      const profitPct =
        profitForCard?.profit_all_ratio != null ? Number(profitForCard.profit_all_ratio) * 100 : null;
      const stakeCurCard = String(showCfgForCard?.stake_currency ?? stakeCurGlobal ?? "").trim();
      const tradingApis = panelBotTradingApisAvailable(showCfgForCard, proxyHealth, healthForCard);
      /* 操作按钮：全局单实例沿用原主卡规则；独立 RPC 时每张卡控制自己的 trade 进程。 */
      const { openCount, stake } = aggregateForStrategy(statusForCard, name, activeForAgg);
      const botRunning = normalizeBotState(showCfgForCard?.state) === "running";
      const paperOnly = Boolean(ent?.paperTrading);
      const operable = metricsActive && tradingApis && !paperOnly;
      let disabledHint = "";
      if (!operable) {
        if (metricsActive && paperOnly) {
          disabledHint = t("sc.tradeMode.paperActionsBlocked");
        } else if (metricsActive && !tradingApis) {
          disabledHint = t("sc.tradeMode.actionsBlocked");
        } else {
          disabledHint = t("sc.strategy.inactiveHelp");
        }
      }
      const runningNow = metricsActive && botRunning;
      const chipCls = metricsActive ? (runningNow ? "ok" : "idle") : "idle";
      let badge;
      if (hasDedicated && dedicatedOk) {
        badge = `<span class="sc-chip ${chipCls}">${escapeHtml(dryLabel)}${chipSep}${escapeHtml(exch)}${chipSep}${escapeHtml(stateLabel)}${chipSep}${escapeHtml(t("sc.strategy.dedicatedBotBadge"))}</span>`;
      } else if (hasDedicated && !dedicatedOk) {
        const errT = snap?.error ? escapeHtml(String(snap.error).slice(0, 160)) : "";
        badge = `<span class="sc-chip idle" title="${errT}">${escapeHtml(t("sc.strategy.dedicatedBotOffline"))}</span>`;
      } else if (isConfigStrategy) {
        badge = `<span class="sc-chip ${chipCls}">${escapeHtml(dryLabel)}${chipSep}${escapeHtml(exch)}${chipSep}${escapeHtml(stateLabel)}${chipSep}${escapeHtml(t("sc.strategy.configActive"))}</span>`;
      } else if (isPanelOnlyFocus || isAiTakeoverSettingsPrimary) {
        badge = `<span class="sc-chip ${chipCls}">${escapeHtml(dryLabel)}${chipSep}${escapeHtml(exch)}${chipSep}${escapeHtml(stateLabel)}${chipSep}${escapeHtml(t("sc.strategy.panelPrefBadge"))}</span>`;
      } else if (manualSet.has(name) && !diskSet.has(name)) {
        badge = `<span class="sc-chip idle">${escapeHtml(t("sc.strategy.manualEntry"))}</span>`;
      } else {
        badge = `<span class="sc-chip idle">${escapeHtml(t("sc.strategy.available"))}</span>`;
      }
      let perfInner = `<em data-i18n="sc.perf">${escapeHtml(t("sc.perf"))}</em><strong>—</strong>`;
      if (metricsActive && profitPct != null && Number.isFinite(profitPct)) {
        const perfClass = profitPct < 0 ? "negative" : "positive";
        const sign =
          profitPct < 0
            ? `<span class="sc-perf-sym sc-perf-sign" aria-hidden="true">-</span>`
            : `<span class="sc-perf-sym sc-perf-sign" aria-hidden="true">+</span>`;
        const num = escapeHtml(Math.abs(profitPct).toFixed(2));
        perfInner = `<em data-i18n="sc.perf">${escapeHtml(t("sc.perf"))}</em><strong class="${perfClass}">${sign}<span class="sc-perf-num">${num}</span><span class="sc-perf-sym sc-perf-pct" aria-hidden="true">%</span><span class="sc-perf-sym sc-perf-sigma" aria-hidden="true">Σ</span></strong>`;
      } else if (!metricsActive) {
        perfInner = `<em data-i18n="sc.perf">${escapeHtml(t("sc.perf"))}</em><strong>—</strong>`;
      }
      const expBold = metricsActive
        ? `${stake.toFixed(2)} ${escapeHtml(stakeCurCard || "—")} · ${escapeHtml(t("sc.strategy.openCount").replace("{n}", String(openCount)))}`
        : escapeHtml(t("sc.strategy.inactiveExposure"));
      const barPct = Math.min(100, Math.max(0, metricsActive ? slotPct : 0));
      const midMeta = metricsActive
        ? `<div class="sc-progress"><i style="--sc-progress-pct: ${barPct}%"></i></div>
           <div><span data-i18n="sc.strategy.slotUse">${escapeHtml(t("sc.strategy.slotUse"))}</span><b>${maxOpen > 0 ? `${curOpen}/${maxOpen}` : String(curOpen)}</b></div>`
        : `<div class="sc-progress"><i style="--sc-progress-pct: 0%"></i></div>
           <div><span data-i18n="sc.lastRun">${escapeHtml(t("sc.lastRun"))}</span><b>${escapeHtml(t("sc.strategy.uptimeDash"))}</b></div>`;
      const botRm = String(showCfgForCard?.runmode || "—");
      const thirdMeta = `<div><span data-i18n="sc.uptime">${escapeHtml(t("sc.uptime"))}</span><b>${escapeHtml(botRm)}</b></div>`;
      const panelKpis = formatPanelStrategyKpisHtml(name, stakeCurCard, showCfgForCard);
      const slotRow = formatStrategySlotRowHtml(name);

      let tradeDisabledHint = "";
      if (!metricsActive && hasDedicated && !dedicatedOk) {
        tradeDisabledHint = snap?.error
          ? String(snap.error).slice(0, 200)
          : t("sc.strategy.dedicatedBotOffline");
      }
      const actions = buildStrategyCardActionsHtml({
        operable,
        botRunning,
        disabledHint,
        tradeTargetActive: metricsActive,
        tradeDisabledHint,
      });

      const apiBaseAttr =
        hasDedicated && rowBase ? ` data-strategy-api-base="${encodeURIComponent(rowBase)}"` : "";
      return `<article class="sc-card" data-strategy-card="${escapeHtml(name)}"${apiBaseAttr}>
        <div class="sc-card-head">
          <div class="sc-card-head-main">
            <div class="sc-card-head-topline">
              <h3 title="${escapeHtml(name)}">${escapeHtml(name)}</h3>
              <div class="sc-perf">${perfInner}</div>
            </div>
            <div class="sc-card-head-chip">${badge}</div>
          </div>
        </div>
        <div class="sc-meta">
          <div><span data-i18n="sc.exposure">${escapeHtml(t("sc.exposure"))}</span><b>${expBold}</b></div>
          ${midMeta}
          ${thirdMeta}
        </div>
        ${panelKpis}
        ${slotRow}
        ${actions}
      </article>`;
    })
    .join("")}`;
}

const SC_GOV_LOCK_SVG = `<span class="sc-gov-pair-lock" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" focusable="false"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg></span>`;

function govPairCountBadge(n) {
  const en = String(state.lang || "").toLowerCase().startsWith("en");
  if (en) return n === 1 ? `1 ${t("sc.gov.pairSingular")}` : `${n} ${t("sc.gov.pairs")}`;
  return `${n} ${t("sc.gov.pairs")}`;
}

function governanceMetaFromShowConfig(showConfig) {
  const sc = showConfig && typeof showConfig === "object" ? showConfig : {};
  const rawEx =
    sc.exchange?.name ?? sc.exchange ?? sc.exchange_name ?? sc.exchangeName ?? "";
  const exStr =
    typeof rawEx === "string" ? rawEx.trim().toUpperCase() : String(rawEx || "").trim().toUpperCase();
  const strat = String(sc.strategy ?? sc.strategy_name ?? sc.active_strategy ?? "").trim() || "—";
  const rm = String(sc.runmode || "").toLowerCase();
  const paper = Boolean(sc.dry_run) || rm === "dry_run" || rm.includes("dry");
  const mode = paper ? t("sc.gov.metaPaper") : t("sc.gov.metaLive");
  let s = t("sc.gov.metaLine");
  s = s.split("{ex}").join(exStr || "—");
  s = s.split("{strat}").join(strat);
  s = s.split("{mode}").join(mode);
  return s;
}

function govPairCardWl(pair) {
  const enc = encodeURIComponent(pair);
  return `<article class="sc-gov-pair-card sc-gov-pair-card--wl">
    <div class="sc-gov-pair-card-main">
      <strong class="sc-gov-pair-name">${escapeHtml(pair)}</strong>
      ${SC_GOV_LOCK_SVG}
    </div>
    <div class="sc-gov-wl-aside">
      <button type="button" class="sc-gov-remove-wl" data-gov-remove-wl="${enc}" aria-label="${escapeHtml(t("sc.gov.removeWlAria"))}">${escapeHtml(t("btn.del"))}</button>
    </div>
  </article>`;
}

function govPairCardBl(pair) {
  return `<article class="sc-gov-pair-card sc-gov-pair-card--bl">
    <div class="sc-gov-pair-card-main">
      <strong class="sc-gov-pair-name">${escapeHtml(pair)}</strong>
      ${SC_GOV_LOCK_SVG}
    </div>
    <span class="sc-gov-pair-tag sc-gov-pair-tag--bl">${escapeHtml(t("pairlist.blacklistTag"))}</span>
  </article>`;
}

function govBlacklistEmptyHintCard() {
  return `<article class="sc-gov-pair-card sc-gov-pair-card--bl sc-gov-pair-card--hint" role="status">
    <div class="sc-gov-pair-card-main sc-gov-pair-card-main--stack">
      <strong class="sc-gov-hint-title">${escapeHtml(t("sc.gov.blRpcTitle"))}</strong>
      <small class="sc-gov-hint-body">${escapeHtml(t("sc.gov.blRpcHint"))}</small>
    </div>
  </article>`;
}

/**
 * 控制台「资产访问治理」白/黑名单（GET /whitelist、GET /blacklist + show_config 元信息）。
 * @param {unknown} wlPayload
 * @param {unknown} blPayload
 * @param {Record<string, unknown>} [showConfig]
 */
export function renderControlGovernanceLists(wlPayload, blPayload, showConfig) {
  const wl = pairsFromWhitelistPayload(wlPayload);
  const bl = pairsFromBlacklistPayload(blPayload);

  const metaEl = $("scGovMeta");
  if (metaEl) {
    metaEl.textContent = governanceMetaFromShowConfig(
      showConfig && typeof showConfig === "object" ? showConfig : uiState.lastShowConfig
    );
  }

  const wlCount = $("scWlCount");
  const blCount = $("scBlCount");
  if (wlCount) wlCount.textContent = govPairCountBadge(wl.length);
  if (blCount) blCount.textContent = govPairCountBadge(bl.length);

  const wlItems = $("scGovernanceWlItems");
  const blItems = $("scGovernanceBlItems");
  if (wlItems) {
    wlItems.innerHTML = wl.length ? wl.map((p) => govPairCardWl(p)).join("") : "";
  }
  if (blItems) {
    blItems.innerHTML = bl.length ? bl.map((p) => govPairCardBl(p)).join("") : govBlacklistEmptyHintCard();
  }

  const wlMono = $("whitelist");
  const blMono = $("blacklist");
  if (wlMono) wlMono.textContent = wl.length ? wl.join("\n") : "";
  if (blMono) blMono.textContent = bl.length ? bl.join("\n") : "";
}

export function renderControlHeroAndCards(
  dailyPayload,
  showConfig,
  profit,
  health,
  proxyHealth,
  strategyBotSnapshots = {}
) {
  const annualEl = $("controlHeroAnnual");
  if (annualEl) {
    const ann = computeEstimatedAnnualReturn(profit, dailyPayload, health);
    const { text, cls } = formatAnnualReturnLabel(ann);
    annualEl.textContent = text;
    annualEl.classList.remove("positive", "negative");
    if (cls) annualEl.classList.add(cls);
  }

  const hero = $("controlHeroPnl");
  if (hero && !state.mockMode) {
    const dayRows = dailyPayload?.data || [];
    const last = dayRows.length ? dayRows[dayRows.length - 1] : null;
    const v = Number(last?.abs_profit ?? 0);
    hero.textContent = `${v >= 0 ? "+" : "-"}$${Math.abs(v).toFixed(2)}`;
    hero.classList.remove("positive", "negative");
    hero.classList.add(v >= 0 ? "positive" : "negative");
  } else if (hero && state.mockMode) {
    hero.textContent = "+$14,204.42";
    hero.classList.remove("negative");
    hero.classList.add("positive");
  }
  const cfg = showConfig && typeof showConfig === "object" ? showConfig : {};
  renderControlStrategyCards(
    cfg,
    profit,
    uiState.lastCount || {},
    uiState.lastStForRisk || [],
    uiState.panelStrategyList,
    proxyHealth,
    health,
    strategyBotSnapshots
  );
  renderControlGovernanceLists(uiState.lastWl, uiState.lastBl, cfg);
  renderControlTradeFeed(uiState.lastTradesMini);
}

/** @param {unknown} payload GET /trades 响应（数组或 { trades } / { data }） */
function normalizeTradesListPayload(payload) {
  if (payload == null) return [];
  if (Array.isArray(payload)) return payload;
  if (typeof payload === "object") {
    const o = /** @type {Record<string, unknown>} */ (payload);
    if (Array.isArray(o.trades)) return o.trades;
    if (Array.isArray(o.data)) return o.data;
  }
  return [];
}

function formatTradeFeedTimestamp(tr) {
  const x = tr && typeof tr === "object" ? tr : {};
  const raw =
    x.close_date ??
    x.close_timestamp ??
    x.open_date ??
    x.open_timestamp ??
    x.date ??
    x.timestamp ??
    null;
  if (typeof raw === "number") {
    const ms = raw > 1e12 ? raw : raw * 1000;
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d.toLocaleString() : "—";
  }
  if (typeof raw === "string" && raw.trim()) {
    const d = new Date(raw);
    return Number.isFinite(d.getTime()) ? d.toLocaleString() : raw.trim();
  }
  return "—";
}

function tradeFeedRowDotClass(tr) {
  const x = tr && typeof tr === "object" ? tr : {};
  const pr = Number(x.profit_ratio ?? x.close_profit_pct ?? x.profit_pct ?? NaN);
  if (Number.isFinite(pr)) {
    if (pr > 0) return "ok";
    if (pr < 0) return "err";
  }
  const abs = Number(x.close_profit_abs ?? x.profit_abs ?? NaN);
  if (Number.isFinite(abs)) {
    if (abs > 0) return "ok";
    if (abs < 0) return "err";
  }
  return "pri";
}

/** @param {unknown[]} rows @param {number} max */
function buildTradeFeedRowsHtml(rows, max) {
  const slice = rows.slice(0, Math.max(0, Math.min(max, rows.length)));
  return slice
    .map((tr) => {
      const x = tr && typeof tr === "object" ? tr : {};
      const strat = String(x.strategy ?? x.strategy_name ?? "—").trim() || "—";
      const pair = String(x.pair ?? x.pairname ?? "—").trim() || "—";
      const amtRaw = x.amount ?? x.amount_requested ?? x.stake_amount ?? null;
      const amtN = Number(amtRaw);
      const mid =
        amtRaw != null && amtRaw !== "" && Number.isFinite(amtN)
          ? `${pair} · ${amtN.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
          : pair;
      const when = formatTradeFeedTimestamp(x);
      const dot = tradeFeedRowDotClass(x);
      return `<div class="feed-row">
      <i class="${escapeHtml(dot)}" aria-hidden="true"></i>
      <div>
        <b>${escapeHtml(strat)}</b>
        <small>${escapeHtml(mid)}</small>
        <em>${escapeHtml(when)}</em>
      </div>
    </div>`;
    })
    .join("");
}

/**
 * 打开「完整审计/成交」弹窗：GET /trades?limit=… 与侧栏「最近条数」使用同一归一化上限。
 */
export async function openTradesAuditModal() {
  const modal = $("tradesAuditModal");
  const body = $("tradesAuditModalBody");
  const subEl = $("tradesAuditModalSub");
  if (!modal || !body) return;
  const lim = getNormalizedControlTradesFeedLimit();
  if (subEl) {
    subEl.textContent = String(t("sc.feed.auditModalSub")).split("{n}").join(String(lim));
  }
  modal.classList.remove("hidden");
  body.innerHTML = `<p class="muted sc-feed-audit-loading">${escapeHtml(t("sc.feed.auditLoading"))}</p>`;
  try {
    const payload = await getTradesFeed(lim);
    const rows = normalizeTradesListPayload(payload);
    if (!rows.length) {
      body.innerHTML = `<div class="feed-row feed-row--empty sc-feed-audit-empty">
        <i class="pri" aria-hidden="true"></i>
        <div>
          <b>${escapeHtml(t("sc.feed.auditEmpty"))}</b>
          <small>—</small>
          <em>—</em>
        </div>
      </div>`;
      return;
    }
    body.innerHTML = `<div class="sc-feed-audit-rows">${buildTradeFeedRowsHtml(rows, lim)}</div>`;
  } catch (e) {
    const msg = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
    body.innerHTML = `<p class="sc-feed-audit-error">${escapeHtml(msg)}</p>`;
  }
}

export function closeTradesAuditModal() {
  $("tradesAuditModal")?.classList.add("hidden");
}

/**
 * 控制台右侧「实时成交流」DOM（数据来自 GET /trades，limit 见 state.controlTradesFeedLimit）。
 * @param {unknown} payload
 */
export function renderControlTradeFeed(payload) {
  const root = $("scFeedRows");
  if (!root) return;
  const rows = normalizeTradesListPayload(payload);
  if (!rows.length) {
    root.innerHTML = `<div class="feed-row feed-row--empty">
      <i class="pri" aria-hidden="true"></i>
      <div>
        <b>${escapeHtml(t("mock.noTrades"))}</b>
        <small>—</small>
        <em>—</em>
      </div>
    </div>`;
    return;
  }
  const max = getNormalizedControlTradesFeedLimit();
  root.innerHTML = buildTradeFeedRowsHtml(rows, max);
}
