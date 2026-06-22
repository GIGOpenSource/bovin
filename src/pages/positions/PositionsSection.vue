<template>
<section id="positions" class="section">
          <div class="ft-page positions-wrap">
            <header class="ft-page-hero">
              <div class="ft-page-hero__intro">
                <span class="ft-page-hero__kicker" data-i18n="page.kicker.positions"></span>
                <h1 class="ft-page-hero__title" data-i18n="page.title.positions"></h1>
                <p class="ft-page-hero__desc" data-i18n="page.desc.positions"></p>
              </div>
              <div class="ft-page-hero__aside">
                <div class="positions-kpis">
                  <div class="pos-kpi">
                    <p data-i18n="positions.floatPnl">浮动盈亏合计</p>
                    <div><span id="posTotalPnl">+$0.00</span></div>
                  </div>
                  <div class="pos-kpi">
                    <p data-i18n="positions.exposure">当前敞口</p>
                    <div><span id="posExposure">$0.00</span></div>
                  </div>
                </div>
              </div>
            </header>

            <section class="positions-block">
              <div class="positions-block-head">
                <h3 data-i18n="positions.botComparison">机器人对比</h3>
              </div>
              <div class="positions-table-shell">
                <table class="positions-table">
                  <thead>
                    <tr>
                      <th data-i18n="th.botName">机器人名称</th>
                      <th data-i18n="th.tradeStatus">交易</th>
                      <th data-i18n="th.openPnl">开盘盈利</th>
                      <th data-i18n="th.closedPnl">已结利润</th>
                      <th data-i18n="th.balance">平衡</th>
                      <th data-i18n="th.winLoss">胜负</th>
                    </tr>
                  </thead>
                  <tbody id="botComparisonTable"></tbody>
                </table>
              </div>
            </section>

            <section class="positions-block">
              <div class="positions-block-head">
                <h3 data-i18n="positions.uncompletedTrades">未完成交易</h3>
                <span data-i18n="positions.liveFeed">实时推送</span>
              </div>
              <div class="positions-table-shell">
                <table class="positions-table">
                  <thead>
                    <tr>
                      <th data-i18n="th.bot">机器人</th>
                      <th data-i18n="th.id">ID</th>
                      <th data-i18n="th.pair">一对</th>
                      <th class="t-right" data-i18n="th.quantity">数量</th>
                      <th class="t-right" data-i18n="th.investment">投注金额</th>
                      <th class="t-right" data-i18n="th.openRate">开盈率</th>
                      <th class="t-right" data-i18n="th.currentRate">当前利率</th>
                      <th class="t-right" data-i18n="th.currentPnl">当前利润率</th>
                      <th class="t-right" data-i18n="th.openDate">开放日期</th>
                      <th class="t-center" data-i18n="th.actions">操作</th>
                    </tr>
                  </thead>
                  <tbody id="openTradesTable"></tbody>
                </table>
              </div>
              <div class="positions-pager">
                <button type="button" id="openPrev" class="ghost" data-i18n="btn.prevPage">上一页</button>
                <span id="openPageInfo" class="pager-info">1 / 1</span>
                <button type="button" id="openNext" class="ghost" data-i18n="btn.nextPage">下一页</button>
              </div>
            </section>

            <section class="positions-block">
              <div class="positions-block-head">
                <h3 data-i18n="positions.closedTrades">已平仓交易</h3>
              </div>
              <div class="positions-table-shell">
                <table class="positions-table">
                  <thead>
                    <tr>
                      <th data-i18n="th.id">ID</th>
                      <th data-i18n="th.pair">一对</th>
                      <th class="t-right" data-i18n="th.quantity">数量</th>
                      <th class="t-right" data-i18n="th.totalInvestment">总投注金额</th>
                      <th class="t-right" data-i18n="th.openRate">开盈率</th>
                      <th class="t-right" data-i18n="th.closeRate">成交价</th>
                      <th class="t-right" data-i18n="th.profitPct">利润 %</th>
                      <th class="t-right" data-i18n="th.openDate">开放日期</th>
                      <th class="t-right" data-i18n="th.closeDate">截止日期</th>
                      <th data-i18n="th.closeReason">关闭原因</th>
                    </tr>
                  </thead>
                  <tbody id="closedTradesTable"></tbody>
                </table>
              </div>
              <div class="positions-pager">
                <button type="button" id="closedPrev" class="ghost" data-i18n="btn.prevPage">上一页</button>
                <span id="closedPageInfo" class="pager-info">1 / 1</span>
                <button type="button" id="closedNext" class="ghost" data-i18n="btn.nextPage">下一页</button>
              </div>
            </section>
          </div>
        </section>
</template>

<style scoped>
.positions-wrap {
  max-width: none;
  width: 100%;
  margin: 0 auto;
}

.positions-kpis {
  display: flex;
  gap: 10px;
}

.positions-block {
  background: var(--ft-panel-surface);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.25);
  border-radius: var(--ft-panel-radius);
  padding: 12px 14px;
  margin-bottom: 16px;
}

.positions-block:last-child {
  margin-bottom: 0;
}

.positions-block-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding: 0 4px;
}

.positions-block-head h3 {
  margin: 0;
  font-family: var(--ft-font-display);
}

.positions-block-head span {
  font-size: 12px;
  color: #aeb9db;
  background: #2d3449;
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.25);
  border-radius: 999px;
  padding: 4px 8px;
}

.positions-table-shell {
  border-radius: var(--ft-panel-radius);
  overflow: hidden;
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.2);
}

.positions-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--ft-panel-surface-inset);
}

.positions-table th,
.positions-table td {
  padding: 12px 10px;
  border-bottom: 1px solid rgba(var(--ft-panel-edge-rgb), 0.14);
  font-size: 12px;
}

.positions-table th {
  background: var(--ft-table-header-bg);
  color: #8c90a2;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
}

.t-right {
  text-align: right;
}

.t-center {
  text-align: center;
}

.pair-cell {
  display: grid;
  gap: 2px;
}

.pair-cell small {
  color: #8c90a2;
  font-size: 10px;
}

.status-chip {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid rgba(180, 197, 255, 0.3);
  color: #b4c5ff;
  background: rgba(180, 197, 255, 0.08);
  font-size: 10px;
  text-transform: uppercase;
}

.status-chip.muted {
  color: #8c90a2;
  border-color: rgba(140, 144, 162, 0.25);
  background: rgba(140, 144, 162, 0.08);
}

.status-chip.green {
  color: #6bc46d;
  border-color: rgba(107, 196, 109, 0.4);
  background: rgba(107, 196, 109, 0.1);
}

.status-chip.red {
  color: #ff6b6b;
  border-color: rgba(255, 107, 107, 0.4);
  background: rgba(255, 107, 107, 0.1);
}

.pnl-positive {
  color: #6bc46d;
}

.pnl-negative {
  color: #ff6b6b;
}

.pnl-box {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 6px;
  font-weight: 600;
}

.pnl-box.positive {
  background: rgba(107, 196, 109, 0.15);
  color: #6bc46d;
}

.pnl-box.negative {
  background: rgba(255, 107, 107, 0.15);
  color: #ff6b6b;
}

.positions-pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 4px 2px;
}

:deep(.empty-row-cell) {
  text-align: center;
  vertical-align: middle;
}

:deep(.pos-close-btn) {
  min-width: 52px;
  height: 28px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid rgba(86, 140, 255, 0.65);
  background: linear-gradient(180deg, rgba(50, 96, 214, 0.95) 0%, rgba(35, 72, 168, 0.95) 100%);
  color: #e8f0ff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 0 0 1px rgba(22, 46, 109, 0.35);
}

:deep(.pos-close-btn:hover) {
  filter: brightness(1.06);
}

.action-icon {
  width: 16px;
  height: 16px;
  cursor: pointer;
  opacity: 0.7;
}

.action-icon:hover {
  opacity: 1;
}
</style>

<script>
export * from "../../api/positions.js";
</script>

<script setup>
import { onMounted, onUnmounted } from "vue";

onMounted(() => {
});

onUnmounted(() => {
});
</script>