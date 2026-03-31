<template>
<section id="monitor" class="section">
          <div class="ft-page monitor-page">
            <header class="ft-page-hero">
              <div class="ft-page-hero__intro">
                <span class="ft-page-hero__kicker" data-i18n="page.kicker.monitor"></span>
                <h1 class="ft-page-hero__title" id="monitorPageHeading" data-i18n="page.title.monitor"></h1>
                <p class="ft-page-hero__desc" data-i18n="page.desc.monitor"></p>
              </div>
              <div class="ft-page-hero__aside">
                <button type="button" id="monitorRefreshBtn" class="ghost" data-i18n="monitor.refresh">刷新数据</button>
              </div>
            </header>
            <div class="card monitor-page-card" role="region" aria-labelledby="monitorPageHeading">
            <div class="monitor-metric-grid">
              <article class="monitor-metric">
                <div class="monitor-metric-label" data-i18n="monitor.metric.ram">机器人主机内存占用</div>
                <div class="monitor-metric-value mono" id="monitorRam">—</div>
                <p class="monitor-metric-hint muted" data-i18n="monitor.hint.ram">来源：Bovin GET /sysinfo（psutil 内存百分比）</p>
              </article>
              <article class="monitor-metric">
                <div class="monitor-metric-label" data-i18n="monitor.metric.disk">服务器磁盘使用</div>
                <div class="monitor-metric-value mono" id="monitorDiskServer">—</div>
                <p class="monitor-metric-hint muted" data-i18n="monitor.hint.disk">标准 Bovin 未返回磁盘；模拟数据为演示值。</p>
              </article>
              <article class="monitor-metric">
                <div class="monitor-metric-label" data-i18n="monitor.metric.browserStorage">本页浏览器存储</div>
                <div class="monitor-metric-value mono" id="monitorStorageBrowser">—</div>
                <p class="monitor-metric-hint muted" data-i18n="monitor.hint.browserStorage">来源：StorageManager.estimate()，为本源页面配额。</p>
              </article>
              <article class="monitor-metric">
                <div class="monitor-metric-label" data-i18n="monitor.metric.bandwidth">带宽（客户端）</div>
                <div class="monitor-metric-value mono" id="monitorBandwidth">—</div>
                <p class="monitor-metric-hint muted" data-i18n="monitor.hint.bandwidth">Network Information API，反映当前浏览器网络估计，非机房出口。</p>
              </article>
              <article class="monitor-metric">
                <div class="monitor-metric-label" data-i18n="monitor.metric.latency">API 往返延迟</div>
                <div class="monitor-metric-value mono" id="monitorLatency">—</div>
                <p class="monitor-metric-hint muted" data-i18n="monitor.hint.latency">基于最近一次 /ping 耗时。</p>
              </article>
              <article class="monitor-metric">
                <div class="monitor-metric-label" data-i18n="monitor.metric.cagr">年化收益（CAGR）</div>
                <div class="monitor-metric-value mono" id="monitorCagr">—</div>
                <p class="monitor-metric-hint muted" data-i18n="monitor.hint.cagr">来源：GET /profit 的 cagr 字段（回测/统计含义以 Bovin 为准）。</p>
              </article>
              <article class="monitor-metric monitor-metric--wide">
                <div class="monitor-metric-label" data-i18n="monitor.metric.uptime">程序运行时长</div>
                <div class="monitor-metric-value mono" id="monitorUptime">—</div>
                <p class="monitor-metric-hint muted" data-i18n="monitor.hint.uptime">优先使用 /health.bot_startup_ts，否则使用 /profit.bot_start_timestamp。</p>
              </article>
            </div>
            </div>
          </div>
        </section>
</template>

<style scoped>
/* System monitor page */
.monitor-page-card {
  padding: clamp(14px, 2vw, 22px);
}

.monitor-page-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: clamp(16px, 2.5vw, 24px);
}

.monitor-page-head h3 {
  margin: 0 0 6px;
}

.monitor-page-sub {
  margin: 0;
  font-size: 13px;
  max-width: 52rem;
  line-height: 1.5;
}

.monitor-metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}

.monitor-metric {
  border: 1px solid rgba(var(--ft-accent-rgb), 0.28);
  border-radius: 12px;
  padding: 14px 16px;
  background: rgba(26, 43, 82, 0.35);
}

.monitor-metric--wide {
  grid-column: 1 / -1;
}

.monitor-metric-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--primary);
  margin-bottom: 8px;
}

.monitor-metric-value {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 8px;
  word-break: break-word;
}

.monitor-metric-hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.45;
}
</style>

<script>
export * from "../../api/monitor.js";
</script>
