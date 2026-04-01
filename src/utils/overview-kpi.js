/**
 * 概览三张 KPI 卡：解析 GET /balance、/daily、/profit、/count 的常用字段并生成 SVG 折线路径。
 * 与 Freqtrade / Bovin 转发形态兼容多种键名。
 */

/**
 * @param {number[]} values
 * @param {number} w
 * @param {number} h
 * @param {number} pad
 * @returns {string}
 */
export function buildSparkPolylinePath(values, w = 100, h = 20, pad = 1.5) {
  const v = (Array.isArray(values) ? values : [])
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n));
  if (v.length === 0) return `M${pad} ${h / 2} L${w - pad} ${h / 2}`;
  if (v.length === 1) {
    const y = h / 2;
    return `M${pad} ${y} L${w - pad} ${y}`;
  }
  const min = Math.min(...v);
  const max = Math.max(...v);
  const span = max - min || 1;
  const innerW = w - 2 * pad;
  const innerH = h - 2 * pad;
  return v
    .map((val, i) => {
      const x = pad + (i / (v.length - 1)) * innerW;
      const y = pad + (1 - (val - min) / span) * innerH;
      const cmd = i === 0 ? "M" : "L";
      return `${cmd}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

/** @param {unknown} balance */
export function extractBalanceTotal(balance) {
  if (!balance || typeof balance !== "object") return null;
  const b = /** @type {Record<string, unknown>} */ (balance);
  const total = Number(b.total);
  if (Number.isFinite(total) && total >= 0) return total;
  const cur = Array.isArray(b.currencies) ? b.currencies : [];
  let sum = 0;
  let any = false;
  for (const c of cur) {
    if (!c || typeof c !== "object") continue;
    const row = /** @type {Record<string, unknown>} */ (c);
    const es = Number(row.est_stake ?? row.balance ?? row.free ?? 0);
    if (Number.isFinite(es) && es > 0) {
      sum += es;
      any = true;
    }
  }
  return any ? sum : null;
}

/** @param {unknown} balance @param {unknown} daily */
export function pickStakeCurrency(balance, daily) {
  const b = balance && typeof balance === "object" ? /** @type {Record<string, unknown>} */ (balance) : {};
  const d = daily && typeof daily === "object" ? /** @type {Record<string, unknown>} */ (daily) : {};
  const s = String(b.stake ?? d.stake_currency ?? d.stake ?? "USDT").trim();
  return s || "USDT";
}

/** @param {unknown} dailyPayload */
export function dailyRowsChronological(dailyPayload) {
  if (!dailyPayload || typeof dailyPayload !== "object") return [];
  const data = /** @type {Record<string, unknown>} */ (dailyPayload).data;
  if (!Array.isArray(data)) return [];
  return [...data].sort((a, b) => {
    const da = a && typeof a === "object" ? String((/** @type {Record<string, unknown>} */ (a)).date ?? "") : "";
    const db = b && typeof b === "object" ? String((/** @type {Record<string, unknown>} */ (b)).date ?? "") : "";
    return da.localeCompare(db);
  });
}

/**
 * 净资产走势：优先 fiat_value；否则用 abs_profit 累加，末点尽量对齐 balanceTotal。
 * @param {unknown} dailyPayload
 * @param {number | null} balanceTotal
 */
export function seriesNetWorth(dailyPayload, balanceTotal) {
  const rows = dailyRowsChronological(dailyPayload);
  const fiat = rows
    .map((r) => (r && typeof r === "object" ? Number((/** @type {Record<string, unknown>} */ (r)).fiat_value) : NaN))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (fiat.length >= 2) return fiat;

  const profits = rows.map((r) =>
    r && typeof r === "object" ? Number((/** @type {Record<string, unknown>} */ (r)).abs_profit ?? 0) : 0
  );
  if (!profits.length) {
    if (balanceTotal != null && Number.isFinite(balanceTotal)) return [balanceTotal * 0.995, balanceTotal];
    return [0, 0];
  }
  const sumP = profits.reduce((a, x) => a + x, 0);
  let base = 0;
  if (balanceTotal != null && Number.isFinite(balanceTotal)) base = balanceTotal - sumP;
  const out = [];
  let acc = base;
  for (const p of profits) {
    acc += p;
    out.push(acc);
  }
  if (balanceTotal != null && Number.isFinite(balanceTotal) && out.length) out[out.length - 1] = balanceTotal;
  return out;
}

/** @param {unknown} dailyPayload */
export function seriesDailyAbsProfit(dailyPayload) {
  const rows = dailyRowsChronological(dailyPayload);
  return rows.map((r) =>
    r && typeof r === "object" ? Number((/** @type {Record<string, unknown>} */ (r)).abs_profit ?? 0) : 0
  );
}

/** 由权益序列估算逐点回撤 %（相对历史峰值，≤0） */
export function seriesDrawdownPercent(equitySeries) {
  const eq = Array.isArray(equitySeries) ? equitySeries.map(Number).filter((n) => Number.isFinite(n)) : [];
  if (eq.length < 2) return [0, 0];
  let peak = eq[0];
  return eq.map((e) => {
    peak = Math.max(peak, e);
    if (!(peak > 0)) return 0;
    return ((e - peak) / peak) * 100;
  });
}

/** @param {unknown} profit */
export function extractMaxDrawdownPercent(profit) {
  if (!profit || typeof profit !== "object") return null;
  const p = /** @type {Record<string, unknown>} */ (profit);
  const raw = Number(
    p.max_drawdown ?? p.max_drawdown_account ?? p.drawdown ?? p.max_drawdown_pct ?? NaN
  );
  if (!Number.isFinite(raw)) return null;
  if (Math.abs(raw) <= 1) return raw * 100;
  return raw;
}

/** @param {unknown} count */
export function formatOpenPositionsSubtitle(count) {
  const c = count && typeof count === "object" ? /** @type {Record<string, unknown>} */ (count) : {};
  const cur = Number(c.current ?? c.current_trades ?? c.open_trades ?? 0);
  const max = Number(c.max ?? c.max_open_trades ?? c.maximum_open_trades ?? 0);
  if (!Number.isFinite(cur)) return "—";
  const maxStr = Number.isFinite(max) && max > 0 ? String(Math.floor(max)) : "—";
  return `${Math.floor(cur)} / ${maxStr}`;
}

/** @param {unknown} dailyPayload */
export function computeWinRatePercent(dailyPayload) {
  const rows = dailyRowsChronological(dailyPayload);
  let wins = 0;
  let trades = 0;
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const o = /** @type {Record<string, unknown>} */ (r);
    const w = Number(o.wins ?? o.winning_trades ?? NaN);
    const tr = Number(o.trades ?? o.trade_count ?? NaN);
    if (Number.isFinite(w)) wins += w;
    if (Number.isFinite(tr)) trades += tr;
  }
  if (trades > 0) return (wins / trades) * 100;
  const last = rows[rows.length - 1];
  if (last && typeof last === "object") {
    const o = /** @type {Record<string, unknown>} */ (last);
    const w = Number(o.wins ?? NaN);
    const tr = Number(o.trades ?? NaN);
    if (Number.isFinite(tr) && tr > 0 && Number.isFinite(w)) return (w / tr) * 100;
  }
  return null;
}

/** @param {unknown} dailyPayload */
export function lastDayAbsProfit(dailyPayload) {
  const rows = dailyRowsChronological(dailyPayload);
  const last = rows[rows.length - 1];
  if (!last || typeof last !== "object") return null;
  const v = Number((/** @type {Record<string, unknown>} */ (last)).abs_profit);
  return Number.isFinite(v) ? v : null;
}
