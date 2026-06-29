<template>
<section id="data" class="section">
          <div class="ft-page da-wrap">
            <header class="ft-page-hero ft-page-hero--data">
              <div class="ft-page-hero__intro">
                <span class="ft-page-hero__kicker ft-kicker-accent" data-i18n="page.kicker.data"></span>
                <h1 class="ft-page-hero__title" data-i18n="page.title.data"></h1>
                <p class="ft-page-hero__desc" data-i18n="page.desc.data"></p>
                <div class="ft-page-hero__meta da-metrics">
                  <span id="daNodeLine"><i class="dot ok"></i><span data-i18n="data.nodeOffline">节点离线</span></span>
                  <span id="daLatencyLine"><i class="dot"></i><span data-i18n="data.latencyMock">延迟 15ms</span></span>
                  <span id="daNetStatus" class="da-net-badge live"></span>
                  <span id="daDataSource" class="da-source-badge"><span data-i18n="data.sourceLabel">数据源</span>：<span id="daDataSourceValue">Bovin</span></span>
                </div>
              </div>
              <div>
                <div id="daWhitelistPairs" class="da-pair-selector-inline">
                  <!-- <span class="da-pair-selector-label">交易对:</span> -->
                  <div class="da-pair-list-inline" id="daWhitelistPairsList"></div>
                </div>
                <button type="button" id="loadPairs" class="primary"><span style="font-weight: 500;font-size: 15px;" @click="$router.push('/download')" data-i18n="btn.loadPairs">下载交易对数据</span></button>
                <!-- <button type="button" id="loadPairHistory" class="ghost"><HistoryOutlined /><span data-i18n="btn.loadPairHistory">加载 pair_history</span></button>
                <button type="button" class="ghost icon-only" id="daTuneBtn" data-i18n-aria="aria.chartTune" aria-label="图表调节"><FilterOutlined /></button> -->
              </div>
            </header>

            <div class="da-grid">
              <div class="da-main">
                <div class="da-chart">
                  <div class="da-chart-head da-chart-head--toolbar">
                    <div class="da-chart-head__meta">
                      <h3><LineChartOutlined /><span id="daSymbolTicker">BTC_USDT_5M</span></h3>
                      <div class="da-chart-stat">
                        <span><span data-i18n="data.price">价格</span> <b id="daPriceNow">64,281.40</b></span>
                        <span id="daChgLabel"
                          ><span class="da-chg-prefix" data-i18n="data.chg24h">24h 涨跌</span>
                          <b id="daPriceChg" class="positive da-chg-value">+2.15%</b></span
                        >
                      </div>
                    </div>
                    <!-- 顶栏交易对胶囊（与第二行行情卡重复时可隐藏）
                    <div id="daPairButtons" class="da-switch-group da-chart-head__seg" data-i18n-aria="aria.pairSwitch" aria-label="切换交易对">
                      <button type="button" class="da-switch-btn active" data-pair="BTC/USDT">BTC/USDT</button>
                      <button type="button" class="da-switch-btn" data-pair="ETH/USDT">ETH/USDT</button>
                      <button type="button" class="da-switch-btn" data-pair="SOL/USDT">SOL/USDT</button>
                      <button type="button" class="da-switch-btn" data-pair="BNB/USDT">BNB/USDT</button>
                      <button type="button" class="da-switch-btn" data-pair="XRP/USDT">XRP/USDT</button>
                    </div>
                    -->
                    <div id="daTfButtons" class="da-switch-group da-chart-head__seg" data-i18n-aria="aria.tfSwitch" aria-label="切换周期">
                      <button type="button" class="da-switch-btn active" data-tf="5m">5m</button>
                      <button type="button" class="da-switch-btn" data-tf="15m">15m</button>
                      <button type="button" class="da-switch-btn" data-tf="1h">1h</button>
                      <button type="button" class="da-switch-btn" data-tf="4h">4h</button>
                      <button type="button" class="da-switch-btn" data-tf="1d">1d</button>
                    </div>
                    <div id="daChartPairSelector" class="da-switch-group da-chart-head__seg" data-i18n-aria="aria.pairSwitch" aria-label="切换交易对">
                      <span class="da-pair-tab-loading">加载中...</span>
                    </div>
                  </div>
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

                



              </div>
            </div>
          </div>
             <section class="positions-block">
              <div class="positions-block-head">
                <h3 data-i18n="positions.uncompletedTrades">持仓订单</h3>
                <span data-i18n="positions.liveFeed">实时推送</span>
              </div>
              <div class="positions-table-scroll">
                <table class="positions-table">
                  <thead>
                    <tr>
                      <th data-i18n="th.bot">机器人</th>
                      <th data-i18n="th.id">ID</th>
                      <th data-i18n="th.tradingPair">交易对</th>
                      <th data-i18n="th.quantity">数量</th>
                      <th data-i18n="th.investment">投注金额</th>
                      <th data-i18n="th.openRate">开盈率</th>
                      <th data-i18n="th.currentRate">当前利率</th>
                      <th data-i18n="th.currentPnl">当前利润率</th>
                      <th data-i18n="th.openDate">开放日期</th>
                      <th data-i18n="th.actions">操作</th>
                    </tr>
                  </thead>
                  <tbody id="openTradesTable"></tbody>
                </table>
              </div>
            </section>

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
                  <label style="display: block; margin-bottom: 5px;" data-i18n="positions.pair">交易对 *</label>
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
              </div>
            </a-modal>
          
        </section>
        
</template>

<style scoped>
.positions-block {
  background: var(--ft-panel-surface);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.25);
  border-radius: var(--ft-panel-radius);
  padding: 12px 14px;
  margin-bottom: 16px;
  position: relative;
  margin-top: 16px;
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

.positions-table-scroll {
  border-radius: var(--ft-panel-radius);
  overflow-x: auto;
  overflow-y: auto;
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.2);
  max-height: 420px;
}

.positions-table-scroll thead th {
  position: sticky;
  top: 0;
  z-index: 1;
}

.positions-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--ft-panel-surface-inset);
}

.positions-table th,
.positions-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid rgba(var(--ft-panel-edge-rgb), 0.1);
  font-size: 12px;
  white-space: nowrap;
}

.positions-table th {
  background: rgba(34, 42, 61, 0.6);
  color: #8c90a2;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
}

.positions-table tr:last-child td {
  border-bottom: none;
}

.positions-table tr:hover td {
  background: rgba(78, 222, 163, 0.05);
}

.pnl-box {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  font-weight: 600;
}

.pnl-box.positive {
  color: #4edea3;
  background: rgba(78, 222, 163, 0.12);
}

.pnl-box.negative {
  color: #ffb4ab;
  background: rgba(255, 180, 171, 0.12);
}

.action-dropdown {
  position: relative;
  display: inline-block;
}

.action-icon-btn {
  background: transparent;
  border: none;
  color: #aeb9db;
  padding: 4px;
  border-radius: 4px;
  font-size: 18px;
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-icon-btn:hover:not(:disabled) {
  background: rgba(180, 197, 255, 0.1);
  color: #b4c5ff;
}

.action-icon-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.action-icon-dots {
  font-weight: bold;
  letter-spacing: 2px;
}

.action-dropdown-menu {
  position: fixed;
  margin-top: 4px;
  background: #1e2336;
  border: 1px solid rgba(180, 197, 255, 0.2);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  z-index: 9999;
  min-width: 190px;
  display: none;
  overflow: hidden;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 12px;
  color: #dae2fd;
  background: transparent;
  border: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
}

.dropdown-item:hover {
  background: rgba(180, 197, 255, 0.1);
}

.dropdown-icon {
  font-size: 14px;
  width: 16px;
  text-align: center;
}
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
  grid-template-columns: 1fr;
  gap: var(--ft-page-stack-gap);
}

.da-pair-selector-inline {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-right: 16px;
}

.da-pair-selector-label {
  font-size: 12px;
  color: var(--ft-text-muted);
  white-space: nowrap;
}

.da-pair-list-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.da-pair-item-loading {
  color: var(--ft-text-muted);
  font-size: 12px;
}

.da-pair-item {
  padding: 4px 10px;
  background: rgba(34, 42, 61, 0.8);
  border: 1px solid var(--ft-border-color);
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  color: var(--ft-text-primary);
  transition: all 0.2s;
  white-space: nowrap;
}

.da-pair-item:hover {
  background: var(--ft-accent-bg);
  border-color: var(--ft-accent-color);
}

.da-pair-item.active {
  background: var(--ft-accent-color);
  border-color: var(--ft-accent-color);
  color: white;
}

.da-volume {
  background: var(--ft-panel-surface);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.2);
  border-radius: var(--ft-panel-radius);
  padding: 12px;
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

.da-chart {
  background: var(--ft-panel-surface);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.22);
  border-radius: var(--ft-panel-radius);
  overflow: hidden;
  min-width: 0;
}

.da-chart-head {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(var(--ft-panel-edge-rgb), 0.2);
  background: rgba(34, 42, 61, 0.5);
}

/** 第一行：标题+价格、交易对、周期、K 线模式同一行（窄屏横向滚动） */
.da-chart-head--toolbar {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 10px 14px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
}

/** 周期：与左右区块留出间距 */
.da-chart-head--toolbar #daTfButtons {
  padding: 0 clamp(12px, 3vw, 24px);
  box-sizing: border-box;
}

/** 顶栏内 K 线模式：紧凑但保留足够点击高度 */
.da-chart-head--toolbar .da-kline-mode-toolbar {
  margin-top: 0;
  gap: 6px;
  align-items: center;
}

.da-chart-head--toolbar .da-kline-mode-label {
  font-size: 11px;
  line-height: 1.35;
}

.da-chart-head--toolbar .da-kline-mode-toolbar .da-kline-mode-btn {
  font-size: 11px;
  font-weight: 500;
  line-height: 1.35;
  border-radius: 7px;
  padding: 6px 12px;
  min-height: 28px;
  box-sizing: border-box;
}

.da-chart-head--toolbar .da-kline-mode-toolbar .da-kline-mode-btn.active {
  box-shadow:
    0 0 0 1px rgba(78, 222, 163, 0.22),
    0 0 10px rgba(78, 222, 163, 0.14);
}

.da-chart-head__meta {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 12px 16px;
  flex-shrink: 0;
}

.da-chart-head__seg {
  flex-shrink: 0;
}

.da-chart-head h3 {
  margin: 0;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
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

/** 第二行：五档行情卡片，等分一行 */
.da-market-board--tickers {
  gap: 10px;
  padding: 10px 12px 12px;
}

.da-ticker-card {
  flex: 1 1 0;
  min-width: 0;
  max-width: none;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 10px 12px;
  margin: 0;
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.28);
  border-radius: 10px;
  background: rgba(19, 27, 46, 0.88);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.da-ticker-card:hover {
  border-color: rgba(78, 222, 163, 0.35);
  background: rgba(24, 34, 58, 0.95);
}

.da-ticker-card.is-active {
  border-color: rgba(78, 222, 163, 0.5);
  box-shadow: 0 0 0 1px rgba(78, 222, 163, 0.12);
}

.da-ticker-card__pair {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #8c90a2;
}

.da-ticker-card__price {
  font-size: 15px;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #f0f3fc;
  line-height: 1.2;
}

.da-ticker-card__pct {
  font-size: 12px;
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.da-ticker-card__pct.muted {
  color: #8c90a2;
}

.da-ticker-card__pct.positive {
  color: #4edea3;
}

.da-ticker-card__pct.negative {
  color: #ffb4ab;
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

.da-chart #pairData {
  margin: 0;
  min-height: 220px;
  background: transparent;
  border: 0;
  border-radius: 0;
  white-space: normal;
  max-height: none;
  padding: 12px;
  min-width: 0;
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
import { ref, onMounted, onUnmounted } from "vue";
import {
  FilterOutlined,
  HistoryOutlined,
  LineChartOutlined,
  UnorderedListOutlined
} from "@ant-design/icons-vue";
import { getPanelBinanceBoard, getPairCandles } from "../../api/data.js";
import { getWhitelist } from "../../api/positions.js";
import { HttpError } from "../../utils/http.js";
import { state, uiState } from "../../store/state-core.js";
import { message } from "ant-design-vue";
import { http } from "../../utils/http.js";
import { i18n } from "../../i18n/index.js";

function t(key) {
  const lang = state.lang || "zh-CN";
  return i18n[lang]?.[key] ?? i18n["zh-CN"]?.[key] ?? key;
}

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
    
    await http.post("/forcesell", body);
    message.success("强制退出成功");
    window.runPanelTickOnce?.();
    forceExitModalVisible.value = false;
  } catch (e) {
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
    
    await http.post("/forcebuy", body);
    message.success("提升仓位成功");
    window.runPanelTickOnce?.();
    increasePositionModalVisible.value = false;
  } catch (e) {
    message.error("提升仓位失败");
  }
};

window.openForceExitModal = openForceExitModal;
window.openIncreasePositionModal = openIncreasePositionModal;

import {
  pairForBinanceKlinesRequest,
  parseBinanceKlinesRows,
  createLwcKline,
  buildKlineShellHtml,
  maLegendValues,
  renderSvgFallbackKline,
  sortKlineRowsByTime
} from "./data-panel-kline.js";
import {
  drawPanelKlineCanvas,
  ensurePanelKlineCanvas,
  disconnectPanelKlineResizeObserver,
  observePanelKlineResize
} from "./panel-kline-canvas.js";

let disposePairTf = null;

onMounted(() => {
  const dataRoot = document.getElementById("data");
  if (!dataRoot) return;
  const pairWrap = dataRoot.querySelector("#daPairButtons");
  const tfWrap = dataRoot.querySelector("#daTfButtons");
  const chartPairContainer = dataRoot.querySelector("#daChartPairSelector");
  const ticker = dataRoot.querySelector("#daSymbolTicker");
  const klineStatus = dataRoot.querySelector("#daKlineStatus");
  const maLayerDemo = dataRoot.querySelector("#daMaLayerDemo");
  const klineHintDemo = dataRoot.querySelector("#daKlineHintDemo");
  const pairData = dataRoot.querySelector("#pairData");
  const daDataSource = dataRoot.querySelector("#daDataSource");
  const whitelistContainer = dataRoot.querySelector("#daWhitelistPairs .da-pair-list-inline");
  if (!tfWrap || !chartPairContainer || !pairData) return;

  let pairSelection = "";

  const loadWhitelistPairs = async () => {
    const chartContainer = chartPairContainer;
    if (!chartContainer) return;
    try {
      const res = await getWhitelist();
      const whitelist = res?.whitelist || [];
      if (!whitelist.length) {
        chartContainer.innerHTML = "";
        return;
      }
      if (!pairSelection) {
        pairSelection = whitelist[0];
        if (canFetchKlines()) {
          void refreshBinanceKlines();
        }
      }
      const html = whitelist.map((pair) => {
        const isActive = pairSelection === pair;
        return `<button type="button" class="da-switch-btn${isActive ? " active" : ""}" data-pair="${pair}">${pair}</button>`;
      }).join("");
      chartContainer.innerHTML = html;
    } catch (e) {
      chartContainer.innerHTML = "";
    }
  };

  void loadWhitelistPairs();

  let boardTimer = null;
  const BOARD_POLL_MS = 20000;

  const pairToBoardSymbol = (pair) => {
    const [a, b] = String(pair || "")
      .split("/")
      .map((s) => s.trim().toUpperCase());
    return `${a || "BTC"}${b || "USDT"}`;
  };

  const formatBoardPrice = (p) => {
    const n = Number(p);
    if (!Number.isFinite(n)) return "—";
    if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (n >= 1) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  let lwcApi = null;
  let lastRows = [];
  let loadGen = 0;
  let abortCtl = null;

  const disposeLwc = () => {
    try {
      lwcApi?.dispose();
    } catch {
      // ignore
    }
    lwcApi = null;
  };

  const applyActive = (wrap, attr, value) => {
    if (!wrap) return;
    const buttons = Array.from(wrap.querySelectorAll("button.da-switch-btn"));
    for (const btn of buttons) {
      const on = btn.getAttribute(attr) === value;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }
  };

  const currentPair = () => pairSelection;
  const currentTf = () =>
    tfWrap.querySelector("button.da-switch-btn.active")?.getAttribute("data-tf") || "5m";

  const renderMode = () => {
    if (dataRoot.querySelector("#daKlineModeSvg")?.classList.contains("active")) return "svg";
    if (dataRoot.querySelector("#daKlineModePanel")?.classList.contains("active")) return "panel";
    return "lw";
  };

  const syncTicker = () => {
    if (!ticker) return;
    const p = currentPair().replace("/", "_");
    const tf = currentTf().toUpperCase();
    ticker.textContent = `${p}_${tf}`;
  };

  const clearKlineError = () => {
    klineStatus?.classList.add("hidden");
    klineStatus && (klineStatus.innerHTML = "");
    klineHintDemo?.classList.add("hidden");
    maLayerDemo?.classList.add("hidden");
  };

  const showKlineError = (err) => {
    const msg =
      err instanceof HttpError
        ? `K 线加载失败（${err.status}）`
        : String(err?.message || err || "K 线加载失败");
    if (klineStatus) {
      klineStatus.classList.remove("hidden");
      klineStatus.innerHTML = `<span>${msg}</span><span class="da-kline-status-actions"><button type="button" class="ghost tiny" id="daKlineRetryBtn">立即重试</button></span>`;
    }
    klineHintDemo?.classList.remove("hidden");
    const daDataSourceValue = pairData.querySelector("#daDataSourceValue");
      if (daDataSourceValue) daDataSourceValue.textContent = "—";
  };

  const ensureShell = (pair, tf) => {
    const key = `${pair}\u001f${tf}`;
    if (pairData.dataset.daShellKey === key && pairData.querySelector("#daKlineMount")) return;
    const prevMount = pairData.querySelector("#daKlineMount");
    if (prevMount) disconnectPanelKlineResizeObserver(prevMount);
    disposeLwc();
    pairData.dataset.daShellKey = key;
    pairData.innerHTML = buildKlineShellHtml("MA(7): —", "MA(25): —", "MA(99): —");
  };

  const movingAvg = (closes, period) =>
    closes.map((_, i) => {
      if (i < period - 1) return null;
      const win = closes.slice(i - period + 1, i + 1);
      return win.reduce((s, v) => s + Number(v || 0), 0) / period;
    });

  const applyRowsToRenderer = (rows) => {
    const sorted = sortKlineRowsByTime(rows);
    lastRows = sorted;
    const mount = pairData.querySelector("#daKlineMount");
    if (!mount) return;
    const { ma7Text, ma25Text, ma99Text } = maLegendValues(sorted);
    const leg7 = pairData.querySelector(".da-ma-legend .ma7");
    const leg25 = pairData.querySelector(".da-ma-legend .ma25");
    const leg99 = pairData.querySelector(".da-ma-legend .ma99");
    if (leg7) leg7.textContent = ma7Text;
    if (leg25) leg25.textContent = ma25Text;
    if (leg99) leg99.textContent = ma99Text;

    const closes = sorted.map((r) => Number(r[4] || 0));
    const ma7 = movingAvg(closes, 7);
    const ma25 = movingAvg(closes, 25);
    const ma99 = movingAvg(closes, 99);
    const pairLabel = currentPair();
    const tfLabel = currentTf();

    const mode = renderMode();
    if (mode === "lw") {
      disconnectPanelKlineResizeObserver(mount);
      mount.innerHTML = "";
      if (!lwcApi) lwcApi = createLwcKline(mount);
      lwcApi.setCandleRows(sorted);
    } else if (mode === "panel") {
      disposeLwc();
      const cv = ensurePanelKlineCanvas(mount);
      const drawPanel = () => {
        drawPanelKlineCanvas(cv, {
          mini: sorted,
          viewStart: 0,
          viewEnd: sorted.length,
          ma7,
          ma25,
          ma99,
          pair: pairLabel,
          tf: tfLabel
        });
      };
      drawPanel();
      observePanelKlineResize(mount, drawPanel);
    } else {
      disconnectPanelKlineResizeObserver(mount);
      disposeLwc();
      mount.innerHTML = sorted.length ? renderSvgFallbackKline(sorted, ma7, ma25, ma99) : "";
    }
  };

  const updateHeaderFromRows = (rows) => {
    const ordered = sortKlineRowsByTime(rows);
    const latest = ordered[ordered.length - 1];
    const prev = ordered[ordered.length - 2];
    const close = Number(latest?.[4] || 0);
    const prevClose = Number(prev?.[4] || close || 1);
    const pct = prevClose ? ((close - prevClose) / prevClose) * 100 : 0;
    const priceNow = dataRoot.querySelector("#daPriceNow");
    const priceChg = dataRoot.querySelector("#daPriceChg");
    if (priceNow) {
      priceNow.textContent = close
        ? close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "—";
    }
    if (priceChg) {
      priceChg.textContent = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
      priceChg.classList.toggle("positive", pct >= 0);
      priceChg.classList.toggle("negative", pct < 0);
    }
  };

  const canFetchKlines = () =>
    Boolean(uiState.authed && String(state.password || "").trim().length > 0);

  const refreshBinanceKlines = async () => {
    if (!canFetchKlines()) return;
    let pair = currentPair();
    const tf = currentTf();
    
    if (!pair) {
      try {
        const res = await getWhitelist();
        const whitelist = res?.whitelist || [];
        if (whitelist.length > 0) {
          pair = whitelist[0];
          pairSelection = pair;
        } else {
          return;
        }
      } catch {
        return;
      }
    }
    
    syncTicker();
    ensureShell(pair, tf);

    abortCtl?.abort();
    abortCtl = new AbortController();
    const myGen = ++loadGen;

    try {
      const raw = await getPairCandles(
        {
          pair: pair,
          timeframe: tf,
          columns: JSON.stringify(["enter_tag", "exit_tag"])
        },
        { signal: abortCtl.signal }
      );
      if (myGen !== loadGen) return;
      const rows = parseBinanceKlinesRows(raw);
      if (!rows.length) throw new Error("接口返回的 K 线为空");
      updateHeaderFromRows(rows);
      applyRowsToRenderer(rows);
      clearKlineError();
      const daDataSourceValue = pairData.querySelector("#daDataSourceValue");
      if (daDataSourceValue) daDataSourceValue.textContent = "BOVIN_BINANCE";
    } catch (e) {
      if (e?.name === "AbortError") return;
      if (myGen !== loadGen) return;
      disposeLwc();
      const mount = pairData.querySelector("#daKlineMount");
      if (mount) {
        disconnectPanelKlineResizeObserver(mount);
        mount.innerHTML = "";
      }
      lastRows = [];
      showKlineError(e);
    }
  };

  const onPairClick = (e) => {
    const btn = e.target instanceof Element ? e.target.closest("button.da-switch-btn[data-pair]") : null;
    if (!btn) return;
    const value = btn.getAttribute("data-pair");
    if (!value) return;
    pairSelection = value;
    if (chartPairContainer) applyActive(chartPairContainer, "data-pair", value);
    syncTicker();
    void refreshBinanceKlines();
  };

  chartPairContainer?.addEventListener("click", onPairClick);

  const onTfClick = (e) => {
    const btn = e.target instanceof Element ? e.target.closest("button.da-switch-btn[data-tf]") : null;
    if (!btn) return;
    const value = btn.getAttribute("data-tf");
    if (!value) return;
    applyActive(tfWrap, "data-tf", value);
    syncTicker();
    void refreshBinanceKlines();
  };

  const onRetryClick = (e) => {
    const btn =
      e.target instanceof Element ? e.target.closest("#daKlineRetryBtn, #daKlineRetryBtnMini") : null;
    if (!btn) return;
    if (!canFetchKlines()) return;
    btn.textContent = "重试中…";
    void refreshBinanceKlines().finally(() => {
      btn.textContent = "立即重试";
    });
  };

  const tryRefreshKlinesIfAuthed = () => {
    if (!canFetchKlines()) return;
    void refreshBinanceKlines();
  };

  const onPanelAuthed = () => tryRefreshKlinesIfAuthed();
  window.addEventListener("bovin-panel-auth", onPanelAuthed);

  pairWrap?.addEventListener("click", onPairClick);
  tfWrap?.addEventListener("click", onTfClick);
  klineStatus?.addEventListener("click", onRetryClick);
  klineHintDemo?.addEventListener("click", onRetryClick);
  syncTicker();
  clearKlineError();
  tryRefreshKlinesIfAuthed();

  disposePairTf = () => {
    if (boardTimer != null) {
      window.clearInterval(boardTimer);
      boardTimer = null;
    }
    const km = pairData.querySelector("#daKlineMount");
    if (km) disconnectPanelKlineResizeObserver(km);
    window.removeEventListener("bovin-panel-auth", onPanelAuthed);
    pairWrap?.removeEventListener("click", onPairClick);
    tfWrap?.removeEventListener("click", onTfClick);
    // modeWrap?.removeEventListener("click", onModeClick);
    klineStatus?.removeEventListener("click", onRetryClick);
    klineHintDemo?.removeEventListener("click", onRetryClick);
    abortCtl?.abort();
    abortCtl = null;
    disposeLwc();
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
