<template>
<section id="data" class="section">
          <div class="ft-page da-wrap">
            <header class="ft-page-hero ft-page-hero--data">
              <div class="ft-page-hero__intro">
                <span class="ft-page-hero__kicker ft-kicker-accent" data-i18n="page.kicker.data"></span>
                <h1 class="ft-page-hero__title" data-i18n="page.title.data"></h1>
                <p class="ft-page-hero__desc" data-i18n="page.desc.data"></p>
                <div class="ft-page-hero__meta da-metrics">
                  <span id="daNodeLine"><i class="dot ok"></i>节点离线</span>
                  <span id="daLatencyLine"><i class="dot"></i>延迟 15ms</span>
                  <span id="daNetStatus" class="da-net-badge live">网络正常</span>
                  <span id="daDataSource" class="da-source-badge">数据源：Bovin</span>
                </div>
              </div>
              <div class="ft-page-hero__aside da-actions">
                <button type="button" id="loadPairs" class="primary"><UnorderedListOutlined /><span data-i18n="btn.loadAvailablePairs">加载 available_pairs</span></button>
                <button type="button" id="loadPairHistory" class="ghost"><HistoryOutlined /><span data-i18n="btn.loadPairHistory">加载 pair_history</span></button>
                <button type="button" class="ghost icon-only" id="daTuneBtn" data-i18n-aria="aria.chartTune" aria-label="图表调节"><FilterOutlined /></button>
              </div>
            </header>

            <div class="da-grid">
              <aside class="da-left">
                <div class="da-left-head">
                  <h3 data-i18n="data.strategies">策略</h3>
                  <span class="da-left-meta" data-i18n="data.strategiesRunningDemo">4 个运行中（演示）</span>
                </div>
                <div class="da-strategy-list">
                  <div class="da-strategy-card"><strong>SampleStrategy</strong><em>+12.4%</em><small>胜率: 64%</small></div>
                  <div class="da-strategy-card"><strong>RSITrendStrategy</strong><em>+8.1%</em><small>胜率: 58%</small></div>
                  <div class="da-strategy-card"><strong>MomentumBreakout</strong><em class="negative">-2.4%</em><small>胜率: 42%</small></div>
                  <div class="da-strategy-card"><strong>MeanReversionV2</strong><em>+24.9%</em><small>胜率: 71%</small></div>
                </div>
                <div class="da-volume">
                  <h4 data-i18n="data.networkVol">全网约成交量</h4>
                  <div class="bars da-vol-bars" id="daVolBars">
                    <i style="--da-vol-h: 40%"></i><i style="--da-vol-h: 60%"></i><i style="--da-vol-h: 85%"></i><i style="--da-vol-h: 55%"></i>
                    <i style="--da-vol-h: 95%"></i><i style="--da-vol-h: 45%"></i><i style="--da-vol-h: 70%"></i><i style="--da-vol-h: 30%"></i>
                  </div>
                </div>
              </aside>

              <div class="da-main">
                <div class="da-chart">
                  <div class="da-chart-head">
                    <h3><LineChartOutlined /><span id="daSymbolTicker">BTC_USDT_1H</span></h3>
                    <div class="da-chart-stat">
                      <span><span data-i18n="data.price">价格</span> <b id="daPriceNow">64,281.40</b></span>
                      <span id="daChgLabel"><span class="da-chg-prefix" data-i18n="data.chg24h">24h 涨跌</span> <b id="daPriceChg" class="positive da-chg-value">+2.15%</b></span>
                    </div>
                    <div id="daPairButtons" class="da-switch-group" data-i18n-aria="aria.pairSwitch" aria-label="切换交易对">
                      <button type="button" class="da-switch-btn active" data-pair="BTC/USD">BTC/USD</button>
                      <button type="button" class="da-switch-btn" data-pair="ETH/USD">ETH/USD</button>
                      <button type="button" class="da-switch-btn" data-pair="SOL/USD">SOL/USD</button>
                      <button type="button" class="da-switch-btn" data-pair="BNB/USD">BNB/USD</button>
                      <button type="button" class="da-switch-btn" data-pair="XRP/USD">XRP/USD</button>
                    </div>
                    <div id="daTfButtons" class="da-switch-group" data-i18n-aria="aria.tfSwitch" aria-label="切换周期">
                      <button type="button" class="da-switch-btn active" data-tf="5m">5m</button>
                      <button type="button" class="da-switch-btn" data-tf="15m">15m</button>
                      <button type="button" class="da-switch-btn" data-tf="1h">1h</button>
                      <button type="button" class="da-switch-btn" data-tf="4h">4h</button>
                      <button type="button" class="da-switch-btn" data-tf="1d">1d</button>
                    </div>
                    <div class="da-kline-mode-toolbar" role="toolbar" data-i18n-aria="aria.klineChartMode">
                      <span class="da-kline-mode-label muted" data-i18n="kline.modeLabel">K 线</span>
                      <button type="button" class="ghost tiny da-kline-mode-btn active" id="daKlineModeLw" data-i18n="kline.modeLw">
                        Lightweight
                      </button>
                      <button type="button" class="ghost tiny da-kline-mode-btn" id="daKlineModePanel" data-i18n="kline.modePanel">
                        面板 K 线
                      </button>
                      <button type="button" class="ghost tiny da-kline-mode-btn" id="daKlineModeSvg" data-i18n="kline.modeSvg">SVG</button>
                    </div>
                  </div>
                  <div id="daMarketBoard" class="da-market-board"></div>
                  <div class="da-chart-body">
                    <div class="mock-grid"></div>
                    <div id="daKlineStatus" class="da-kline-status hidden" role="status" aria-live="polite"></div>
                    <svg id="daMaLayerDemo" class="da-ma-layer hidden" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <polyline class="ma7" points="0,68 10,64 20,66 30,58 40,62 50,54 60,56 70,48 80,51 90,44 100,46"></polyline>
                      <polyline class="ma25" points="0,74 10,72 20,70 30,69 40,67 50,66 60,64 70,63 80,61 90,60 100,58"></polyline>
                    </svg>
                    <div id="daKlineHintDemo" class="da-kline-hint hidden" role="status" aria-live="polite">
                      <span>实时数据源不可达，当前未获取到可渲染 K 线</span>
                      <button type="button" class="ghost tiny" id="daKlineRetryBtnMini">立即重试</button>
                    </div>
                    <div id="pairData" class="log"></div>
                  </div>
                </div>

                <div class="da-history">
                  <div class="da-history-head">
                    <h3 data-i18n="data.histLogs">历史日志</h3>
                    <button type="button" class="ghost" id="exportHistoryCsv" data-i18n="data.exportCsv">导出 CSV</button>
                  </div>
                  <div id="availablePairs" class="log">
                    <div id="daHistoryEmpty" class="da-history-empty">
                      <div class="da-history-empty-meta">
                        <span class="da-history-pill">长度 0</span>
                        <span class="da-history-pill">交易对数 0</span>
                        <span class="da-history-pill">行数 0</span>
                      </div>
                      <div class="da-history-empty-text">暂无历史日志数据</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="hidden-control">
              <input id="historyStrategy" name="historyStrategy" value="SampleStrategy" autocomplete="off" />
              <input id="historyPair" name="historyPair" value="BTC/USD" autocomplete="off" />
              <input id="historyTf" name="historyTf" value="5m" autocomplete="off" />
              <input id="historyRange" name="historyRange" value="20260324-20260327" autocomplete="off" />
            </div>
          </div>
        </section>
</template>

<style scoped>
/* Data panel */
.da-wrap {
  width: 100%;
}

.da-metrics {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 10px;
  color: #aeb9db;
  letter-spacing: 0.08em;
}

.da-metrics span {
  display: inline-flex;
  align-items: center;
}

.da-metrics .dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: rgba(180, 197, 255, 0.5);
  display: inline-block;
  margin-right: 6px;
}

.da-metrics .dot.ok {
  background: #4edea3;
}

.da-net-badge {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.35);
  background: rgba(20, 30, 52, 0.8);
  color: #d9e4ff;
  letter-spacing: 0.04em;
  font-weight: 700;
}

.da-net-badge.live {
  color: #4edea3;
  border-color: rgba(78, 222, 163, 0.35);
  background: rgba(78, 222, 163, 0.1);
}

.da-net-badge.retry {
  color: #f8cf65;
  border-color: rgba(248, 207, 101, 0.35);
  background: rgba(248, 207, 101, 0.1);
}

.da-net-badge.fallback {
  color: #ffb4ab;
  border-color: rgba(255, 180, 171, 0.35);
  background: rgba(255, 180, 171, 0.1);
}

.da-source-badge {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid rgba(180, 197, 255, 0.25);
  background: rgba(180, 197, 255, 0.1);
  color: #b4c5ff;
  font-weight: 700;
}

.da-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(30, 39, 61, 0.72);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.28);
  border-radius: 14px;
  padding: 8px;
}

.da-actions button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
}

.da-actions .anticon {
  font-size: 14px;
  line-height: 1;
}

.da-actions .icon-only {
  width: 34px;
  height: 34px;
  justify-content: center;
  padding: 0;
}

.da-grid {
  display: grid;
  grid-template-columns: minmax(260px, 280px) minmax(0, 1fr);
  gap: var(--ft-page-stack-gap);
}

.da-left {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  align-self: start;
}

.da-left-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.da-left-head h3 {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 12px;
}

.da-left-head span {
  font-size: 10px;
  color: var(--text-dim);
  background: rgba(var(--ft-accent-rgb), 0.1);
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(var(--ft-line-rgb), 0.2);
}

.da-strategy-list {
  display: grid;
  gap: 8px;
  width: 100%;
}

.da-strategy-card {
  background: var(--ft-panel-surface);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.2);
  border-radius: 10px;
  padding: 10px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 8px;
  align-items: center;
  min-height: 64px;
}

.da-strategy-card strong {
  font-size: 14px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.da-strategy-card em {
  font-style: normal;
  color: #4edea3;
  font-weight: 700;
  font-size: 13px;
}

.da-strategy-card small {
  grid-column: 1 / -1;
  font-size: 10px;
  color: #8c90a2;
  line-height: 1.35;
}

.da-volume {
  background: var(--ft-panel-surface);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.2);
  border-radius: 10px;
  padding: 12px;
  margin-top: 2px;
}

.da-volume h4 {
  margin: 0 0 8px;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.da-volume .bars {
  height: 90px;
  display: flex;
  align-items: flex-end;
  gap: 4px;
  width: 100%;
}

.da-volume .bars i {
  flex: 1;
  align-self: flex-end;
  height: var(--da-vol-h, 45%);
  min-height: 4px;
  background: rgba(180, 197, 255, 0.35);
  border-radius: 4px 4px 0 0;
}

.da-main {
  display: grid;
  gap: var(--ft-page-stack-gap);
  min-width: 0;
}

.da-chart,
.da-history {
  background: var(--ft-panel-surface);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.22);
  border-radius: var(--ft-panel-radius);
  overflow: hidden;
  min-width: 0;
}

.da-chart-head,
.da-history-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(var(--ft-panel-edge-rgb), 0.2);
  background: rgba(34, 42, 61, 0.5);
}

.da-chart-head h3,
.da-history-head h3 {
  margin: 0;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.da-switch-group {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.da-switch-btn {
  height: 30px;
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  background: var(--ft-panel-surface-inset);
  color: #dae2fd;
  border-radius: 8px;
  font-size: 11px;
  padding: 0 10px;
  cursor: pointer;
}

.da-switch-btn.active {
  color: #4edea3;
  border-color: rgba(78, 222, 163, 0.42);
  background: rgba(78, 222, 163, 0.12);
}


.da-market-board {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  overflow-x: auto;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(var(--ft-panel-edge-rgb), 0.15);
  background: rgba(12, 20, 38, 0.72);
}

.da-market-board .chip {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.25);
  background: var(--ft-panel-surface-inset);
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
}

.da-market-board .chip b {
  color: #dae2fd;
}

.da-market-board .chip em {
  font-style: normal;
  color: #aeb9db;
}

.da-market-board .chip i {
  font-style: normal;
  font-weight: 700;
}

.da-market-board .chip.up i { color: #4edea3; }
.da-market-board .chip.down i { color: #ffb4ab; }

.da-chart-stat {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 10px;
  color: #aeb9db;
}

.da-chart-body {
  position: relative;
  min-height: 280px;
  min-width: 0;
}

.mock-grid {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-image:
    linear-gradient(to right, rgba(var(--ft-panel-edge-rgb), 0.1) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(var(--ft-panel-edge-rgb), 0.1) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
}

.da-chart #pairData,
.da-history #availablePairs {
  margin: 0;
  min-height: 220px;
  background: transparent;
  border: 0;
  border-radius: 0;
  white-space: normal;
  max-height: none;
  padding: 12px;
  min-width: 0;
}

.da-chart #pairData {
  position: relative;
  z-index: 2;
  overflow: hidden;
}

/** K 线加载/无数据提示（在 #pairData 外，避免被 overflow 与画布叠层挡住） */
.da-kline-status {
  /* margin: 0 0 8px; */
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.45;
  color: #dae2fd;
  background: rgba(34, 42, 61, 0.85);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.45);
  z-index: 5;
  /* margin-right: 10px !important; */
  margin: 0 10px;
}

.da-kline-status.hidden {
  display: none !important;
}

.da-kline-status .da-kline-status-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  flex-wrap: wrap;
  margin-left: 10px;
}

.da-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.da-table-wrap-main {
  max-height: 240px;
}

.da-table-wrap-logs {
  max-height: 320px;
}

.da-chart-live {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.da-chart-live .pill {
  font-size: 12px;
  color: #8c90a2;
  background: var(--ft-panel-surface-inset);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.2);
  border-radius: 999px;
  padding: 4px 8px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.da-chart-live .pill b {
  margin-left: 4px;
  color: #dae2fd;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.da-candle-strip {
  margin-top: 10px;
  display: block;
  height: 320px;
  position: relative;
  isolation: isolate;
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.2);
  background: rgba(11, 19, 38, 0.6);
  border-radius: 8px;
  padding: 6px 56px 6px 8px;
}

.da-ma-layer {
  position: absolute;
  inset: 6px 56px 6px 8px;
  z-index: 1;
  pointer-events: none;
}

/* 仅用 inset 定框；勿再写 width/height，否则与四边定位冲突易导致 0×0 或错位，图表库与 Canvas 都画在不可见区域 */
.da-kline-mount {
  position: absolute;
  inset: 6px 56px 6px 8px;
  z-index: 1;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
}

.da-kline-mount canvas.da-panel-kline {
  display: block;
  width: 100%;
  height: 100%;
}

.da-kline-mode-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
  font-size: 11px;
}

.da-kline-mode-label {
  color: #8c90a2;
  margin-right: 2px;
}

.da-kline-mode-btn.active {
  border-color: rgba(78, 222, 163, 0.45);
  color: #b8f5d4;
  background: rgba(78, 222, 163, 0.1);
}

.da-kline-mount.fallback-interactive {
  cursor: grab;
}

.da-draw-layer {
  position: absolute;
  inset: 6px 56px 6px 8px;
  z-index: 3;
  pointer-events: none;
}

.da-ma-layer polyline {
  fill: none;
  stroke-width: 0.9;
  vector-effect: non-scaling-stroke;
}

.da-ma-layer .ma7 { stroke: #f1d06e; opacity: 0.95; }
.da-ma-layer .ma25 { stroke: #9c5aff; opacity: 0.95; }


.da-ma-legend {
  position: absolute;
  left: 12px;
  top: 10px;
  z-index: 2;
  display: flex;
  gap: 10px;
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.da-ma-legend .ma7 { color: #f1d06e; }
.da-ma-legend .ma25 { color: #9c5aff; }

.da-ohlc-float {
  position: absolute;
  z-index: 4;
  background: rgba(6, 14, 32, 0.92);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.35);
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 10px;
  color: #dae2fd;
  pointer-events: none;
  white-space: nowrap;
}

.da-kline-hint {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 12;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: #aeb9db;
  background: rgba(6, 14, 32, 0.8);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.35);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-right: 10px;
}

.da-fallback-kline {
  width: 100%;
  height: 100%;
  display: block;
}


.da-mini-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.2);
  border-radius: 8px;
  overflow: hidden;
  min-width: 620px;
}

.da-mini-table th,
.da-mini-table td {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(var(--ft-panel-edge-rgb), 0.12);
  font-size: 11px;
}

.da-mini-table th {
  background: rgba(34, 42, 61, 0.6);
  color: #8c90a2;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
}

.da-history-table {
  margin-top: 12px;
}

.da-history-table tbody tr:nth-child(even) {
  background: var(--ft-panel-head-bg-soft);
}

.da-history-table tbody tr:hover {
  background: rgba(34, 42, 61, 0.7);
}

.da-history-empty {
  min-height: 180px;
  display: grid;
  align-content: start;
  gap: 10px;
}

.da-history-empty-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.da-history-pill {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.35);
  background: rgba(20, 30, 52, 0.55);
  color: #9fb0d8;
  font-size: 11px;
}

.da-history-empty-text {
  margin-top: 14px;
  text-align: center;
  color: #8fa2d0;
  font-size: 13px;
}

.da-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.da-tag.buy {
  color: #4edea3;
  background: rgba(78, 222, 163, 0.14);
  border: 1px solid rgba(78, 222, 163, 0.25);
}

.da-tag.sell {
  color: #ffb4ab;
  background: rgba(255, 180, 171, 0.14);
  border: 1px solid rgba(255, 180, 171, 0.25);
}

.da-tag.neutral {
  color: #8c90a2;
  background: rgba(var(--ft-panel-edge-rgb), 0.2);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.35);
}

.da-inline-error {
  margin-bottom: 10px;
  border: 1px solid rgba(255, 180, 171, 0.3);
  background: rgba(147, 0, 10, 0.25);
  color: #ffdad6;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 11px;
  white-space: pre-wrap;
}

.ft-env-hint-banner {
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 10px 14px;
  font-size: 12px;
  line-height: 1.45;
  color: #3d2a00;
  background: linear-gradient(90deg, #ffe08a 0%, #ffd866 100%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  z-index: 10000;
}

.da-history-pager {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}

@media (max-width: 1200px) {
  .ft-page-hero__title { font-size: 34px; }
  .ft-page-hero {
    flex-direction: column;
    align-items: flex-start;
  }
  .ft-page-hero__aside {
    width: 100%;
  }
  .ds-mini-metrics {
    width: 100%;
    flex-wrap: wrap;
  }
  .ds-dashboard-grid {
    grid-template-columns: 1fr;
  }
  .ds-risk,
  .ds-telemetry {
    grid-column: auto;
  }
  .ds-risk-cells { grid-template-columns: 1fr; }
  .positions-kpis {
    width: 100%;
    flex-wrap: wrap;
  }
  .ft-page-hero__aside .sc-hero-kpis {
    width: 100%;
    justify-content: flex-start;
  }
  .ft-page-hero__aside .sc-hero-kpis .sc-kpi {
    flex: 1;
    min-width: min(220px, 100%);
    justify-content: space-between;
  }
  .pos-kpi {
    flex: 1;
    min-width: 0;
  }
  .sc-console-grid {
    grid-template-columns: 1fr;
  }
  .sc-strategy-grid {
    grid-template-columns: 1fr;
  }
  .sc-governance,
  .sc-feed {
    grid-column: auto;
  }
  .sc-governance-grid {
    grid-template-columns: 1fr;
  }
  .sc-list.black {
    border-left: 0;
    border-top: 1px solid rgba(var(--ft-panel-edge-rgb), 0.2);
  }
  .da-grid {
    grid-template-columns: 1fr;
  }
  .da-left {
    width: 100%;
  }
  .da-actions {
    width: 100%;
    flex-wrap: wrap;
  }
  .da-actions button {
    flex: 1;
    justify-content: center;
  }
  .da-actions .icon-only {
    flex: 0 0 42px;
  }
  .da-candle-strip {
    height: 240px;
  }
}

.hero-title {
  margin: 0;
  font-family: var(--ft-font-display);
  font-size: 32px;
  line-height: 1.05;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.hero-title span {
  display: block;
  font-size: 20px;
  color: var(--text-dim);
  font-weight: 600;
}

.hero-meta {
  margin: 8px 0 0;
  color: var(--text-dim);
  font-size: 12px;
}

.hero-stats {
  display: flex;
  gap: 10px;
}

.mini-stat {
  background: rgba(19, 27, 46, 0.85);
  border: 1px solid rgba(var(--ft-line-rgb), 0.25);
  border-radius: 10px;
  padding: 10px 12px;
}

.mini-stat span {
  display: block;
  font-size: 10px;
  color: var(--text-dim);
  text-transform: uppercase;
}

.mini-stat strong {
  font-family: var(--ft-font-display);
  font-size: 16px;
}

.overview-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 14px;
}

.metric-card {
  background: linear-gradient(180deg, rgba(19, 27, 46, 0.95) 0%, rgba(14, 22, 43, 0.95) 100%);
  border: 1px solid rgba(var(--ft-line-rgb), 0.25);
  border-radius: 14px;
  padding: 16px;
}

.metric-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.metric-head span {
  font-size: 11px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.metric-head em {
  font-style: normal;
  font-size: 10px;
  font-weight: 700;
  border-radius: 999px;
  padding: 3px 8px;
  background: rgba(var(--ft-accent-rgb), 0.15);
  color: var(--primary);
}

.metric-head em.good {
  background: rgba(78, 222, 163, 0.16);
  color: var(--secondary);
}

.metric-head em.bad {
  background: rgba(255, 179, 173, 0.16);
  color: var(--tertiary);
}

.metric-value span {
  font-family: var(--ft-font-display);
  font-size: 34px;
  font-weight: 800;
  line-height: 1;
}

.metric-value small {
  display: block;
  margin-top: 4px;
  color: var(--text-dim);
  font-size: 11px;
}

.metric-card svg {
  margin-top: 12px;
  width: 100%;
  height: 46px;
  fill: none;
  stroke: rgba(78, 222, 163, 0.9);
  stroke-width: 1.8;
}

.overview-mid {
  grid-template-columns: 2fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}

.risk-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 16px;
}

.risk-head h3 {
  margin: 0;
}

.risk-head span {
  color: var(--text-dim);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.risk-lev {
  font-family: var(--ft-font-display);
  font-size: 24px;
  font-weight: 800;
  color: var(--primary);
}

.risk-bars {
  display: grid;
  gap: 12px;
}

.risk-bars label {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  margin-bottom: 4px;
}

.bar {
  height: 6px;
  border-radius: 999px;
  background: rgba(var(--ft-line-rgb), 0.24);
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  background: var(--primary);
}

.bar i.bar-sec {
  background: var(--secondary);
}

.bar i.bar-dim {
  background: rgba(227, 233, 255, 0.45);
}
</style>

<script setup>
import { onMounted, onUnmounted } from "vue";
import {
  FilterOutlined,
  HistoryOutlined,
  LineChartOutlined,
  UnorderedListOutlined
} from "@ant-design/icons-vue";

let disposePairTf = null;
let historyEmptyTimer = null;

onMounted(() => {
  const pairWrap = document.getElementById("daPairButtons");
  const tfWrap = document.getElementById("daTfButtons");
  const modeWrap = document.querySelector(".da-kline-mode-toolbar");
  const ticker = document.getElementById("daSymbolTicker");
  const klineStatus = document.getElementById("daKlineStatus");
  const maLayerDemo = document.getElementById("daMaLayerDemo");
  const klineHintDemo = document.getElementById("daKlineHintDemo");
  const historyRoot = document.getElementById("availablePairs");
  const historyEmpty = document.getElementById("daHistoryEmpty");
  if (!pairWrap || !tfWrap || !modeWrap) return;

  const applyActive = (wrap, attr, value) => {
    const buttons = Array.from(wrap.querySelectorAll("button.da-switch-btn"));
    for (const btn of buttons) {
      const on = btn.getAttribute(attr) === value;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }
  };

  const currentPair = () =>
    pairWrap.querySelector("button.da-switch-btn.active")?.getAttribute("data-pair") || "BTC/USD";
  const currentTf = () =>
    tfWrap.querySelector("button.da-switch-btn.active")?.getAttribute("data-tf") || "5m";

  const syncTicker = () => {
    if (!ticker) return;
    const p = currentPair().replace("/", "_");
    const tf = currentTf().toUpperCase();
    ticker.textContent = `${p}_${tf}`;
  };

  const onPairClick = (e) => {
    const btn = e.target instanceof Element ? e.target.closest("button.da-switch-btn[data-pair]") : null;
    if (!btn) return;
    const value = btn.getAttribute("data-pair");
    if (!value) return;
    applyActive(pairWrap, "data-pair", value);
    syncTicker();
  };

  const onTfClick = (e) => {
    const btn = e.target instanceof Element ? e.target.closest("button.da-switch-btn[data-tf]") : null;
    if (!btn) return;
    const value = btn.getAttribute("data-tf");
    if (!value) return;
    applyActive(tfWrap, "data-tf", value);
    syncTicker();
  };

  const onModeClick = (e) => {
    const btn = e.target instanceof Element ? e.target.closest("button.da-kline-mode-btn") : null;
    if (!btn) return;
    const buttons = Array.from(modeWrap.querySelectorAll("button.da-kline-mode-btn"));
    for (const b of buttons) {
      const on = b === btn;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    }
    syncModePanel();
  };

  const syncModePanel = () => {
    if (!klineStatus) return;
    const lwActive = document.getElementById("daKlineModeLw")?.classList.contains("active");
    if (lwActive) {
      klineStatus.classList.remove("hidden");
      maLayerDemo?.classList.remove("hidden");
      klineHintDemo?.classList.remove("hidden");
      klineStatus.innerHTML =
        '<span>实时数据源不可达，当前未获取到可渲染 K 线</span><span class="da-kline-status-actions"><button type="button" class="ghost tiny" id="daKlineRetryBtn">立即重试</button></span>';
    } else {
      klineStatus.classList.add("hidden");
      maLayerDemo?.classList.add("hidden");
      klineHintDemo?.classList.add("hidden");
      klineStatus.textContent = "";
    }
  };

  const onRetryClick = (e) => {
    const btn =
      e.target instanceof Element ? e.target.closest("#daKlineRetryBtn, #daKlineRetryBtnMini") : null;
    if (!btn) return;
    btn.textContent = "重试中...";
    window.setTimeout(() => {
      btn.textContent = "立即重试";
    }, 800);
  };

  const syncHistoryEmptyState = () => {
    if (!historyRoot || !historyEmpty) return;
    const rows = Array.from(historyRoot.querySelectorAll(".da-history-table tbody tr"));
    let hasData = false;
    for (const tr of rows) {
      const tds = Array.from(tr.querySelectorAll("td"));
      if (!tds.length) continue;
      const anyReal = tds.some((td) => {
        const txt = String(td.textContent || "").trim();
        return txt && txt !== "-" && txt !== "—";
      });
      if (anyReal) {
        hasData = true;
        break;
      }
    }
    historyEmpty.classList.toggle("hidden", hasData);
  };

  pairWrap.addEventListener("click", onPairClick);
  tfWrap.addEventListener("click", onTfClick);
  modeWrap.addEventListener("click", onModeClick);
  klineStatus?.addEventListener("click", onRetryClick);
  klineHintDemo?.addEventListener("click", onRetryClick);
  syncTicker();
  syncModePanel();
  syncHistoryEmptyState();
  historyEmptyTimer = window.setInterval(syncHistoryEmptyState, 1000);

  disposePairTf = () => {
    pairWrap.removeEventListener("click", onPairClick);
    tfWrap.removeEventListener("click", onTfClick);
    modeWrap.removeEventListener("click", onModeClick);
    klineStatus?.removeEventListener("click", onRetryClick);
    klineHintDemo?.removeEventListener("click", onRetryClick);
    if (historyEmptyTimer != null) {
      window.clearInterval(historyEmptyTimer);
      historyEmptyTimer = null;
    }
  };
});

onUnmounted(() => {
  disposePairTf?.();
  disposePairTf = null;
});
</script>

<script>
export * from "../../api/data.js";
</script>
