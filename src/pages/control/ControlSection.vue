<template>
<section id="control" class="section">
          <div class="ft-page sc-wrap">
            <header class="ft-page-hero">
              <div class="ft-page-hero__intro">
                <span class="ft-page-hero__kicker" data-i18n="page.kicker.control"></span>
                <h1 class="ft-page-hero__title" data-i18n="page.title.control"></h1>
                <p class="ft-page-hero__desc ft-page-hero__desc--inline">
                  <CheckCircleOutlined class="sc-verify-icon" aria-hidden="true" />
                  <span data-i18n="page.desc.control"></span>
                </p>
              </div>
              <div class="ft-page-hero__aside">
                <div class="sc-hero-kpis">
                  <div class="sc-kpi">
                    <div>
                      <em data-i18n="control.estAnnualReturn">年化收益预估</em>
                      <strong id="controlHeroAnnual">—</strong>
                    </div>
                    <LineChartOutlined aria-hidden="true" />
                  </div>
                  <div class="sc-kpi">
                    <div>
                      <em data-i18n="control.pnl24h">24h 盈亏</em>
                      <strong id="controlHeroPnl">+$14,204.42</strong>
                    </div>
                    <RiseOutlined aria-hidden="true" />
                  </div>
                </div>
              </div>
            </header>

            <section class="sc-panel-config-card" id="panelStrategyConfigCard" data-i18n-aria="aria.panelStrategyConfig" aria-label="面板策略配置">
              <div class="sc-panel-config-head">
                <h3 data-i18n="control.panelStrategyConfig">面板策略配置</h3>
                <div class="sc-panel-config-actions">
                  <button type="button" id="btnSyncConfigAndStart" class="primary" data-i18n="btn.syncConfigStart">同步配置并启动交易器</button>
                  <button type="button" id="btnSyncConfigOnly" class="ghost" data-i18n="btn.syncConfigOnly">仅同步配置到服务端</button>
                </div>
              </div>
              <p id="controlStrategyConfigSummary" class="sc-panel-config-summary"></p>
              <p class="sc-panel-config-hint" data-i18n="hint.strategyFileManual">要把接管期间的交易逻辑固化成可复用的主策略：请根据操作/决策日志整理要点，或借助 LLM 生成策略代码草稿，再在 user_data/strategies 中手动保存并后续迭代。本处仅存备忘与规则文本，不会自动写入 .py 策略文件。</p>
              <div class="sc-panel-config-rules">
                <h4 data-i18n="control.strategyRulesOut">AI / 接管 — 策略规则输出</h4>
                <pre id="controlStrategyRulesOut" class="mono sc-rules-pre">（暂无规则输出）</pre>
              </div>
            </section>

            <div class="sc-console-grid">
            <section class="sc-strategy-grid" id="controlStrategyCards" aria-live="polite"></section>

            <section class="sc-bottom">
              <div class="sc-governance">
                <div class="sc-governance-head">
                  <div class="sc-governance-head-main">
                    <h2 data-i18n="sc.gov.title">资产访问治理</h2>
                    <p id="scGovMeta" class="sc-gov-meta" aria-live="polite"></p>
                  </div>
                  <button type="button" class="ghost sc-gov-export-btn" data-i18n="sc.gov.export">导出配置</button>
                </div>
                <div class="sc-governance-grid">
                  <div class="sc-list sc-list--wl">
                    <div class="sc-list-head">
                      <h4 data-i18n="sc.gov.activeWl">当前白名单</h4>
                      <span id="scWlCount" class="sc-gov-count-pill sc-gov-count-pill--wl">0 个交易对</span>
                    </div>
                    <div class="sc-list-items sc-gov-list-items" id="scGovernanceWlItems"></div>
                    <button type="button" class="sc-gov-add-wl-btn" id="scGovAddWhitelist" data-i18n="sc.gov.addWhitelistBtn">
                      添加白名单
                    </button>
                  </div>
                  <div class="sc-list sc-list--bl">
                    <div class="sc-list-head">
                      <h4 data-i18n="sc.gov.globalBl">全局黑名单</h4>
                      <span id="scBlCount" class="sc-gov-count-pill sc-gov-count-pill--bl">0 个交易对</span>
                    </div>
                    <div class="sc-list-items sc-gov-list-items" id="scGovernanceBlItems"></div>
                  </div>
                </div>
              </div>
              <aside class="sc-feed">
                <div class="sc-feed-head">
                  <h3><BarChartOutlined /><span data-i18n="sc.feed.title">实时成交流</span></h3>
                  <label class="sc-feed-limit">
                    <span data-i18n="sc.feed.limitLabel">最近条数</span>
                    <input
                      id="scFeedLimitInput"
                      type="number"
                      name="scFeedLimit"
                      min="1"
                      max="500"
                      step="1"
                      autocomplete="off"
                      aria-label="Trades feed row limit"
                    />
                  </label>
                </div>
                <div id="scFeedRows"></div>
                <button type="button" class="ghost sc-feed-btn" id="scFeedAuditBtn" data-i18n="sc.feed.audit">查看完整审计日志</button>
              </aside>
            </section>
            </div>

            <div class="hidden-control">
              <button id="loadLists" class="ghost">刷新名单</button>
              <input id="blacklistPair" name="blacklistPair" placeholder="如 PEPE/USDT" value="PEPE/USDT" autocomplete="off" />
              <button id="addBlacklist" class="ghost">加入黑名单</button>
              <input id="forcePair" name="forcePair" value="BTC/USDT" autocomplete="off" />
              <input type="hidden" id="forceSide" value="long" />
              <a-select
                v-model:value="forceSideVal"
                :options="forceSideOptions"
                class="bovin-select-force"
                popup-class-name="bovin-select-dropdown"
                :get-popup-container="forceSidePopupContainer"
              />
              <button type="button" id="forceEnter" class="primary" data-i18n="btn.forceEnter">强制开仓</button>
              <input id="forceExitTradeId" name="forceExitTradeId" value="all" autocomplete="off" />
              <div id="whitelist" class="mono"></div>
              <div id="blacklist" class="mono"></div>
            </div>
          </div>
        </section>
</template>

<style scoped>
/* Panel strategy config (control page) */
.sc-panel-config-card {
  margin-bottom: 18px;
  padding: 16px 18px;
  border-radius: 12px;
  border: 1px solid rgba(var(--ft-line-rgb), 0.3);
  background: rgba(10, 18, 38, 0.55);
}

.sc-panel-config-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.sc-panel-config-head h3 {
  margin: 0;
  font-size: 15px;
  font-family: var(--ft-font-display);
}

.sc-panel-config-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sc-panel-config-summary {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-dim);
}

.sc-panel-config-hint {
  margin: 0 0 14px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-dim);
}

.sc-panel-config-rules h4 {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--text-dim);
}

.sc-rules-pre {
  margin: 0;
  max-height: 220px;
  overflow: auto;
  padding: 12px;
  font-size: 11px;
  line-height: 1.45;
  border-radius: 10px;
  border: 1px solid rgba(var(--ft-line-rgb), 0.28);
  background: rgba(6, 12, 28, 0.85);
  color: var(--text-main, #e8ecf8);
  white-space: pre-wrap;
  word-break: break-word;
}

.sc-checkbox-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 12px;
  line-height: 1.45;
  cursor: pointer;
  color: var(--text-dim);
}

.sc-checkbox-row input {
  margin-top: 3px;
  flex-shrink: 0;
}

/* Strategy control console */
.sc-wrap {
  width: 100%;
}

.sc-hero-kpis {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: stretch;
  justify-content: flex-end;
}

.sc-kpi {
  background: var(--ft-panel-surface);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.25);
  border-radius: var(--ft-panel-radius);
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.sc-kpi em {
  display: block;
  font-style: normal;
  text-transform: uppercase;
  color: #8c90a2;
  font-size: 10px;
  font-weight: 700;
}

.sc-kpi strong {
  display: block;
  margin-top: 2px;
  color: #4edea3;
  font-family: var(--ft-font-display);
  font-size: 24px;
  line-height: 1.05;
}

.sc-kpi .material-symbols-outlined {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: rgba(78, 222, 163, 0.12);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #4edea3;
}

.sc-console-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--ft-page-stack-gap);
}

.sc-console-grid > .sc-strategy-grid,
.sc-console-grid > .sc-governance,
.sc-console-grid > .sc-feed {
  min-width: 0;
}

/* 独立占满一行，避免原先 display:contents 时卡片与 .sc-governance（span 2）同属一格网而叠在第二张策略卡上，导致底部按钮无法点击 */
.sc-strategy-grid {
  display: grid;
  align-items: center;
  grid-column: 1 / -1;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--ft-page-stack-gap);
  align-content: start;
}

.sc-strategy-grid > .sc-card {
  min-width: 0;
}

.sc-strategy-grid > .sc-card-alert {
  grid-column: 1 / -1;
}

.sc-bottom {
  display: contents;
}

.sc-card {
  background: var(--ft-panel-surface);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.25);
  border-radius: var(--ft-panel-radius);
  padding: var(--ft-panel-pad-block) var(--ft-panel-pad-inline);
}
.sc-alert{
   display: flex;
   align-items: center;
}
.sc-card-alert {
  border-color: rgba(255, 180, 171, 0.22);
}

.sc-card--info-soft {
  border-color: rgba(138, 180, 255, 0.22);
  margin-bottom: 10px;
}

.sc-card-demo {
  border-color: rgba(var(--ft-accent-rgb), 0.28);
}

.sc-demo-tag {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  font-family: var(--ft-font-sans);
  letter-spacing: 0.06em;
  vertical-align: middle;
  background: rgba(var(--ft-accent-rgb), 0.22);
  color: #cfd9ff;
}

.sc-alert-demo {
  border-color: rgba(var(--ft-accent-rgb), 0.25);
  background: rgba(59, 88, 160, 0.2);
  color: #dae2fd;
}

.sc-alert-demo .material-symbols-outlined {
  font-size: 18px;
  color: #8ab4ff;
}
.waring{
  font-size: 10px !important;
}
.feed-row-demo {
  opacity: 0.92;
}

.sc-card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.sc-card-head h3 {
  margin: 0;
  font-family: var(--ft-font-display);
  font-size: 30px;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.sc-chip {
  margin-top: 6px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-radius: 999px;
  padding: 3px 8px;
  display: inline-block;
}

.sc-chip.ok {
  color: #4edea3;
  background: rgba(78, 222, 163, 0.12);
}

.sc-chip.idle {
  color: #8c90a2;
  background: rgba(140, 144, 162, 0.16);
}

.sc-chip.err {
  color: #ffb4ab;
  background: rgba(255, 180, 171, 0.14);
}

.sc-perf {
  text-align: right;
}

.sc-perf em {
  display: block;
  font-style: normal;
  color: #8c90a2;
  font-size: 10px;
  text-transform: uppercase;
}

.sc-perf strong {
  display: block;
  margin-top: 4px;
  font-family: var(--ft-font-display);
  font-size: 28px;
  line-height: 1;
}

.sc-perf strong small {
  font-size: 10px;
  color: var(--text-dim);
}

.sc-meta {
  margin-top: 12px;
  display: grid;
  gap: 8px;
}

.sc-meta > div {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sc-meta span {
  font-size: 11px;
  color: var(--text-dim);
}

.sc-meta b {
  font-size: 11px;
}

.sc-card-kpis {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(var(--ft-panel-edge-rgb), 0.35);
  display: grid;
  gap: 6px;
  font-size: 11px;
  line-height: 1.4;
}

.sc-card-kpi-row {
  display: grid;
  grid-template-columns: minmax(100px, 38%) 1fr;
  gap: 8px;
  align-items: start;
}

.sc-card-kpi-k {
  color: var(--text-dim);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 10px;
}

.sc-card-kpi-v {
  color: var(--text);
  word-break: break-word;
}

.sc-card-kpi-row--memo .sc-card-kpi-memo {
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
  font-size: 11px;
  color: var(--text-dim);
  line-height: 1.45;
}

.sc-progress {
  height: 4px;
  border-radius: 999px;
  background: rgba(var(--ft-panel-edge-rgb), 0.3);
  overflow: hidden;
}

.sc-progress i {
  display: block;
  height: 100%;
  width: var(--sc-progress-pct, 0%);
  min-width: 0;
  max-width: 100%;
  transition: width 0.22s ease;
  background: rgba(var(--ft-accent-rgb), 0.85);
}

.sc-actions {
  margin-top: 14px;
  display: grid;
  gap: 8px;
}

.sc-actions.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.sc-actions button {
  min-height: var(--ft-control-min-h);
  height: auto;
  border-radius: var(--ft-radius-control);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.25);
  background: #2d3449;
  color: #dae2fd;
  font-weight: 700;
  text-transform: none;
  font-size: 11px;
  letter-spacing: 0.01em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition:
    background var(--ft-transition-fast),
    border-color var(--ft-transition-fast),
    color var(--ft-transition-fast),
    transform var(--ft-transition-fast),
    opacity var(--ft-transition-fast);
}

:deep(.sc-actions .sc-action-icon) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 0;
}

:deep(.sc-actions .sc-action-icon svg) {
  width: 18px;
  height: 18px;
  display: block;
}

.sc-actions button:focus {
  outline: none;
}

.sc-actions button:focus-visible {
  outline: var(--ft-focus-ring);
  outline-offset: var(--ft-focus-offset);
}

.sc-actions button:hover:not(:disabled) {
  border-color: rgba(var(--ft-accent-rgb), 0.42);
  background: rgba(45, 52, 73, 0.95);
}

.sc-actions button:active:not(:disabled) {
  transform: scale(0.98);
}

.sc-actions button:disabled {
  opacity: 0.42;
  cursor: not-allowed;
  filter: grayscale(0.35);
}

.sc-actions.sc-actions--locked .action-btn:disabled {
  opacity: 0.38;
}

.sc-actions .sc-wide,
.sc-actions .danger-soft,
.sc-actions .danger {
  grid-column: 1 / -1;
}

.sc-actions .primary {
  border: 0;
  color: #f1f2ff;
  background: linear-gradient(135deg, #b4c5ff 0%, #0061ff 100%);
}

.sc-actions .danger {
  border-color: rgba(255, 180, 171, 0.15);
  color: #ffb4ab;
  background: rgba(147, 0, 10, 0.6);
}

.sc-actions .danger-soft {
  border-color: rgba(255, 180, 171, 0.22);
  color: #ffb4ab;
  background: rgba(147, 0, 10, 0.2);
}

.sc-alert {
  margin-top: 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 180, 171, 0.15);
  background: rgba(147, 0, 10, 0.15);
  color: #ffb4ab;
  display: flex;
  gap: 6px;
  padding: 10px;
  font-size: 11px;
}

.sc-alert.sc-alert--stack {
  align-items: flex-start;
}

.sc-alert-text {
  flex: 1;
  min-width: 0;
}

.sc-alert-sub {
  margin: 6px 0 0;
  font-size: 10px;
  line-height: 1.45;
}

.sc-alert-names {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.4;
  word-break: break-word;
}

.sc-card--strategy-grid-off .sc-alert {
  margin-top: 0;
}

.sc-governance {
  grid-column: span 2;
  background: rgba(8, 14, 28, 0.92);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.28);
  border-radius: 12px;
  overflow: hidden;
  align-self: start;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}

.sc-governance-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  padding: 16px 18px 14px;
  border-bottom: 1px solid rgba(var(--ft-panel-edge-rgb), 0.22);
}

.sc-governance-head-main {
  min-width: 0;
  flex: 1;
}

.sc-governance-head h2 {
  margin: 0;
  font-family: var(--ft-font-display);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-main, #e8ecf8);
}

.sc-kpi .anticon {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(78, 222, 163, 0.12);
  border: 1px solid rgba(78, 222, 163, 0.34);
  color: #7ee7bd;
  font-size: 18px;
}

.sc-verify-icon {
  color: #4edea3;
  font-size: 16px;
}

.sc-gov-meta {
  margin: 8px 0 0;
  font-size: 11px;
  line-height: 1.45;
  color: #8ea0cf;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.sc-gov-export-btn {
  flex-shrink: 0;
  margin-top: 2px;
  border-radius: 8px;
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.35);
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
}

.sc-governance-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: stretch;
}

.sc-list--wl {
  padding: 16px 18px 18px;
  background: rgba(12, 20, 42, 0.35);
}

.sc-list--bl {
  padding: 16px 18px 18px;
  background: rgba(6, 12, 26, 0.55);
  border-left: 1px solid rgba(var(--ft-panel-edge-rgb), 0.18);
}

.sc-list-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.sc-list-head h4 {
  margin: 0;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #aeb9db;
}

.sc-gov-count-pill {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  line-height: 1.2;
}

.sc-gov-count-pill--wl {
  color: #5ee9b5;
  background: rgba(78, 222, 163, 0.14);
  border: 1px solid rgba(78, 222, 163, 0.28);
}

.sc-gov-count-pill--bl {
  color: #ffb4a8;
  background: rgba(255, 140, 120, 0.12);
  border: 1px solid rgba(255, 180, 171, 0.22);
}

.sc-gov-list-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}

.sc-gov-add-wl-btn {
  width: 100%;
  margin-top: 12px;
  min-height: 48px;
  border-radius: 10px;
  border: 1px dashed rgba(var(--ft-panel-edge-rgb), 0.45);
  background: rgba(18, 28, 52, 0.55);
  color: #9aacd9;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.sc-gov-add-wl-btn:hover {
  border-color: rgba(78, 222, 163, 0.45);
  color: #c8d9f0;
  background: rgba(24, 36, 64, 0.65);
}

/* 由 control-console 注入的卡片（:deep 命中子节点） */
.sc-governance :deep(.sc-gov-pair-card) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.22);
  background: rgba(26, 36, 58, 0.85);
}

.sc-governance :deep(.sc-gov-pair-card--bl:not(.sc-gov-pair-card--hint)) {
  background: rgba(22, 28, 44, 0.95);
}

.sc-governance :deep(.sc-gov-pair-card-main) {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
}

.sc-governance :deep(.sc-gov-pair-card-main--stack) {
  width: 100%;
}

.sc-governance :deep(.sc-gov-pair-name) {
  font-size: 13px;
  font-weight: 700;
  color: #f0f4ff;
  line-height: 1.25;
  word-break: break-word;
}

.sc-governance :deep(.sc-gov-pair-lock) {
  display: inline-flex;
  color: #6b7a9e;
  line-height: 0;
}

.sc-governance :deep(.sc-gov-pair-lock svg) {
  display: block;
}

.sc-governance :deep(.sc-gov-pair-tag) {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: #8c9bb8;
  letter-spacing: 0.04em;
}

.sc-governance :deep(.sc-gov-pair-tag--wl) {
  color: #7ebda5;
}

.sc-governance :deep(.sc-gov-pair-tag--bl) {
  color: #c49a94;
}

.sc-governance :deep(.sc-gov-pair-card--hint .sc-gov-hint-title) {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #aeb9db;
}

.sc-governance :deep(.sc-gov-pair-card--hint .sc-gov-hint-body) {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.4;
  color: #7a869f;
}

.sc-auto-blacklist {
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.2);
  border-radius: 8px;
  background: var(--ft-panel-surface-raised);
  color: #c2c6d9;
  font-size: 10px;
  line-height: 1.4;
  padding: 10px;
}

.sc-auto-blacklist b {
  display: block;
  color: #b4c5ff;
  margin-bottom: 3px;
}

.sc-feed {
  grid-column: 3 / 4;
  background: var(--ft-panel-surface-raised);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.25);
  border-radius: var(--ft-panel-radius);
  padding: 14px;
  display: grid;
  gap: 10px;
  align-self: start;
}

.feed-row {
  display: flex;
  gap: 8px;
}

.feed-row i {
  width: 3px;
  border-radius: 999px;
  background: #8c90a2;
}

.feed-row i.ok { background: #4edea3; }
.feed-row i.pri { background: #b4c5ff; }
.feed-row i.err { background: #d12e32; }

.feed-row b {
  display: block;
  font-size: 11px;
}

.feed-row small {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  font-weight: 700;
  color: #b4c5ff;
}

.feed-row em {
  display: block;
  margin-top: 2px;
  font-style: normal;
  color: #8c90a2;
  font-size: 9px;
  text-transform: uppercase;
}

.feed-row .err + div small,
.feed-row i.err ~ div small {
  color: #ffb4ab;
}

.sc-feed-btn {
  margin-top: 4px;
  height: 50px;
  padding: 5px 10px;
  font-size: 12px;
}
</style>

<script setup>
import { createVNode, onMounted, onUnmounted, ref, watch } from "vue";
import { Modal } from "ant-design-vue";
import {
  BarChartOutlined,
  CheckCircleOutlined,
  ExclamationCircleFilled,
  LineChartOutlined,
  RiseOutlined
} from "@ant-design/icons-vue";
import { deleteWhitelistPair, postBlacklist, postWhitelistAdd } from "../../api/positions.js";
import { refreshGovernanceListsOnly, runPanelTickOnce } from "../../panel-poll.js";
import { bindControlTradeActionDelegation } from "../../utils/control-trade-delegate.js";
import { openTradesAuditModal, closeTradesAuditModal } from "../../components/control-console.js";
import { i18n } from "../../i18n/index.js";
import {
  state,
  persistProfileToLocalStorage,
  getNormalizedControlTradesFeedLimit
} from "../../store/state-core.js";

const forceSidePopupContainer = () => document.body;
const forceSideVal = ref("long");
const forceSideOptions = [
  { value: "long", label: "long" },
  { value: "short", label: "short" }
];

watch(forceSideVal, (v) => {
  const el = document.getElementById("forceSide");
  if (el instanceof HTMLInputElement && el.type === "hidden") el.value = v;
});

function wlModalT(key) {
  const lang = state.lang || "zh-CN";
  return i18n[lang]?.[key] ?? i18n["zh-CN"]?.[key] ?? key;
}

let unbindWhitelistModalKeydown = null;
let unbindControlTradeActions = null;
let unbindGovernanceWlRemove = null;
let unbindTradesFeedLimitInput = null;
let unbindTradesAuditModal = null;

function bindTradesFeedLimitInput() {
  const inp = document.getElementById("scFeedLimitInput");
  if (!(inp instanceof HTMLInputElement)) return;
  unbindTradesFeedLimitInput?.();
  inp.value = String(getNormalizedControlTradesFeedLimit());
  const apply = () => {
    const raw = Math.round(Number(inp.value));
    state.controlTradesFeedLimit = Number.isFinite(raw) ? raw : 12;
    inp.value = String(getNormalizedControlTradesFeedLimit());
    persistProfileToLocalStorage();
    void runPanelTickOnce();
  };
  const onBlur = () => apply();
  const onKeydown = (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      inp.blur();
    }
  };
  /** `change` 在值与 focus 时相同（例如改回 500）时可能不触发；失焦统一提交并拉数 */
  inp.addEventListener("blur", onBlur);
  inp.addEventListener("keydown", onKeydown);
  unbindTradesFeedLimitInput = () => {
    inp.removeEventListener("blur", onBlur);
    inp.removeEventListener("keydown", onKeydown);
  };
}

function bindTradesAuditModal() {
  const btn = document.getElementById("scFeedAuditBtn");
  const modal = document.getElementById("tradesAuditModal");
  const closeBtn = document.getElementById("closeTradesAuditModal");
  const mask = modal?.querySelector(".modal-mask");
  if (!btn || !modal) return;
  unbindTradesAuditModal?.();
  const onOpen = () => void openTradesAuditModal();
  const onClose = () => closeTradesAuditModal();
  btn.addEventListener("click", onOpen);
  closeBtn?.addEventListener("click", onClose);
  mask?.addEventListener("click", onClose);
  const onKey = (ev) => {
    if (ev.key === "Escape" && !modal.classList.contains("hidden")) onClose();
  };
  window.addEventListener("keydown", onKey);
  unbindTradesAuditModal = () => {
    btn.removeEventListener("click", onOpen);
    closeBtn?.removeEventListener("click", onClose);
    mask?.removeEventListener("click", onClose);
    window.removeEventListener("keydown", onKey);
  };
}

function bindGovernanceWlRemove(root) {
  if (!(root instanceof HTMLElement)) return;
  unbindGovernanceWlRemove?.();
  const onClick = (ev) => {
    const t = ev.target;
    const btn =
      t instanceof Element ? t.closest("button.sc-gov-remove-wl[data-gov-remove-wl]") : null;
    if (!(btn instanceof HTMLButtonElement)) return;
    const enc = btn.getAttribute("data-gov-remove-wl");
    if (!enc) return;
    let pair = "";
    try {
      pair = decodeURIComponent(enc);
    } catch {
      return;
    }
    if (!pair.trim()) return;
    const content = wlModalT("sc.gov.confirmRemoveWl").replace(/\{pair\}/g, pair);
    Modal.confirm({
      title: wlModalT("modal.confirmTitle"),
      content,
      icon: createVNode(ExclamationCircleFilled, {
        style: { color: "rgb(248, 113, 113)" }
      }),
      okText: wlModalT("btn.confirm"),
      cancelText: wlModalT("btn.cancel"),
      okButtonProps: { danger: true },
      centered: true,
      maskClosable: true,
      async onOk() {
        try {
          await deleteWhitelistPair(pair);
          await refreshGovernanceListsOnly();
        } catch (e) {
          const errMsg =
            e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
          window.alert(errMsg);
          throw e;
        }
      }
    });
  };
  root.addEventListener("click", onClick);
  unbindGovernanceWlRemove = () => root.removeEventListener("click", onClick);
}

function bindWhitelistAddModal() {
  const modal = document.getElementById("whitelistAddModal");
  const rowsHost = document.getElementById("whitelistAddRows");
  const openBtn = document.getElementById("scGovAddWhitelist");
  const closeBtn = document.getElementById("closeWhitelistAddModal");
  const mask = modal?.querySelector(".modal-mask");
  const addRowBtn = document.getElementById("whitelistAddRowBtn");
  const saveBtn = document.getElementById("saveWhitelistAddModal");
  if (!modal || !rowsHost || !openBtn) return;
  unbindWhitelistModalKeydown?.();

  function addRow(initial = "") {
    const row = document.createElement("div");
    row.className = "whitelist-add-row";
    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "whitelist-add-pair";
    inp.autocomplete = "off";
    inp.placeholder = wlModalT("sc.gov.whitelistPairPh");
    inp.value = initial;
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "ghost tiny whitelist-add-remove";
    rm.setAttribute("aria-label", wlModalT("modal.whitelistRemoveRow"));
    rm.textContent = "×";
    rm.addEventListener("click", () => {
      if (rowsHost.querySelectorAll(".whitelist-add-row").length > 1) row.remove();
    });
    row.append(inp, rm);
    rowsHost.appendChild(row);
  }

  function openModal() {
    rowsHost.innerHTML = "";
    addRow("");
    addRow("");
    modal.classList.remove("hidden");
  }

  function closeModal() {
    modal.classList.add("hidden");
  }

  openBtn.addEventListener("click", openModal);
  closeBtn?.addEventListener("click", closeModal);
  mask?.addEventListener("click", closeModal);
  addRowBtn?.addEventListener("click", () => addRow(""));

  const onKey = (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
  };
  window.addEventListener("keydown", onKey);
  unbindWhitelistModalKeydown = () => window.removeEventListener("keydown", onKey);

  saveBtn?.addEventListener("click", () => {
    const inputs = rowsHost.querySelectorAll(".whitelist-add-pair");
    const whitelist = [];
    for (const input of inputs) {
      if (!(input instanceof HTMLInputElement)) continue;
      const v = input.value.trim();
      if (v) whitelist.push(v);
    }
    if (!whitelist.length) {
      window.alert(wlModalT("modal.whitelistAddEmpty"));
      return;
    }
    void (async () => {
      try {
        await postWhitelistAdd({ whitelist });
        closeModal();
        await refreshGovernanceListsOnly();
      } catch (e) {
        const msg = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
        window.alert(msg);
      }
    })();
  });
}

onUnmounted(() => {
  unbindWhitelistModalKeydown?.();
  unbindWhitelistModalKeydown = null;
  unbindControlTradeActions?.();
  unbindControlTradeActions = null;
  unbindGovernanceWlRemove?.();
  unbindGovernanceWlRemove = null;
  unbindTradesFeedLimitInput?.();
  unbindTradesFeedLimitInput = null;
  unbindTradesAuditModal?.();
  unbindTradesAuditModal = null;
});

onMounted(() => {
  const el = document.getElementById("forceSide");
  if (el instanceof HTMLInputElement && el.type === "hidden" && el.value) {
    forceSideVal.value = el.value;
  }

  bindWhitelistAddModal();

  const controlSec = document.getElementById("control");
  if (controlSec instanceof HTMLElement) {
    unbindControlTradeActions?.();
    unbindControlTradeActions = bindControlTradeActionDelegation(controlSec);
    bindGovernanceWlRemove(controlSec);
  }

  bindTradesFeedLimitInput();
  bindTradesAuditModal();

  document.getElementById("loadLists")?.addEventListener("click", () => {
    void refreshGovernanceListsOnly();
  });
  document.getElementById("addBlacklist")?.addEventListener("click", () => {
    const inp = document.getElementById("blacklistPair");
    const pair = inp && "value" in inp ? String(inp.value || "").trim() : "";
    if (!pair) return;
    void (async () => {
      try {
        await postBlacklist([pair]);
        await refreshGovernanceListsOnly();
      } catch (e) {
        const msg = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
        window.alert(msg);
      }
    })();
  });
});
</script>

<script>
export * from "../../api/control.js";
export {
  computeEstimatedAnnualReturn,
  normalizeBotState,
  panelBotTradingApisAvailable,
  orderedStrategyNames,
  resolvePanelConfigSummary,
  renderControlGovernanceLists,
  renderControlTradeFeed,
  renderControlStrategyCards,
  renderControlHeroAndCards,
  openTradesAuditModal,
  closeTradesAuditModal
} from "../../components/control-console.js";
</script>
