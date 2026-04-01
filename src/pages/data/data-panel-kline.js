/**
 * 数据面板：GET /panel/binance_klines 解析与 Lightweight Charts 挂载
 */
import { createChart } from "lightweight-charts";

/** UI 交易对 → 请求参数 pair（USD 按 USDT 处理，与 Bovin 转发一致） */
export function pairForBinanceKlinesRequest(displayPair) {
  const raw = String(displayPair || "BTC/USDT").trim();
  const [base, quote] = raw.split("/").map((s) => s.trim().toUpperCase());
  if (!base) return "BTC/USDT";
  const q = !quote || quote === "USD" ? "USDT" : quote;
  return `${base}/${q}`;
}

/** 解析 /panel/binance_klines 的 data 为 [openTime, o, h, l, c, v][] */
export function parseBinanceKlinesRows(raw) {
  if (!raw || typeof raw !== "object") return [];
  const data = Array.isArray(raw.data) ? raw.data : [];
  const out = [];
  for (const row of data) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const tOpen = Number(row[0]);
    const o = Number(row[1]);
    const h = Number(row[2]);
    const l = Number(row[3]);
    const c = Number(row[4]);
    const v = row.length >= 6 ? Number(row[5] ?? 0) : 0;
    /** 币安 klines 第 8 列为 quote asset volume；缺失时用 close×volume 近似 USDT 成交额 */
    let qv = row.length >= 8 ? Number(row[7] ?? 0) : NaN;
    if (![tOpen, o, h, l, c].every(Number.isFinite)) continue;
    if (o <= 0 || h <= 0 || l <= 0 || c <= 0) continue;
    const vSafe = Number.isFinite(v) && v >= 0 ? v : 0;
    if (!Number.isFinite(qv) || qv < 0) qv = 0;
    if (qv === 0 && vSafe > 0 && c > 0) qv = c * vSafe;
    out.push([tOpen, o, h, l, c, vSafe, Number.isFinite(qv) && qv >= 0 ? qv : 0]);
  }
  return out;
}

function toLwTimeSec(dateLike, fallbackIdx = 0) {
  if (typeof dateLike === "number" && Number.isFinite(dateLike)) {
    const n = Math.floor(dateLike);
    const sec = n > 1_000_000_000_000 ? Math.floor(n / 1000) : n;
    if (sec > 946684800 && sec < 5_000_000_000) return sec;
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

/** 按开盘时间升序，供画布与 LWC 共用 */
export function sortKlineRowsByTime(rows) {
  const mini = rows.filter((r) => Array.isArray(r) && r.length >= 5);
  if (!mini.length) return [];
  const keyed = mini.map((r, idx) => ({ r, k: toLwTimeSec(r[0], mini.length - idx) }));
  keyed.sort((a, b) => a.k - b.k);
  return keyed.map((x) => x.r);
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

function movingAverage(arr, period) {
  return arr.map((_, i) => {
    if (i < period - 1) return null;
    const win = arr.slice(i - period + 1, i + 1);
    const sum = win.reduce((s, v) => s + Number(v || 0), 0);
    return sum / period;
  });
}

export function maLegendValues(rows) {
  const closes = rows.map((r) => Number(r?.[4] || 0));
  const ma7 = movingAverage(closes, 7);
  const ma25 = movingAverage(closes, 25);
  const v7 = ma7[ma7.length - 1];
  const v25 = ma25[ma25.length - 1];
  return {
    ma7Text: `MA(7): ${v7 == null ? "—" : Number(v7).toFixed(2)}`,
    ma25Text: `MA(25): ${v25 == null ? "—" : Number(v25).toFixed(2)}`
  };
}

const lwcNoop = {
  setCandleRows() {},
  dispose() {}
};

/**
 * @param {HTMLElement | null | undefined} mount
 * @returns {{ setCandleRows: (rows: number[][]) => void, dispose: () => void }}
 */
export function createLwcKline(mount) {
  if (!mount || !(mount instanceof HTMLElement)) return lwcNoop;
  const layout = () => {
    const w = Math.max(320, Math.floor(mount.clientWidth || 640));
    const h = Math.max(220, Math.floor(mount.clientHeight || 308));
    return { w, h };
  };
  const { w, h } = layout();
  const chart = createChart(mount, {
    width: w,
    height: h,
    layout: { background: { color: "transparent" }, textColor: "#8c90a2", fontSize: 10 },
    grid: { vertLines: { color: "rgba(66,70,86,0.2)" }, horzLines: { color: "rgba(66,70,86,0.2)" } },
    rightPriceScale: { borderColor: "rgba(66,70,86,0.25)" },
    timeScale: { borderColor: "rgba(66,70,86,0.25)", timeVisible: true, secondsVisible: false },
    handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
    handleScale: { mouseWheel: true, pinch: true }
  });
  const candles = chart.addCandlestickSeries({
    upColor: "#4edea3",
    downColor: "#ffb4ab",
    borderDownColor: "#ffb4ab",
    borderUpColor: "#4edea3",
    wickDownColor: "#ffb4ab",
    wickUpColor: "#4edea3",
    priceLineVisible: true
  });
  const ma7s = chart.addLineSeries({ color: "#f1d06e", lineWidth: 2, priceLineVisible: false });
  const ma25s = chart.addLineSeries({ color: "#9c5aff", lineWidth: 2, priceLineVisible: false });
  const vol = chart.addHistogramSeries({
    priceFormat: { type: "volume" },
    priceScaleId: "",
    scaleMargins: { top: 0.78, bottom: 0 }
  });

  let ro = null;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => {
      const { w: nw, h: nh } = layout();
      if (nw < 120 || nh < 100) return;
      try {
        chart.applyOptions({ width: nw, height: nh });
      } catch {
        // ignore
      }
    });
    ro.observe(mount);
  }

  function setCandleRows(rows) {
    const mini = rows.filter((r) => Array.isArray(r) && r.length >= 5);
    if (!mini.length) {
      try {
        candles.setData([]);
        ma7s.setData([]);
        ma25s.setData([]);
        vol.setData([]);
      } catch {
        // ignore
      }
      return;
    }
    const keyed = mini.map((r, idx) => ({ r, k: toLwTimeSec(r[0], mini.length - idx) }));
    keyed.sort((a, b) => a.k - b.k);
    const sorted = keyed.map((x) => x.r);
    const rawTimes = sorted.map((r, idx) => toLwTimeSec(r[0], sorted.length - idx));
    const times = normalizeMonotonicTimes(rawTimes);
    const closes = sorted.map((r) => Number(r[4] || 0));
    const ma7 = movingAverage(closes, 7);
    const ma25 = movingAverage(closes, 25);
    const cData = sorted.map((r, idx) => ({
      time: times[idx],
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4])
    }));
    const ma7Data = ma7
      .map((v, idx) => (v == null ? null : { time: times[idx], value: Number(v) }))
      .filter(Boolean);
    const ma25Data = ma25
      .map((v, idx) => (v == null ? null : { time: times[idx], value: Number(v) }))
      .filter(Boolean);
    const vData = sorted.map((r, idx) => {
      const up = Number(r[4]) >= Number(r[1]);
      return {
        time: times[idx],
        value: Number(r[5] || 0),
        color: up ? "rgba(78,222,163,0.55)" : "rgba(255,180,171,0.55)"
      };
    });
    try {
      candles.setData(cData);
      ma7s.setData(ma7Data);
      ma25s.setData(ma25Data);
      vol.setData(vData);
      chart.timeScale().fitContent();
    } catch {
      // ignore
    }
  }

  function dispose() {
    try {
      ro?.disconnect();
    } catch {
      // ignore
    }
    ro = null;
    try {
      chart.remove();
    } catch {
      // ignore
    }
  }

  return { setCandleRows, dispose };
}

export function buildKlineShellHtml(ma7Text, ma25Text) {
  return `
    <div class="da-candle-strip">
      <div id="daKlineMount" class="da-kline-mount"></div>
      <div class="da-ma-legend">
        <span class="ma7">${ma7Text}</span>
        <span class="ma25">${ma25Text}</span>
      </div>
    </div>
  `;
}

/** SVG 模式：无 TradingView 库时的静态 K 线（与 rows 同序） */
export function renderSvgFallbackKline(rows, ma7, ma25) {
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
  const candles = rows
    .map((r, i) => {
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
    })
    .join("");
  const maPath = (arr) => {
    const pts = arr
      .map((v, i) => (v == null ? null : `${xOf(i).toFixed(2)},${yOf(v).toFixed(2)}`))
      .filter(Boolean);
    return pts.length >= 2 ? `M ${pts.join(" L ")}` : "";
  };
  const ma7d = maPath(ma7);
  const ma25d = maPath(ma25);
  return `<svg class="da-fallback-kline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
<rect x="0" y="0" width="${w}" height="${h}" fill="transparent" />
${candles}
${ma7d ? `<path d="${ma7d}" stroke="#f1d06e" stroke-width="1.5" fill="none" />` : ""}
${ma25d ? `<path d="${ma25d}" stroke="#9c5aff" stroke-width="1.5" fill="none" />` : ""}
</svg>`;
}
