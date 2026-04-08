/**
 * 数据面板左侧「策略」列表：名称来自 GET /panel/strategy-slots（与控制台策略卡同源），
 * 运行状态对照 GET /show_config，收益率/胜率来自 GET /profit（全账户聚合字段）。
 * 刷新：`panel-poll.js` 的 `panelTick` 每轮（与概览 KPI 相同间隔）调用 `applyDataStrategiesList`。
 */
import { normalizeBotState } from "../components/control-console.js";
import { escapeHtml } from "./html-utils.js";
import { strategyNamesFromShowConfig } from "./overview-strategies-table.js";

/**
 * @param {unknown} raw GET /panel/strategy-slots（或 strategies 数组）中的条目列表
 * @param {boolean} [dedupe=true] 为 true 时按类名去重（策略 AI 控制台卡片）；数据面板需展示接口条数时应传 false
 * @returns {string[]}
 */
export function normalizePanelStrategyNames(raw, dedupe = true) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const x of raw) {
    if (x == null) continue;
    if (typeof x === "string") {
      const s = x.trim();
      if (s) out.push(s);
      continue;
    }
    if (typeof x === "object") {
      const o = /** @type {Record<string, unknown>} */ (x);
      const n =
        o.name ??
        o.strategy ??
        o.class_name ??
        o.strategy_name ??
        o.className ??
        o.strategyClassName ??
        o.strategy_class_name ??
        o.slot_key ??
        o.strategy_class ??
        o.display_name ??
        o.title;
      if (n != null && String(n).trim()) out.push(String(n).trim());
    }
  }
  return dedupe ? [...new Set(out)] : out;
}

/** @param {unknown} v */
function objectLooksLikeStrategySlotRow(v) {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return false;
  const o = /** @type {Record<string, unknown>} */ (v);
  return (
    "id" in o ||
    "slot_id" in o ||
    "strategy_slot_id" in o ||
    "strategySlotId" in o ||
    "slotId" in o ||
    "strategy" in o ||
    "name" in o ||
    "class_name" in o ||
    "strategy_class" in o ||
    "detailJson" in o ||
    "detail_json" in o ||
    "mml" in o
  );
}

/**
 * 解析 GET /panel/strategy-slots（及兼容旧版 /panel/strategies）响应体为「条目数组」。
 * @param {unknown} payload
 * @returns {unknown[] | null} 无法识别时 null（调用方保留上一轮 uiState）
 */
export function extractPanelStrategyListPayload(payload) {
  if (payload == null) return null;
  if (Array.isArray(payload)) return payload;
  if (typeof payload !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (payload);
  const keys = [
    "strategies",
    "slots",
    "strategy_slots",
    "strategySlots",
    "items",
    "data",
    "results",
    "result",
    "rows",
    "list",
    "records",
    "payload"
  ];
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
    const v = o[k];
    if (Array.isArray(v)) return v;
    if (v != null && typeof v === "object" && !Array.isArray(v)) {
      if (k === "slots" || k === "strategy_slots" || k === "strategySlots") {
        const vals = Object.values(v);
        if (
          vals.length > 0 &&
          vals.every((x) => x != null && typeof x === "object" && !Array.isArray(x))
        ) {
          return vals;
        }
      }
      if (objectLooksLikeStrategySlotRow(v)) return [v];
      const inner = extractPanelStrategyListPayload(v);
      if (inner != null) return inner;
    }
  }
  return null;
}

/**
 * 从 GET /panel/strategy-slots 条目解析展示用策略名（与 normalizePanelStrategyNames 单条规则一致）。
 * @param {unknown} row
 * @returns {string}
 */
export function panelStrategySlotRowName(row) {
  if (row == null) return "";
  if (typeof row === "string") return String(row).trim();
  if (typeof row !== "object") return "";
  const o = /** @type {Record<string, unknown>} */ (row);
  const n =
    o.name ??
    o.strategy ??
    o.class_name ??
    o.strategy_name ??
    o.className ??
    o.strategyClassName ??
    o.strategy_class_name ??
    o.slot_key ??
    o.strategy_class ??
    o.display_name ??
    o.title;
  if (n != null && String(n).trim()) return String(n).trim();
  const fromDetail = strategyNameFromSlotDetailJsonText(slotRowDetailJsonText(row));
  if (fromDetail) return fromDetail;
  return strategyClassFromSlotMmlText(slotRowMmlText(row));
}

/**
 * 与策略卡 / JSON 内 strategy 对齐时可用的全部别名（顶层字段、detailJson.strategy、MML meta）。
 * @param {unknown} row
 * @returns {string[]}
 */
export function panelStrategySlotRowAliases(row) {
  if (row == null) return [];
  /** @type {Set<string>} */
  const set = new Set();
  const push = (s) => {
    const t = String(s || "").trim();
    if (t) set.add(t);
  };
  if (typeof row === "string") {
    push(row);
    return [...set];
  }
  if (typeof row !== "object") return [];
  const o = /** @type {Record<string, unknown>} */ (row);
  const top =
    o.name ??
    o.strategy ??
    o.class_name ??
    o.strategy_name ??
    o.className ??
    o.strategyClassName ??
    o.strategy_class_name ??
    o.slot_key ??
    o.strategy_class ??
    o.display_name ??
    o.title;
  push(top);
  push(strategyNameFromSlotDetailJsonText(slotRowDetailJsonText(row)));
  push(strategyClassFromSlotMmlText(slotRowMmlText(row)));
  return [...set];
}

/** @param {string} text */
function strategyNameFromSlotDetailJsonText(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  try {
    const j = JSON.parse(raw);
    if (j && typeof j === "object" && !Array.isArray(j) && j.strategy != null) {
      const n = String(j.strategy).trim();
      return n || "";
    }
  } catch {
    /* ignore */
  }
  return "";
}

/** @param {string} text */
function strategyClassFromSlotMmlText(text) {
  const raw = String(text || "");
  if (!raw.trim()) return "";
  const m = raw.match(/strategyClass:\s*(\S+)/);
  if (!m || !m[1]) return "";
  return String(m[1]).trim();
}

/**
 * 列表中单条槽位的主键（一般即 JSON 字段 `id`）。详情 GET 的路径与 `slot_id` 查询应使用此值。
 * @param {unknown} row GET /panel/strategy-slots 单条
 */
export function rowServerSlotId(row) {
  if (row == null || typeof row !== "object") return "";
  const pick = (x) => {
    if (x == null || typeof x !== "object" || Array.isArray(x)) return "";
    const r = /** @type {Record<string, unknown>} */ (x);
    const id =
      r.id ??
      r.ID ??
      r.slotPk ??
      r.slot_id ??
      r.strategy_slot_id ??
      r.strategySlotId ??
      r.pk ??
      r.uuid ??
      r.slotId ??
      r.SlotId;
    if (id == null || id === "") return "";
    return String(id);
  };
  const o = /** @type {Record<string, unknown>} */ (row);
  let id = pick(o);
  if (!id) {
    const nested = o.slot ?? o.strategy_slot ?? o.strategySlot ?? o.item ?? o.data;
    id = pick(nested);
  }
  return id;
}

/**
 * 按策略展示名（可多候选）在原始列表中解析服务端槽位 id。
 * @param {unknown} rawRows
 * @param {string[]} nameCandidates 如打开弹窗时的类名、JSON 内 strategy、下拉值
 */
export function resolvePanelStrategySlotServerId(rawRows, ...nameCandidates) {
  if (!Array.isArray(rawRows)) return "";
  const wants = [];
  const lowered = new Set();
  for (const c of nameCandidates) {
    const s = String(c || "").trim();
    if (!s || wants.includes(s)) continue;
    wants.push(s);
    lowered.add(s.toLowerCase());
  }
  if (!wants.length) return "";
  const matchName = (alias) => {
    if (!alias) return false;
    return wants.includes(alias) || lowered.has(String(alias).toLowerCase());
  };
  for (const row of rawRows) {
    const aliases = panelStrategySlotRowAliases(row);
    if (!aliases.some(matchName)) continue;
    const sid = rowServerSlotId(row);
    if (sid) return sid;
  }
  return "";
}

/**
 * 策略展示名 → 服务端槽位 id（同名的后出现的覆盖前者，与列表顺序一致）。
 * @param {unknown} rawRows `extractPanelStrategyListPayload` 得到的数组
 * @returns {Record<string, string>}
 */
export function buildPanelStrategySlotIdByName(rawRows) {
  if (!Array.isArray(rawRows)) return {};
  /** @type {Record<string, string>} */
  const out = {};
  for (const x of rawRows) {
    if (x == null || typeof x !== "object") continue;
    const id = rowServerSlotId(x);
    if (!id) continue;
    const aliases = panelStrategySlotRowAliases(x);
    if (!aliases.length) continue;
    for (const name of aliases) out[name] = String(id);
  }
  return out;
}

/**
 * @param {unknown} row GET /panel/strategy-slots 单条
 * @returns {string}
 */
export function slotRowDetailJsonText(row) {
  if (row == null || typeof row !== "object") return "";
  const o = /** @type {Record<string, unknown>} */ (row);
  const v = o.detailJson ?? o.detail_json ?? o.detailJon;
  return v != null ? String(v) : "";
}

/**
 * @param {unknown} row GET /panel/strategy-slots 单条
 * @returns {string}
 */
export function slotRowMmlText(row) {
  if (row == null || typeof row !== "object") return "";
  const o = /** @type {Record<string, unknown>} */ (row);
  const v = o.mml;
  return v != null ? String(v) : "";
}

/**
 * 解析 GET …/strategy-slots（详情或含正文列表）响应为编辑器用的 detailJson / mml 字符串。
 * 兼容：扁平对象、{ data|slot|item|result }、分页 { items:[{ detailJson, mml }] } 等。
 * @param {unknown} payload
 * @returns {{ detailJson: string, mml: string }}
 */
export function extractPanelStrategySlotDetailBodies(payload) {
  if (payload == null) return { detailJson: "", mml: "" };

  /** @type {Record<string, unknown> | null} */
  let row = null;

  if (typeof payload === "object" && !Array.isArray(payload)) {
    const wrap = /** @type {Record<string, unknown>} */ (payload);
    const items = wrap.items;
    if (
      Array.isArray(items) &&
      items.length > 0 &&
      items[0] != null &&
      typeof items[0] === "object" &&
      !Array.isArray(items[0])
    ) {
      row = /** @type {Record<string, unknown>} */ (items[0]);
    } else {
      const inner = wrap.data ?? wrap.slot ?? wrap.item ?? wrap.result;
      if (inner != null && typeof inner === "object" && !Array.isArray(inner)) {
        row = /** @type {Record<string, unknown>} */ (inner);
      } else if (Array.isArray(inner) && inner.length > 0) {
        const first = inner[0];
        if (first != null && typeof first === "object" && !Array.isArray(first)) {
          row = /** @type {Record<string, unknown>} */ (first);
        }
      }
    }
    if (
      row == null &&
      (wrap.detailJson != null ||
        wrap.detail_json != null ||
        wrap.detailJon != null ||
        wrap.mml != null)
    ) {
      row = wrap;
    }
    if (row == null) {
      for (const k of ["rows", "results", "records"]) {
        const arr = wrap[k];
        if (!Array.isArray(arr) || arr.length === 0) continue;
        const first = arr[0];
        if (first != null && typeof first === "object" && !Array.isArray(first)) {
          row = /** @type {Record<string, unknown>} */ (first);
          break;
        }
      }
    }
  }

  if (row == null || typeof row !== "object") return { detailJson: "", mml: "" };
  const djRaw = row.detailJson ?? row.detail_json ?? row.detailJon;
  const mm = row.mml;
  let detailJson = "";
  if (djRaw != null) {
    if (typeof djRaw === "string") detailJson = djRaw;
    else if (typeof djRaw === "object") {
      try {
        detailJson = JSON.stringify(djRaw, null, 2);
      } catch {
        detailJson = String(djRaw);
      }
    } else detailJson = String(djRaw);
  }
  return {
    detailJson,
    mml: mm != null ? String(mm) : ""
  };
}

/**
 * @param {unknown} rawRows
 * @param {string} name 策略展示名
 * @returns {Record<string, unknown> | null}
 */
export function findPanelStrategySlotRow(rawRows, name) {
  const n = String(name || "").trim();
  if (!n || !Array.isArray(rawRows)) return null;
  const nl = n.toLowerCase();
  for (const row of rawRows) {
    const aliases = panelStrategySlotRowAliases(row);
    if (aliases.some((a) => a === n || a.toLowerCase() === nl)) {
      return /** @type {Record<string, unknown>} */ (row);
    }
  }
  for (const row of rawRows) {
    const pn = panelStrategySlotRowName(row);
    if (pn && (pn === n || pn.toLowerCase() === nl)) {
      return /** @type {Record<string, unknown>} */ (row);
    }
  }
  return null;
}

/** @param {unknown} profit */
function profitRatioPercent(profit) {
  if (!profit || typeof profit !== "object") return null;
  const p = /** @type {Record<string, unknown>} */ (profit);
  if (p.profit_all_ratio == null) return null;
  const n = Number(p.profit_all_ratio);
  if (!Number.isFinite(n)) return null;
  return n * 100;
}

/** @param {unknown} profit 0–1 或已是百分比 */
function winratePercent(profit) {
  if (!profit || typeof profit !== "object") return null;
  const p = /** @type {Record<string, unknown>} */ (profit);
  const w = p.winrate ?? p.win_rate;
  if (w == null) return null;
  const n = Number(w);
  if (!Number.isFinite(n)) return null;
  if (n >= 0 && n <= 1) return n * 100;
  return n;
}

/**
 * @param {unknown} showConfig
 * @param {string} name
 * @param {(k: string) => string} t
 */
function strategyStatusLabel(showConfig, name, t) {
  const inConfig = new Set(strategyNamesFromShowConfig(showConfig));
  const n = String(name || "").trim();
  if (!inConfig.has(n)) {
    return {
      text: t("data.strategy.status.notInConfig"),
      cls: "da-strategy-status--inactive"
    };
  }
  const st = normalizeBotState(showConfig?.state);
  if (st === "running") {
    return { text: t("data.strategy.status.running"), cls: "da-strategy-status--running" };
  }
  if (st === "paused") {
    return { text: t("data.strategy.status.paused"), cls: "da-strategy-status--paused" };
  }
  if (st === "stopped") {
    return { text: t("data.strategy.status.stopped"), cls: "da-strategy-status--stopped" };
  }
  return {
    text: t("data.strategy.status.unknown"),
    cls: "da-strategy-status--inactive"
  };
}

/**
 * @param {string[]} names
 * @param {unknown} showConfig
 */
function countRunningInConfig(names, showConfig) {
  const inConfig = new Set(strategyNamesFromShowConfig(showConfig));
  const st = normalizeBotState(showConfig?.state);
  if (st !== "running") return 0;
  let c = 0;
  for (const n of names) {
    if (inConfig.has(String(n).trim())) c += 1;
  }
  return c;
}

/**
 * @param {unknown} panelList 与接口一致的策略条目（可重复类名）；字符串数组或原始 strategies 数组
 * @param {unknown} showConfig
 * @param {unknown} profit
 * @param {(k: string) => string} t
 * @param {(k: string, vars: Record<string, string | number>) => string} tReplace
 */
export function applyDataStrategiesList(panelList, showConfig, profit, t, tReplace) {
  const root = document.getElementById("dataStrategiesList");
  const meta = document.getElementById("dataStrategiesMeta");
  if (!root) return;

  const names = Array.isArray(panelList)
    ? panelList.every((x) => typeof x === "string")
      ? panelList.map((x) => String(x || "").trim()).filter(Boolean)
      : normalizePanelStrategyNames(panelList, false)
    : [];

  const ratioPct = profitRatioPercent(profit);
  const wrPct = winratePercent(profit);

  const ratioStr =
    ratioPct != null && Number.isFinite(ratioPct)
      ? `${ratioPct >= 0 ? "+" : ""}${ratioPct.toFixed(2)}%`
      : "—";
  const ratioCls =
    ratioPct != null && Number.isFinite(ratioPct) ? (ratioPct >= 0 ? "positive" : "negative") : "";

  const wrStr =
    wrPct != null && Number.isFinite(wrPct) ? `${wrPct.toFixed(1)}%` : "—";

  if (meta) {
    if (!names.length) {
      meta.textContent = t("data.strategiesMetaEmpty");
    } else {
      const running = countRunningInConfig(names, showConfig);
      meta.textContent = tReplace("data.strategiesMetaSummary", { total: names.length, running });
    }
  }

  if (!names.length) {
    root.innerHTML = `<div class="da-strategy-card da-strategy-card--placeholder"><small class="muted">${escapeHtml(
      t("data.noStrategy")
    )}</small></div>`;
    return;
  }

  const inConfigSet = new Set(strategyNamesFromShowConfig(showConfig));
  const dash = "—";

  root.innerHTML = names
    .map((name, idx) => {
      const { text: stText, cls: stCls } = strategyStatusLabel(showConfig, name, t);
      const enabled = inConfigSet.has(String(name).trim());
      const ratioDisplay = enabled ? ratioStr : dash;
      const wrDisplay = enabled ? wrStr : dash;
      const ratioEmCls = enabled ? ratioCls : "da-strategy-metric--na";
      return `<div class="da-strategy-card" data-strategy-row="${idx}">
        <div class="da-strategy-card__row">
          <strong title="${escapeHtml(name)}">${escapeHtml(name)}</strong>
          <span class="da-strategy-status ${escapeHtml(stCls)}">${escapeHtml(stText)}</span>
        </div>
        <div class="da-strategy-card__profit">
          <span class="da-strategy-metric-label">${escapeHtml(t("data.profitAllRatio"))}</span>
          <em class="${escapeHtml(ratioEmCls)}">${escapeHtml(ratioDisplay)}</em>
        </div>
        <small
          ><span class="da-strategy-metric-label">${escapeHtml(t("data.winRate"))}</span>: ${escapeHtml(wrDisplay)}</small
        >
      </div>`;
    })
    .join("");
}
