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
                <h3 data-i18n="positions.active">当前持仓</h3>
                <span data-i18n="positions.liveFeed">实时推送</span>
              </div>
              <div class="positions-table-shell">
                <table class="positions-table">
                  <thead>
                    <tr>
                      <th data-i18n="th.tradingPair">交易对</th>
                      <th class="t-right" data-i18n="th.openingPrice">开仓价</th>
                      <th class="t-right" data-i18n="th.currentPrice">现价</th>
                      <th class="t-right" data-i18n="th.floatingPnl">浮动盈亏</th>
                      <th class="t-right" data-i18n="th.positionSize">持仓规模</th>
                      <th class="t-center" data-i18n="th.actions">操作</th>
                    </tr>
                  </thead>
                  <tbody id="statusTable"></tbody>
                </table>
              </div>
              <div class="positions-pager">
                <button type="button" id="statusPrev" class="ghost" data-i18n="btn.prevPage">上一页</button>
                <span id="statusPageInfo" class="pager-info">1 / 1</span>
                <button type="button" id="statusNext" class="ghost" data-i18n="btn.nextPage">下一页</button>
              </div>
            </section>

            <section class="positions-block">
              <div class="positions-block-head">
                <h3 id="pendingSectionTitle" data-i18n="positions.pendingMock">当前持单/待成交</h3>
                <div class="pending-actions">
                  <button type="button" class="ghost" id="pendingFilterBtn" data-i18n="positions.filter">筛选</button>
                  <button type="button" class="ghost" id="pendingCancelAllBtn" data-i18n="positions.cancelAll" disabled>全部撤单</button>
                </div>
              </div>
              <div class="positions-table-shell">
                <table class="positions-table">
                  <thead>
                    <tr>
                      <th data-i18n="th.orderType">订单类型</th>
                      <th class="t-right" data-i18n="th.price">价格</th>
                      <th class="t-right" data-i18n="th.quantity">数量</th>
                      <th class="t-center" data-i18n="th.status">状态</th>
                      <th class="t-center" data-i18n="th.actions">操作</th>
                    </tr>
                  </thead>
                  <tbody id="pendingTable">
                    <tr data-empty-row="pending">
                      <td colspan="5" class="empty-row-cell">无挂单</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="positions-pager">
                <button type="button" id="pendingPrev" class="ghost" data-i18n="btn.prevPage">上一页</button>
                <span id="pendingPageInfo" class="pager-info">1 / 1</span>
                <button type="button" id="pendingNext" class="ghost" data-i18n="btn.nextPage">下一页</button>
              </div>
            </section>
          </div>
        </section>
</template>

<style scoped>
/* Positions page (desktop template style) */
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

.pending-actions {
  display: flex;
  gap: 8px;
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

:deep(.pos-cancel-order-btn) {
  min-width: 52px;
  height: 28px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid rgba(230, 162, 60, 0.75);
  background: linear-gradient(180deg, rgba(200, 120, 40, 0.92) 0%, rgba(150, 85, 25, 0.95) 100%);
  color: #fff8f0;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 0 0 1px rgba(90, 50, 12, 0.35);
}

:deep(.pos-cancel-order-btn:hover:not(:disabled)) {
  filter: brightness(1.06);
}

:deep(.pos-cancel-order-btn:disabled) {
  opacity: 0.45;
  cursor: not-allowed;
  filter: none;
}
</style>

<script>
export * from "../../api/positions.js";
</script>

<script setup>
import { onMounted, onUnmounted } from "vue";

let emptyRowTimer = null;

onMounted(() => {
  const syncPendingEmptyRow = () => {
    const tbody = document.getElementById("pendingTable");
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll("tr"));
    const placeholder = rows.find((r) => r.getAttribute("data-empty-row") === "pending") || null;
    const realRows = rows.filter((r) => r.getAttribute("data-empty-row") !== "pending");
    if (realRows.length === 0) {
      if (!placeholder) {
        tbody.insertAdjacentHTML(
          "beforeend",
          '<tr data-empty-row="pending"><td colspan="5" class="empty-row-cell">无挂单</td></tr>'
        );
      }
    } else if (placeholder) {
      placeholder.remove();
    }
  };

  syncPendingEmptyRow();
  emptyRowTimer = window.setInterval(syncPendingEmptyRow, 1000);
});

onUnmounted(() => {
  if (emptyRowTimer != null) window.clearInterval(emptyRowTimer);
});
</script>
