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
                  <div class="ds-card-top"><span id="kpiCard1Title" data-i18n="overview.kpi.netValue">净资产</span><em id="kpiBotStatus" class="muted">—</em></div>
                  <div class="ds-card-value" id="kpiNetWorth">—</div>
                  <svg viewBox="0 0 100 20" aria-hidden="true"><path id="kpiSpark1" d="M0 10 L100 10"></path></svg>
                </article>
                <article class="ds-card">
                  <div class="ds-card-top"><span id="kpiCard2Title" data-i18n="overview.kpi.dailyProfit">日收益</span><em id="kpiCard2Em" class="muted">—</em></div>
                  <div class="ds-card-value positive" id="kpiProfit">—</div>
                  <svg viewBox="0 0 100 20" aria-hidden="true"><path id="kpiSpark2" d="M0 10 L100 10"></path></svg>
                </article>
                <article class="ds-card">
                  <div class="ds-card-top"><span id="kpiCard3Title" data-i18n="overview.kpi.drawdown">最大回撤</span><em id="kpiCard3Em" class="muted" data-i18n="overview.kpi.riskUnconfigured">在策略配置中设置上限/阈值</em></div>
                  <div class="ds-card-value negative" id="kpiMaxDrawdown">—</div>
                  <svg viewBox="0 0 100 20" aria-hidden="true"><path id="kpiSpark3" d="M0 10 L100 10"></path></svg>
                </article>
              </div>
              <article class="ds-risk">
                <!-- 对接 -->
                <div class="ds-risk-head"><h3 data-i18n="overview.risk.title">风险敞口矩阵（按加密资产分层）</h3><div><span data-i18n="overview.risk.leverage">杠杆 / 敞口</span><b id="riskLeverageValue">—</b></div></div>
                <div class="ds-risk-cells" id="riskMatrixCells"></div>
              </article>
              <!-- 对接 -->
              <article class="ds-telemetry">
                <h3 data-i18n="overview.telemetry">本机状态</h3>
                <div id="sysinfo" class="ds-sysinfo ds-sysinfo--empty muted" data-i18n-aria="overview.telemetry" aria-label="本机状态">
                  <p class="ds-sysinfo-unavailable" data-i18n="overview.sysinfo.unavailable">本机指标暂不可用</p>
                </div>
              </article>
            </div>

            <div class="ds-strategy-table">
              <div class="head"><h3 data-i18n="overview.strategies.title">运行中的策略</h3><div class="right" id="overviewStrategiesSummary">0 运行中 · 0 已暂停 · 0 异常</div></div>
              <table class="data-table">
                <thead>
                  <tr><th data-i18n="th.strategyName">策略名称</th><th data-i18n="th.coreAsset">核心资产</th><th data-i18n="th.pnl24h">24h 盈亏</th><th data-i18n="th.pnlPercent">盈亏百分比</th><th data-i18n="th.drawdown">回撤</th><th data-i18n="th.status">状态</th></tr>
                </thead>
                <tbody id="overviewStrategiesBody">
                  <tr class="ds-strategy-table-empty">
                    <td class="muted" colspan="6" data-i18n="overview.strategies.empty">
                      暂无运行中的策略（机器人未处于运行状态或尚未加载交易进程）
                    </td>
                  </tr>
                </tbody>
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

<script>
export * from "../../api/overview.js";
</script>
