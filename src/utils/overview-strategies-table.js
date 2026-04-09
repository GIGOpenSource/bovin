/**
 * 系统概览「运行中的策略」表：仅依据 GET /show_config 解析策略名与机器人状态，
 * 盈亏/回撤等同进程下共用 GET /profit、GET /count、GET /status 的聚合字段。
 * 「24h 盈亏」列展示 GET /profit 的 `profit_all_coin`（计价币绝对盈亏）。
 */
import { aggregateForStrategy, normalizeBotState } from "../components/control-console.js";
import { extractMaxDrawdownPercent } from "./overview-kpi.js";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {unknown} showConfig
 * @returns {string[]}
 */
export function strategyNamesFromShowConfig(showConfig) {
  if (!showConfig || typeof showConfig !== "object") return [];
  const sc = /** @type {Record<string, unknown>} */ (showConfig);
  const st = sc.strategies;
  if (st && typeof st === "object" && !Array.isArray(st)) {
    return Object.keys(st)
      .map((k) => String(k).trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }
  const single = String(sc.strategy ?? "").trim();
  if (!single) return [];
  if (single.includes(",")) {
    return single
      .split(",")
      .map((x) => String(x).trim())
      .filter(Boolean);
  }
  return [single];
}

/** @param {unknown} showConfig */
function coreAssetCell(showConfig) {
  if (!showConfig || typeof showConfig !== "object") return "—";
  const sc = /** @type {Record<string, unknown>} */ (showConfig);
  const ex = sc.exchange && typeof sc.exchange === "object" ? /** @type {Record<string, unknown>} */ (sc.exchange) : {};
  const wl = ex.pair_whitelist ?? sc.pair_whitelist;
  if (Array.isArray(wl) && wl.length) {
    const first = String(wl[0] ?? "").trim();
    if (first) return first;
  }
  const stake = String(sc.stake_currency ?? "").trim();
  return stake || "—";
}

/** @param {string} raw @param {(k: string) => string} t */
function botStateLabel(raw, t) {
  const n = normalizeBotState(raw);
  if (n === "running") return t("freq.state.running");
  if (n === "stopped") return t("freq.state.stopped");
  if (n === "paused") return t("freq.state.paused");
  if (n === "reload") return t("freq.state.reload");
  const z = String(raw || "").trim();
  return z ? `${t("freq.state.other")}: ${z}` : "—";
}

/**
 * @param {unknown} showConfig
 * @param {unknown} profit
 * @param {unknown} count
 * @param {unknown} statusRows
 * @param {(k: string) => string} t
 * @param {(k: string, vars: Record<string, string | number>) => string} tReplace
 */
export function applyOverviewStrategiesTable(showConfig, profit, count, statusRows, t, tReplace) {
  const body = document.getElementById("overviewStrategiesBody");
  const summaryEl = document.getElementById("overviewStrategiesSummary");
  if (!body) return;

  const names = strategyNamesFromShowConfig(showConfig);
  const p = profit && typeof profit === "object" ? /** @type {Record<string, unknown>} */ (profit) : {};
  const stakeCur = String(showConfig?.stake_currency ?? "").trim() || "—";
  const profitPct = p.profit_all_ratio != null ? Number(p.profit_all_ratio) * 100 : null;
  const pnlCoinRaw = p.profit_all_coin ?? p.profitAllCoin;
  const pnlCoin = pnlCoinRaw != null ? Number(pnlCoinRaw) : NaN;
  const ddp = extractMaxDrawdownPercent(p);
  const st = normalizeBotState(showConfig?.state);
  const rows = Array.isArray(statusRows) ? statusRows : [];
  const activeGlobal = String(showConfig?.strategy ?? "").trim();

  let run = 0;
  let pause = 0;
  let err = 0;
  if (names.length) {
    if (st === "running") run = names.length;
    else if (st === "paused") pause = names.length;
    else err = names.length;
  }

  if (summaryEl) {
    summaryEl.textContent = tReplace("overview.strategies.counts", { run, pause, err });
  }

  if (!names.length) {
    body.innerHTML = `<tr class="ds-strategy-table-empty"><td class="muted" colspan="6">${esc(
      t("overview.strategies.empty")
    )}</td></tr>`;
    return;
  }

  let pnl24 = "—";
  let pnl24Cls = "";
  if (Number.isFinite(pnlCoin)) {
    const curSuffix = stakeCur && stakeCur !== "—" ? ` ${stakeCur}` : "";
    pnl24 = `${pnlCoin >= 0 ? "+" : ""}${pnlCoin.toLocaleString(undefined, { maximumFractionDigits: 2 })}${curSuffix}`;
    pnl24Cls = pnlCoin >= 0 ? "positive" : "negative";
  }
  const pctStr =
    profitPct != null && Number.isFinite(profitPct)
      ? `${profitPct >= 0 ? "+" : ""}${profitPct.toFixed(2)}%`
      : "—";
  const pctCls = profitPct != null && Number.isFinite(profitPct) ? (profitPct >= 0 ? "positive" : "negative") : "";
  const ddStr = ddp != null && Number.isFinite(ddp) ? `${Math.abs(ddp).toFixed(2)}%` : "—";

  const stateText = botStateLabel(showConfig?.state, t);

  body.innerHTML = names
    .map((name) => {
      const core = coreAssetCell(showConfig);
      const { openCount, stake } = aggregateForStrategy(rows, name, activeGlobal);
      const expHint =
        openCount > 0 || stake > 0
          ? `${stake.toFixed(2)} ${esc(stakeCur)} · ${openCount} open`
          : esc(stakeCur);
      return `<tr>
        <td class="mono">${esc(name)}</td>
        <td>${esc(core)}<small class="muted" style="display:block;font-size:11px;margin-top:2px;">${expHint}</small></td>
        <td class="${esc(pnl24Cls)}">${esc(pnl24)}</td>
        <td class="${esc(pctCls)}">${esc(pctStr)}</td>
        <td class="negative">${esc(ddStr)}</td>
        <td>${esc(stateText)}</td>
      </tr>`;
    })
    .join("");
}
