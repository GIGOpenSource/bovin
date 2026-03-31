<template>
<section id="overview" class="section active">
          <div class="ft-page">
            <header class="ft-page-hero">
              <div class="ft-page-hero__intro">
                <span class="ft-page-hero__kicker" data-i18n="page.kicker.overview"></span>
                <h1 class="ft-page-hero__title" data-i18n="page.title.overview"></h1>
                <p class="ft-page-hero__desc" data-i18n="page.desc.overview"></p>
              </div>
              <div class="ft-page-hero__aside">
                <div class="ds-mini-metrics">
                  <div><span data-i18n="hero.latency">延迟</span><strong id="heroLatency">15ms</strong></div>
                  <div><span data-i18n="hero.uptime">运行时间</span><strong id="heroUptime">99.98%</strong></div>
                </div>
              </div>
            </header>

            <div class="ds-dashboard-grid">
              <div class="ds-top-cards">
                <article class="ds-card">
                  <div class="ds-card-top"><span id="kpiCard1Title" data-i18n="overview.kpi.netValue">净资产</span><em id="kpiBotStatus">+2.4%</em></div>
                  <div class="ds-card-value" id="kpiOpenTrades">-</div>
                  <svg viewBox="0 0 100 20"><path id="kpiSpark1" d="M0 15 Q 10 18, 20 12 T 40 14 T 60 8 T 80 10 T 100 2"></path></svg>
                </article>
                <article class="ds-card">
                  <div class="ds-card-top"><span id="kpiCard2Title" data-i18n="overview.kpi.dailyProfit">日收益</span><em id="kpiCard2Em" class="positive" data-i18n="overview.kpi.targetMet">已达目标</em></div>
                  <div class="ds-card-value positive" id="kpiProfit">-</div>
                  <svg viewBox="0 0 100 20"><path id="kpiSpark2" d="M0 18 L 15 15 L 30 17 L 45 10 L 60 12 L 75 5 L 100 2"></path></svg>
                </article>
                <article class="ds-card">
                  <div class="ds-card-top"><span id="kpiCard3Title" data-i18n="overview.kpi.drawdown">最大回撤</span><em id="kpiCard3Em" class="negative" data-i18n="overview.kpi.riskThreshold">风险阈值</em></div>
                  <div class="ds-card-value negative" id="kpiMaxDrawdown">-</div>
                  <svg viewBox="0 0 100 20"><path id="kpiSpark3" d="M0 2 L 20 5 L 40 4 L 60 12 L 80 15 L 100 18"></path></svg>
                </article>
              </div>
              <article class="ds-risk">
                <div class="ds-risk-head"><h3 data-i18n="overview.risk.title">风险敞口矩阵</h3><div><span data-i18n="overview.risk.leverage">杠杆</span><b id="riskLeverageValue">—</b></div></div>
                <div class="ds-risk-cells" id="riskMatrixCells"></div>
              </article>
              <article class="ds-telemetry">
                <h3 data-i18n="overview.telemetry">系统遥测</h3>
                <div id="sysinfo" class="mono"></div>
              </article>
            </div>

            <div class="ds-strategy-table">
              <div class="head"><h3 data-i18n="overview.strategies.title">运行中的策略</h3><div class="right" id="overviewStrategiesSummary">0 运行中 · 0 已暂停 · 0 异常</div></div>
              <table class="data-table">
                <thead>
                  <tr><th data-i18n="th.strategyName">策略名称</th><th data-i18n="th.coreAsset">核心资产</th><th data-i18n="th.pnl24h">24h 盈亏</th><th data-i18n="th.pnlPercent">盈亏百分比</th><th data-i18n="th.drawdown">回撤</th><th data-i18n="th.status">状态</th></tr>
                </thead>
                <tbody id="overviewStrategiesBody"></tbody>
              </table>
            </div>

            <div id="logs" class="log hidden-control"></div>
            <div class="log-pager hidden-control">
              <button id="logsPrev" class="ghost" data-i18n="btn.prevPage">上一页</button>
              <span id="logsPageInfo" class="pager-info">1 / 1</span>
              <button id="logsNext" class="ghost" data-i18n="btn.nextPage">下一页</button>
            </div>
          </div>
        </section>
</template>

<style scoped>
/* Overview: KPI row + risk + telemetry share one 3-column track so ds-risk aligns with first two ds-cards */
.ds-dashboard-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--ft-page-stack-gap);
  margin-bottom: 0;
}

.ds-top-cards {
  display: contents;
}

.ds-risk {
  grid-column: span 2;
}

.ds-telemetry {
  grid-column: 3 / 4;
  min-width: 0;
}

.ds-card,
.ds-telemetry {
  background: var(--ft-panel-surface);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.25);
  border-radius: var(--ft-panel-radius);
  padding: var(--ft-panel-pad-block) var(--ft-panel-pad-inline);
}

.ds-dashboard-grid > .ds-card,
.ds-dashboard-grid > .ds-risk,
.ds-dashboard-grid > .ds-telemetry {
  min-width: 0;
  align-self: stretch;
}

.ds-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #c2c6d9;
  text-transform: uppercase;
}

.ds-card-top em {
  font-style: normal;
  font-weight: 700;
}

.ds-card-value {
  margin-top: 10px;
  font-family: var(--ft-font-display);
  font-size: 52px;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.ds-card svg {
  margin-top: 10px;
  width: 100%;
  height: 52px;
  fill: none;
  stroke: rgba(78, 222, 163, 0.9);
  stroke-width: 1.8;
}

.ds-risk {
  background: var(--ft-panel-surface-raised);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.25);
  border-radius: var(--ft-panel-radius);
  padding: var(--ft-panel-pad-block) var(--ft-panel-pad-inline);
}

.ds-risk-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 12px;
}

.ds-risk-head h3 {
  margin: 0;
  font-family: var(--ft-font-display);
}

.ds-telemetry h3 {
  margin: 0 0 10px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #c2c6d9;
}

.ds-risk-head span {
  display: block;
  font-size: 10px;
  color: #8c90a2;
  text-transform: uppercase;
}

.ds-risk-head b {
  font-size: 30px;
  font-family: var(--ft-font-display);
  color: #b4c5ff;
}

.ds-risk-cells {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 10px;
}

.ds-risk-cells .cell {
  background: var(--ft-panel-surface-inset);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.2);
  border-radius: 10px;
  padding: 12px;
}

.ds-risk-cells .cell span {
  display: block;
  font-size: 10px;
  color: var(--text-dim);
  text-transform: uppercase;
}

.ds-risk-cells .cell b {
  display: block;
  margin-top: 8px;
  font-size: 34px;
  font-family: var(--ft-font-display);
}

.ds-risk-cells .bar {
  margin-top: 8px;
  height: 6px;
  border-radius: 999px;
  background: rgba(var(--ft-panel-edge-rgb), 0.3);
  overflow: hidden;
}

.ds-risk-cells .bar i {
  display: block;
  height: 100%;
  width: var(--ds-risk-bar-pct, 0%);
  max-width: 100%;
  transition: width 0.2s ease;
  background: rgba(var(--ft-accent-rgb), 0.88);
}

.ds-risk-cells .bar i.sec { background: #4edea3; }
.ds-risk-cells .bar i.dim { background: rgba(218, 226, 253, 0.45); }

.ds-strategy-table {
  background: var(--ft-panel-surface);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.25);
  border-radius: var(--ft-panel-radius);
  overflow: hidden;
}

.ds-strategy-table .head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(var(--ft-panel-edge-rgb), 0.2);
  background: var(--ft-panel-head-bg);
}

.ds-strategy-table .head h3 {
  margin: 0;
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 0.1em;
}

.ds-strategy-table .head .right {
  font-size: 11px;
  color: #aeb9db;
}
</style>

<script setup src="./overview.js"></script>
