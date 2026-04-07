/**
 * 数据面板左侧「策略」列表：名称来自 GET /panel/strategies，
 * 运行状态对照 GET /show_config，收益率/胜率来自 GET /profit（全账户聚合字段）。
 * 刷新：`panel-poll.js` 的 `panelTick` 每轮（与概览 KPI 相同间隔）调用 `applyDataStrategiesList`。
 */
import { normalizeBotState } from "../components/control-console.js";
import { escapeHtml } from "./html-utils.js";
import { strategyNamesFromShowConfig } from "./overview-strategies-table.js";

/**
 * @param {unknown} raw GET /panel/strategies 返回的 strategies 数组
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
      const n = o.name ?? o.strategy ?? o.class_name ?? o.strategy_name ?? o.className;
      if (n != null && String(n).trim()) out.push(String(n).trim());
    }
  }
  return dedupe ? [...new Set(out)] : out;
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
