<template>
  <section id="period" class="section">
    <div class="ft-page pb-wrap">
      <header class="ft-page-hero ft-page-hero--data">
        <div class="ft-page-hero__intro">
          <span class="ft-page-hero__kicker ft-kicker-accent" data-i18n="pb.analysis">分析</span>
          <h1 class="ft-page-hero__title" data-i18n="pb.title">周期分析</h1>
          <p class="ft-page-hero__desc" data-i18n="pb.desc">按日 / 周 / 月查看收益与成交分布</p>
        </div>
        <div class="ft-page-hero__aside">
          <div class="pb-legend">
            <span class="pb-legend-item" id="pbLegendProfit" data-i18n="pb.legend.profit">绝对收益</span>
            <span class="pb-legend-item"><span class="pb-legend-dot pb-legend-dot--trade"></span><span data-i18n="pb.legend.trade">成交数</span></span>
          </div>
        </div>
      </header>

      <div class="pb-main">
        <div class="pb-chart-toolbar">
          <div class="pb-tabs" id="pbTabs">
            <button type="button" class="pb-tab active" data-period="days" data-i18n="pb.tab.days">日</button>
            <button type="button" class="pb-tab" data-period="weeks" data-i18n="pb.tab.weeks">周</button>
            <button type="button" class="pb-tab" data-period="months" data-i18n="pb.tab.months">月</button>
          </div>
        </div>
        <div class="pb-chart-card">
          <div class="pb-mode-switch" id="pbModeSwitch">
            <button type="button" class="pb-mode-btn active" data-mode="abs" data-i18n="pb.mode.abs">绝对值</button>
            <button type="button" class="pb-mode-btn" data-mode="rel" data-i18n="pb.mode.rel">相对值</button>
          </div>
          <div class="pb-chart-wrap">
            <canvas id="pbChartCanvas"></canvas>
            <div class="pb-chart-axis pb-chart-axis--y-left" id="pbYLeft">
              <span>1.8</span>
              <span>1.5</span>
              <span>1.2</span>
              <span>0.9</span>
              <span>0.6</span>
              <span>0.3</span>
              <span>0</span>
            </div>
            <div class="pb-chart-axis pb-chart-axis--y-right">
              <span>1</span>
              <span>0.8</span>
              <span>0.6</span>
              <span>0.4</span>
              <span>0.2</span>
              <span>0</span>
            </div>
            <div class="pb-chart-axis-label pb-chart-axis-label--y-left" id="pbYLabelLeft">Absolute profit</div>
            <div class="pb-chart-axis-label pb-chart-axis-label--y-right">Trades Count</div>
            <div class="pb-chart-axis pb-chart-axis--x" id="pbChartXAxis"></div>
            <div id="pbChartTooltip" class="pb-chart-tooltip hidden"></div>
          </div>
        </div>

        <div class="pb-table-card">
          <div class="pb-table-scroll">
            <table class="pb-table">
              <thead>
                <tr>
                  <th data-i18n="pb.header.day">日期</th>
                  <th data-i18n="pb.header.profit">收益</th>
                  <th data-i18n="pb.header.usd">USD</th>
                  <th data-i18n="pb.header.trades">成交数</th>
                  <th data-i18n="pb.header.profitPct">收益率</th>
                </tr>
              </thead>
              <tbody id="pbTableBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pb-wrap {
  width: 100%;
}

.pb-main {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.pb-tabs {
  display: flex;
  gap: 4px;
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.25);
  background: var(--ft-panel-surface-inset);
  border-radius: 8px;
  padding: 3px;
  width: fit-content;
}

.pb-tab {
  padding: 6px 16px;
  border: none;
  background: transparent;
  color: #dae2fd;
  font-size: 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pb-tab:hover {
  background: rgba(255, 255, 255, 0.05);
}

.pb-tab.active {
  background: #4edea3;
  color: #0c111d;
  font-weight: 700;
}

.pb-legend {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.pb-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #c2c8d8;
}

.pb-legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.pb-legend-dot--profit {
  background: #4edea3;
  box-shadow: 0 0 0 3px rgba(78, 222, 163, 0.18);
}

.pb-legend-dot--trade {
  background: rgba(255, 255, 255, 0.55);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.12);
}

.pb-chart-card,
.pb-table-card {
  background: var(--ft-panel-surface);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.22);
  border-radius: 10px;
  padding: 12px 14px;
  overflow: hidden;
}

.pb-chart-card {
  padding: 12px 14px;
  position: relative;
}

.pb-mode-switch {
  position: absolute;
  top: 10px;
  right: 14px;
  z-index: 4;
  display: flex;
  gap: 2px;
  padding: 2px;
  background: var(--ft-panel-surface-inset);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  border-radius: 6px;
}

.pb-mode-btn {
  border: none;
  background: transparent;
  color: #dae2fd;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pb-mode-btn:hover {
  background: rgba(255, 255, 255, 0.05);
}

.pb-mode-btn.active {
  background: #4edea3;
  color: #0c111d;
}

.pb-chart-toolbar {
  display: flex;
  align-items: center;
  padding: 4px 0 10px;
}

.pb-chart-wrap {
  position: relative;
  height: 280px;
  padding: 40px 56px 28px 94px;
  overflow: hidden;
}

#pbChartCanvas {
  position: absolute;
  inset: 40px 56px 28px 94px;
  width: calc(100% - 150px);
  height: calc(100% - 68px);
}

.pb-chart-axis {
  position: absolute;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-size: 10px;
  color: #6e7591;
  pointer-events: none;
}

.pb-chart-axis--y-left {
  left: 40px;
  top: 40px;
  bottom: 28px;
  width: 54px;
  text-align: left;
}

.pb-chart-axis--y-right {
  right: 0;
  top: 40px;
  bottom: 28px;
  width: 50px;
  text-align: left;
  padding-left: 8px;
}

.pb-chart-axis--x {
  left: 94px;
  right: 56px;
  bottom: 4px;
  flex-direction: row;
  justify-content: space-between;
  font-size: 10px;
  color: #6e7591;
}

.pb-chart-axis-label {
  position: absolute;
  top: 50%;
  transform: translateY(-50%) rotate(-90deg);
  transform-origin: center;
  font-size: 11px;
  color: #8c90a2;
  letter-spacing: 0.06em;
  pointer-events: none;
}

.pb-chart-axis-label--y-left {
  left: 4px;
  top: 50%;
  transform: translateY(-50%);
  writing-mode: vertical-lr;
  text-orientation: mixed;
}

.pb-chart-axis-label--y-right {
  right: -30px;
  transform: translateY(-50%) rotate(90deg);
}

.pb-chart-tooltip {
  position: absolute;
  background: rgba(18, 22, 32, 0.95);
  border: 1px solid rgba(78, 222, 163, 0.35);
  color: #e8e9ed;
  font-size: 11px;
  padding: 6px 10px;
  border-radius: 6px;
  pointer-events: none;
  z-index: 5;
  white-space: nowrap;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

.pb-chart-tooltip.hidden {
  display: none;
}

.pb-chart-tooltip .tt-date {
  color: #8c90a2;
  margin-bottom: 4px;
}

.pb-chart-tooltip .tt-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.pb-table-card {
  padding: 4px 0 0;
}

.pb-table-scroll {
  max-height: 360px;
  overflow-y: auto;
}

.pb-table {
  width: 100%;
  border-collapse: collapse;
}

.pb-table th {
  text-align: left;
  padding: 12px 14px;
  font-size: 11px;
  font-weight: 600;
  color: #8c90a2;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-bottom: 1px solid rgba(var(--ft-panel-edge-rgb), 0.2);
  background: var(--ft-panel-surface-inset);
  position: sticky;
  top: 0;
  z-index: 1;
}

.pb-table td {
  padding: 12px 14px;
  font-size: 12px;
  color: #e8e9ed;
  border-bottom: 1px solid rgba(var(--ft-panel-edge-rgb), 0.1);
}

.pb-table td.positive {
  color: #4edea3;
  font-weight: 600;
}

.pb-table td.negative {
  color: #ffb4ab;
  font-weight: 600;
}

.pb-table tr:hover td {
  background: rgba(78, 222, 163, 0.04);
}
</style>

<script setup>
import { onMounted, onUnmounted } from "vue";
import { getDaily, getWeekly, getMonthly } from "../../api/period.js";

let disposePeriod = null;

const apiMap = {
  days: getDaily,
  weeks: getWeekly,
  months: getMonthly
};

const fmtDate = (d) => {
  if (!d) return "";
  if (d.length === 7) return d;
  const [y, m, day] = d.split("-");
  return `${y}-${m}-${day}`;
};

const normalize = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => ({
    date: r.date,
    profit: Number(r.abs_profit) || 0,
    usd: Number(r.abs_profit) || 0,
    trades: Number(r.trade_count) || 0,
    profitPct: Number(r.rel_profit) || 0,
    startingBalance: Number(r.starting_balance) || 0
  }));
};

const renderTable = (data) => {
  const tbody = document.getElementById("pbTableBody");
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#8c90a2;padding:24px;">暂无数据</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map((row) => {
    const profitClass = row.profit > 0 ? "positive" : row.profit < 0 ? "negative" : "";
    const pct = `${row.profitPct.toFixed(2)}%`;
    return `
      <tr>
        <td>${fmtDate(row.date)}</td>
        <td class="${profitClass}">${row.profit}</td>
        <td>${row.usd.toFixed ? row.usd.toFixed(2) : row.usd}</td>
        <td>${row.trades}</td>
        <td class="${profitClass}">${pct}</td>
      </tr>
    `;
  }).join("");
};

const drawChart = (data, mode = "abs") => {
  const canvas = document.getElementById("pbChartCanvas");
  const xAxisEl = document.getElementById("pbChartXAxis");
  if (!canvas || !xAxisEl) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const w = rect.width;
  const h = rect.height;

  // 网格
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 6; i++) {
    const y = (h / 6) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  if (!data.length) {
    xAxisEl.innerHTML = "";
    return;
  }

  // 按日期升序排列，旧日期在左侧，新日期在右侧
  const chartData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
  // mode: 'abs' => abs_profit, 'rel' => rel_profit(%)
  const valueKey = mode === "rel" ? "profitPct" : "profit";

  // 计算数据范围（支持负数）
  const allValues = chartData.map((d) => d[valueKey] || 0);
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  
  // 计算对称范围，确保0点在图表中间
  const absMax = Math.max(Math.abs(minVal), Math.abs(maxVal), 0.5);
  const yMin = -absMax;
  const yMax = absMax;
  const yRange = yMax - yMin;
  
  const maxTrades = Math.max(1, ...chartData.map((d) => d.trades));

  const stepX = w / Math.max(1, chartData.length - 1);

  // 折线
  ctx.beginPath();
  chartData.forEach((d, i) => {
    const x = i * stepX;
    const val = d[valueKey] || 0;
    const y = h - ((val - yMin) / yRange) * h * 0.8 - h * 0.1;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#4edea3";
  ctx.lineWidth = 2;
  ctx.shadowColor = "rgba(78,222,163,0.45)";
  ctx.shadowBlur = 4;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 节点：根据正负值显示不同颜色
  chartData.forEach((d, i) => {
    const x = i * stepX;
    const val = d[valueKey] || 0;
    const y = h - ((val - yMin) / yRange) * h * 0.8 - h * 0.1;
    
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = val >= 0 ? "#4edea3" : "#ff5b6b";
    ctx.fill();
    ctx.strokeStyle = "#0c111d";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // 柱（交易数）— 白色雾蒙蒙
  chartData.forEach((d, i) => {
    if (!d.trades) return;
    const x = i * stepX - 6;
    const y = h - (d.trades / maxTrades) * h;
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(x, y, 12, h - y);
  });

  // X 轴标签
  const labelStep = Math.max(1, Math.floor(chartData.length / 6));
  xAxisEl.innerHTML = chartData
    .map((d, i) => (i % labelStep === 0 || i === chartData.length - 1 ? `<span>${fmtDate(d.date)}</span>` : "<span></span>"))
    .join("");

  // Y 轴刻度 & 左轴标签（支持负数）
  const yAxisLeft = document.getElementById("pbYLeft");
  const yLabelLeft = document.getElementById("pbYLabelLeft");
  if (mode === "rel") {
    const step = yRange / 6;
    if (yAxisLeft) {
      yAxisLeft.innerHTML = Array.from({ length: 7 }, (_, i) => {
        const v = yMax - i * step;
        const suffix = "%";
        return `<span>${v.toFixed(1)}${suffix}</span>`;
      }).join("");
    }
    if (yLabelLeft) {
      yLabelLeft.textContent = "收益率";
      yLabelLeft.setAttribute("data-i18n", "pb.yLabel.rel");
    }
  } else {
    const step = yRange / 6;
    if (yAxisLeft) {
      yAxisLeft.innerHTML = Array.from({ length: 7 }, (_, i) => {
        const v = yMax - i * step;
        return `<span>${v.toFixed(1)}</span>`;
      }).join("");
    }
    if (yLabelLeft) {
      yLabelLeft.textContent = "绝对收益";
      yLabelLeft.setAttribute("data-i18n", "pb.yLabel.abs");
    }
  }
};

const showTooltip = (e, canvas, data, mode = "abs") => {
  const tooltip = document.getElementById("pbChartTooltip");
  if (!tooltip || !canvas || !data.length) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const stepX = rect.width / Math.max(1, data.length - 1);
  const chartIdx = Math.max(0, Math.min(data.length - 1, Math.round(x / stepX)));
  const row = data[data.length - 1 - chartIdx];
  const usd = row.usd.toFixed ? row.usd.toFixed(2) : row.usd;
  tooltip.innerHTML = `
    <div class="tt-date">${fmtDate(row.date)}</div>
    <div class="tt-row"><span data-i18n="pb.tooltip.profit">收益</span><span>${usd}</span></div>
    <div class="tt-row"><span data-i18n="pb.tooltip.profitPct">收益率</span><span>${row.profitPct.toFixed(2)}%</span></div>
    <div class="tt-row"><span data-i18n="pb.tooltip.trades">成交数</span><span>${row.trades}</span></div>
  `;
  tooltip.classList.remove("hidden");
  const left = Math.min(rect.width - 140, Math.max(0, x + 12));
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `8px`;
};

const loadPeriod = async (period, mode = "abs") => {
  const apiFn = apiMap[period];
  let data = [];
  if (apiFn) {
    try {
      const resp = await apiFn(20);
      const raw = resp?.data ?? resp;
      data = normalize(raw);
    } catch (e) {
      console.warn(`[period] ${period} 接口调用失败`, e);
      data = [];
    }
  }
  renderTable(data);
  drawChart(data, mode);
  return data;
};

onMounted(async () => {
  const root = document.getElementById("period");
  if (!root) return;
  const tabs = root.querySelector(".pb-tabs");
  const modeSwitch = root.querySelector("#pbModeSwitch");
  const canvas = root.querySelector("#pbChartCanvas");
  const tooltip = root.querySelector("#pbChartTooltip");
  const legendProfit = root.querySelector("#pbLegendProfit");
  const legendProfitDot = root.querySelector("#pbLegendProfitDot");

  let currentMode = "abs";
  let currentData = await loadPeriod("days", currentMode);

  const onTabClick = async (e) => {
    const t = e.target.closest(".pb-tab");
    if (!t) return;
    tabs.querySelectorAll(".pb-tab").forEach((b) => b.classList.remove("active"));
    t.classList.add("active");
    tooltip?.classList.add("hidden");
    const period = t.getAttribute("data-period");
    currentData = await loadPeriod(period, currentMode);
  };

  const onModeClick = (e) => {
    const b = e.target.closest(".pb-mode-btn");
    if (!b) return;
    modeSwitch.querySelectorAll(".pb-mode-btn").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    currentMode = b.getAttribute("data-mode");
    if (legendProfit) {
      legendProfit.textContent = currentMode === "rel" ? "Profit %" : "Absolute profit";
    }
    tooltip?.classList.add("hidden");
    drawChart(currentData, currentMode);
  };

  const onMove = (e) => showTooltip(e, canvas, currentData, currentMode);
  const onLeave = () => tooltip?.classList.add("hidden");
  const onResize = () => drawChart(currentData, currentMode);

  tabs?.addEventListener("click", onTabClick);
  modeSwitch?.addEventListener("click", onModeClick);
  canvas?.addEventListener("mousemove", onMove);
  canvas?.addEventListener("mouseleave", onLeave);
  window.addEventListener("resize", onResize);

  disposePeriod = () => {
    tabs?.removeEventListener("click", onTabClick);
    modeSwitch?.removeEventListener("click", onModeClick);
    canvas?.removeEventListener("mousemove", onMove);
    canvas?.removeEventListener("mouseleave", onLeave);
    window.removeEventListener("resize", onResize);
  };
});

onUnmounted(() => {
  disposePeriod?.();
  disposePeriod = null;
});
</script>