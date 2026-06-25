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

            <a-modal
              v-model:open="forceExitModalVisible"
              title="强制退出交易"
              :ok-text="'出口仓位'"
              :cancel-text="'取消'"
              @ok="handleForceExitOk"
            >
              <div style="padding: 10px;">
                <p style="margin-bottom: 10px;">配置并确认强制退出交易</p>
                
                <p style="margin-bottom: 10px; font-weight: bold;">平仓交易 #{{ forceExitTradeId }} {{ forceExitPair }}</p>
                <p style="margin-bottom: 10px;">目前持有 {{ forceExitCurrentAmount }} {{ forceExitBaseCurrency }}</p>
                
                <div style="margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 6px;">
                  <p style="margin-bottom: 5px;">以 {{ forceExitBaseCurrency }} 为单位的金额（可选）</p>
                  <p style="margin-bottom: 0; color: #8c90a2; font-size: 12px;">约 {{ forceExitEstimatedUsdt }} USDT（估价）</p>
                </div>
                
                <div style="margin-bottom: 15px;">
                  <label style="display: block; margin-bottom: 5px;">数量</label>
                  <input
                    type="number"
                    v-model="forceExitAmount"
                    min="0.01"
                    max="1"
                    step="0.01"
                    style="width: 100%; padding: 8px; border: 1px solid #3d4354; border-radius: 6px; background: #1a1e2e; color: #fff;"
                  />
                  <p style="margin-top: 5px; color: #8c90a2; font-size: 12px;">当前值: {{ forceExitAmount }} {{ forceExitBaseCurrency }}</p>
                </div>
                
                <div style="margin-bottom: 15px;">
                  <label style="display: block; margin-bottom: 5px;">价格（仅限限价订单，可选）</label>
                  <input
                    type="number"
                    v-model="forceExitPrice"
                    step="0.0001"
                    placeholder="输入价格"
                    style="width: 100%; padding: 8px; border: 1px solid #3d4354; border-radius: 6px; background: #1a1e2e; color: #fff;"
                  />
                </div>
                
                <div style="margin-bottom: 15px;">
                  <label style="display: block; margin-bottom: 5px;">订单类型</label>
                  <a-space>
                    <a-button
                      :type="forceExitOrderType === 'market' ? 'primary' : 'default'"
                      @click="forceExitOrderType = 'market'"
                    >市场</a-button>
                    <a-button
                      :type="forceExitOrderType === 'limit' ? 'primary' : 'default'"
                      @click="forceExitOrderType = 'limit'"
                    >限制</a-button>
                  </a-space>
                </div>
              </div>
            </a-modal>

            <a-modal
              v-model:open="increasePositionModalVisible"
              :title="`增持${increasePositionPair}`"
              :ok-text="'进入位置'"
              :cancel-text="'取消'"
              @ok="handleIncreasePositionOk"
              width="500px"
            >
              <div style="padding: 15px;">
                <p style="margin-bottom: 15px; color: #8c90a2; font-size: 12px;">增加现有职位</p>
                
                <div style="margin-bottom: 15px;">
                  <label style="display: block; margin-bottom: 8px;">订单方向（做多或做空）</label>
                  <a-space>
                    <a-button
                      :type="increasePositionDirection === 'long' ? 'primary' : 'default'"
                      @click="increasePositionDirection = 'long'"
                    >Long</a-button>
                    <a-button
                      :type="increasePositionDirection === 'short' ? 'primary' : 'default'"
                      @click="increasePositionDirection = 'short'"
                    >Short</a-button>
                  </a-space>
                </div>
                
                <div style="margin-bottom: 15px;">
                  <label style="display: block; margin-bottom: 5px;">交易对 *</label>
                  <input
                    type="text"
                    v-model="increasePositionPair"
                    readonly
                    style="width: 100%; padding: 10px; border: 1px solid #3d4354; border-radius: 6px; background: #1a1e2e; color: #fff;"
                  />
                </div>
                
                <div style="margin-bottom: 15px;">
                  <label style="display: block; margin-bottom: 5px;">价格（可选）</label>
                  <input
                    type="number"
                    v-model="increasePositionPrice"
                    step="0.0001"
                    min="0.01"
                    placeholder="价格"
                    style="width: 100%; padding: 10px; border: 1px solid #3d4354; border-radius: 6px; background: #1a1e2e; color: #fff;"
                  />
                </div>
                
                <div style="margin-bottom: 15px;">
                  <label style="display: block; margin-bottom: 5px;">质押金额（USDT）[可选]</label>
                  <input
                    type="number"
                    v-model="increasePositionMargin"
                    step="0.01"
                    min="0.01"
                    placeholder="质押金额"
                    style="width: 100%; padding: 10px; border: 1px solid #3d4354; border-radius: 6px; background: #1a1e2e; color: #fff;"
                  />
                </div>
                
                <div style="margin-bottom: 15px;">
                  <label style="display: block; margin-bottom: 5px;">利用 [可选]</label>
                  <input
                    type="number"
                    v-model="increasePositionLeverage"
                    min="1"
                    max="100"
                    step="1"
                    placeholder="利用"
                    style="width: 100%; padding: 10px; border: 1px solid #3d4354; border-radius: 6px; background: #1a1e2e; color: #fff;"
                  />
                </div>
                
                <div style="margin-bottom: 15px;">
                  <label style="display: block; margin-bottom: 8px;">订单类型</label>
                  <a-space>
                    <a-button
                      :type="increasePositionOrderType === 'market' ? 'primary' : 'default'"
                      @click="increasePositionOrderType = 'market'"
                    >市场</a-button>
                    <a-button
                      :type="increasePositionOrderType === 'limit' ? 'primary' : 'default'"
                      @click="increasePositionOrderType = 'limit'"
                    >限制</a-button>
                  </a-space>
                </div>
                
                <div style="margin-bottom: 10px;">
                  <label style="display: block; margin-bottom: 5px;">* 自定义条目标签（可选）</label>
                  <input
                    type="text"
                    v-model="increasePositionCustomTag"
                    placeholder="force_entry"
                    style="width: 100%; padding: 10px; border: 1px solid #3d4354; border-radius: 6px; background: #1a1e2e; color: #fff;"
                  />
                </div>
              </div>
            </a-modal>

            <section class="positions-block">
              <div class="positions-block-head">
                <h3 data-i18n="positions.botComparison">当前业绩</h3>
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
                <h3 data-i18n="positions.uncompletedTrades">持仓订单</h3>
                <span data-i18n="positions.liveFeed">实时推送</span>
              </div>
              <div class="positions-table-shell">
                <table class="positions-table">
                  <thead>
                    <tr>
                      <th data-i18n="th.bot">机器人</th>
                      <th data-i18n="th.id">ID</th>
                      <th data-i18n="th.pair">交易对</th>
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
                <h3 data-i18n="positions.closedTrades">已平仓订单</h3>
              </div>
              <div class="positions-table-shell">
                <table class="positions-table">
                  <thead>
                    <tr>
                      <th data-i18n="th.id">ID</th>
                      <th data-i18n="th.pair">交易对</th>
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
import { ref, computed, onMounted, onUnmounted } from "vue";
import { postForceSell } from "../../api/positions.js";
import { message, InputNumber } from "ant-design-vue";
import { http } from "../../utils/http.js";

const forceExitModalVisible = ref(false);
const forceExitTradeId = ref("");
const forceExitAmount = ref(0.04);
const forceExitPrice = ref(null);
const forceExitOrderType = ref("market");
const forceExitPair = ref("");
const forceExitCurrentAmount = ref("0.04");
const forceExitBaseCurrency = ref("ETH");
const forceExitEstimatedUsdt = ref("0.00");

const increasePositionModalVisible = ref(false);
const increasePositionTradeId = ref("");
const increasePositionAmount = ref(0.04);
const increasePositionPrice = ref(null);
const increasePositionOrderType = ref("market");
const increasePositionPair = ref("");
const increasePositionDirection = ref("long");
const increasePositionMargin = ref(null);
const increasePositionLeverage = ref(null);
const increasePositionCustomTag = ref("force_entry");

const validateAmount = (value) => {
  if (!value || value === "") {
    return "请输入数量";
  }
  const num = parseFloat(value);
  if (isNaN(num)) {
    return "请输入有效数字";
  }
  if (num <= 0.01) {
    return "数量必须大于0.01";
  }
  if (num > 1) {
    return "数量不能超过1";
  }
  return true;
};

const validatePrice = (value) => {
  if (!value || value === "") {
    return true;
  }
  const num = parseFloat(value);
  if (isNaN(num)) {
    return "请输入有效数字";
  }
  if (num <= 0) {
    return "价格必须大于0";
  }
  return true;
};

const openForceExitModal = (tradeId, pair = "", currentAmount = "0.04", baseCurrency = "ETH", currentRate = 0) => {
  forceExitTradeId.value = tradeId;
  forceExitAmount.value = parseFloat(currentAmount) || 0.04;
  forceExitPrice.value = null;
  forceExitOrderType.value = "market";
  forceExitPair.value = pair;
  forceExitCurrentAmount.value = currentAmount;
  forceExitBaseCurrency.value = baseCurrency;
  
  const amount = parseFloat(currentAmount) || 0;
  const rate = parseFloat(currentRate) || 0;
  forceExitEstimatedUsdt.value = (amount * rate).toFixed(2);
  
  forceExitModalVisible.value = true;
};

const handleForceExitOk = async () => {
  const amountVal = parseFloat(forceExitAmount.value);
  const priceVal = forceExitPrice.value ? parseFloat(forceExitPrice.value) : null;
  
  if (isNaN(amountVal) || amountVal < 0.01) {
    message.error("请输入有效的数量（大于等于0.01）");
    return;
  }
  
  try {
    const body = {
      ordertype: forceExitOrderType.value,
      tradeid: Number(forceExitTradeId.value),
      amount: amountVal
    };
    
    if (priceVal !== null && !isNaN(priceVal) && priceVal > 0) {
      body.price = priceVal;
    }
    
    console.log("Force sell request body:", body);
    await http.post("/forcesell", body);
    message.success("强制退出成功");
    window.runPanelTickOnce?.();
    forceExitModalVisible.value = false;
  } catch (e) {
    console.error("Force sell error:", e);
    message.error("强制退出失败");
  }
};

const openIncreasePositionModal = (tradeId, pair = "") => {
  increasePositionTradeId.value = tradeId;
  increasePositionAmount.value = 0.04;
  increasePositionPrice.value = null;
  increasePositionOrderType.value = "market";
  increasePositionPair.value = pair;
  increasePositionDirection.value = "long";
  increasePositionMargin.value = null;
  increasePositionLeverage.value = null;
  increasePositionCustomTag.value = "force_entry";
  increasePositionModalVisible.value = true;
};

const handleIncreasePositionOk = async () => {
  const amountVal = parseFloat(increasePositionAmount.value);
  
  if (isNaN(amountVal) || amountVal < 0.01) {
    message.error("请输入有效的数量（大于等于0.01）");
    return;
  }
  
  try {
    const body = {
      ordertype: increasePositionOrderType.value,
      pair: increasePositionPair.value,
      side: increasePositionDirection.value,
      stakeamount: amountVal
    };
    
    const priceVal = increasePositionPrice.value ? parseFloat(increasePositionPrice.value) : null;
    if (priceVal !== null && !isNaN(priceVal) && priceVal > 0) {
      body.price = priceVal;
    }
    
    const leverageVal = increasePositionLeverage.value ? parseFloat(increasePositionLeverage.value) : null;
    if (leverageVal !== null && !isNaN(leverageVal) && leverageVal >= 1) {
      body.leverage = leverageVal;
    }
    
    if (increasePositionCustomTag.value) {
      body.entry_tag = increasePositionCustomTag.value;
    }
    
    console.log("Force buy request body:", body);
    await http.post("/forcebuy", body);
    message.success("提升仓位成功");
    window.runPanelTickOnce?.();
    increasePositionModalVisible.value = false;
  } catch (e) {
    console.error("Increase position error:", e);
    message.error("提升仓位失败");
  }
};

window.openForceExitModal = openForceExitModal;
window.openIncreasePositionModal = openIncreasePositionModal;

onMounted(() => {
});

onUnmounted(() => {
  delete window.openForceExitModal;
  delete window.openIncreasePositionModal;
});
</script>