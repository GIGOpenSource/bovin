/**
 * 面板原生 K 线：主图（K+MA7/MA25）+ 成交量（VOL / 可选 QV）+ MACD(12,26,9)，与移动端类交易 App 分区一致。
 * 数据来自已解析的 K 线行 [t,o,h,l,c,v,qv?]，不额外请求。
 */

function calcEMA(values, period) {
  const k = 2 / (period + 1);
  let ema = null;
  return values.map((v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    if (ema == null) {
      ema = n;
    } else {
      ema = n * k + ema * (1 - k);
    }
    return ema;
  });
}

function emaOnValidSeries(arr, period) {
  const k = 2 / (period + 1);
  let ema = null;
  return arr.map((v) => {
    if (v == null || !Number.isFinite(v)) return null;
    ema = ema == null ? v : v * k + ema * (1 - k);
    return ema;
  });
}

/** MACD: DIF = EMA12 − EMA26，DEA = EMA9(DIF)，柱 = DIF − DEA */
function calcMacdSeries(closes) {
  const e12 = calcEMA(closes, 12);
  const e26 = calcEMA(closes, 26);
  const dif = closes.map((_, i) => {
    const a = e12[i];
    const b = e26[i];
    if (a == null || b == null) return null;
    return a - b;
  });
  const dea = emaOnValidSeries(dif, 9);
  const hist = dif.map((d, i) => {
    if (d == null || dea[i] == null) return null;
    return d - dea[i];
  });
  return { dif, dea, hist };
}

function priceDecimals(maxPx) {
  if (!Number.isFinite(maxPx) || maxPx <= 0) return 2;
  if (maxPx >= 1000) return 2;
  if (maxPx >= 1) return 4;
  if (maxPx >= 0.01) return 6;
  return 8;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{
 *   mini: any[][];
 *   viewStart: number;
 *   viewEnd: number;
 *   ma7: (number|null)[];
 *   ma25: (number|null)[];
 *   pair: string;
 *   tf: string;
 * }} opts
 */
export function drawPanelKlineCanvas(canvas, opts) {
  const { mini, viewStart, viewEnd, ma7, ma25, pair, tf } = opts;
  const mount = canvas.parentElement;
  const wCss = Math.max(280, Math.floor(mount?.clientWidth || canvas.clientWidth || 400));
  const hCss = Math.max(260, Math.floor(mount?.clientHeight || canvas.clientHeight || 320));
  const dpr =
    typeof window !== "undefined" && window.devicePixelRatio ? Math.min(2.5, window.devicePixelRatio) : 1;
  canvas.width = Math.floor(wCss * dpr);
  canvas.height = Math.floor(hCss * dpr);
  canvas.style.width = `${wCss}px`;
  canvas.style.height = `${hCss}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  const W = wCss;
  const H = hCss;
  const padL = 52;
  const padR = 8;
  const padT = 6;
  const padB = 20;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const gap = Math.max(4, Math.floor(innerH * 0.02));
  const mainH = Math.floor(innerH * 0.55);
  const volH = Math.floor(innerH * 0.22);
  const macdH = innerH - mainH - volH - 2 * gap;

  const viewRows = mini.slice(viewStart, viewEnd);
  const n = Math.max(1, viewRows.length);
  if (n === 0) {
    ctx.fillStyle = "rgba(140,144,162,0.9)";
    ctx.font = "12px system-ui,sans-serif";
    ctx.fillText("No bars in view", padL, padT + 16);
    return;
  }

  let hi = -Infinity;
  let lo = Infinity;
  for (const r of viewRows) {
    const h = Number(r[2]);
    const l = Number(r[3]);
    if (Number.isFinite(h) && Number.isFinite(l)) {
      hi = Math.max(hi, h);
      lo = Math.min(lo, l);
    }
  }
  if (!(hi > lo)) {
    hi += 1;
    lo -= 1;
  }
  const padPrice = (hi - lo) * 0.06;
  hi += padPrice;
  lo -= padPrice;

  const upC = "#4edea3";
  const dnC = "#ffb4ab";
  const gridC = "rgba(66,70,86,0.25)";
  const txtC = "#8c90a2";

  ctx.fillStyle = "transparent";
  ctx.clearRect(0, 0, W, H);

  const mainTop = padT;
  const volTop = mainTop + mainH + gap;
  const macdTop = volTop + volH + gap;

  const xStep = innerW / n;
  const candleW = Math.max(1, Math.min(10, xStep * 0.65));

  const yMain = (p) => mainTop + mainH - ((p - lo) / (hi - lo)) * mainH;

  ctx.strokeStyle = gridC;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = mainTop + (mainH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + innerW, y);
    ctx.stroke();
    const price = hi - ((hi - lo) * i) / 4;
    ctx.fillStyle = txtC;
    ctx.font = "10px ui-monospace,monospace";
    ctx.textAlign = "right";
    ctx.fillText(price.toFixed(priceDecimals(hi)), padL - 4, y + 3);
  }
  ctx.textAlign = "left";

  ctx.fillStyle = txtC;
  ctx.font = "11px system-ui,sans-serif";
  ctx.fillText(`${pair} · ${tf}`, padL, mainTop - 1);

  for (let i = 0; i < n; i++) {
    const r = viewRows[i];
    const o = Number(r[1]);
    const h = Number(r[2]);
    const l = Number(r[3]);
    const c = Number(r[4]);
    if (![o, h, l, c].every(Number.isFinite)) continue;
    const cx = padL + i * xStep + xStep / 2;
    const col = c >= o ? upC : dnC;
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx, yMain(h));
    ctx.lineTo(cx, yMain(l));
    ctx.stroke();
    const yO = yMain(o);
    const yC = yMain(c);
    const top = Math.min(yO, yC);
    const bh = Math.max(1, Math.abs(yO - yC));
    ctx.fillStyle = col;
    ctx.fillRect(cx - candleW / 2, top, candleW, bh);
  }

  const lineMA = (series, color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < n; i++) {
      const gi = viewStart + i;
      const v = series[gi];
      if (v == null || !Number.isFinite(v)) continue;
      const cx = padL + i * xStep + xStep / 2;
      const y = yMain(v);
      if (!started) {
        ctx.moveTo(cx, y);
        started = true;
      } else {
        ctx.lineTo(cx, y);
      }
    }
    if (started) ctx.stroke();
  };
  lineMA(ma7, "rgba(241,208,110,0.95)", 1.4);
  lineMA(ma25, "rgba(156,90,255,0.95)", 1.4);

  const vols = viewRows.map((r) => Number(r[5] ?? 0));
  const qvs = viewRows.map((r) => Number(r[6] ?? 0));
  const vmax = Math.max(...vols, 1e-12);
  const vmaxQ = Math.max(...qvs, 1e-12);

  /** 固定三行：VOL + QV (USDT) + MACD；成交量区上下各半，与常见行情图一致 */
  const volGap = 3;
  const hVolBand = Math.max(20, Math.floor((volH - volGap) * 0.5));
  const qvTop = volTop + hVolBand + volGap;
  const hQvBand = Math.max(18, volH - hVolBand - volGap);

  ctx.fillStyle = "rgba(66,70,86,0.35)";
  ctx.fillRect(padL, volTop, innerW, hVolBand);
  ctx.fillStyle = "rgba(66,70,86,0.28)";
  ctx.fillRect(padL, qvTop, innerW, hQvBand);

  ctx.font = "9px system-ui,sans-serif";
  for (let i = 0; i < n; i++) {
    const r = viewRows[i];
    const o = Number(r[1]);
    const c = Number(r[4]);
    const v = vols[i];
    const cx = padL + i * xStep + xStep / 2;
    const bh = (v / vmax) * Math.max(2, hVolBand - 8);
    ctx.fillStyle = c >= o ? "rgba(78,222,163,0.55)" : "rgba(255,180,171,0.55)";
    ctx.fillRect(cx - candleW / 2, volTop + hVolBand - bh - 2, candleW, bh);
  }
  ctx.fillStyle = txtC;
  ctx.fillText("VOL", padL + 2, volTop + 10);

  for (let i = 0; i < n; i++) {
    const r = viewRows[i];
    const o = Number(r[1]);
    const c = Number(r[4]);
    const vq = qvs[i];
    const cx = padL + i * xStep + xStep / 2;
    const bh = (vq / vmaxQ) * Math.max(2, hQvBand - 8);
    /** QV 用蓝/橙区分涨跌，与主图绿红区分 */
    ctx.fillStyle = c >= o ? "rgba(92,200,255,0.7)" : "rgba(255,184,107,0.72)";
    ctx.fillRect(cx - candleW / 2, qvTop + hQvBand - bh - 2, candleW, bh);
  }
  ctx.fillStyle = txtC;
  ctx.fillText("QV (USDT)", padL + 2, qvTop + 10);

  const closes = mini.map((r) => Number(r[4]));
  const { dif, dea, hist } = calcMacdSeries(closes);
  let mh = 0;
  for (let i = viewStart; i < viewEnd; i++) {
    const a = hist[i];
    if (a != null && Number.isFinite(a)) mh = Math.max(mh, Math.abs(a));
  }
  if (!(mh > 0)) mh = 1;
  const macdMid = macdTop + macdH / 2;
  ctx.fillStyle = "rgba(66,70,86,0.35)";
  ctx.fillRect(padL, macdTop, innerW, macdH);
  ctx.strokeStyle = gridC;
  ctx.beginPath();
  ctx.moveTo(padL, macdMid);
  ctx.lineTo(padL + innerW, macdMid);
  ctx.stroke();

  for (let i = 0; i < n; i++) {
    const gi = viewStart + i;
    const h0 = hist[gi];
    if (h0 == null || !Number.isFinite(h0)) continue;
    const cx = padL + i * xStep + xStep / 2;
    const hh = (h0 / mh) * (macdH * 0.42);
    ctx.fillStyle = h0 >= 0 ? "rgba(78,222,163,0.75)" : "rgba(255,180,171,0.75)";
    if (h0 >= 0) ctx.fillRect(cx - candleW / 2, macdMid - hh, candleW, hh);
    else ctx.fillRect(cx - candleW / 2, macdMid, candleW, -hh);
  }

  const lineMacd = (series, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < n; i++) {
      const gi = viewStart + i;
      const v = series[gi];
      if (v == null || !Number.isFinite(v)) continue;
      const cx = padL + i * xStep + xStep / 2;
      const y = macdMid - (v / mh) * (macdH * 0.38);
      if (!started) {
        ctx.moveTo(cx, y);
        started = true;
      } else {
        ctx.lineTo(cx, y);
      }
    }
    if (started) ctx.stroke();
  };
  lineMacd(dif, "rgba(92,200,255,0.9)");
  lineMacd(dea, "rgba(255,184,107,0.9)");

  ctx.fillStyle = txtC;
  ctx.font = "9px system-ui,sans-serif";
  ctx.fillText("MACD(12,26,9)", padL + 2, macdTop + 10);
}

export function ensurePanelKlineCanvas(mount) {
  let cv = mount.querySelector("canvas.da-panel-kline");
  if (!cv) {
    mount.innerHTML = "";
    cv = document.createElement("canvas");
    cv.className = "da-panel-kline";
    cv.setAttribute("role", "img");
    cv.setAttribute("aria-label", "Panel K-line chart");
    mount.appendChild(cv);
  }
  return cv;
}

export function disconnectPanelKlineResizeObserver(mount) {
  try {
    mount?._panelKlineRo?.disconnect();
  } catch {
    // ignore
  }
  if (mount) delete mount._panelKlineRo;
}

export function observePanelKlineResize(mount, redraw) {
  if (!mount || typeof ResizeObserver === "undefined") return;
  disconnectPanelKlineResizeObserver(mount);
  const ro = new ResizeObserver(() => {
    redraw();
  });
  ro.observe(mount);
  mount._panelKlineRo = ro;
}
