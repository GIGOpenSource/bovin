import { i18n } from "../i18n/index.js";
import { state, uiState, normalizeStrategyEntries } from "../store/state-core.js";
import { normalizeUserRestApiV1Base } from "../api/config.js";
import { escapeHtml } from "../utils/html-utils.js";

function t(key) {
  return i18n[state.lang]?.[key] || i18n["zh-CN"]?.[key] || key;
}

const $ = (id) => document.getElementById(id);

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
      <span class="material-symbols-outlined">warning</span>
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
      <span class="material-symbols-outlined">swap_horiz</span>
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
 * 策略卡底部机器人级操作区：始终展示与「主」卡相同的按钮布局；
 * 不可用时 disabled + title，避免非主卡或非交易 runmode 下整块空白。
 */
function buildStrategyCardActionsHtml({ operable, botRunning, disabledHint }) {
  const hint = String(disabledHint || "").trim();
  const lockAttr = operable ? "" : ` disabled title="${escapeHtml(hint)}"`;
  const pauseBtn = `<button type="button" class="ghost action-btn" data-method="POST" data-endpoint="/pause"${operable ? "" : lockAttr}><span class="material-symbols-outlined">pause</span><span data-i18n="sc.pause">${escapeHtml(t("sc.pause"))}</span></button>`;
  const stopBtn = `<button type="button" class="danger action-btn" data-method="POST" data-endpoint="/stop"${operable ? "" : lockAttr}><span class="material-symbols-outlined">dangerous</span><span data-i18n="sc.stop">${escapeHtml(t("sc.stop"))}</span></button>`;
  const startBtn = `<button type="button" class="primary action-btn sc-wide" data-method="POST" data-endpoint="/start"${operable ? "" : lockAttr}><span class="material-symbols-outlined">play_arrow</span><span data-i18n="sc.startStrategy">${escapeHtml(t("sc.startStrategy"))}</span></button>`;
  const pauseStop = botRunning ? `${pauseBtn}${stopBtn}` : startBtn;
  const reloadBtn = `<button type="button" class="ghost action-btn" data-method="POST" data-endpoint="/reload_config"${operable ? "" : lockAttr}><span data-i18n="sc.editConfig">${escapeHtml(t("sc.editConfig"))}</span></button>`;
  const backtestBtn = `<button type="button" class="ghost" disabled title="${escapeHtml(t("sc.backtest"))}" data-i18n="sc.backtest">${escapeHtml(t("sc.backtest"))}</button>`;
  const forceBtn = `<button type="button" class="danger-soft" data-control-force-exit="1"${operable ? "" : lockAttr} data-i18n="sc.forceCloseAll">${escapeHtml(t("sc.forceCloseAll"))}</button>`;
  const lockedClass = operable ? "" : " sc-actions--locked";
  return `<div class="sc-actions two${lockedClass}">${pauseStop}${reloadBtn}${backtestBtn}${forceBtn}</div>`;
}

function formatStrategyGridOffCard(name, showConfig) {
  const title = escapeHtml(t("sc.strategy.entryGridOff").replace("{name}", name));
  const sub = escapeHtml(t("sc.strategy.entryGridOffHint"));
  const botRunning = normalizeBotState(showConfig?.state) === "running";
  const actions = buildStrategyCardActionsHtml({
    operable: false,
    botRunning,
    disabledHint: t("sc.strategy.entryGridOffHint"),
  });
  return `<article class="sc-card sc-card-alert sc-card--strategy-grid-off" data-strategy-card="${escapeHtml(name)}">
    <div class="sc-alert sc-alert--stack">
      <span class="material-symbols-outlined">visibility_off</span>
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
  const btn = `<button type="button" class="ghost sc-strategy-slot-btn" data-strategy-slot-edit="${escapeHtml(name)}">${escapeHtml(t("sc.strategy.editSlot"))}</button>`;
  return `<div class="sc-strategy-slot-row">${bd}${btn}</div>`;
}

function aggregateForStrategy(statusRows, name, activeName) {
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
    root.innerHTML = `${webserverTradeRelayInfoHtml(showConfig, proxyHealth, botHealth)}${runmodeNonTradingBannerHtml(showConfig, proxyHealth, botHealth)}<article class="sc-card sc-card-alert"><div class="sc-alert"><span class="material-symbols-outlined">info</span><span>${escapeHtml(t("sc.strategy.noFiles"))}</span></div></article>`;
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
    root.innerHTML = `${webserverTradeRelayInfoHtml(showConfig, proxyHealth, botHealth)}${runmodeNonTradingBannerHtml(showConfig, proxyHealth, botHealth)}<article class="sc-card sc-card-alert"><div class="sc-alert"><span class="material-symbols-outlined">visibility_off</span><span>${escapeHtml(t("sc.strategy.allHiddenByPref"))}</span></div></article>`;
    return;
  }
  if (visibleNames.length > 0 && visibleNames.every((n) => !entryWantsStrategyGrid(n))) {
    const namesLine = visibleNames.map((n) => escapeHtml(n)).join(" · ");
    const lead = escapeHtml(t("sc.strategy.allVisibleGridOffLead"));
    root.innerHTML = `${webserverTradeRelayInfoHtml(showConfig, proxyHealth, botHealth)}${runmodeNonTradingBannerHtml(showConfig, proxyHealth, botHealth)}<article class="sc-card sc-card-alert"><div class="sc-alert sc-alert--stack">
      <span class="material-symbols-outlined">visibility_off</span>
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
      const runningNow = metricsActive && botRunning;
      const chipCls = metricsActive ? (runningNow ? "ok" : "idle") : "idle";
      let badge;
      if (hasDedicated && dedicatedOk) {
        badge = `<span class="sc-chip ${chipCls}">${escapeHtml(dryLabel)} · ${escapeHtml(exch)} · ${escapeHtml(stateLabel)} · ${escapeHtml(t("sc.strategy.dedicatedBotBadge"))}</span>`;
      } else if (hasDedicated && !dedicatedOk) {
        const errT = snap?.error ? escapeHtml(String(snap.error).slice(0, 160)) : "";
        badge = `<span class="sc-chip idle" title="${errT}">${escapeHtml(t("sc.strategy.dedicatedBotOffline"))}</span>`;
      } else if (isConfigStrategy) {
        badge = `<span class="sc-chip ${chipCls}">${escapeHtml(dryLabel)} · ${escapeHtml(exch)} · ${escapeHtml(stateLabel)} · ${escapeHtml(t("sc.strategy.configActive"))}</span>`;
      } else if (isPanelOnlyFocus || isAiTakeoverSettingsPrimary) {
        badge = `<span class="sc-chip ${chipCls}">${escapeHtml(dryLabel)} · ${escapeHtml(exch)} · ${escapeHtml(stateLabel)} · ${escapeHtml(t("sc.strategy.panelPrefBadge"))}</span>`;
      } else if (manualSet.has(name) && !diskSet.has(name)) {
        badge = `<span class="sc-chip idle">${escapeHtml(t("sc.strategy.manualEntry"))}</span>`;
      } else {
        badge = `<span class="sc-chip idle">${escapeHtml(t("sc.strategy.available"))}</span>`;
      }
      let perfInner = `<em data-i18n="sc.perf">${escapeHtml(t("sc.perf"))}</em><strong>—</strong>`;
      if (metricsActive && profitPct != null && Number.isFinite(profitPct)) {
        const perfClass = profitPct < 0 ? "negative" : "positive";
        perfInner = `<em data-i18n="sc.perf">${escapeHtml(t("sc.perf"))}</em><strong class="${perfClass}">${profitPct >= 0 ? "+" : ""}${profitPct.toFixed(2)}% <small>Σ</small></strong>`;
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
      const actions = buildStrategyCardActionsHtml({
        operable,
        botRunning,
        disabledHint,
      });

      const apiBaseAttr =
        hasDedicated && rowBase ? ` data-strategy-api-base="${encodeURIComponent(rowBase)}"` : "";
      return `<article class="sc-card" data-strategy-card="${escapeHtml(name)}"${apiBaseAttr}>
        <div class="sc-card-head">
          <div>
            <h3>${escapeHtml(name)}</h3>
            <div>${badge}</div>
          </div>
          <div class="sc-perf">${perfInner}</div>
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
}
