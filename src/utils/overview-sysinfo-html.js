/**
 * 概览「本机状态」：解析 GET /sysinfo 的多种 JSON 形态并输出与参考 UI 一致的结构化 HTML。
 */

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** @param {Record<string, unknown>} o @param {string[]} keys */
function pickNum(o, keys) {
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
    const n = Number(o[k]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** @param {Record<string, unknown>} o @param {string[]} keys */
function pickStr(o, keys) {
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
    const v = o[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

/** @param {Record<string, unknown>} o @param {string[]} keys */
function pickArray(o, keys) {
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
    const v = o[k];
    if (Array.isArray(v) && v.length) return v;
  }
  return null;
}

/**
 * @param {unknown} raw
 * @returns {null | {
 *   ram: number|null,
 *   cpuAvg: number|null,
 *   l1: number|null, l5: number|null, l15: number|null,
 *   cpus: number|null,
 *   per: number[]|null,
 *   ts: string
 * }}
 */
export function parseSysinfoPayload(raw) {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return parseSysinfoPayload(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (raw);

  const ram =
    pickNum(o, ["ram_pct", "memory_pct", "memory_percent", "mem_used_pct", "ram_percent"]) ??
    (o.ram && typeof o.ram === "object"
      ? pickNum(/** @type {Record<string, unknown>} */ (o.ram), ["ram_pct", "percent", "pct", "used_pct"])
      : null);

  let per =
    pickArray(o, ["cpu_percents", "cpu_pct", "per_cpu", "cpu_cores", "cpus", "cpu_per_cpu"]) ||
    (o.cpu && typeof o.cpu === "object"
      ? pickArray(/** @type {Record<string, unknown>} */ (o.cpu), ["per_cpu", "percents", "cores", "cpu_pct"])
      : null);

  let cpuAvg =
    pickNum(o, ["cpu_avg", "cpu_mean", "avg_cpu"]) ||
    (o.cpu && typeof o.cpu === "object"
      ? pickNum(/** @type {Record<string, unknown>} */ (o.cpu), ["average", "avg", "cpu_percent", "total", "percent"])
      : null);
  if (cpuAvg == null) cpuAvg = pickNum(o, ["cpu_percent"]);

  if (cpuAvg == null && per && per.length) {
    const nums = per.map((x) => Number(x)).filter((x) => Number.isFinite(x));
    if (nums.length) cpuAvg = nums.reduce((a, b) => a + b, 0) / nums.length;
  }

  let l1 = pickNum(o, ["load_1", "load1", "la1", "loadavg_1"]);
  let l5 = pickNum(o, ["load_5", "load5", "la5", "loadavg_5"]);
  let l15 = pickNum(o, ["load_15", "load15", "la15", "loadavg_15"]);
  const la = o.load_avg ?? o.loadavg;
  if (Array.isArray(la) && la.length >= 1) {
    if (l1 == null) l1 = Number(la[0]);
    if (l5 == null && la.length > 1) l5 = Number(la[1]);
    if (l15 == null && la.length > 2) l15 = Number(la[2]);
  }
  if (o.load && typeof o.load === "object") {
    const L = /** @type {Record<string, unknown>} */ (o.load);
    if (l1 == null) l1 = pickNum(L, ["1", "m1", "one", "avg_1"]);
    if (l5 == null) l5 = pickNum(L, ["5", "m5", "five", "avg_5"]);
    if (l15 == null) l15 = pickNum(L, ["15", "m15", "avg_15"]);
  }

  let cpus =
    pickNum(o, ["cpu_count", "logical_cpus", "cpu_logical", "n_cpus", "count"]) ||
    (o.cpu && typeof o.cpu === "object"
      ? pickNum(/** @type {Record<string, unknown>} */ (o.cpu), ["count", "logical", "logical_count"])
      : null);
  if (cpus == null && per && per.length) cpus = per.length;

  const perNums = per ? per.map((x) => Number(x)).filter((x) => Number.isFinite(x)) : null;

  const ts = pickStr(o, [
    "timestamp",
    "last_update",
    "generated",
    "robot_tag",
    "bot_note",
    "note",
    "server_time",
    "time"
  ]);

  return {
    ram,
    cpuAvg,
    l1,
    l5,
    l15,
    cpus,
    per: perNums && perNums.length ? perNums : null,
    ts
  };
}

function hasRenderableData(v) {
  if (!v) return false;
  if (v.ts) return true;
  if (v.ram != null && Number.isFinite(v.ram)) return true;
  if (v.cpuAvg != null && Number.isFinite(v.cpuAvg)) return true;
  if (v.l1 != null || v.l5 != null || v.l15 != null) return true;
  if (v.cpus != null && Number.isFinite(v.cpus)) return true;
  if (v.per && v.per.length) return true;
  return false;
}

/** @param {number|null|undefined} x @param {number} d */
function fmtLoad(x, d = 2) {
  if (x == null || !Number.isFinite(x)) return "—";
  return x.toFixed(d);
}

/** @param {number|null|undefined} x @param {number} d */
function fmtPct(x, d = 1) {
  if (x == null || !Number.isFinite(x)) return "—";
  return `${x.toFixed(d)}`;
}

/**
 * @param {number|null} l1
 * @param {number|null} cpus
 * @param {(k: string) => string} t
 */
function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * 将 ISO 字符串、Unix 秒/毫秒或数字字符串解析为本地时间 YYYY-MM-DD HH:mm:ss。
 * @param {unknown} raw
 * @returns {string}
 */
function formatTimestampLocalYmdHms(raw) {
  if (raw == null || raw === "") return "";
  let ms;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    ms = raw > 1e12 ? raw : Math.round(raw * 1000);
  } else {
    const s = String(raw).trim();
    if (!s) return "";
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      if (!Number.isFinite(n)) return "";
      ms = s.length >= 13 ? n : n * 1000;
    } else {
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return "";
      ms = d.getTime();
    }
  }
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/**
 * @param {unknown} health GET /health 响应体
 * @returns {string} 使用 last_process 格式化的本地时间，不可解析时为空串
 */
function robotTagFromHealth(health) {
  if (!health || typeof health !== "object") return "";
  const o = /** @type {Record<string, unknown>} */ (health);
  const raw = o.last_process ?? o.lastProcess;
  return formatTimestampLocalYmdHms(raw);
}

function loadHintLine(l1, cpus, t) {
  if (l1 == null || cpus == null || !(cpus > 0)) return "";
  const ratio = l1 / cpus;
  let hintKey = "overview.telemetry.loadAvg.hint.light";
  if (ratio >= 1.25) hintKey = "overview.telemetry.loadAvg.hint.heavy";
  else if (ratio >= 1) hintKey = "overview.telemetry.loadAvg.hint.busy";
  else if (ratio >= 0.5) hintKey = "overview.telemetry.loadAvg.hint.moderate";
  let line = t("overview.telemetry.loadAvg.coresLine");
  line = line.split("{{n}}").join(String(Math.floor(cpus)));
  line = line.split("{n}").join(String(Math.floor(cpus)));
  line = line.split("{{hint}}").join(t(hintKey));
  line = line.split("{hint}").join(t(hintKey));
  return line;
}

/**
 * @param {HTMLElement|null} el
 * @param {unknown} raw
 * @param {(k: string) => string} t
 * @param {(k: string, vars: Record<string, string | number>) => string} tReplace
 * @param {unknown} [healthRaw] GET /health 响应；「机器人便签」优先取其中的 last_process
 */
export function renderOverviewSysinfoInto(el, raw, t, tReplace, healthRaw) {
  if (!el) return;
  const view = parseSysinfoPayload(raw);
  if (!hasRenderableData(view)) {
    el.className = "ds-sysinfo ds-sysinfo--empty muted";
    el.innerHTML = `<p class="ds-sysinfo-unavailable">${esc(t("overview.sysinfo.unavailable"))}</p>`;
    return;
  }

  el.className = "ds-sysinfo";

  const ramMain =
    view.ram != null && Number.isFinite(view.ram) ? `${fmtPct(view.ram, 1)}%` : "—";
  let ramDesc = t("overview.telemetry.friendly.ramVal");
  ramDesc = ramDesc.split("{{pct}}").join(fmtPct(view.ram, 1));
  ramDesc = ramDesc.split("{pct}").join(fmtPct(view.ram, 1));

  const cpuMain =
    view.cpuAvg != null && Number.isFinite(view.cpuAvg) ? `${tReplace("overview.sysinfo.cpuApprox", { pct: fmtPct(view.cpuAvg, 1) })}` : "—";
  let cpuDesc = t("overview.telemetry.friendly.cpuAvgVal");
  cpuDesc = cpuDesc.split("{{pct}}").join(fmtPct(view.cpuAvg, 1));
  cpuDesc = cpuDesc.split("{pct}").join(fmtPct(view.cpuAvg, 1));

  const l1s = fmtLoad(view.l1);
  const l5s = fmtLoad(view.l5);
  const l15s = fmtLoad(view.l15);
  const loadMain = tReplace("overview.sysinfo.loadSentence", { l1: l1s, l5: l5s, l15: l15s });
  const loadSub = loadHintLine(view.l1, view.cpus, t);

  let cpuCountMain = "—";
  let cpuCountDesc = "";
  if (view.cpus != null && Number.isFinite(view.cpus)) {
    cpuCountMain = tReplace("overview.sysinfo.cpuCountShort", { n: Math.floor(view.cpus) });
    cpuCountDesc = t("overview.telemetry.friendly.cpuCountVal");
    cpuCountDesc = cpuCountDesc.split("{{n}}").join(String(Math.floor(view.cpus)));
    cpuCountDesc = cpuCountDesc.split("{n}").join(String(Math.floor(view.cpus)));
  }

  let perCoreHtml = "";
  if (view.per && view.per.length) {
    const parts = view.per.map((pct, idx) =>
      tReplace("overview.sysinfo.perCoreItem", { i: idx + 1, pct: fmtPct(pct, 1) })
    );
    perCoreHtml = `<div class="ds-sysinfo-main ds-sysinfo-percore">${esc(parts.join("，"))}</div>`;
  } else {
    perCoreHtml = `<div class="ds-sysinfo-main muted">—</div>`;
  }

  const tagFromHealth = robotTagFromHealth(healthRaw);
  const tagVal = tagFromHealth
    ? esc(tagFromHealth)
    : view.ts
      ? esc(view.ts)
      : "—";

  el.innerHTML = `
<div class="ds-sysinfo-row">
  <div class="ds-sysinfo-k">${esc(t("overview.sysinfo.robotTag"))}</div>
  <div class="ds-sysinfo-v"><div class="ds-sysinfo-main ds-sysinfo-robot-time mono">${tagVal}</div></div>
</div>
<div class="ds-sysinfo-row">
  <div class="ds-sysinfo-k">${esc(t("overview.telemetry.friendly.ramLabel"))}</div>
  <div class="ds-sysinfo-v">
    <div class="ds-sysinfo-main">${esc(ramMain)}</div>
    <div class="ds-sysinfo-desc muted">${esc(ramDesc)}</div>
  </div>
</div>
<div class="ds-sysinfo-row">
  <div class="ds-sysinfo-k">${esc(t("overview.telemetry.friendly.cpuAvgLabel"))}</div>
  <div class="ds-sysinfo-v">
    <div class="ds-sysinfo-main">${esc(cpuMain)}</div>
    <div class="ds-sysinfo-desc muted">${esc(cpuDesc)}</div>
  </div>
</div>
<div class="ds-sysinfo-row">
  <div class="ds-sysinfo-k">${esc(t("overview.telemetry.friendly.loadAvgLabel"))}</div>
  <div class="ds-sysinfo-v">
    <div class="ds-sysinfo-main">${esc(loadMain)}</div>
    ${loadSub ? `<div class="ds-sysinfo-desc muted">${esc(loadSub)}</div>` : ""}
  </div>
</div>
<div class="ds-sysinfo-row">
  <div class="ds-sysinfo-k">${esc(t("overview.telemetry.friendly.cpuCountLabel"))}</div>
  <div class="ds-sysinfo-v">
    <div class="ds-sysinfo-main">${esc(cpuCountMain)}</div>
    ${cpuCountDesc ? `<div class="ds-sysinfo-desc muted">${esc(cpuCountDesc)}</div>` : ""}
  </div>
</div>
<div class="ds-sysinfo-row ds-sysinfo-row--last">
  <div class="ds-sysinfo-k">${esc(t("overview.telemetry.friendly.perCoreLabel"))}</div>
  <div class="ds-sysinfo-v">${perCoreHtml}</div>
</div>`;
}
