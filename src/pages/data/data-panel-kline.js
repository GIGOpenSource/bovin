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

/** 解析 /api/v1/pair_candles 的 columns + data 为 [openTime, o, h, l, c, v, qv, exitShort, exitLong, exitTag, exitShortSignalClose, exitLongSignalClose, enterLong, enterShort, enterTag, enterLongSignalClose, enterShortSignalClose][] */
export function parseBinanceKlinesRows(raw) {
  if (!raw || typeof raw !== "object") return [];
  const data = Array.isArray(raw.data) ? raw.data : [];
  const columns = Array.isArray(raw.columns) ? raw.columns : [];
  
  const dateIdx = columns.indexOf("date");
  const openIdx = columns.indexOf("open");
  const highIdx = columns.indexOf("high");
  const lowIdx = columns.indexOf("low");
  const closeIdx = columns.indexOf("close");
  const volumeIdx = columns.indexOf("volume");
  const exitShortIdx = columns.indexOf("exit_short");
  const exitLongIdx = columns.indexOf("exit_long");
  const exitTagIdx = columns.indexOf("exit_tag");
  const exitShortSignalCloseIdx = columns.indexOf("_exit_short_signal_close");
  const exitLongSignalCloseIdx = columns.indexOf("_exit_long_signal_close");
  const enterLongIdx = columns.indexOf("enter_long");
  const enterShortIdx = columns.indexOf("enter_short");
  const enterTagIdx = columns.indexOf("enter_tag");
  const enterLongSignalCloseIdx = columns.indexOf("_enter_long_signal_close");
  const enterShortSignalCloseIdx = columns.indexOf("_enter_short_signal_close");
  
  const out = [];
  for (const row of data) {
    if (!Array.isArray(row)) continue;
    
    const dateVal = row[dateIdx >= 0 ? dateIdx : 0];
    const o = Number(row[openIdx >= 0 ? openIdx : 1]);
    const h = Number(row[highIdx >= 0 ? highIdx : 2]);
    const l = Number(row[lowIdx >= 0 ? lowIdx : 3]);
    const c = Number(row[closeIdx >= 0 ? closeIdx : 4]);
    const v = volumeIdx >= 0 ? Number(row[volumeIdx] ?? 0) : 0;
    
    let tOpen = toLwTimeSec(dateVal);
    if (tOpen === null) continue;
    
    if (![o, h, l, c].every(Number.isFinite)) continue;
    if (o <= 0 || h <= 0 || l <= 0 || c <= 0) continue;
    
    const vSafe = Number.isFinite(v) && v >= 0 ? v : 0;
    const qv = vSafe > 0 && c > 0 ? c * vSafe : 0;
    
    const exitShort = exitShortIdx >= 0 ? Number(row[exitShortIdx]) === 1 : false;
    const exitLong = exitLongIdx >= 0 ? Number(row[exitLongIdx]) === 1 : false;
    const exitTag = exitTagIdx >= 0 ? String(row[exitTagIdx] ?? "").trim() : "";
    const exitShortSignalClose = exitShortSignalCloseIdx >= 0 ? Number(row[exitShortSignalCloseIdx]) : null;
    const exitLongSignalClose = exitLongSignalCloseIdx >= 0 ? Number(row[exitLongSignalCloseIdx]) : null;
    
    const enterLong = enterLongIdx >= 0 ? Number(row[enterLongIdx]) === 1 : false;
    const enterShort = enterShortIdx >= 0 ? Number(row[enterShortIdx]) === 1 : false;
    const enterTag = enterTagIdx >= 0 ? String(row[enterTagIdx] ?? "").trim() : "";
    const enterLongSignalClose = enterLongSignalCloseIdx >= 0 ? Number(row[enterLongSignalCloseIdx]) : null;
    const enterShortSignalClose = enterShortSignalCloseIdx >= 0 ? Number(row[enterShortSignalCloseIdx]) : null;
    
    out.push([tOpen, o, h, l, c, vSafe, qv, exitShort, exitLong, exitTag, exitShortSignalClose, exitLongSignalClose, enterLong, enterShort, enterTag, enterLongSignalClose, enterShortSignalClose]);
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

/**
 * 数据页侧栏柱形：仅取时间轴上 **最近 8 根** K 线；每根取数组 **第 5 个数字**（下标 4，常见为 close）。
 * @param {HTMLElement | null | undefined} container `#daVolBars`
 * @param {unknown[]} rows `parseBinanceKlinesRows` 等同源行（每行至少 5 列）
 * @param {number} [maxBars=8] 只展示最近 N 根（默认 8）
 */
export function renderDaVolumeBars(container, rows, maxBars = 8) {
  if (!container) return;
  if (!Array.isArray(rows) || !rows.length) {
    container.innerHTML = "";
    return;
  }
  const sorted = sortKlineRowsByTime(rows);
  const cap = Math.max(1, Math.min(maxBars, sorted.length));
  const slice = sorted.slice(-cap);
  const vals = [];
  for (const r of slice) {
    if (!Array.isArray(r) || r.length < 5) continue;
    const v = Number(r[4]);
    if (Number.isFinite(v)) vals.push(v);
  }
  if (!vals.length) {
    container.innerHTML = "";
    return;
  }
  const mx = Math.max(...vals);
  const mn = Math.min(...vals);
  const span = mx - mn || Math.abs(mx) || 1;
  container.innerHTML = vals
    .map((v) => {
      const t = mx !== mn && span > 0 ? (v - mn) / span : 0.55;
      const pct = Math.min(100, Math.max(6, Math.round(6 + t * 94)));
      return `<i style="--da-vol-h: ${pct}%"></i>`;
    })
    .join("");
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
  const ma99 = movingAverage(closes, 99);
  const v7 = ma7[ma7.length - 1];
  const v25 = ma25[ma25.length - 1];
  const v99 = ma99[ma99.length - 1];
  return {
    ma7Text: `MA(7): ${v7 == null ? "—" : Number(v7).toFixed(2)}`,
    ma25Text: `MA(25): ${v25 == null ? "—" : Number(v25).toFixed(2)}`,
    ma99Text: `MA(99): ${v99 == null ? "—" : Number(v99).toFixed(2)}`
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
    handleScale: { mouseWheel: true, pinch: true },
    crosshair: {
      mode: 1,
      vertLine: {
        color: "rgba(140,144,162,0.4)",
        width: 1,
        style: 2,
        labelBackgroundColor: "#2a2d3a"
      },
      horzLine: {
        color: "rgba(140,144,162,0.4)",
        width: 1,
        style: 2,
        labelBackgroundColor: "#2a2d3a"
      }
    },
    localization: {
      dateFormat: "yyyy-MM-dd HH:mm",
      locale: "zh-CN"
    }
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
  const ma99s = chart.addLineSeries({ color: "#4ecdc4", lineWidth: 2, priceLineVisible: false });
  const vol = chart.addHistogramSeries({
    priceFormat: { type: "volume" },
    priceScaleId: "",
    scaleMargins: { top: 0.78, bottom: 0 }
  });

  let tooltip = null;
  function createTooltip() {
    if (tooltip) return;
    tooltip = document.createElement("div");
    tooltip.className = "da-kline-tooltip";
    tooltip.style.cssText = `
      position: absolute;
      pointer-events: none;
      background: rgba(42, 45, 58, 0.95);
      border: 1px solid rgba(66, 70, 86, 0.4);
      border-radius: 8px;
      padding: 12px;
      font-size: 11px;
      color: #e8e9ed;
      z-index: 1000;
      min-width: 200px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      display: none;
    `;
    mount.appendChild(tooltip);
  }

  let candleData = [];
  let volumeData = [];
  let ma7Data = [];
  let ma25Data = [];
  let ma99Data = [];
  let exitShortData = [];
  let exitLongData = [];
  let enterLongData = [];
  let enterShortData = [];

  function showTooltip(x, y) {
    if (!tooltip) createTooltip();
    if (!candleData.length) return;

    const timeScale = chart.timeScale();
    const xPercent = x / mount.clientWidth;
    const visibleRange = timeScale.getVisibleRange();
    if (!visibleRange) return;
    
    const timeStart = visibleRange.from;
    const timeEnd = visibleRange.to;
    const timeRange = timeEnd - timeStart;
    const dataTime = timeStart + timeRange * xPercent;
    
    let closestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < candleData.length; i++) {
      const diff = Math.abs(candleData[i].time - dataTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }

    const candle = candleData[closestIdx];
    const vol = volumeData[closestIdx];
    const ma7 = ma7Data[closestIdx];
    const ma25 = ma25Data[closestIdx];
    const ma99 = ma99Data[closestIdx];
    const exitShort = exitShortData[closestIdx];
    const exitLong = exitLongData[closestIdx];
    const enterLong = enterLongData[closestIdx];
    const enterShort = enterShortData[closestIdx];

    const date = new Date(candle.time * 1000);
    const timeStr = date.toLocaleString("zh-CN", { 
      year: "numeric", 
      month: "2-digit", 
      day: "2-digit", 
      hour: "2-digit", 
      minute: "2-digit",
      second: "2-digit"
    });

    let exitHtml = "";
    if (exitShort?.exitShort) {
      const exitTag = exitShort.exitTag ? `(${exitShort.exitTag})` : "";
      const amount = exitShort.exitShortSignalClose != null && exitShort.exitShortSignalClose !== "" 
        ? `<span style="margin-left: auto; font-family: ui-monospace; color: #f1d06e;">${Number(exitShort.exitShortSignalClose).toFixed(2)}</span>` 
        : "";
      exitHtml += `
        <div style="display: flex; align-items: center; margin-bottom: 4px;">
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #f1d06e; margin-right: 8px;"></span>
          <span style="color: #f1d06e;">short exit${exitTag}</span>
          ${amount}
        </div>
      `;
    }
    if (exitLong?.exitLong) {
      const exitTag = exitLong.exitTag ? `(${exitLong.exitTag})` : "";
      const amount = exitLong.exitLongSignalClose != null && exitLong.exitLongSignalClose !== "" 
        ? `<span style="margin-left: auto; font-family: ui-monospace; color: #f1d06e;">${Number(exitLong.exitLongSignalClose).toFixed(2)}</span>` 
        : "";
      exitHtml += `
        <div style="display: flex; align-items: center; margin-bottom: 4px;">
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #f1d06e; margin-right: 8px;"></span>
          <span style="color: #f1d06e;">long exit${exitTag}</span>
          ${amount}
        </div>
      `;
    }

    let enterHtml = "";
    if (enterLong?.enterLong) {
      const enterTag = enterLong.enterTag ? `(${enterLong.enterTag})` : "";
      const amount = enterLong.enterLongSignalClose != null && enterLong.enterLongSignalClose !== "" 
        ? `<span style="margin-left: auto; font-family: ui-monospace; color: #4ecdc4;">${Number(enterLong.enterLongSignalClose).toFixed(2)}</span>` 
        : "";
      enterHtml += `
        <div style="display: flex; align-items: center; margin-bottom: 4px;">
          <span style="display: inline-block; width: 0; height: 0; border-left: 3px solid transparent; border-right: 3px solid transparent; border-top: 5px solid #4ecdc4; margin-right: 6px;"></span>
          <span style="color: #4ecdc4;">Long Entry${enterTag}</span>
          ${amount}
        </div>
      `;
    }
    if (enterShort?.enterShort) {
      const enterTag = enterShort.enterTag ? `(${enterShort.enterTag})` : "";
      const amount = enterShort.enterShortSignalClose != null && enterShort.enterShortSignalClose !== "" 
        ? `<span style="margin-left: auto; font-family: ui-monospace; color: #4ecdc4;">${Number(enterShort.enterShortSignalClose).toFixed(2)}</span>` 
        : "";
      enterHtml += `
        <div style="display: flex; align-items: center; margin-bottom: 4px;">
          <span style="display: inline-block; width: 0; height: 0; border-left: 3px solid transparent; border-right: 3px solid transparent; border-bottom: 5px solid #4ecdc4; margin-right: 6px;"></span>
          <span style="color: #4ecdc4;">Short entry${enterTag}</span>
          ${amount}
        </div>
      `;
    }

    let html = `
      <div style="margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(66,70,86,0.3); font-weight: 600; color: #e8e9ed;">${timeStr}</div>
      
      <div style="display: flex; align-items: center; margin-bottom: 6px;">
        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #8c90a2; margin-right: 8px;"></span>
        <span style="color: #8c90a2;">Volume</span>
        <span style="margin-left: auto; font-family: ui-monospace; color: #e8e9ed;">${(vol?.value || 0).toLocaleString()}</span>
      </div>

      ${exitHtml ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(66,70,86,0.3);">${exitHtml}</div>` : ""}
      ${enterHtml ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(66,70,86,0.3);">${enterHtml}</div>` : ""}

      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(66,70,86,0.3);">
        <div style="font-weight: 600; margin-bottom: 6px; color: #ffb4ab;">Candles</div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span style="color: #8c90a2;">open</span>
          <span style="font-family: ui-monospace; color: #e8e9ed;">${(candle?.open || 0).toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span style="color: #8c90a2;">highest</span>
          <span style="font-family: ui-monospace; color: #e8e9ed;">${(candle?.high || 0).toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span style="color: #8c90a2;">lowest</span>
          <span style="font-family: ui-monospace; color: #e8e9ed;">${(candle?.low || 0).toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #8c90a2;">close</span>
          <span style="font-family: ui-monospace; color: #e8e9ed;">${(candle?.close || 0).toFixed(2)}</span>
        </div>
      </div>

      <div style="display: flex; align-items: center; margin-top: 8px;">
        <span style="display: inline-block; width: 10px; height: 2px; background: #f1d06e; margin-right: 8px;"></span>
        <span style="color: #f1d06e;">MA(7)</span>
        <span style="margin-left: auto; font-family: ui-monospace; color: #e8e9ed;">${(ma7?.value || 0).toFixed(2)}</span>
      </div>
      <div style="display: flex; align-items: center; margin-top: 4px;">
        <span style="display: inline-block; width: 10px; height: 2px; background: #9c5aff; margin-right: 8px;"></span>
        <span style="color: #9c5aff;">MA(25)</span>
        <span style="margin-left: auto; font-family: ui-monospace; color: #e8e9ed;">${(ma25?.value || 0).toFixed(2)}</span>
      </div>
      <div style="display: flex; align-items: center; margin-top: 4px;">
        <span style="display: inline-block; width: 10px; height: 2px; background: #4ecdc4; margin-right: 8px;"></span>
        <span style="color: #4ecdc4;">MA(99)</span>
        <span style="margin-left: auto; font-family: ui-monospace; color: #e8e9ed;">${(ma99?.value || 0).toFixed(2)}</span>
      </div>
    `;

    tooltip.innerHTML = html;
    tooltip.style.left = `${Math.min(x, mount.clientWidth - tooltip.offsetWidth - 15)}px`;
    tooltip.style.top = `${Math.min(y, mount.clientHeight - tooltip.offsetHeight - 15)}px`;
    tooltip.style.display = "block";
  }

  function hideTooltip() {
    if (tooltip) {
      tooltip.style.display = "none";
    }
  }

  mount.addEventListener("mousemove", (e) => {
    const rect = mount.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    showTooltip(x, y);
  });

  mount.addEventListener("mouseleave", hideTooltip);

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
        ma99s.setData([]);
        vol.setData([]);
        candles.setMarkers([]);
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
    const ma99 = movingAverage(closes, 99);
    candleData = sorted.map((r, idx) => ({
      time: times[idx],
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4])
    }));
    const ma7sData = ma7
      .map((v, idx) => (v == null ? null : { time: times[idx], value: Number(v) }))
      .filter(Boolean);
    const ma25sData = ma25
      .map((v, idx) => (v == null ? null : { time: times[idx], value: Number(v) }))
      .filter(Boolean);
    const ma99sData = ma99
      .map((v, idx) => (v == null ? null : { time: times[idx], value: Number(v) }))
      .filter(Boolean);
    volumeData = sorted.map((r, idx) => {
      const up = Number(r[4]) >= Number(r[1]);
      return {
        time: times[idx],
        value: Number(r[5] || 0),
        color: up ? "rgba(78,222,163,0.55)" : "rgba(255,180,171,0.55)"
      };
    });
    
    exitShortData = sorted.map((r, idx) => ({
      time: times[idx],
      exitShort: r[7] === true,
      exitTag: r[9] || "",
      exitShortSignalClose: r[10],
      low: Number(r[3])
    }));
    exitLongData = sorted.map((r, idx) => ({
      time: times[idx],
      exitLong: r[8] === true,
      exitTag: r[9] || "",
      exitLongSignalClose: r[11],
      high: Number(r[2])
    }));
    enterLongData = sorted.map((r, idx) => ({
      time: times[idx],
      enterLong: r[12] === true,
      enterTag: r[14] || "",
      enterLongSignalClose: r[15],
      high: Number(r[2])
    }));
    enterShortData = sorted.map((r, idx) => ({
      time: times[idx],
      enterShort: r[13] === true,
      enterTag: r[14] || "",
      enterShortSignalClose: r[16],
      low: Number(r[3])
    }));
    
    const exitMarkers = [];
       for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i];
      const time = times[i];
      if (r[7] === true) {
        exitMarkers.push({
          time: time,
          position: "belowBar",
          color: "#f1d06e",
          shape: "circle",
          text: "",
          size:0.1
        });
      }
      if (r[8] === true) {
        exitMarkers.push({
          time: time,
          position: "aboveBar",
          color: "#f1d06e",
          shape: "circle",
          text: "",
          size:0.1
        });
      }
      if (r[12] === true) {
        exitMarkers.push({
          time: time,
          position: "aboveBar",
          color: "#4ecdc4",
          shape: "arrowDown",
          text: "",
          size:0.2
        });
      }
      if (r[13] === true) {
        exitMarkers.push({
          time: time,
          position: "belowBar",
          color: "#4ecdc4",
          shape: "arrowUp",
          text: "",
          size:0.2
        });
      }
    }
    
    ma7Data = ma7.map((v, idx) => ({ time: times[idx], value: Number(v) }));
    ma25Data = ma25.map((v, idx) => ({ time: times[idx], value: Number(v) }));
    ma99Data = ma99.map((v, idx) => ({ time: times[idx], value: Number(v) }));
    
    try {
      candles.setData(candleData);
      ma7s.setData(ma7sData);
      ma25s.setData(ma25sData);
      ma99s.setData(ma99sData);
      vol.setData(volumeData);
      candles.setMarkers(exitMarkers);
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
      tooltip?.remove();
    } catch {
      // ignore
    }
    tooltip = null;
    try {
      mount.removeEventListener("mouseleave", hideTooltip);
    } catch {
      // ignore
    }
    try {
      chart.remove();
    } catch {
      // ignore
    }
  }

  return { setCandleRows, dispose };
}

export function buildKlineShellHtml(ma7Text, ma25Text, ma99Text) {
  return `
    <div class="da-candle-strip">
      <div id="daKlineMount" class="da-kline-mount"></div>
      <div class="da-ma-legend">
        <span class="ma7">${ma7Text}</span>
        <span class="ma25">${ma25Text}</span>
        <span class="ma99">${ma99Text}</span>
      </div>
    </div>
  `;
}

/** SVG 模式：无 TradingView 库时的静态 K 线（与 rows 同序） */
export function renderSvgFallbackKline(rows, ma7, ma25, ma99) {
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
  const ma99d = maPath(ma99);
  return `<svg class="da-fallback-kline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
<rect x="0" y="0" width="${w}" height="${h}" fill="transparent" />
${candles}
${ma7d ? `<path d="${ma7d}" stroke="#f1d06e" stroke-width="1.5" fill="none" />` : ""}
${ma25d ? `<path d="${ma25d}" stroke="#9c5aff" stroke-width="1.5" fill="none" />` : ""}
${ma99d ? `<path d="${ma99d}" stroke="#4ecdc4" stroke-width="1.5" fill="none" />` : ""}
</svg>`;
}
