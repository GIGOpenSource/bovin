/**
 * 面板数据来源（优先级简述）：
 * - Bovin REST：实时持仓/交易/配置等，以 Basic 鉴权后的服务端为准。
 * - 设置中心三块「永久真源」均在 SQLite `panel_store.sqlite`（非 mock）：
 *   - API 对接映射 → 表 panel_api_binding，经 GET/POST /panel/preferences 的 api_bindings。
 *   - 策略配置 → 表 panel_profile（strategy_entries_json、strategy_slots_json 等），经同接口的 strategyEntries / strategySlots。
 *   - 面板用户 → 表 panel_user / panel_user_menu，经 /panel/users* 与 /panel/auth/login（与 preferences 分离）。
 * - Strategy AI 控制台展示哪些策略、是否隐藏、卡片形态与 KPI：由 strategyEntries（及 strategySlots、strategyHiddenFromConsole）
 *   驱动，见 control-console.js。app.js 会将 /show_config 当前策略与 GET /panel/strategies 扫描结果合并进 strategyEntries，并防抖 POST 回 SQLite，与设置中心列表对齐。
 * - state（baseUrl/username/password）：与面板登录同一组凭据；username/baseUrl 存 localStorage；**密码仅存 sessionStorage**（新标签页需重新登录）。
 * - api_bindings：非模拟下 localStorage 为**脱敏副本**；另在 sessionStorage 存本标签页「上次成功 GET/POST 含密钥的快照」，供 GET 偏好失败时恢复列表，**避免假清空**（与 ft_pwd_session 同级风险，登出时清除）。
 * - **GET /panel/preferences 尚未成功**时，不向 SQLite 做隐式 POST（策略防抖等）；避免内存未与库对齐时覆盖 panel_profile / 对接表。换主题、模拟开关、保存连接、同步按钮等显式操作带 forceFullProfileSync。
 * - uiState.菜单权限：本地可篡改，仅 UI 约束；写操作仍由 Bovin api_server 鉴权。
 */

import { DEFAULT_REST_API_V1_BASE } from "../api/default-api-base.js";

const LEGACY_PWD_LS = "ft_pwd";
const API_PWD_SS = "ft_pwd_session";

/** 首次打开面板且未存过 ft_base_url 时，与 api/config.js 的 httpDevProxyBase 一致，避免 POST 误达静态页 501。 */
function defaultBovinRestApiV1BaseFirstVisit() {
  try {
    if (typeof location === "undefined") return "";
    const h = String(location.hostname || "").toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h === "[::1]") {
      return DEFAULT_REST_API_V1_BASE;
    }
    if (location.protocol === "http:" && isPrivateLanIPv4ForProxy(h)) {
      return DEFAULT_REST_API_V1_BASE;
    }
  } catch {
    // ignore
  }
  return "";
}

function isPrivateLanIPv4ForProxy(hostname) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(hostname || "").toLowerCase());
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

/** 若为历史开发机 `192.168.77.46:8000`，改为当前默认 …/api/v1；否则原样返回（已 trim、去尾斜杠）。 */
function rewriteLegacyLan8000BaseUrl(v) {
  const s = String(v ?? "").trim().replace(/\/+$/, "");
  if (!s) return "";
  try {
    const u = new URL(s.includes("://") ? s : `http://${s}`);
    if (u.hostname === "192.168.77.46" && u.port === "8000") {
      return DEFAULT_REST_API_V1_BASE.replace(/\/+$/, "");
    }
  } catch {
    // ignore
  }
  return s;
}

/** 读 localStorage 前执行：把旧默认基址写回 DEFAULT_REST_API_V1_BASE。 */
function migrateLegacyLan8000BaseUrlIfNeeded() {
  try {
    const raw = localStorage.getItem("ft_base_url");
    if (raw == null) return;
    const cur = String(raw).trim().replace(/\/+$/, "");
    if (!cur) return;
    const next = rewriteLegacyLan8000BaseUrl(cur);
    if (next === cur) return;
    localStorage.setItem("ft_base_url", next);
    localStorage.removeItem("ft_api_base_last_ok");
  } catch {
    // quota / private mode
  }
}

(function migrateLegacyPasswordToSessionStorage() {
  try {
    const legacy = localStorage.getItem(LEGACY_PWD_LS);
    if (legacy != null && legacy !== "") {
      if (!sessionStorage.getItem(API_PWD_SS)) sessionStorage.setItem(API_PWD_SS, legacy);
      localStorage.removeItem(LEGACY_PWD_LS);
    }
  } catch {
    // ignore
  }
})();

/** 历史版本曾把交易所/LLM 密钥写入 localStorage；启动时清除，降低 XSS 窃取面。 */
(function purgeLegacyCredentialLocalStorageKeys() {
  const keys = [
    "ft_ex_api_key",
    "ft_ex_api_secret",
    "ft_ex_passphrase",
    "ft_llm_api_key"
  ];
  try {
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    // ignore
  }
})();

function readInitialPasswordFromSession() {
  try {
    return sessionStorage.getItem(API_PWD_SS) || "";
  } catch {
    return "";
  }
}

/** Per-strategy ``detailJson`` / ``mml`` map (strategy class name → payload). */
export function normalizeStrategySlots(raw) {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = String(k).trim();
    if (!key || !v || typeof v !== "object") continue;
    const dj = String(v.detailJson ?? "").trim();
    const mml = String(v.mml ?? "").trim();
    const slot = {};
    if (dj) slot.detailJson = dj;
    if (mml) slot.mml = mml;
    // Keep key even when both empty: condition-driven / AI orchestration without template text.
    out[key] = slot;
  }
  return out;
}

/** Panel-only strategy class names (manual entries), order preserved, deduped. */
export function normalizeManualStrategyNames(raw) {
  if (raw == null) return [];
  let arr = raw;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      arr = JSON.parse(s);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out = [];
  const seen = new Set();
  for (const x of arr) {
    const n = String(x ?? "").trim();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/** Same shape as manual names: unique non-empty strings (hidden-from-console list). */
export function normalizeStrategyHiddenFromConsole(raw) {
  return normalizeManualStrategyNames(raw);
}

function newStrategyEntryId() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return `e-${crypto.randomUUID()}`;
    }
  } catch {
    // ignore
  }
  return `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** One panel strategy row (full fields, persisted in ``strategyEntries``). */
export function defaultStrategyEntry(over = {}) {
  return {
    id: newStrategyEntryId(),
    strategyName: "",
    strategyNotes: "",
    strategyExtraJson: "",
    aiTakeoverTrading: false,
    /** 仅 AI / 面板备忘，不调用机器人交易 API（/start 等）；LLM 等仍可在对接配置中使用 */
    paperTrading: false,
    strategyRulesOutput: "",
    riskMaxDrawdownLimitPct: null,
    riskThresholdPct: null,
    riskUseFreqaiLimits: false,
    strategyAuthorizedAmount: null,
    strategyTargetAnnualReturnPct: null,
    showOnConsole: true,
    controlShowStrategyCards: true,
    /** 非空时该策略卡片直连此 Bovin REST …/api/v1（另起 trade 进程、独立端口），与全局 Base URL 并行多实例 */
    strategyRpcBase: "",
    ...over
  };
}

export function normalizeStrategyEntries(raw) {
  if (raw == null) return [];
  let arr = raw;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      arr = JSON.parse(s);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out = [];
  const seenNames = new Set();
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    let id = String(item.id || "").trim();
    if (!id) id = newStrategyEntryId();
    const name = String(item.strategyName || "").trim();
    if (name && seenNames.has(name)) continue;
    if (name) seenNames.add(name);
    out.push(
      defaultStrategyEntry({
        id,
        strategyName: name,
        strategyNotes: String(item.strategyNotes ?? ""),
        strategyExtraJson: String(item.strategyExtraJson ?? ""),
        aiTakeoverTrading: Boolean(item.aiTakeoverTrading),
        paperTrading: Boolean(item.paperTrading),
        strategyRulesOutput: String(item.strategyRulesOutput ?? ""),
        riskMaxDrawdownLimitPct:
          item.riskMaxDrawdownLimitPct != null &&
          item.riskMaxDrawdownLimitPct !== "" &&
          Number.isFinite(Number(item.riskMaxDrawdownLimitPct))
            ? Number(item.riskMaxDrawdownLimitPct)
            : null,
        riskThresholdPct:
          item.riskThresholdPct != null &&
          item.riskThresholdPct !== "" &&
          Number.isFinite(Number(item.riskThresholdPct))
            ? Number(item.riskThresholdPct)
            : null,
        riskUseFreqaiLimits: Boolean(item.riskUseFreqaiLimits),
        strategyAuthorizedAmount:
          item.strategyAuthorizedAmount != null &&
          item.strategyAuthorizedAmount !== "" &&
          Number.isFinite(Number(item.strategyAuthorizedAmount))
            ? Number(item.strategyAuthorizedAmount)
            : null,
        strategyTargetAnnualReturnPct:
          item.strategyTargetAnnualReturnPct != null &&
          item.strategyTargetAnnualReturnPct !== "" &&
          Number.isFinite(Number(item.strategyTargetAnnualReturnPct))
            ? Number(item.strategyTargetAnnualReturnPct)
            : null,
        showOnConsole: item.showOnConsole !== false,
        controlShowStrategyCards: item.controlShowStrategyCards !== false,
        strategyRpcBase: String(item.strategyRpcBase ?? "").trim()
      })
    );
  }
  return out;
}

/** Keep ``manualStrategyNames`` / ``strategyHiddenFromConsole`` / first-row flat fields in sync. */
export function syncStrategyEntriesDerivedState() {
  const entries = normalizeStrategyEntries(state.strategyEntries);
  state.strategyEntries = entries;
  const names = [];
  const hidden = [];
  const seen = new Set();
  for (const e of entries) {
    const n = String(e.strategyName || "").trim();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    names.push(n);
    if (!e.showOnConsole) hidden.push(n);
  }
  state.manualStrategyNames = names;
  state.strategyHiddenFromConsole = hidden;
  const e0 = entries[0];
  if (e0) {
    state.strategyName = String(e0.strategyName || "");
    state.strategyNotes = String(e0.strategyNotes || "");
    state.strategyExtraJson = String(e0.strategyExtraJson || "");
    state.aiTakeoverTrading = Boolean(e0.aiTakeoverTrading);
    state.paperTrading = Boolean(e0.paperTrading);
    state.strategyRulesOutput = String(e0.strategyRulesOutput || "");
    state.riskMaxDrawdownLimitPct =
      e0.riskMaxDrawdownLimitPct != null && Number.isFinite(e0.riskMaxDrawdownLimitPct)
        ? e0.riskMaxDrawdownLimitPct
        : null;
    state.riskThresholdPct =
      e0.riskThresholdPct != null && Number.isFinite(e0.riskThresholdPct) ? e0.riskThresholdPct : null;
    state.riskUseFreqaiLimits = Boolean(e0.riskUseFreqaiLimits);
    state.strategyAuthorizedAmount =
      e0.strategyAuthorizedAmount != null && Number.isFinite(e0.strategyAuthorizedAmount)
        ? e0.strategyAuthorizedAmount
        : null;
    state.strategyTargetAnnualReturnPct =
      e0.strategyTargetAnnualReturnPct != null && Number.isFinite(e0.strategyTargetAnnualReturnPct)
        ? e0.strategyTargetAnnualReturnPct
        : null;
    state.controlShowStrategyCards = e0.controlShowStrategyCards !== false;
  } else {
    state.controlShowStrategyCards = true;
    state.paperTrading = false;
  }
}

function migrateLocalFlatToStrategyEntries() {
  const names = (() => {
    try {
      const raw = localStorage.getItem("ft_manual_strategy_names");
      if (!raw || !raw.trim()) return [];
      return normalizeManualStrategyNames(JSON.parse(raw));
    } catch {
      return [];
    }
  })();
  const hidden = (() => {
    try {
      const raw = localStorage.getItem("ft_strategy_hidden_console");
      if (!raw || !raw.trim()) return [];
      return normalizeStrategyHiddenFromConsole(JSON.parse(raw));
    } catch {
      return [];
    }
  })();
  const hset = new Set(hidden);
  const mainName = String(localStorage.getItem("ft_strategy_name") || "").trim();
  const e0 = defaultStrategyEntry({
    id: "e-0",
    strategyName: mainName,
    strategyNotes: localStorage.getItem("ft_strategy_notes") || "",
    strategyExtraJson: localStorage.getItem("ft_strategy_extra_json") || "",
    aiTakeoverTrading: localStorage.getItem("ft_ai_takeover") === "1",
    strategyRulesOutput: localStorage.getItem("ft_strategy_rules_out") || "",
    riskMaxDrawdownLimitPct: (() => {
      const v = localStorage.getItem("ft_risk_dd_limit_pct");
      if (v == null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    })(),
    riskThresholdPct: (() => {
      const v = localStorage.getItem("ft_risk_threshold_pct");
      if (v == null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    })(),
    riskUseFreqaiLimits: localStorage.getItem("ft_risk_use_freqai") === "1",
    strategyAuthorizedAmount: (() => {
      const v = localStorage.getItem("ft_strategy_auth_amount");
      if (v == null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    })(),
    strategyTargetAnnualReturnPct: (() => {
      const v = localStorage.getItem("ft_strategy_target_apr_pct");
      if (v == null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    })(),
    showOnConsole: !mainName || !hset.has(mainName),
    controlShowStrategyCards: localStorage.getItem("ft_control_show_strategy_cards") !== "0"
  });
  const out = [e0];
  for (const nm of names) {
    if (nm === mainName) continue;
    out.push(
      defaultStrategyEntry({
        strategyName: nm,
        showOnConsole: !hset.has(nm)
      })
    );
  }
  return out;
}

export const state = {
  /**
   * 留空：自动候选含同源 …/api/v1 与默认上游（见 api/config.js）；显式填 …/api/v1 可避免误连静态站。
   * 从未写入 ft_base_url 时：本机/局域网 http 开发写入 default-api-base.js 中的默认 …/api/v1，并清除 ft_api_base_last_ok。
   * 若本地仍存历史 `192.168.77.46:8000`，启动时迁移为当前默认基址。
   */
  baseUrl: (() => {
    try {
      migrateLegacyLan8000BaseUrlIfNeeded();
      const raw = localStorage.getItem("ft_base_url");
      if (raw !== null) return String(raw).trim().replace(/\/+$/, "");
      const d = defaultBovinRestApiV1BaseFirstVisit();
      if (d) {
        try {
          localStorage.removeItem("ft_api_base_last_ok");
          localStorage.setItem("ft_base_url", d);
        } catch {
          // quota / private mode
        }
        return d.replace(/\/+$/, "");
      }
      return "";
    } catch {
      return "";
    }
  })(),
  /** 可选；WebSocket 用的 /api/v1 根。留空则按 REST 是否经 :19090 推断直连 Bovin 端口 */
  wsApiV1Base: localStorage.getItem("ft_ws_api_v1_base") ?? "",
  /** 与 api_server.ws_token 一致；仅浏览器本地保存，不参与 /panel/preferences 同步 */
  wsToken: localStorage.getItem("ft_ws_token") ?? "",
  username: localStorage.getItem("ft_user") ?? "",
  password: readInitialPasswordFromSession(),
  strategyName: localStorage.getItem("ft_strategy_name") || "",
  strategyNotes: localStorage.getItem("ft_strategy_notes") || "",
  strategyExtraJson: localStorage.getItem("ft_strategy_extra_json") || "",
  aiTakeoverTrading: localStorage.getItem("ft_ai_takeover") === "1",
  paperTrading: false,
  strategyRulesOutput: localStorage.getItem("ft_strategy_rules_out") || "",
  riskMaxDrawdownLimitPct: (() => {
    const v = localStorage.getItem("ft_risk_dd_limit_pct");
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  })(),
  riskThresholdPct: (() => {
    const v = localStorage.getItem("ft_risk_threshold_pct");
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  })(),
  riskUseFreqaiLimits: localStorage.getItem("ft_risk_use_freqai") === "1",
  controlShowStrategyCards: (() => {
    const v = localStorage.getItem("ft_control_show_strategy_cards");
    if (v === "0") return false;
    return true;
  })(),
  strategyAuthorizedAmount: (() => {
    const v = localStorage.getItem("ft_strategy_auth_amount");
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  })(),
  strategyTargetAnnualReturnPct: (() => {
    const v = localStorage.getItem("ft_strategy_target_apr_pct");
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  })(),
  strategySlots: (() => {
    try {
      const raw = localStorage.getItem("ft_strategy_slots");
      if (!raw || !raw.trim()) return {};
      return normalizeStrategySlots(JSON.parse(raw));
    } catch {
      return {};
    }
  })(),
  manualStrategyNames: [],
  strategyHiddenFromConsole: [],
  strategyEntries: (() => {
    try {
      const raw = localStorage.getItem("ft_strategy_entries");
      if (raw && raw.trim()) {
        const n = normalizeStrategyEntries(JSON.parse(raw));
        if (n.length) return n;
      }
    } catch {
      // ignore
    }
    return migrateLocalFlatToStrategyEntries();
  })(),
  apiBindings: [],
  lang: localStorage.getItem("ft_lang") || "zh-CN",
  mockMode:
    localStorage.getItem("ft_mock_mode") === "1" ||
    new URLSearchParams(window.location.search).get("mock") === "1"
};

syncStrategyEntriesDerivedState();

/** 非 mock：落盘前清空密钥类字段，避免 localStorage 长期存交易所/LLM Secret。 */
export function redactApiBindingsForLocalStorage(bindings) {
  if (!Array.isArray(bindings)) return [];
  return bindings.map((b) => ({
    ...b,
    exchangeApiKey: "",
    exchangeApiSecret: "",
    exchangePassphrase: "",
    llmApiKey: ""
  }));
}

/** mock 模式写入完整绑定；非 mock 只写脱敏副本。 */
export function persistApiBindingsLocalSnapshot(bindings) {
  const payload = state.mockMode ? bindings : redactApiBindingsForLocalStorage(bindings);
  try {
    localStorage.setItem("ft_api_bindings", JSON.stringify(payload));
  } catch {
    // quota / private mode
  }
}

export function clearFreqtradePasswordSession() {
  try {
    sessionStorage.removeItem(API_PWD_SS);
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(LEGACY_PWD_LS);
  } catch {
    // ignore
  }
  state.password = "";
}

export function persistProfileToLocalStorage() {
  localStorage.setItem("ft_base_url", state.baseUrl);
  try {
    localStorage.setItem("ft_ws_api_v1_base", String(state.wsApiV1Base ?? "").trim());
  } catch {
    // ignore
  }
  try {
    localStorage.setItem("ft_ws_token", String(state.wsToken ?? "").trim());
  } catch {
    // ignore
  }
  localStorage.setItem("ft_user", state.username);
  try {
    sessionStorage.setItem(API_PWD_SS, state.password);
  } catch {
    // private mode / quota
  }
  try {
    localStorage.removeItem(LEGACY_PWD_LS);
  } catch {
    // ignore
  }
  localStorage.setItem("ft_strategy_name", state.strategyName);
  localStorage.setItem("ft_strategy_notes", state.strategyNotes);
  localStorage.setItem("ft_strategy_extra_json", state.strategyExtraJson);
  localStorage.setItem("ft_ai_takeover", state.aiTakeoverTrading ? "1" : "0");
  localStorage.setItem("ft_strategy_rules_out", state.strategyRulesOutput);
  if (state.riskMaxDrawdownLimitPct != null && Number.isFinite(state.riskMaxDrawdownLimitPct)) {
    localStorage.setItem("ft_risk_dd_limit_pct", String(state.riskMaxDrawdownLimitPct));
  } else {
    localStorage.removeItem("ft_risk_dd_limit_pct");
  }
  if (state.riskThresholdPct != null && Number.isFinite(state.riskThresholdPct)) {
    localStorage.setItem("ft_risk_threshold_pct", String(state.riskThresholdPct));
  } else {
    localStorage.removeItem("ft_risk_threshold_pct");
  }
  localStorage.setItem("ft_risk_use_freqai", state.riskUseFreqaiLimits ? "1" : "0");
  localStorage.setItem("ft_control_show_strategy_cards", state.controlShowStrategyCards ? "1" : "0");
  if (state.strategyAuthorizedAmount != null && Number.isFinite(state.strategyAuthorizedAmount)) {
    localStorage.setItem("ft_strategy_auth_amount", String(state.strategyAuthorizedAmount));
  } else {
    localStorage.removeItem("ft_strategy_auth_amount");
  }
  if (state.strategyTargetAnnualReturnPct != null && Number.isFinite(state.strategyTargetAnnualReturnPct)) {
    localStorage.setItem("ft_strategy_target_apr_pct", String(state.strategyTargetAnnualReturnPct));
  } else {
    localStorage.removeItem("ft_strategy_target_apr_pct");
  }
  try {
    localStorage.setItem("ft_strategy_slots", JSON.stringify(state.strategySlots ?? {}));
  } catch {
    // quota
  }
  try {
    localStorage.setItem(
      "ft_strategy_entries",
      JSON.stringify(normalizeStrategyEntries(state.strategyEntries))
    );
  } catch {
    // quota
  }
  try {
    localStorage.setItem(
      "ft_manual_strategy_names",
      JSON.stringify(normalizeManualStrategyNames(state.manualStrategyNames))
    );
  } catch {
    // quota
  }
  try {
    localStorage.setItem(
      "ft_strategy_hidden_console",
      JSON.stringify(normalizeStrategyHiddenFromConsole(state.strategyHiddenFromConsole))
    );
  } catch {
    // quota
  }
}

/** Merge server / POST body profile fields into state (only keys present on `prefs`). */
export function applyPanelProfileFromPrefs(prefs) {
  if (!prefs || typeof prefs !== "object") return;
  const rawEntries = prefs.strategyEntries ?? prefs.strategy_entries;
  const hadEntries = Array.isArray(rawEntries);
  if ("baseUrl" in prefs) {
    const fromServer = String(prefs.baseUrl ?? "").trim().replace(/\/+$/, "");
    // 服务端未存或为空时不要用 "" 覆盖本地 ft_base_url（否则会冲掉默认/手填基址，POST 又落到静态页 501）
    if (fromServer !== "") {
      const next = rewriteLegacyLan8000BaseUrl(fromServer);
      state.baseUrl = next;
      if (next !== fromServer) {
        try {
          localStorage.setItem("ft_base_url", next);
          localStorage.removeItem("ft_api_base_last_ok");
        } catch {
          // quota / private mode
        }
      }
    }
  }
  /**
   * 不从 GET /panel/preferences 恢复 username/password：它们必须与 api_server（HTTP Basic）一致，
   * 且 profile 里可能残留旧值（如曾保存 admin），会覆盖本次登录凭据并导致后续 /show_config 等 401。
   * 凭据仅来自登录框与 sessionStorage。
   */
  if ("controlShowStrategyCards" in prefs) {
    state.controlShowStrategyCards = Boolean(prefs.controlShowStrategyCards);
  }
  if ("strategySlots" in prefs) {
    state.strategySlots = normalizeStrategySlots(prefs.strategySlots);
  }
  if (hadEntries) {
    state.strategyEntries = normalizeStrategyEntries(rawEntries);
  } else {
    if ("strategyName" in prefs) state.strategyName = String(prefs.strategyName ?? "");
    if ("strategyNotes" in prefs) state.strategyNotes = String(prefs.strategyNotes ?? "");
    if ("strategyExtraJson" in prefs) state.strategyExtraJson = String(prefs.strategyExtraJson ?? "");
    if ("aiTakeoverTrading" in prefs) state.aiTakeoverTrading = Boolean(prefs.aiTakeoverTrading);
    if ("strategyRulesOutput" in prefs) {
      state.strategyRulesOutput = String(prefs.strategyRulesOutput ?? "");
    }
    if ("riskMaxDrawdownLimitPct" in prefs) {
      const x = prefs.riskMaxDrawdownLimitPct;
      state.riskMaxDrawdownLimitPct =
        x != null && x !== "" && Number.isFinite(Number(x)) ? Number(x) : null;
    }
    if ("riskThresholdPct" in prefs) {
      const x = prefs.riskThresholdPct;
      state.riskThresholdPct =
        x != null && x !== "" && Number.isFinite(Number(x)) ? Number(x) : null;
    }
    if ("riskUseFreqaiLimits" in prefs) {
      state.riskUseFreqaiLimits = Boolean(prefs.riskUseFreqaiLimits);
    }
    if ("strategyAuthorizedAmount" in prefs) {
      const x = prefs.strategyAuthorizedAmount;
      state.strategyAuthorizedAmount =
        x != null && x !== "" && Number.isFinite(Number(x)) ? Number(x) : null;
    }
    if ("strategyTargetAnnualReturnPct" in prefs) {
      const x = prefs.strategyTargetAnnualReturnPct;
      state.strategyTargetAnnualReturnPct =
        x != null && x !== "" && Number.isFinite(Number(x)) ? Number(x) : null;
    }
    if ("manualStrategyNames" in prefs) {
      state.manualStrategyNames = normalizeManualStrategyNames(prefs.manualStrategyNames);
    }
    if ("strategyHiddenFromConsole" in prefs) {
      state.strategyHiddenFromConsole = normalizeStrategyHiddenFromConsole(
        prefs.strategyHiddenFromConsole
      );
    }
    const main = String(state.strategyName || "").trim();
    const manual = normalizeManualStrategyNames(state.manualStrategyNames);
    const hidden = new Set(normalizeStrategyHiddenFromConsole(state.strategyHiddenFromConsole));
    const e0 = defaultStrategyEntry({
      id: "e-0",
      strategyName: main,
      strategyNotes: state.strategyNotes,
      strategyExtraJson: state.strategyExtraJson,
      aiTakeoverTrading: state.aiTakeoverTrading,
      strategyRulesOutput: state.strategyRulesOutput,
      riskMaxDrawdownLimitPct: state.riskMaxDrawdownLimitPct,
      riskThresholdPct: state.riskThresholdPct,
      riskUseFreqaiLimits: state.riskUseFreqaiLimits,
      strategyAuthorizedAmount: state.strategyAuthorizedAmount,
      strategyTargetAnnualReturnPct: state.strategyTargetAnnualReturnPct,
      showOnConsole: !main || !hidden.has(main),
      controlShowStrategyCards:
        "controlShowStrategyCards" in prefs ? Boolean(prefs.controlShowStrategyCards) : true
    });
    const built = [e0];
    for (const nm of manual) {
      if (nm === main) continue;
      built.push(
        defaultStrategyEntry({
          strategyName: nm,
          showOnConsole: !hidden.has(nm),
          controlShowStrategyCards: true
        })
      );
    }
    state.strategyEntries = built;
  }
  syncStrategyEntriesDerivedState();
  persistProfileToLocalStorage();
}

export const uiState = {
  logsPage: 1,
  logsPageSize: 20,
  logsTotalPages: 1,
  positionsPage: 1,
  positionsPageSize: 5,
  positionsTotalPages: 1,
  pendingPage: 1,
  pendingPageSize: 6,
  pendingTotalPages: 1,
  positionsRows: [],
  pendingRows: [],
  dataPairs: null,
  dataCandles: null,
  dataHistory: null,
  selectedPair: null,
  selectedTimeframe: null,
  dataTickSeq: 0,
  lwChart: null,
  lwCandles: null,
  lwMA7: null,
  lwMA25: null,
  lwVolume: null,
  lwMount: null,
  lwEMA: null,
  lwBollMid: null,
  lwBollUpper: null,
  lwBollLower: null,
  lwLoadFailed: false,
  lwLoadErrorInfo: "",
  lwDidInitialFit: false,
  drawMode: "none",
  drawBuffer: null,
  drawings: [],
  showEMA: true,
  showBOLL: false,
  /** 为 true 时用内置 SVG 画 K 线（本地表达），不创建 LightweightCharts；数据仍来自当前数据源标签（如 COINBASE） */
  preferSvgKline: false,
  /** 为 true 时用 Canvas 面板 K 线（主图+成交量+MACD），数据同源；与 preferSvgKline 互斥 */
  preferPanelKline: false,
  dataPanelBusy: false,
  dataPanelRefreshQueued: false,
  dataRealtimeBusy: false,
  dataRefreshToken: 0,
  dataNetMode: "LIVE",
  dataNetRetries: 0,
  lastDataSourceCode: "NONE",
  /** 并发延迟探测后的 K 线通道排序；当前源失效时作回退顺序 */
  dataCandleSourceOrder: [],
  dataBoardSourceOrder: [],
  /** 锁定延迟最低的通道，持续使用直至该次请求失败后再探测并切换 */
  /** 默认锁定本地 binance_proxy（:19090）；连续多轮失败后会清空 pin 并探测其它源 */
  dataCandleSourcePinned: "PROXY_BINANCE",
  dataBoardSourcePinned: "PROXY_BINANCE",
  /** 当前锁定 K 线源连续失败轮数，达阈值后才重新探测，避免偶发抖动换源 */
  dataCandlePinFailStreak: 0,
  dataBoardPinFailStreak: 0,
  /** 最近一次成功拉取的市场条数据；BOARD 源 HOLD 时用于避免行情条被清空闪烁 */
  lastDataMarketBoard: [],
  dataSourceProbeBusy: false,
  dataSourceProbeLastAt: 0,
  historyLogsPage: 1,
  historyLogsPageSize: 12,
  historyLogsTotalPages: 1,
  historyLogsRows: [],
  historyLogsKey: "",
  fallbackBars: 0,
  fallbackOffset: 0,
  fallbackKey: "",
  fallbackDragging: false,
  fallbackDragStartX: 0,
  fallbackDragStartOffset: 0,
  fallbackDragRowsLen: 0,
  fallbackDragTimeframe: "5m",
  fallbackDragPair: "BTC/USD",
  fallbackGlobalBound: false,
  proxyCircuitOpenUntil: 0,
  proxyStartupHintShown: false,
  webserverModeNotified: false,
  /** binance_proxy GET /health 解析结果（含 bovin_trade_upstream 时启用控制台交易按钮） */
  lastProxyHealth: null,
  authed: localStorage.getItem("ft_panel_auth") === "1",
  eventsBound: false,
  langDelegatedBound: false,
  editingBindingIdx: -1,
  /** `null` = create manual strategy entry; string = original class name when editing */
  editingStrategyEntryId: null,
  theme: "system",
  themeMediaBound: false,
  topbarChromeBound: false,
  lastLogsSnapshot: [],
  openOrderFlat: [],
  mockTradesPayload: null,
  lastPingLatencyMs: 0,
  lastPingOk: true,
  lastPing: null,
  lastShowConfig: null,
  lastProfit: null,
  lastCount: null,
  lastDaily: null,
  /** GET /balance 最近一次成功结果 */
  lastBalance: null,
  lastHealth: null,
  lastSysinfo: null,
  lastStForRisk: [],
  lastWl: null,
  lastBl: null,
  lastTradesMini: null,
  lastStrategiesResult: null,
  lastProfitSummary: null,
  lastActiveStrategyName: null,
  lastTicker: null,
  lastAiOverview: null,
  /** 策略名 -> 独立 trade 实例快照（见 strategyRpcBase） */
  strategyBotSnapshots: {},
  tuneStep: 0,
  tradeActionDelegation: false,
  controlConsoleDelegation: false,
  /** 去重后的类名列表，供策略 AI 控制台等多卡逻辑 */
  panelStrategyList: null,
  /** 与 GET /panel/strategies 的 strategies 数组一致（保留重复项与顺序），供数据面板列表 */
  panelStrategyListAll: null,
  panelUserId: null,
  panelUsername: "",
  menuPermissions: null,
  /** 非 mock：最近一次 GET /panel/preferences 是否成功 */
  panelPrefsSyncedFromDb: false,
  /**
   * 仅当本次 GET 响应里存在数组类型的 api_bindings（含合法空数组 []）时为 true。
   * 隐式 POST（换主题、策略防抖等）不得在未确认时附带 api_bindings，否则可能以内存里的 [] 覆盖 SQLite。
   */
  panelPrefsBindingsLoadedFromDb: false,
  /** GET /panel/preferences 失败时的 err.message，便于与 /show_config 502 等对齐说明 */
  panelPrefsLoadErrorDetail: "",
  /** Bovin /api/v1/message/ws 已连接且已订阅 RPC 流 */
  rpcWsConnected: false
};

(function hydratePanelSessionFromStorage() {
  try {
    const raw = localStorage.getItem("ft_panel_menu_perm");
    if (raw) uiState.menuPermissions = JSON.parse(raw);
  } catch {
    // ignore
  }
  const uid = localStorage.getItem("ft_panel_uid");
  uiState.panelUserId = uid ? Number(uid) : null;
  uiState.panelUsername = localStorage.getItem("ft_panel_uname") || "";
})();
