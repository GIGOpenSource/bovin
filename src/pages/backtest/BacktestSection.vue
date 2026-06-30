<template>
  <section id="backtest" class="section">
    <div class="ft-page bt-wrap">
      <header class="ft-page-hero ft-page-hero--data">
        <div class="ft-page-hero__intro">
          <span class="ft-page-hero__kicker ft-kicker-accent" data-i18n="page.kicker.backtest">回测管理</span>
          <h1 class="ft-page-hero__title" data-i18n="page.title.backtest">回测管理</h1>
          <p class="ft-page-hero__desc" data-i18n="page.desc.backtest">运行和管理策略回测</p>
        </div>
      </header>

      <div class="bt-main">
        <div class="bt-card">
          <div class="bt-tabs">
            <button 
              v-for="tab in tabs" 
              :key="tab.key"
              type="button" 
              class="bt-tab"
              :class="{ 
                'bt-tab--active': activeTab === tab.key, 
                'bt-tab--disabled': tab.key === 'analyze' && hasAnalysisData === false 
              }"
              :disabled="tab.key === 'analyze' && hasAnalysisData === false"
              @click="handleTabClick(tab.key)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path :d="tab.icon" />
              </svg>
              <span :data-i18n="`backtest.tab.${tab.key}`">{{ tab.label }}</span>
            </button>
          </div>

          <div class="bt-tab-content">
            <div v-show="activeTab === 'load'" class="bt-tab-panel">
              <div class="bt-section">
                <div class="bt-section-header">
                  <h3 class="bt-section-title" data-i18n="backtest.loadHistory">加载历史回测结果</h3>
                  <!-- <button type="button" class="bt-refresh-btn" @click="loadHistory">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 8l3.26-3.26A9.75 9.75 0 0 1 12 3a9 9 0 0 1 9 9Z"/>
                      <path d="M16 3h5v5"/>
                      <path d="M21 16v5h-5"/>
                    </svg>
                  </button> -->
                </div>
                <div v-if="isLoadingHistory" class="bt-loading">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4edea3" stroke-width="2" class="bt-spinner">
                    <circle cx="12" cy="12" r="10" stroke-linecap="round"/>
                  </svg>
                </div>
                <div v-else-if="historyResults.length === 0" class="bt-empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6e7591" stroke-width="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                  </svg>
                  <p>暂无历史回测结果</p>
                </div>
                <div v-else class="bt-table-container">
                  <table class="bt-table">
                    <thead>
                      <tr>
                        <th data-i18n="backtest.th.strategy">战略</th>
                        <th data-i18n="backtest.th.detail">详情</th>
                        <th data-i18n="backtest.th.backtestTime">回测时间</th>
                        <th data-i18n="backtest.th.fileName">文件名</th>
                        <th data-i18n="backtest.th.actions">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(item, index) in historyResults" :key="index">
                        <td>{{ item.strategy }}</td>
                        <td>{{ formatDetail(item) }}</td>
                        <td>{{ formatDateTime(item.backtest_start_time) }}</td>
                        <td>{{ item.filename }}</td>
                        <td class="bt-table-actions">
                          <button type="button" class="bt-action-btn bt-action-btn--load" :disabled="isLoadingResult" @click="loadHistoryResult(item)">
                            <svg v-if="!isLoadingResult" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M9 5l7 7-7 7"/>
                            </svg>
                            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="bt-spin">
                              <circle cx="12" cy="12" r="10" stroke-linecap="round"/>
                            </svg>
                          </button>
                          <button type="button" class="bt-action-btn bt-action-btn--delete" @click="deleteHistoryItem(item)">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div v-show="activeTab === 'run'" class="bt-tab-panel">
              <div class="bt-section">
                <h3 class="bt-section-title" data-i18n="backtest.strategy">Strategy</h3>
                <div class="bt-form-row">
                  <a-select v-model:value="selectedStrategy" class="bovin-select-full" :placeholder="t('backtest.selectStrategy')">
                    <a-select-option v-for="opt in strategyList" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </a-select-option>
                  </a-select>
                  <!-- <button type="button" class="bt-use-default-btn" data-i18n="backtest.useStrategyDefault">Use strategy default</button> -->
                </div>
              </div>

              <div class="bt-section">
                <h3 class="bt-section-title" data-i18n="backtest.params">Backtesting parameters</h3>
                <div class="bt-form-row">
                  <span class="bt-form-label" data-i18n="backtest.timerange">Timerange:</span>
                  <a-select v-model:value="backtestParams.timerange" class="bovin-select-full">
                    <a-select-option v-for="opt in timeframeOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </a-select-option>
                  </a-select>
                </div>
                <div class="bt-form-row">
                  <span class="bt-form-label" data-i18n="backtest.detailTimeframe">Detail Timeframe:</span>
                  <a-select v-model:value="backtestParams.timerange2" class="bovin-select-full">
                    <a-select-option v-for="opt in timeframeOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </a-select-option>
                  </a-select>
                </div>
                <div class="bt-form-row">
                  <span class="bt-form-label" data-i18n="backtest.maxOpenTrades">Max open trades:</span>
                  <input type="number" v-model="backtestParams.maxOpenTrades" class="bt-input" />
                  <!-- <button type="button" class="bt-use-default-btn" data-i18n="backtest.useStrategyDefault">Use strategy default</button> -->
                </div>
                <div class="bt-form-row">
                  <span class="bt-form-label" data-i18n="backtest.startingCapital">Starting capital:</span>
                  <input type="number" v-model="backtestParams.startingCapital" class="bt-input" />
                  <!-- <button type="button" class="bt-use-default-btn" data-i18n="backtest.useStrategyDefault">Use strategy default</button> -->
                </div>
                <div class="bt-form-row">
                  <span class="bt-form-label" data-i18n="backtest.stakeAmount">Stake amount:</span>
                  <label class="bt-checkbox-label">
                    <input type="checkbox" v-model="backtestParams.unlimitedStake" />
                    <span data-i18n="backtest.unlimitedStake">Unlimited stake</span>
                  </label>
                </div>
              </div>

              <div class="bt-section">
                <h3 class="bt-section-title" data-i18n="backtest.timerangeParams">Timerange parameters</h3>
                <div class="bt-form-row">
                  <label class="bt-checkbox-label">
                    <input type="checkbox" v-model="timerangeParams.enableProtections" />
                    <span data-i18n="backtest.enableProtections">Enable Protections</span>
                  </label>
                </div>
                <div class="bt-form-row">
                  <label class="bt-checkbox-label">
                    <input type="checkbox" v-model="timerangeParams.cacheBacktestResults" checked />
                    <span data-i18n="backtest.cacheBacktest">Cache Backtest results</span>
                  </label>
                </div>
                <div class="bt-form-row">
                  <label class="bt-checkbox-label">
                    <input type="checkbox" v-model="timerangeParams.enableFreqAI" />
                    <span data-i18n="backtest.enableFreqAI">Enable FreqAI</span>
                  </label>
                </div>
                <div v-show="timerangeParams.enableFreqAI" class="bt-form-row">
                  <span class="bt-form-label" data-i18n="backtest.freqaiIdentifier">FreqAI identifier:</span>
                  <input type="text" v-model="timerangeParams.freqaiIdentifier" class="bt-input" />
                </div>
                <div v-show="timerangeParams.enableFreqAI" class="bt-form-row">
                  <span class="bt-form-label" data-i18n="backtest.freqaiMode">FreqAI Mode:</span>
                  <a-select v-model:value="timerangeParams.freqaiMode" class="bovin-select-full" :placeholder="t('backtest.selectFreqaiMode')">
                    <a-select-option v-for="model in freqaiModels" :key="model.value" :value="model.value">
                      {{ model.label }}
                    </a-select-option>
                  </a-select>
                </div>
              </div>

              <div class="bt-date-section">
                <h3 class="bt-section-title" data-i18n="backtest.startDate">Start Date</h3>
                <div class="bt-date-range-row">
                  <div class="bt-date-input-wrap">
                    <a-date-picker
                      v-model:value="dateRange.startDate"
                      format="YYYY-MM-DD"
                      :placeholder="t('backtest.startDate')"
                      class="bovin-select-full"
                    />
                  </div>
                  <div class="bt-date-label-wrap">
                    <span class="bt-date-label" data-i18n="backtest.endDate">End Date</span>
                  </div>
                  <div class="bt-date-input-wrap">
                    <a-date-picker
                      v-model:value="dateRange.endDate"
                      format="YYYY-MM-DD"
                      :placeholder="t('backtest.endDate')"
                      class="bovin-select-full"
                    />
                  </div>
                </div>
              </div>

              <div class="bt-summary-section">
                <h3 class="bt-section-title" data-i18n="backtest.summary">Backtesting summary</h3>
                <div class="bt-summary-actions">
                  <button type="button" class="bt-btn bt-btn-primary" :disabled="isRunning || !selectedStrategy" @click="handleBacktest">
                    <!-- <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 19V5M8 9l4-4 4 4"/>
                    </svg> -->
                    <span :data-i18n="isRunning ? 'backtest.running' : 'backtest.start'">{{ isRunning ? t('backtest.running') : t('backtest.start') }}</span>
                  </button>
                  <button type="button" class="bt-btn bt-btn-secondary" :disabled="isRunning || isLoadingResult" @click="loadBacktestResult">
                    <!-- <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                    </svg> -->
                    <span :data-i18n="isLoadingResult ? 'backtest.loading' : 'backtest.load'">{{ isLoadingResult ? t('backtest.loading') : t('backtest.load') }}</span>
                  </button>
                  <button type="button" class="bt-btn bt-btn-secondary" :disabled="!isRunning" @click="stopBacktest">
                    <!-- <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M6 4h12M6 20h12"/>
                    </svg> -->
                    <span data-i18n="backtest.stop">Stop Backtest</span>
                  </button>
                  <button type="button" class="bt-btn bt-btn-secondary" :disabled="isRunning" @click="resetBacktest">
                    <!-- <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 8l3.26-3.26A9.75 9.75 0 0 1 12 3a9 9 0 0 1 9 9Z"/>
                      <path d="M16 3h5v5"/>
                      <path d="M21 16v5h-5"/>
                    </svg> -->
                    <span data-i18n="backtest.reset">Reset Backtest</span>
                  </button>
                </div>
              </div>
            </div>

            <div v-show="activeTab === 'analyze'" class="bt-tab-panel">
              <div v-if="currentResult" class="bt-analysis">
                <div class="bt-analysis-header">
                  <h3 class="bt-section-title" data-i18n="backtest.analyzeResult">回测结果分析</h3>
                  <div class="bt-analysis-strategy">{{ currentResult.strategy }}</div>
                </div>
                
                <div class="bt-analysis-grid">
                  <div class="bt-analysis-section">
                    <h4 class="bt-analysis-section-title" data-i18n="backtest.strategySettings">Strategy settings</h4>
                    <div class="bt-settings-table">
                      <div class="bt-settings-header">
                        <span class="bt-settings-label" data-i18n="backtest.setting">Setting</span>
                        <span class="bt-settings-value" data-i18n="backtest.value">Value</span>
                      </div>
                      <div 
                        v-for="(value, key) in currentResult.strategySettings" 
                        :key="key"
                        class="bt-settings-row"
                      >
                        <span class="bt-settings-label">{{ key }}</span>
                        <span class="bt-settings-value">{{ value }}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div class="bt-analysis-section">
                    <h4 class="bt-analysis-section-title" data-i18n="backtest.metrics">Metrics</h4>
                    <div class="bt-metrics-table">
                      <div class="bt-metrics-header">
                        <span class="bt-metrics-label" data-i18n="backtest.metric">Metric</span>
                        <span class="bt-metrics-value" data-i18n="backtest.value">Value</span>
                      </div>
                      <div 
                        v-for="(value, key) in currentResult.metrics" 
                        :key="key"
                        class="bt-metrics-row"
                      >
                        <span class="bt-metrics-label">{{ key }}</span>
                        <span class="bt-metrics-value">{{ value }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div class="bt-analysis-tables">
                  <div class="bt-results-table">
                    <div class="bt-table-header">
                      <h4 class="bt-table-title" data-i18n="backtest.resultsEnterTag">Results per Enter tag</h4>
                      <div class="bt-table-shown">
                        <span data-i18n="backtest.shownMetrics">Shown metrics:</span>
                        <a-select
                          v-model:value="enterTagVisibleMetrics"
                          mode="multiple"
                          class="bt-table-select"
                          :placeholder="t('backtest.selectMetrics')"
                          :style="{ minWidth: '200px' }"
                        >
                          <a-select-option v-for="opt in metricOptions" :key="opt.value" :value="opt.value">
                            {{ opt.label }}
                          </a-select-option>
                        </a-select>
                      </div>
                    </div>
                    <div class="bt-table-container">
                      <table class="bt-data-table">
                        <thead>
                          <tr>
                            <th data-i18n="backtest.enterTag">Enter Tag</th>
                            <th data-i18n="backtest.trades">Trades</th>
                            <th data-i18n="backtest.avgProfitPct">Avg Profit %</th>
                            <th data-i18n="backtest.totProfitUsdt">Tot Profit USDT</th>
                            <th data-i18n="backtest.totProfitPct">Tot Profit %</th>
                            <th data-i18n="backtest.wins">Wins</th>
                            <th data-i18n="backtest.draws">Draws</th>
                            <th data-i18n="backtest.losses">Losses</th>
                            <th v-if="enterTagVisibleMetrics.includes('sqn')" data-i18n="backtest.sqn">SQN</th>
                            <th v-if="enterTagVisibleMetrics.includes('cagr')" data-i18n="backtest.cagr">Cagr</th>
                            <th v-if="enterTagVisibleMetrics.includes('calmar')" data-i18n="backtest.calmar">Calmar</th>
                            <th v-if="enterTagVisibleMetrics.includes('expectancy')" data-i18n="backtest.expectancy">Expectancy</th>
                            <th v-if="enterTagVisibleMetrics.includes('profit_factor')" data-i18n="backtest.profitFactor">Profit Factor</th>
                            <th v-if="enterTagVisibleMetrics.includes('sharpe')" data-i18n="backtest.sharpe">Sharpe</th>
                            <th v-if="enterTagVisibleMetrics.includes('sortino')" data-i18n="backtest.sortino">Sortino</th>
                            <th v-if="enterTagVisibleMetrics.includes('max_drawdown')" data-i18n="backtest.maxDrawdown">Max Drawdown</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(item, key) in currentResult.resultsPerEnterTag" :key="key">
                            <td>{{ item.key }}</td>
                            <td>{{ item.trades }}</td>
                            <td>{{ formatNumber(item.profit_mean_pct) }}%</td>
                            <td>{{ formatNumber(item.profit_total_abs) }}</td>
                            <td>{{ formatNumber(item.profit_total_pct) }}%</td>
                            <td>{{ item.wins }}</td>
                            <td>{{ item.draws }}</td>
                            <td>{{ item.losses }}</td>
                            <td v-if="enterTagVisibleMetrics.includes('sqn')">{{ formatNumber(item.sqn) }}</td>
                            <td v-if="enterTagVisibleMetrics.includes('cagr')">{{ formatNumber(item.cagr) }}%</td>
                            <td v-if="enterTagVisibleMetrics.includes('calmar')">{{ formatNumber(item.calmar) }}</td>
                            <td v-if="enterTagVisibleMetrics.includes('expectancy')">{{ formatNumber(item.expectancy) }}</td>
                            <td v-if="enterTagVisibleMetrics.includes('profit_factor')">{{ formatNumber(item.profit_factor) }}</td>
                            <td v-if="enterTagVisibleMetrics.includes('sharpe')">{{ formatNumber(item.sharpe) }}</td>
                            <td v-if="enterTagVisibleMetrics.includes('sortino')">{{ formatNumber(item.sortino) }}</td>
                            <td v-if="enterTagVisibleMetrics.includes('max_drawdown')">{{ formatNumber(item.max_drawdown) }}%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  <div class="bt-results-table">
                    <div class="bt-table-header">
                      <h4 class="bt-table-title" data-i18n="backtest.resultsExitReason">Results per Exit reason</h4>
                      <div class="bt-table-shown">
                        <span data-i18n="backtest.shownMetrics">Shown metrics:</span>
                        <a-select
                          v-model:value="exitReasonVisibleMetrics"
                          mode="multiple"
                          class="bt-table-select"
                          :placeholder="t('backtest.selectMetrics')"
                          :style="{ minWidth: '200px' }"
                        >
                          <a-select-option v-for="opt in metricOptions" :key="opt.value" :value="opt.value">
                            {{ opt.label }}
                          </a-select-option>
                        </a-select>
                      </div>
                    </div>
                    <div class="bt-table-container">
                      <table class="bt-data-table">
                        <thead>
                          <tr>
                            <th data-i18n="backtest.exitReason">Exit Reason</th>
                            <th data-i18n="backtest.trades">Trades</th>
                            <th data-i18n="backtest.avgProfitPct">Avg Profit %</th>
                            <th data-i18n="backtest.totProfitUsdt">Tot Profit USDT</th>
                            <th data-i18n="backtest.totProfitPct">Tot Profit %</th>
                            <th data-i18n="backtest.wins">Wins</th>
                            <th data-i18n="backtest.draws">Draws</th>
                            <th data-i18n="backtest.losses">Losses</th>
                            <th v-if="exitReasonVisibleMetrics.includes('sqn')" data-i18n="backtest.sqn">SQN</th>
                            <th v-if="exitReasonVisibleMetrics.includes('cagr')" data-i18n="backtest.cagr">Cagr</th>
                            <th v-if="exitReasonVisibleMetrics.includes('calmar')" data-i18n="backtest.calmar">Calmar</th>
                            <th v-if="exitReasonVisibleMetrics.includes('expectancy')" data-i18n="backtest.expectancy">Expectancy</th>
                            <th v-if="exitReasonVisibleMetrics.includes('profit_factor')" data-i18n="backtest.profitFactor">Profit Factor</th>
                            <th v-if="exitReasonVisibleMetrics.includes('sharpe')" data-i18n="backtest.sharpe">Sharpe</th>
                            <th v-if="exitReasonVisibleMetrics.includes('sortino')" data-i18n="backtest.sortino">Sortino</th>
                            <th v-if="exitReasonVisibleMetrics.includes('max_drawdown')" data-i18n="backtest.maxDrawdown">Max Drawdown</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(item, key) in currentResult.exitReasonSummary" :key="key">
                            <td>{{ item.key }}</td>
                            <td>{{ item.trades }}</td>
                            <td>{{ formatNumber(item.profit_mean_pct) }}%</td>
                            <td>{{ formatNumber(item.profit_total_abs) }}</td>
                            <td>{{ formatNumber(item.profit_total_pct) }}%</td>
                            <td>{{ item.wins }}</td>
                            <td>{{ item.draws }}</td>
                            <td>{{ item.losses }}</td>
                            <td v-if="exitReasonVisibleMetrics.includes('sqn')">{{ formatNumber(item.sqn) }}</td>
                            <td v-if="exitReasonVisibleMetrics.includes('cagr')">{{ formatNumber(item.cagr) }}%</td>
                            <td v-if="exitReasonVisibleMetrics.includes('calmar')">{{ formatNumber(item.calmar) }}</td>
                            <td v-if="exitReasonVisibleMetrics.includes('expectancy')">{{ formatNumber(item.expectancy) }}</td>
                            <td v-if="exitReasonVisibleMetrics.includes('profit_factor')">{{ formatNumber(item.profit_factor) }}</td>
                            <td v-if="exitReasonVisibleMetrics.includes('sharpe')">{{ formatNumber(item.sharpe) }}</td>
                            <td v-if="exitReasonVisibleMetrics.includes('sortino')">{{ formatNumber(item.sortino) }}</td>
                            <td v-if="exitReasonVisibleMetrics.includes('max_drawdown')">{{ formatNumber(item.max_drawdown) }}%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  <div class="bt-results-table">
                    <div class="bt-table-header">
                      <h4 class="bt-table-title" data-i18n="backtest.resultsMixedTag">Results Mixed Tag</h4>
                      <div class="bt-table-shown">
                        <span data-i18n="backtest.shownMetrics">Shown metrics:</span>
                        <a-select
                          v-model:value="mixTagVisibleMetrics"
                          mode="multiple"
                          class="bt-table-select"
                          :placeholder="t('backtest.selectMetrics')"
                          :style="{ minWidth: '200px' }"
                        >
                          <a-select-option v-for="opt in metricOptions" :key="opt.value" :value="opt.value">
                            {{ opt.label }}
                          </a-select-option>
                        </a-select>
                      </div>
                    </div>
                    <div class="bt-table-container">
                      <table class="bt-data-table">
                        <thead>
                          <tr>
                            <th data-i18n="backtest.enterTag">Enter Tag</th>
                            <th data-i18n="backtest.exitTag">Exit Tag</th>
                            <th data-i18n="backtest.trades">Trades</th>
                            <th data-i18n="backtest.avgProfitPct">Avg Profit %</th>
                            <th data-i18n="backtest.totProfitUsdt">Tot Profit USDT</th>
                            <th data-i18n="backtest.totProfitPct">Tot Profit %</th>
                            <th data-i18n="backtest.wins">Wins</th>
                            <th data-i18n="backtest.draws">Draws</th>
                            <th data-i18n="backtest.losses">Losses</th>
                            <th v-if="mixTagVisibleMetrics.includes('sqn')" data-i18n="backtest.sqn">SQN</th>
                            <th v-if="mixTagVisibleMetrics.includes('cagr')" data-i18n="backtest.cagr">Cagr</th>
                            <th v-if="mixTagVisibleMetrics.includes('calmar')" data-i18n="backtest.calmar">Calmar</th>
                            <th v-if="mixTagVisibleMetrics.includes('expectancy')" data-i18n="backtest.expectancy">Expectancy</th>
                            <th v-if="mixTagVisibleMetrics.includes('profit_factor')" data-i18n="backtest.profitFactor">Profit Factor</th>
                            <th v-if="mixTagVisibleMetrics.includes('sharpe')" data-i18n="backtest.sharpe">Sharpe</th>
                            <th v-if="mixTagVisibleMetrics.includes('sortino')" data-i18n="backtest.sortino">Sortino</th>
                            <th v-if="mixTagVisibleMetrics.includes('max_drawdown')" data-i18n="backtest.maxDrawdown">Max Drawdown</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(item, enterTag) in currentResult.mixTagStats" :key="enterTag">
                            <!-- <tr v-for="(item, exitTag) in exitTags" :key="`${enterTag}-${exitTag}`"> -->
                              <td>{{ item.key?.[0] }}</td>
                              <td>{{ item.key?.[1] }}</td>
                              <td>{{ item.trades }}</td>
                              <td>{{ formatNumber(item.profit_mean_pct) }}%</td>
                              <td>{{ formatNumber(item.profit_total_abs) }}</td>
                              <td>{{ formatNumber(item.profit_total_pct) }}%</td>
                              <td>{{ item.wins }}</td>
                              <td>{{ item.draws }}</td>
                              <td>{{ item.losses }}</td>
                              <td v-if="mixTagVisibleMetrics.includes('sqn')">{{ formatNumber(item.sqn) }}</td>
                              <td v-if="mixTagVisibleMetrics.includes('cagr')">{{ formatNumber(item.cagr) }}%</td>
                              <td v-if="mixTagVisibleMetrics.includes('calmar')">{{ formatNumber(item.calmar) }}</td>
                              <td v-if="mixTagVisibleMetrics.includes('expectancy')">{{ formatNumber(item.expectancy) }}</td>
                              <td v-if="mixTagVisibleMetrics.includes('profit_factor')">{{ formatNumber(item.profit_factor) }}</td>
                              <td v-if="mixTagVisibleMetrics.includes('sharpe')">{{ formatNumber(item.sharpe) }}</td>
                              <td v-if="mixTagVisibleMetrics.includes('sortino')">{{ formatNumber(item.sortino) }}</td>
                              <td v-if="mixTagVisibleMetrics.includes('max_drawdown')">{{ formatNumber(item.max_drawdown) }}%</td>
                            <!-- </tr> -->
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  <div class="bt-results-table">
                    <div class="bt-table-header">
                      <h4 class="bt-table-title" data-i18n="backtest.resultsPerPair">Results per pair</h4>
                      <div class="bt-table-shown">
                        <span data-i18n="backtest.shownMetrics">Shown metrics:</span>
                        <a-select
                          v-model:value="pairVisibleMetrics"
                          mode="multiple"
                          class="bt-table-select"
                          :placeholder="t('backtest.selectMetrics')"
                          :style="{ minWidth: '200px' }"
                        >
                          <a-select-option v-for="opt in metricOptions" :key="opt.value" :value="opt.value">
                            {{ opt.label }}
                          </a-select-option>
                        </a-select>
                      </div>
                    </div>
                    <div class="bt-table-container">
                      <table class="bt-data-table">
                        <thead>
                          <tr>
                            <th data-i18n="backtest.pair">Pair</th>
                            <th data-i18n="backtest.trades">Trades</th>
                            <th data-i18n="backtest.avgProfitPct">Avg Profit %</th>
                            <th data-i18n="backtest.totProfitUsdt">Tot Profit USDT</th>
                            <th data-i18n="backtest.totProfitPct">Tot Profit %</th>
                            <th data-i18n="backtest.wins">Wins</th>
                            <th data-i18n="backtest.draws">Draws</th>
                            <th data-i18n="backtest.losses">Losses</th>
                            <th v-if="pairVisibleMetrics.includes('sqn')" data-i18n="backtest.sqn">SQN</th>
                            <th v-if="pairVisibleMetrics.includes('cagr')" data-i18n="backtest.cagr">Cagr</th>
                            <th v-if="pairVisibleMetrics.includes('calmar')" data-i18n="backtest.calmar">Calmar</th>
                            <th v-if="pairVisibleMetrics.includes('expectancy')" data-i18n="backtest.expectancy">Expectancy</th>
                            <th v-if="pairVisibleMetrics.includes('profit_factor')" data-i18n="backtest.profitFactor">Profit Factor</th>
                            <th v-if="pairVisibleMetrics.includes('sharpe')" data-i18n="backtest.sharpe">Sharpe</th>
                            <th v-if="pairVisibleMetrics.includes('sortino')" data-i18n="backtest.sortino">Sortino</th>
                            <th v-if="pairVisibleMetrics.includes('max_drawdown')" data-i18n="backtest.maxDrawdown">Max Drawdown</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(item, key) in currentResult.resultsPerPair" :key="key">
                            <td>{{ item.key }}</td>
                            <td>{{ item.trades }}</td>
                            <td>{{ formatNumber(item.profit_mean_pct) }}%</td>
                            <td>{{ formatNumber(item.profit_total_abs) }}</td>
                            <td>{{ formatNumber(item.profit_total_pct) }}%</td>
                            <td>{{ item.wins }}</td>
                            <td>{{ item.draws }}</td>
                            <td>{{ item.losses }}</td>
                            <td v-if="pairVisibleMetrics.includes('sqn')">{{ formatNumber(item.sqn) }}</td>
                            <td v-if="pairVisibleMetrics.includes('cagr')">{{ formatNumber(item.cagr) }}%</td>
                            <td v-if="pairVisibleMetrics.includes('calmar')">{{ formatNumber(item.calmar) }}</td>
                            <td v-if="pairVisibleMetrics.includes('expectancy')">{{ formatNumber(item.expectancy) }}</td>
                            <td v-if="pairVisibleMetrics.includes('profit_factor')">{{ formatNumber(item.profit_factor) }}</td>
                            <td v-if="pairVisibleMetrics.includes('sharpe')">{{ formatNumber(item.sharpe) }}</td>
                            <td v-if="pairVisibleMetrics.includes('sortino')">{{ formatNumber(item.sortino) }}</td>
                            <td v-if="pairVisibleMetrics.includes('max_drawdown')">{{ formatNumber(item.max_drawdown) }}%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  <div class="bt-results-table">
                    <div class="bt-table-header">
                      <h4 class="bt-table-title" data-i18n="backtest.periodicBreakdown">周期细分</h4>
                      <!-- <div class="bt-table-shown">
                        <span>Shown metrics:</span>
                        <select class="bt-table-select">
                          <option>Profit Factor, Expectancy</option>
                        </select>
                      </div> -->
                    </div>
                    <div class="bt-periodic-tabs">
                      <button 
                        v-for="tab in periodicTabs" 
                        :key="tab.key"
                        :class="['bt-periodic-tab', { active: activePeriodicTab === tab.key }]"
                        @click="activePeriodicTab = tab.key"
                      >
                        {{ tab.label }}
                      </button>
                    </div>
                    <div class="bt-table-container">
                      <table class="bt-data-table">
                        <thead>
                          <tr>
                            <th data-i18n="backtest.date">日期</th>
                            <th data-i18n="backtest.trades">交易</th>
                            <th data-i18n="backtest.totalProfit">总收益</th>
                            <th data-i18n="backtest.profitFactor">收益因子</th>
                            <th data-i18n="backtest.wins">盈利</th>
                            <th data-i18n="backtest.draws">平局</th>
                            <th data-i18n="backtest.losses">亏损</th>
                            <th data-i18n="backtest.winRate">胜率</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(item, index) in currentResult.periodicBreakdown" :key="index">
                            <td>{{ item.date }}</td>
                            <td>{{ item.trades }}</td>
                            <td>{{ formatNumber(item.profit_abs) }}</td>
                            <td>{{ formatNumber(item.profit_factor) }}</td>
                            <td>{{ item.wins }}</td>
                            <td>{{ item.draws }}</td>
                            <td>{{ item.losses }}</td>
                            <td>{{ ((item.wins / (item.wins + item.losses)) * 100).toFixed(2) }}%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  <div class="bt-results-table">
                    <div class="bt-table-header">
                      <h4 class="bt-table-title" data-i18n="backtest.singleTrades">单笔交易</h4>
                      <div class="bt-table-shown">
                        <!-- <span data-i18n="backtest.shownMetrics">Shown metrics:</span>
                        <select class="bt-table-select">
                          <option>Profit Factor, Expectancy</option>
                        </select> -->
                      </div>
                    </div>
                    <div class="bt-table-container">
                      <table class="bt-trades-table">
                        <thead>
                          <tr>
                            <th data-i18n="backtest.id">ID</th>
                            <th data-i18n="backtest.pair">交易对</th>
                            <th data-i18n="backtest.amount">数量</th>
                            <th data-i18n="backtest.totalStakeAmount">总赌注金额</th>
                            <th data-i18n="backtest.openRate">开仓价</th>
                            <th data-i18n="backtest.closeRate">平仓价</th>
                            <th data-i18n="backtest.profitPct">利润%</th>
                            <th data-i18n="backtest.openDate">开仓日期</th>
                            <th data-i18n="backtest.closeDate">平仓日期</th>
                            <th data-i18n="backtest.closeReason">平仓原因</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(trade, index) in paginatedTrades" :key="index">
                            <td>{{ trade.is_short ? 'Short' : 'Long' }}</td>
                            <td>{{ trade.pair }}</td>
                            <td>{{ trade.amount }}</td>
                            <td>{{ trade.stake_amount }}(1X)</td>
                            <td>{{ trade.open_rate }}</td>
                            <td>{{ trade.close_rate }}</td>
                            <td :class="['bt-profit-cell', trade.profit_ratio >= 0 ? 'profit' : 'loss']">
                              <span v-if="trade.profit_abs >= 0">▲</span>
                              <span v-else>▼</span>
                              {{ Number(trade.profit_ratio * 100).toFixed(2) }}%（{{Number(trade.profit_abs).toFixed(2)}}）
                            </td>
                            <td>{{ formatDate(trade.open_date) }}</td>
                            <td>{{ formatDate(trade.close_date) }}</td>
                            <td>{{ trade.exit_reason }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div class="bt-pagination">
                      <button 
                        class="bt-pagination-btn" 
                        :disabled="currentPage === 1"
                        @click="currentPage = 1"
                      >
                        «
                      </button>
                      <button 
                        class="bt-pagination-btn" 
                        :disabled="currentPage === 1"
                        @click="currentPage--"
                      >
                        ‹
                      </button>
                      <template v-for="(page, index) in visiblePages" :key="index">
                        <button 
                          v-if="typeof page === 'number'"
                          :class="['bt-pagination-btn', { active: currentPage === page }]"
                          @click="currentPage = page"
                        >
                          {{ page }}
                        </button>
                        <span v-else class="bt-pagination-dots">{{ page }}</span>
                      </template>
                      <button 
                        class="bt-pagination-btn" 
                        :disabled="currentPage >= totalPages"
                        @click="currentPage++"
                      >
                        ›
                      </button>
                      <button 
                        class="bt-pagination-btn" 
                        :disabled="currentPage >= totalPages"
                        @click="currentPage = totalPages"
                      >
                        »
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div v-else class="bt-empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6e7591" stroke-width="1.5">
                  <path d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z"/>
                </svg>
                <p>请先运行回测或加载历史结果</p>
              </div>
            </div>

            <div v-show="activeTab === 'visualize'" class="bt-tab-panel">
              <div v-if="currentResult" class="bt-visualization">
                <div class="bt-chart-section">
                  <h3 class="bt-section-title" data-i18n="backtest.equityCurve">收益曲线</h3>
                  <div class="bt-chart-container">
                    <div class="bt-chart">
                      <svg viewBox="0 0 800 300" class="bt-line-chart">
                        <defs>
                          <linearGradient id="profitGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stop-color="rgba(78, 222, 163, 0.3)" />
                            <stop offset="100%" stop-color="rgba(78, 222, 163, 0)" />
                          </linearGradient>
                        </defs>
                        <path :d="areaPath" fill="url(#profitGradient)" />
                        <path :d="linePath" fill="none" stroke="#4edea3" stroke-width="2" />
                      </svg>
                      <div class="bt-chart-labels">
                        <span data-i18n="backtest.day1">第1天</span>
                        <span data-i18n="backtest.day10">第10天</span>
                        <span data-i18n="backtest.day20">第20天</span>
                        <span data-i18n="backtest.day30">第30天</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="bt-chart-section">
                  <h3 class="bt-section-title" data-i18n="backtest.profitDistribution">收益分布</h3>
                  <div class="bt-bar-chart">
                    <div class="bt-bar-group">
                      <div class="bt-bar-item">
                        <div class="bt-bar bt-bar-win" :style="{ height: winRateHeight + '%' }"></div>
                        <span data-i18n="backtest.win">盈利</span>
                      </div>
                      <div class="bt-bar-item">
                        <div class="bt-bar bt-bar-loss" :style="{ height: (100 - winRateHeight) + '%' }"></div>
                        <span data-i18n="backtest.loss">亏损</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="bt-metrics-grid">
                  <div class="bt-metric-card">
                    <div class="bt-metric-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 8v4l3 3"/>
                      </svg>
                    </div>
                    <div class="bt-metric-content">
                      <div class="bt-metric-value">{{ currentResult.sharpeRatio }}</div>
                      <div class="bt-metric-label" data-i18n="backtest.sharpeRatio">夏普比率</div>
                    </div>
                  </div>
                  <div class="bt-metric-card">
                    <div class="bt-metric-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                      </svg>
                    </div>
                    <div class="bt-metric-content">
                      <div class="bt-metric-value">{{ currentResult.sortinoRatio }}</div>
                      <div class="bt-metric-label" data-i18n="backtest.sortinoRatio">索提诺比率</div>
                    </div>
                  </div>
                  <div class="bt-metric-card">
                    <div class="bt-metric-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 12V7a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v5a4 4 0 0 0 4 4h2"/>
                      </svg>
                    </div>
                    <div class="bt-metric-content">
                      <div class="bt-metric-value">{{ currentResult.volatility }}%</div>
                      <div class="bt-metric-label" data-i18n="backtest.volatility">波动率</div>
                    </div>
                  </div>
                  <div class="bt-metric-card">
                    <div class="bt-metric-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                    </div>
                    <div class="bt-metric-content">
                      <div class="bt-metric-value">{{ currentResult.maxProfit }}%</div>
                      <div class="bt-metric-label" data-i18n="backtest.maxProfit">最大盈利</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div v-else class="bt-empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6e7591" stroke-width="1.5">
                  <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
                <p data-i18n="backtest.pleaseRunBacktest">请先运行回测或加载历史结果</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { Modal, message, Select, DatePicker } from 'ant-design-vue';
import dayjs from 'dayjs';
import { getBacktestHistory, getBacktestHistoryResult, deleteBacktestHistory, getStrategyDetail, runBacktest, getStrategies, getBacktest, deleteBacktest, getFreqaiModels, abortBacktest, getStrategy } from '../../api/backtest.js';
import { i18n } from "../../i18n/index.js";
import { state } from "../../store/state-core.js";

function t(key) {
  const lang = state.lang || "zh-CN";
  return i18n[lang]?.[key] ?? i18n["zh-CN"]?.[key] ?? key;
}

const strategyList = ref([]);
const freqaiModels = ref([]);
const hasAnalysisData = ref(false);
const savedBacktestResult = ref(null);
const periodicTabs = ref([
  { key: 'day', label: t('backtest.periodic.day') },
  { key: 'week', label: t('backtest.periodic.week') },
  { key: 'month', label: t('backtest.periodic.month') },
  { key: 'year', label: t('backtest.periodic.year') },
  { key: 'weekday', label: t('backtest.periodic.weekday') }
]);

function updatePeriodicTabs() {
  periodicTabs.value = [
    { key: 'day', label: t('backtest.periodic.day') },
    { key: 'week', label: t('backtest.periodic.week') },
    { key: 'month', label: t('backtest.periodic.month') },
    { key: 'year', label: t('backtest.periodic.year') },
    { key: 'weekday', label: t('backtest.periodic.weekday') }
  ];
}
const activePeriodicTab = ref('month');
const currentPage = ref(1);
const pageSize = ref(20);

const metricOptions = ref([
  { value: 'sqn', label: t('backtest.sqn') },
  { value: 'cagr', label: t('backtest.cagr') },
  { value: 'calmar', label: t('backtest.calmar') },
  { value: 'expectancy', label: t('backtest.expectancy') },
  { value: 'profit_factor', label: t('backtest.profitFactor') },
  { value: 'sharpe', label: t('backtest.sharpe') },
  { value: 'sortino', label: t('backtest.sortino') },
  { value: 'max_drawdown', label: t('backtest.maxDrawdown') }  
]);

function updateMetricOptions() {
  metricOptions.value = [
    { value: 'sqn', label: t('backtest.sqn') },
    { value: 'cagr', label: t('backtest.cagr') },
    { value: 'calmar', label: t('backtest.calmar') },
    { value: 'expectancy', label: t('backtest.expectancy') },
    { value: 'profit_factor', label: t('backtest.profitFactor') },
    { value: 'sharpe', label: t('backtest.sharpe') },
    { value: 'sortino', label: t('backtest.sortino') },
    { value: 'max_drawdown', label: t('backtest.maxDrawdown') }  
  ];
}

const name = ref('')
const enterTagVisibleMetrics = ref(['sqn', 'cagr', 'calmar', 'expectancy', 'profit_factor', 'sharpe', 'sortino', 'max_drawdown']);
const exitReasonVisibleMetrics = ref(['sqn', 'cagr', 'calmar', 'expectancy', 'profit_factor', 'sharpe', 'sortino', 'max_drawdown']);
const mixTagVisibleMetrics = ref(['sqn', 'cagr', 'calmar', 'expectancy', 'profit_factor', 'sharpe', 'sortino', 'max_drawdown']);
const pairVisibleMetrics = ref(['sqn', 'cagr', 'calmar', 'expectancy', 'profit_factor', 'sharpe', 'sortino', 'max_drawdown']);

const paginatedTrades = computed(() => {
  const trades = currentResult.value?.trades || [];
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return trades.slice(start, end);
});

const totalPages = computed(() => {
  const total = currentResult.value?.trades?.length || 0;
  return Math.ceil(total / pageSize.value);
});

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const formatNumber = (value, decimals = 2) => {
  if (value === undefined || value === null || value === '-') return '-';
  const num = Number(value);
  if (isNaN(num)) return String(value);
  return num.toFixed(decimals);
};

const visiblePages = computed(() => {
  const pages = [];
  const total = totalPages.value;
  const current = currentPage.value;
  
  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(total);
    } else if (current >= total - 3) {
      pages.push(1);
      pages.push('...');
      for (let i = total - 4; i <= total; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      pages.push('...');
      for (let i = current - 1; i <= current + 1; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(total);
    }
  }
  
  return pages;
});

watch(activePeriodicTab, (newTab) => {
  if (savedBacktestResult.value) {
    const strategyName = selectedStrategy.value || 'DOUStrategy';
    const strategyData = savedBacktestResult.value?.backtest_result?.strategy;
    const rawSettings = strategyData?.[strategyName] || savedBacktestResult.value || {};
    currentResult.value.periodicBreakdown = (rawSettings?.periodic_breakdown?.[newTab] || []).map(item => ({
      date: item.date,
      trades: item.trades,
      profit_abs: item.profit_abs,
      profit_factor: item.profit_factor,
      wins: item.wins,
      draws: item.draws,
      losses: item.losses
    }));
  }
});

const handleTabClick = async (tabKey) => {
   console.log(hasAnalysisData.value,'hasAnalysisData.valu')
   console.log(currentResult.value,'currentResult.value')
  if (tabKey === 'analyze') {
    await loadBacktestResult()
  }
  activeTab.value = tabKey;
};

const timeframeOptions = [
  // { value: '', label: 'Select timeframe' },
  // { value: 'use_strategy', label: 'Use strategy default' },
  { value: '1m', label: '1m' },
  { value: '3m', label: '3m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '30m', label: '30m' },
  { value: '1h', label: '1h' },
  { value: '2h', label: '2h' },
  { value: '4h', label: '4h' },
  { value: '6h', label: '6h' },
  { value: '8h', label: '8h' },
  { value: '12h', label: '12h' },
  { value: '1d', label: '1d' },
  { value: '3d', label: '3d' },
  { value: '1w', label: '1w' },
  { value: '2w', label: '2w' },
  { value: '1mo', label: '1mo' },
  { value: '1y', label: '1y' }
];

const tabs = ref([
  { key: 'load', label: t('backtest.tab.load'), icon: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3' },
  { key: 'run', label: t('backtest.tab.run'), icon: 'M12 19V5M8 9l4-4 4 4' },
  { key: 'analyze', label: t('backtest.tab.analyze'), icon: 'M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z' },
]);

function updateTabs() {
  tabs.value = [
    { key: 'load', label: t('backtest.tab.load'), icon: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3' },
    { key: 'run', label: t('backtest.tab.run'), icon: 'M12 19V5M8 9l4-4 4 4' },
    { key: 'analyze', label: t('backtest.tab.analyze'), icon: 'M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z' },
  ];
}

const activeTab = ref('run');

const pairs = ref(['BTC/USDT', 'ETH/USDT']);
const timeframes = ref(['5m', '1h']);
const backtestDays = ref(30);
const useCustomTimerange = ref(false);
const advancedExpanded = ref(false);
const startDate = ref('2026-05-01');
const endDate = ref('');
const isRunning = ref(false);
const isLoadingResult = ref(false);
const isLoadingHistory = ref(false);

const advancedOptions = reactive({
  enablePositionSizing: true,
  enableProtections: false,
  useDryRun: true,
  initialCapital: 10000,
  feePercent: 0.1
});

const selectedStrategy = ref('');

const backtestParams = reactive({
  timerange: '',
  timerange2: '',
  maxOpenTrades: '',
  startingCapital: '',
  stakeAmount: '',
  unlimitedStake: false,
  stakeAmount2: '',
  unlimitedStake2: false
});

const timerangeParams = reactive({
  enableProtections: false,
  cacheBacktestResults: true,
  enableFreqAI: false,
  freqaiIdentifier: '',
  freqaiMode: ''
});

const dateRange = reactive({
  startDate: dayjs('2026-04-30'),
  endDate: null,
  timeframe: ''
});

const historyResults = ref([]);

const loadHistory = async () => {
  isLoadingHistory.value = true;
  try {
    const result = await getBacktestHistory();
    historyResults.value = result || [];
  } catch (error) {
    console.error('加载回测历史失败:', error);
    historyResults.value = [];
  } finally {
    isLoadingHistory.value = false;
  }
};

const deleteHistoryItem = (item) => {
  Modal.confirm({
    title: t('backtest.confirmDelete'),
    content: t('backtest.deleteConfirm'),
    okText: t('backtest.ok'),
    cancelText: t('backtest.cancel'),
    async onOk() {
      try {
        await deleteBacktestHistory(item.filename);
        const index = historyResults.value.findIndex(h => h.filename === item.filename);
        if (index > -1) {
          historyResults.value.splice(index, 1);
        }
        message.success('删除成功');
      } catch (error) {
        message.error('删除失败');
      }
    }
  });
};

const formatDetail = (item) => {
  const timeframe = item.timeframe || '';
  const start = formatTimestamp(item.backtest_start_ts);
  const end = formatTimestamp(item.backtest_end_ts);
  return `${timeframe} ${start}-${end}`.trim();
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const formatDateTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

onMounted(() => {
  if (activeTab.value === 'load') {
    loadHistory();
  }
  loadStrategies();
});

const loadStrategies = async () => {
  try {
    const result = await getStrategies();
    console.log('策略接口返回数据:', result);
    strategyList.value = result.strategies.map(item => {
      return { value: item, label: item };
    });
    console.log('策略列表加载成功:', strategyList.value);
  } catch (error) {
    console.error('加载策略列表失败:', error);
    strategyList.value = [
      { value: 'SampleStrategy', label: 'SampleStrategy' },
      { value: 'EMAStrategy', label: 'EMAStrategy' },
      { value: 'RSIStrategy', label: 'RSIStrategy' }
    ];
  }
};

watch(activeTab, (newTab) => {
  if (newTab === 'load') {
    loadHistory();
  } else if (newTab === 'run') {
    loadStrategies();
    loadFreqaiModels();
  }
});

function handleLangChange() {
  updateTabs();
  updatePeriodicTabs();
  updateMetricOptions();
}

window.addEventListener("bovin-lang-changed", handleLangChange);

const loadFreqaiModels = async () => {
  try {
    const result = await getFreqaiModels();
     freqaiModels.value = result.freqaimodels.map(item => {
      return { value: item, label: item };
    });
    console.log(freqaiModels.value,'freqaiModels')
  } catch (error) {
    console.error('加载 FreqAI 模型列表失败:', error);
    freqaiModels.value = [
      { value: 'regression', label: 'Regression' },
      { value: 'classification', label: 'Classification' },
      { value: 'multiclass', label: 'Multiclass' },
      { value: 'cluster', label: 'Cluster' }
    ];
  }
};

const currentResult = ref({
  strategy: 'DOUStrategy',
  strategySettings: {
    'Backtesting from': '2025-06-23 00:00:00',
    'Backtesting to': '2026-06-23 00:00:00',
    'Trading Mode': 'Isolated Futures',
    'BT execution time': '8 minutes, 23 seconds',
    'Max open trades': '3',
    'Timeframe': '5m',
    'Timeframe Detail': 'N/A',
    'Timerange': '20250623-20260623',
    'Stoploss': '-5.00%',
    'Trailing Stoploss': 'false',
    'Trail only when offset is reached': 'false',
    'Trailing Stop positive': 'N/A',
    'Trailing stop positive offset': '0',
    'Custom Stoploss': 'false',
    'ROI': '{"0": 0.1,"240": -1}',
    'Use Exit Signal': 'true',
    'Exit profit only': 'false',
    'Exit profit offset': '0',
    'Enable protections': 'false',
    'Starting balance': '1000 USDT',
    'Final balance': '457.154 USDT',
    'Avg. stake amount': '236.388 USDT',
    'Total trade volume': '776378.245 USDT'
  },
  metrics: {
    'Total Profit': '-54.285% | -542.846 USDT',
    'CAGR': '-54.285%',
    'Sortino': '-8.6',
    'Sharpe': '-7.07',
    'Calmar': '-4.97',
    'System Quality Number (SQN)': '-3.33',
    'Expectancy (ratio)': '-0.33 (-0.12)',
    'Profit factor': '0.771',
    'Total trades / Daily Avg Trades': '1642 / 4.5',
    'Best day': '24.30% | 39.606 USDT',
    'Worst day': '-40.85% | -80.788 USDT',
    'Win/Draw/Loss': '780 / 0 / 862 (WR: 47.50%)',
    'Days win/draw/loss': '144 / 70 / 148',
    'Min. Duration winners': '5 minutes',
    'Avg. Duration winners': '3 hours, 30 minutes',
    'Max. Duration winners': '4 hours',
    'Min. Duration Losers': 'N/A',
    'Avg. Duration Losers': '3 hours, 46 minutes',
    'Max. Duration Losers': '4 hours',
    'Max Consecutive Wins / Loss': '9 / 15',
    'Rejected entry signals': '0',
    'Entry/Exit timeouts': '0 / 0',
    'Canceled Trade Entries': '0',
    'Canceled Entry Orders': '0',
    'Replaced Entry Orders': '0',
    'Long / Short': '1020 / 622',
    'Total profit Long': '-48.247% | -482.47 USDT',
    'Total profit Short': '-6.037% | -60.37 USDT',
    'Min/Max balance (closed trades)': '449.223 USDT / 1000 USDT',
    'Min/Max balance (wallet balance)': '449.223 USDT / 1000 USDT',
    'Market change': '-34.684%',
    'Max Drawdown (Account)': '57.141%',
    'Max Drawdown ABS': '598.926 USDT',
    'Drawdown duration': '237 days 00:50:00',
    'Profit at Drawdown start | end': '48.149 USDT | -550.777 USDT',
    'Drawdown start': '2025-10-21 16:15:00',
    'Drawdown end': '2026-06-15 17:05:00',
    '-- Wallet Balance metrics --': '',
    'Max Drawdown (wallet balance)': '57.141%',
    'Max Drawdown abs (wallet balance)': '598.926 USDT',
    'Drawdown duration (wallet balance)': '237 days 00:50:00',
    'Profit at Drawdown start | end (wallet balance)': '48.149 USDT | -550.777 USDT',
    'Drawdown start (wallet balance)': '2025-10-21 16:20:00',
    'Drawdown end (wallet balance)': '2026-06-15 17:10:00',
    'Sortino (wallet balance)': '-2.22',
    'Sharpe (wallet balance)': '-2.54',
    'Calmar (wallet balance)': '-4.97',
    'Best Pair': 'BTC/USDT',
    'Worst Pair': 'ETH/USDT',
    'Best single Trade': '+12.34% | 123.4 USDT',
    'Worst single Trade': '-8.9% | -89 USDT'
  },
  resultsPerEnterTag: {
    'ai_short': { trades: 622, profit_mean_pct: '-0.06%', profit_total_abs: '-60.373', profit_total_pct: '-6.04%', wins: 289, draws: 0, losses: 333, expectancy: '-0.1', profit_factor: '0.9' },
    'ai_long': { trades: 1020, profit_mean_pct: '-0.19%', profit_total_abs: '-482.473', profit_total_pct: '-48.25%', wins: 491, draws: 0, losses: 529, expectancy: '-0.47', profit_factor: '0.73' },
    'TOTAL': { trades: 1642, profit_mean_pct: '-0.14%', profit_total_abs: '-542.846', profit_total_pct: '-54.28%', wins: 780, draws: 0, losses: 862, expectancy: '-0.33', profit_factor: '0.77' }
  },
  exitReasonSummary: {
    'exit_signal': { trades: 273, avg_profit_pct: '0.70%', tot_profit_usdt: '466.776', tot_profit_pct: '46.68%', wins: 193, draws: 0, losses: 80, expectancy: '1.71', profit_factor: '4.46' },
    'roi': { trades: 1321, avg_profit_pct: '-0.13%', tot_profit_usdt: '-426.234', tot_profit_pct: '-42.62%', wins: 587, draws: 0, losses: 734, expectancy: '-0.32', profit_factor: '0.74' },
    'stop_loss': { trades: 48, avg_profit_pct: '-5.09%', tot_profit_usdt: '-583.387', tot_profit_pct: '-58.34%', wins: 0, draws: 0, losses: 48, expectancy: '-12.15', profit_factor: '0' },
    'TOTAL': { trades: 1642, avg_profit_pct: '-0.14%', tot_profit_usdt: '-542.846', tot_profit_pct: '-54.28%', wins: 780, draws: 0, losses: 862, expectancy: '-0.33', profit_factor: '0.77' }
  },
  mixTagStats: {
    'ai_long': {
      'exit_signal': { trades: 146, avg_profit_pct: '0.77%', tot_profit_usdt: '279.824', tot_profit_pct: '27.98%', wins: 102, draws: 0, losses: 44, expectancy: '1.92', profit_factor: '4.44' },
      'roi': { trades: 830, avg_profit_pct: '-0.10%', tot_profit_usdt: '-221.313', tot_profit_pct: '-22.13%', wins: 389, draws: 0, losses: 441, expectancy: '-0.27', profit_factor: '0.81' },
      'stop_loss': { trades: 44, avg_profit_pct: '-5.09%', tot_profit_usdt: '-540.984', tot_profit_pct: '-54.10%', wins: 0, draws: 0, losses: 44, expectancy: '-12.3', profit_factor: '0' }
    },
    'ai_short': {
      'exit_signal': { trades: 127, avg_profit_pct: '0.62%', tot_profit_usdt: '186.951', tot_profit_pct: '18.70%', wins: 91, draws: 0, losses: 36, expectancy: '1.47', profit_factor: '4.49' },
      'roi': { trades: 491, avg_profit_pct: '-0.19%', tot_profit_usdt: '-204.922', tot_profit_pct: '-20.49%', wins: 198, draws: 0, losses: 293, expectancy: '-0.42', profit_factor: '0.6' },
      'stop_loss': { trades: 4, avg_profit_pct: '-5.10%', tot_profit_usdt: '-42.403', tot_profit_pct: '-4.24%', wins: 0, draws: 0, losses: 4, expectancy: '-10.6', profit_factor: '0' }
    },
    'TOTAL': {
      'TOTAL': { trades: 1642, avg_profit_pct: '-0.14%', tot_profit_usdt: '-542.846', tot_profit_pct: '-54.28%', wins: 780, draws: 0, losses: 862, expectancy: '-0.33', profit_factor: '0.77' }
    }
  }
});

const winRateHeight = computed(() => {
  return currentResult.value ? currentResult.value.winRate : 0;
});

const generateChartData = () => {
  const points = [];
  for (let i = 0; i <= 30; i++) {
    const base = Math.sin(i * 0.3) * 15;
    const noise = (Math.random() - 0.5) * 10;
    points.push(30 + base + noise);
  }
  return points;
};

const linePath = computed(() => {
  const points = generateChartData();
  const width = 800;
  const height = 280;
  const stepX = width / 30;
  
  let path = `M 0 ${height - points[0] * (height / 100)}`;
  for (let i = 1; i < points.length; i++) {
    const x = i * stepX;
    const y = height - points[i] * (height / 100);
    path += ` L ${x} ${y}`;
  }
  return path;
});

const areaPath = computed(() => {
  const points = generateChartData();
  const width = 800;
  const height = 280;
  const stepX = width / 30;
  
  let path = `M 0 ${height}`;
  for (let i = 0; i < points.length; i++) {
    const x = i * stepX;
    const y = height - points[i] * (height / 100);
    path += ` L ${x} ${y}`;
  }
  path += ` L ${width} ${height} Z`;
  return path;
});

const addStrategy = () => strategies.value.push('');
const removeStrategy = (index) => strategies.value.splice(index, 1);
const addPair = () => pairs.value.push('');
const removePair = (index) => pairs.value.splice(index, 1);
const addTimeframe = () => timeframes.value.push('');
const removeTimeframe = (index) => timeframes.value.splice(index, 1);
const increaseDays = () => backtestDays.value++;
const decreaseDays = () => { if (backtestDays.value > 1) backtestDays.value--; };
const toggleAdvanced = () => advancedExpanded.value = !advancedExpanded.value;

const stopBacktest = async () => {
  try {
    await abortBacktest();
    message.info('正在停止回测...');
    
    const pollStatus = async () => {
      try {
        const result = await getBacktest();
        
        if (result.running === false) {
          isRunning.value = false;
          if (result.status_msg) {
            message.info(result.status_msg);
          } else if (result.status) {
            message.info(`回测状态: ${result.status}`);
          } else {
            message.success('回测已停止');
          }
          
          if (result.status === 'ended' || result.status === 'finished') {
            currentResult.value = {
              strategy: result.strategy || selectedStrategy.value,
              profit: result.profit || 15.3,
              winRate: result.winRate || 58,
              maxDrawdown: result.maxDrawdown || 8.2,
              trades: result.trades || 120,
              winCount: result.winCount || 70,
              lossCount: result.lossCount || 50,
              sharpeRatio: result.sharpeRatio || 1.8,
              sortinoRatio: result.sortinoRatio || 2.5,
              volatility: result.volatility || 12.3,
              maxProfit: result.maxProfit || 25.6,
              tradesDetail: result.tradesDetail || [
                { pair: 'BTC/USDT', time: '09:30', direction: 'LONG', profit: 2.5 },
                { pair: 'ETH/USDT', time: '10:15', direction: 'SHORT', profit: -1.2 },
                { pair: 'BTC/USDT', time: '11:00', direction: 'LONG', profit: 3.8 },
                { pair: 'BTC/USDT', time: '14:30', direction: 'LONG', profit: 1.5 },
                { pair: 'ETH/USDT', time: '15:45', direction: 'SHORT', profit: 4.2 }
              ]
            };
            activeTab.value = 'analyze';
          }
        } else {
          setTimeout(pollStatus, 2000);
        }
      } catch (error) {
        console.error('轮询回测状态失败:', error);
        isRunning.value = false;
        message.error('轮询回测状态失败');
      }
    };
    
    pollStatus();
  } catch (error) {
    console.error('停止回测失败:', error);
    message.error('停止回测失败');
  }
};

const resetBacktest = async () => {
  try {
    await deleteBacktest();
    selectedStrategy.value = '';
    Object.keys(backtestParams).forEach(key => {
      if (typeof backtestParams[key] === 'boolean') {
        backtestParams[key] = false;
      } else {
        backtestParams[key] = '';
      }
    });
    timerangeParams.enableProtections = false;
    timerangeParams.cacheBacktestResults = true;
    timerangeParams.enableFreqAI = false;
    timerangeParams.freqaiIdentifier = '';
    timerangeParams.freqaiMode = '';
    dateRange.startDate = dayjs('2026-04-30');
    dateRange.endDate = null;
    message.success('回测已重置');
  } catch (error) {
    console.error('重置回测失败:', error);
    message.error('重置回测失败');
  }
};

const strategySettingsFields = [
  'Backtesting from',
  'Backtesting to',
  'Trading Mode',
  'BT execution time',
  'Max open trades',
  'Timeframe',
  'Timeframe Detail',
  'Timerange',
  'Stoploss',
  'Trailing Stoploss',
  'Trail only when offset is reached',
  'Trailing Stop positive',
  'Trailing stop positive offset',
  'Custom Stoploss',
  'ROI',
  'Use Exit Signal',
  'Exit profit only',
  'Exit profit offset',
  'Enable protections',
  'Starting balance',
  'Final balance',
  'Avg. stake amount',
  'Total trade volume'
];

const metricsFields = [
  'Total Profit',
  'CAGR',
  'Sortino',
  'Sharpe',
  'Calmar',
  'System Quality Number (SQN)',
  'Expectancy (ratio)',
  'Profit factor',
  'Total trades / Daily Avg Trades',
  'Best day',
  'Worst day',
  'Win/Draw/Loss',
  'Days win/draw/loss',
  'Min. Duration winners',
  'Avg. Duration winners',
  'Max. Duration winners',
  'Min. Duration Losers',
  'Avg. Duration Losers',
  'Max. Duration Losers',
  'Max Consecutive Wins / Loss',
  'Rejected entry signals',
  'Entry/Exit timeouts',
  'Canceled Trade Entries',
  'Canceled Entry Orders',
  'Replaced Entry Orders',
  'Long / Short',
  'Total profit Long',
  'Total profit Short',
  'Min/Max balance (closed trades)',
  'Min/Max balance (wallet balance)',
  'Market change',
  'Max Drawdown (Account)',
  'Max Drawdown ABS',
  'Drawdown duration',
  'Profit at Drawdown start | end',
  'Drawdown start',
  'Drawdown end',
  '-- Wallet Balance metrics --',
  'Max Drawdown (wallet balance)',
  'Max Drawdown abs (wallet balance)',
  'Drawdown duration (wallet balance)',
  'Profit at Drawdown start | end (wallet balance)',
  'Drawdown start (wallet balance)',
  'Drawdown end (wallet balance)',
  'Sortino (wallet balance)',
  'Sharpe (wallet balance)',
  'Calmar (wallet balance)',
  'Best Pair',
  'Worst Pair',
  'Best single Trade',
  'Worst single Trade'
];

const getFieldValue = (data, fieldName, isMetric = false) => {
  const strategyFieldMappings = {
    'Backtesting from': ['backtest_start'],
    'Backtesting to': ['backtest_end'],
    'Trading Mode': ['margin_mode', 'trading_mode'],
    'BT execution time': ['backtest_run_end_ts', 'backtest_run_start_ts'],
    'Max open trades': ['max_open_trades', 'maxOpenTrades', 'maxTrades'],
    'Timeframe': ['timeframe', 'tf'],
    'Timeframe Detail': ['timeframe_detail', 'tfDetail', 'detailTimeframe'],
    'Timerange': ['timerange', 'timeRange'],
    'Stoploss': ['stoploss', 'stop_loss'],
    'Trailing Stoploss': ['trailing_stop'],
    'Trail only when offset is reached': ['trailing_only_offset_is_reached'],
    'Trailing Stop positive': ['trailing_stop_positive', 'trailPositive'],
    'Trailing stop positive offset': ['trailing_stop_positive_offset', 'trailPositiveOffset'],
    'Custom Stoploss': ['use_custom_stoploss'],
    'ROI': ['minimal_roi'],
    'Use Exit Signal': ['use_exit_signal', 'useExitSignal', 'exitSignal'],
    'Exit profit only': ['exit_profit_only', 'exitProfitOnly'],
    'Exit profit offset': ['exit_profit_offset', 'exitProfitOffset'],
    'Enable protections': ['enable_protections', 'enableProtections', 'protections'],
    'Starting balance': ['starting_balance', 'startBalance', 'initialBalance'],
    'Final balance': ['final_balance', 'endBalance', 'balance'],
    'Avg. stake amount': ['avg_stake_amount'],
    'Total trade volume': ['total_volume']
  };
  
  const metricFieldMappings = {
    'Total Profit': ['profit_total'],
    'CAGR': ['cagr'],
    'Sortino': ['sortino'],
    'Sharpe': ['sharpe'],
    'Calmar': ['calmar'],
    'System Quality Number (SQN)': ['sqn'],
    'Expectancy (ratio)': ['expectancy', 'expectancy_ratio'],
    'Profit factor': ['profit_factor'],
    'Total trades / Daily Avg Trades': ['total_trades', 'trades_per_day'],
    'Best day': ['backtest_best_day', 'backtest_best_day_abs'],
    'Worst day': ['backtest_worst_day', 'backtest_worst_day_abs'],
    'Win/Draw/Loss': ['wins', 'draws', 'losses'],
    'Days win/draw/loss': ['winning_days', 'draw_days', 'losing_days'],
    'Max Consecutive Wins / Loss': ['max_consecutive_wins', 'max_consecutive_losses'],
    'Rejected entry signals': ['rejected_signal'],
    'Entry/Exit timeouts': ['timedout_entry_orders', 'timedout_exit_orders'],
    'Canceled Trade Entries': ['canceled_trade_entries'],
    'Canceled Entry Orders': ['canceled_entry_order'],
    'Long / Short': ['trade_count_long', 'trade_count_short'],
    'Total profit Long': ['profit_total_long'],
    'Total profit Short': ['profit_total_short'],
    'Market change': ['market_change'],
    'Max Drawdown (Account)': ['max_relative_drawdown'],
    'Profit at Drawdown start | end': ['max_drawdown_high', 'max_drawdown_low'],
    '-- Wallet Balance metrics --': [],
    'Max Drawdown (wallet balance)': ['max_relative_drawdown'],
    'Max Drawdown abs (wallet balance)': ['max_drawdown_abs'],
    'Drawdown duration (wallet balance)': ['drawdown_duration'],
    'Drawdown start (wallet balance)': ['drawdown_start'],
    'Drawdown end (wallet balance)': ['drawdown_end'],
    'Sortino (wallet balance)': ['sortino'],
    'Sharpe (wallet balance)': ['sharpe'],
    'Calmar (wallet balance)': ['calmar'],
    'Best Pair': ['best_pair'],
    'Worst Pair': ['worst_pair'],
    'Min. Duration winners': ['winner_holding_min_s'],
    'Avg. Duration winners': ['winner_holding_avg_s'],
    'Max. Duration winners': ['winner_holding_max_s'],
    'Min. Duration Losers': ['loser_holding_min_s'],
    'Avg. Duration Losers': ['loser_holding_avg_s'],
    'Max. Duration Losers': ['loser_holding_max_s'],
    'Min balance (closed trades)': ['csum_min'],
    'Max balance (closed trades)': ['csum_max'],
    'Best single Trade': ['best_single_trade'],
    'Worst single Trade': ['worst_single_trade']
  };
  
  const fieldMappings = isMetric ? metricFieldMappings : strategyFieldMappings;
  
  if (!isMetric && fieldName === 'Trading Mode') {
    const marginMode = data['margin_mode'];
    const tradingMode = data['trading_mode'];
    if (marginMode !== undefined && tradingMode !== undefined) {
      return `${marginMode} ${tradingMode}`;
    } else if (marginMode !== undefined) {
      return String(marginMode);
    } else if (tradingMode !== undefined) {
      return String(tradingMode);
    }
    return 'N/A';
  }
  
  if (!isMetric && fieldName === 'BT execution time') {
    const endTs = data['backtest_run_end_ts'];
    const startTs = data['backtest_run_start_ts'];
    if (endTs !== undefined && startTs !== undefined) {
      const seconds = endTs - startTs;
      return `${seconds} seconds`;
    }
    return 'N/A';
  }
  
  if (!isMetric && fieldName === 'Stoploss') {
    const stoploss = data['stoploss'] || data['stop_loss'];
    if (stoploss !== undefined && stoploss !== null) {
      const value = Number(stoploss);
      if (!isNaN(value)) {
        return `${(value * 100).toFixed(2)}%`;
      }
      return String(stoploss);
    }
    return 'N/A';
  }
  
  if (!isMetric && fieldName === 'ROI') {
    const minimalRoi = data['minimal_roi'];
    if (minimalRoi !== undefined && minimalRoi !== null) {
      if (typeof minimalRoi === 'object') {
        return JSON.stringify(minimalRoi);
      }
      return String(minimalRoi);
    }
    return 'N/A';
  }
  
  if (isMetric && fieldName === 'CAGR') {
    const cagr = data['cagr'];
    if (cagr !== undefined && cagr !== null) {
      const value = Number(cagr);
      if (!isNaN(value)) {
        return `${(value * 100).toFixed(2)}%`;
      }
      return String(cagr);
    }
    return 'N/A';
  }
  
  if (isMetric && fieldName === 'Total Profit') {
    const profitTotal = data['profit_total'];
    if (profitTotal !== undefined && profitTotal !== null) {
      const value = Number(profitTotal);
      if (!isNaN(value)) {
        return `${(value * 100).toFixed(2)}% | ${(value * 1000).toFixed(2)} USDT`;
      }
      return String(profitTotal);
    }
    return 'N/A';
  }
  
  if (isMetric && fieldName === 'Total trades / Daily Avg Trades') {
    const totalTrades = data['total_trades'];
    const tradesPerDay = data['trades_per_day'];
    if (totalTrades !== undefined && tradesPerDay !== undefined) {
      return `${totalTrades} / ${tradesPerDay}`;
    } else if (totalTrades !== undefined) {
      return String(totalTrades);
    }
    return 'N/A';
  }
  
  if (isMetric && fieldName === 'Best day') {
    const bestDay = data['backtest_best_day'];
    const bestDayAbs = data['backtest_best_day_abs'];
    if (bestDay !== undefined && bestDayAbs !== undefined) {
      const value = Number(bestDay);
      const absValue = Number(bestDayAbs);
      if (!isNaN(value) && !isNaN(absValue)) {
        return `${(value * 100).toFixed(2)}% | ${absValue.toFixed(2)} USDT`;
      }
      return `${bestDay} | ${bestDayAbs}`;
    }
    return 'N/A';
  }
  
  if (isMetric && fieldName === 'Worst day') {
    const worstDay = data['backtest_worst_day'];
    const worstDayAbs = data['backtest_worst_day_abs'];
    if (worstDay !== undefined && worstDayAbs !== undefined) {
      const value = Number(worstDay);
      const absValue = Number(worstDayAbs);
      if (!isNaN(value) && !isNaN(absValue)) {
        return `${(value * 100).toFixed(2)}% | ${absValue.toFixed(2)} USDT`;
      }
      return `${worstDay} | ${worstDayAbs}`;
    }
    return 'N/A';
  }
  
  if (isMetric && fieldName === 'Win/Draw/Loss') {
    const wins = data['wins'];
    const draws = data['draws'];
    const losses = data['losses'];
    if (wins !== undefined && draws !== undefined && losses !== undefined) {
      const total = Number(wins) + Number(losses);
      const winRate = total > 0 ? ((Number(wins) / total) * 100).toFixed(2) : '0.00';
      return `${wins} / ${draws} / ${losses} (WR: ${winRate}%)`;
    }
    return 'N/A';
  }
  
  if (isMetric && fieldName === 'Days win/draw/loss') {
    const winningDays = data['winning_days'];
    const drawDays = data['draw_days'];
    const losingDays = data['losing_days'];
    if (winningDays !== undefined && drawDays !== undefined && losingDays !== undefined) {
      return `${winningDays} / ${drawDays} / ${losingDays}`;
    }
    return 'N/A';
  }
  
  if (isMetric && fieldName === 'Max Consecutive Wins / Loss') {
    const maxWins = data['max_consecutive_wins'];
    const maxLosses = data['max_consecutive_losses'];
    if (maxWins !== undefined && maxLosses !== undefined) {
      return `${maxWins} / ${maxLosses}`;
    }
    return 'N/A';
  }
  
  if (isMetric && fieldName === 'Entry/Exit timeouts') {
    const entryTimeouts = data['timedout_entry_orders'];
    const exitTimeouts = data['timedout_exit_orders'];
    if (entryTimeouts !== undefined && exitTimeouts !== undefined) {
      return `${entryTimeouts} / ${exitTimeouts}`;
    }
    return 'N/A';
  }
  
  if (isMetric && fieldName === 'Long / Short') {
    const longCount = data['trade_count_long'];
    const shortCount = data['trade_count_short'];
    if (longCount !== undefined && shortCount !== undefined) {
      return `${longCount} / ${shortCount}`;
    }
    return 'N/A';
  }
  
  if (isMetric && fieldName === 'Total profit Long') {
    const profitLong = data['profit_total_long'];
    if (profitLong !== undefined && profitLong !== null) {
      const value = Number(profitLong);
      if (!isNaN(value)) {
        return `${(value * 100).toFixed(2)}% | ${(value * 1000).toFixed(2)} USDT`;
      }
      return String(profitLong);
    }
    return 'N/A';
  }
  
  if (isMetric && fieldName === 'Total profit Short') {
    const profitShort = data['profit_total_short'];
    if (profitShort !== undefined && profitShort !== null) {
      const value = Number(profitShort);
      if (!isNaN(value)) {
        return `${(value * 100).toFixed(2)}% | ${(value * 1000).toFixed(2)} USDT`;
      }
      return String(profitShort);
    }
    return 'N/A';
  }
  
  if (isMetric && fieldName === 'Market change') {
    const marketChange = data['market_change'];
    if (marketChange !== undefined && marketChange !== null) {
      const value = Number(marketChange);
      if (!isNaN(value)) {
        return `${(value * 100).toFixed(2)}%`;
      }
      return String(marketChange);
    }
    return 'N/A';
  }
  
  if (isMetric && fieldName === 'Max Drawdown (Account)') {
    const maxDrawdown = data['max_relative_drawdown'];
    if (maxDrawdown !== undefined && maxDrawdown !== null) {
      const value = Number(maxDrawdown);
      if (!isNaN(value)) {
        return `${(value * 100).toFixed(2)}%`;
      }
      return String(maxDrawdown);
    }
    return 'N/A';
  }
  
  if (isMetric && fieldName === 'Profit at Drawdown start | end') {
    const high = data['max_drawdown_high'];
    const low = data['max_drawdown_low'];
    if (high !== undefined && low !== undefined) {
      const highVal = typeof high === 'number' || !isNaN(Number(high)) ? formatNumber(high) : high;
      const lowVal = typeof low === 'number' || !isNaN(Number(low)) ? formatNumber(low) : low;
      return `${highVal} USDT | ${lowVal} USDT`;
    }
    return 'N/A';
  }
  
  if (isMetric && fieldName === '-- Wallet Balance metrics --') {
    return '';
  }
  
  if (isMetric && fieldName === 'Max Drawdown (wallet balance)') {
    const maxDrawdown = data['max_relative_drawdown'];
    if (maxDrawdown !== undefined && maxDrawdown !== null) {
      const value = Number(maxDrawdown);
      if (!isNaN(value)) {
        return `${(value * 100).toFixed(2)}%`;
      }
      return String(maxDrawdown);
    }
    return 'N/A';
  }
  
  if (isMetric && fieldName === 'Max Drawdown abs (wallet balance)') {
    const maxDrawdownAbs = data['max_drawdown_abs'];
    if (maxDrawdownAbs !== undefined && maxDrawdownAbs !== null) {
      const value = typeof maxDrawdownAbs === 'number' || !isNaN(Number(maxDrawdownAbs)) ? formatNumber(maxDrawdownAbs) : maxDrawdownAbs;
      return `${value} USDT`;
    }
    return 'N/A';
  }
  
  if (isMetric && fieldName === 'Best Pair') {
    const bestPair = data['best_pair'];
    if (bestPair !== undefined && bestPair !== null) {
      const key = bestPair.key || bestPair.pair || 'N/A';
      const profitTotal = bestPair.profit_total !== undefined ? bestPair.profit_total : 0;
      const value = Number(profitTotal);
      if (!isNaN(value)) {
        return `${key} (+${(value * 100).toFixed(2)}%)`;
      }
      return key;
    }
    return 'N/A';
  }
  
  if (isMetric && fieldName === 'Worst Pair') {
    const worstPair = data['worst_pair'];
    if (worstPair !== undefined && worstPair !== null) {
      const key = worstPair.key || worstPair.pair || 'N/A';
      const profitTotal = worstPair.profit_total !== undefined ? worstPair.profit_total : 0;
      const value = Number(profitTotal);
      if (!isNaN(value)) {
        return `${key} (${(value * 100).toFixed(2)}%)`;
      }
      return key;
    }
    return 'N/A';
  }
  
  if (isMetric && fieldName === 'Best single Trade') {
    const trade = data['best_single_trade'];
    if (trade !== undefined && trade !== null && trade !== 'N/A') {
      const pair = trade.pair || 'N/A';
      const profitRatio = trade.profit_ratio !== undefined ? trade.profit_ratio : 0;
      const profitAbs = trade.profit_abs !== undefined ? trade.profit_abs : 0;
      const ratioValue = Number(profitRatio);
      const absValue = Number(profitAbs);
      if (!isNaN(ratioValue) && !isNaN(absValue)) {
        return `${pair} ${(ratioValue * 100).toFixed(2)}% (${absValue.toFixed(2)} USDT)`;
      }
      return pair;
    }
    return 'N/A';
  }
  
  if (isMetric && fieldName === 'Worst single Trade') {
    const trade = data['worst_single_trade'];
    if (trade !== undefined && trade !== null && trade !== 'N/A') {
      const pair = trade.pair || 'N/A';
      const profitRatio = trade.profit_ratio !== undefined ? trade.profit_ratio : 0;
      const profitAbs = trade.profit_abs !== undefined ? trade.profit_abs : 0;
      const ratioValue = Number(profitRatio);
      const absValue = Number(profitAbs);
      if (!isNaN(ratioValue) && !isNaN(absValue)) {
        return `${pair} ${(ratioValue * 100).toFixed(2)}% (${absValue.toFixed(2)} USDT)`;
      }
      return pair;
    }
    return 'N/A';
  }
  
  const possibleKeys = fieldMappings[fieldName] || [fieldName.toLowerCase().replace(/\s+/g, '_')];
  
  for (const key of possibleKeys) {
    if (data[key] !== undefined && data[key] !== null) {
      const value = data[key];
      if (typeof value === 'number' || !isNaN(Number(value))) {
        return formatNumber(value);
      }
      return String(value);
    }
  }
  
  if (data[fieldName] !== undefined) {
    const value = data[fieldName];
    if (typeof value === 'number' || !isNaN(Number(value))) {
      return formatNumber(value);
    }
    return String(value);
  }
  return 'N/A';
};

const loadBacktestResult = async () => {
  isLoadingResult.value = true;
  try {
    const strategyName = name.value || 'DOUStrategy';
    
    if (savedBacktestResult.value) {
      console.log('使用保存的回测结果数据:', savedBacktestResult.value);
      
      const strategyData = savedBacktestResult.value?.backtest_result?.strategy;
      const rawSettings = strategyData?.[strategyName] || savedBacktestResult.value || {};
      const trades = rawSettings?.trades || [];
      const bestTrade = trades.length > 0 
        ? trades.reduce((prev, curr) => prev.profit_abs > curr.profit_abs ? prev : curr) 
        : null;
      const worstTrade = trades.length > 0 
        ? trades.reduce((prev, curr) => prev.profit_abs < curr.profit_abs ? prev : curr) 
        : null;
      const rawMetrics = {
        ...rawSettings,
        best_single_trade: bestTrade,
        worst_single_trade: worstTrade
      };
      
      console.log('使用策略名:', strategyName);
      console.log('原始策略设置数据:', rawSettings);
      console.log('原始指标数据:', rawMetrics);
      
      const strategySettings = {};
      strategySettingsFields.forEach(field => {
        strategySettings[field] = getFieldValue(rawSettings, field);
      });
      
      const metrics = {};
      metricsFields.forEach(field => {
        metrics[field] = getFieldValue(rawMetrics, field, true);
      });
      
      console.log('映射后的策略设置:', strategySettings);
      console.log('映射后的指标:', metrics);
      
      currentResult.value = {
        strategy: strategyName,
        strategySettings: strategySettings,
        metrics: metrics,
        resultsPerEnterTag: rawSettings?.results_per_enter_tag || {},
        exitReasonSummary: rawSettings?.exit_reason_summary || {},
        mixTagStats: rawSettings?.mix_tag_stats || {},
        resultsPerPair: rawSettings?.results_per_pair || {},
        periodicBreakdown: (rawSettings?.periodic_breakdown?.[activePeriodicTab.value] || []).map(item => ({
          date: item.date,
          trades: item.trades,
          profit_abs: item.profit_abs,
          profit_factor: item.profit_factor,
          wins: item.wins,
          draws: item.draws,
          losses: item.losses
        })),
        trades: rawSettings?.trades || []
      };
      console.log('加载的回测结果:', currentResult.value);
      
      message.success(t('backtest.loaded'));
    }
  } catch (error) {
    console.error('加载回测结果失败:', error);
    message.error(t('backtest.loadFailed'));
    
    currentResult.value = {
      strategy: 'DOUStrategy',
      strategySettings: {
        'Backtesting from': '2025-06-23 00:00:00',
        'Backtesting to': '2026-06-23 00:00:00',
        'Trading Mode': 'Isolated Futures',
        'BT execution time': '8 minutes, 23 seconds',
        'Max open trades': '3',
        'Timeframe': '5m',
        'Timeframe Detail': 'N/A',
        'Timerange': '20250623-20260623',
        'Stoploss': '-5.00%',
        'Trailing Stoploss': 'false',
        'Trail only when offset is reached': 'false',
        'Trailing Stop positive': 'N/A',
        'Trailing stop positive offset': '0',
        'Custom Stoploss': 'false',
        'ROI': '{"0": 0.1,"240": -1}',
        'Use Exit Signal': 'true',
        'Exit profit only': 'false',
        'Exit profit offset': '0',
        'Enable protections': 'false',
        'Starting balance': '1000 USDT',
        'Final balance': '457.154 USDT',
        'Avg. stake amount': '236.388 USDT',
        'Total trade volume': '776378.245 USDT'
      },
      metrics: {
        'Total Profit': '-54.285% | -542.846 USDT',
        'CAGR': '-54.285%',
        'Sortino': '-8.6',
        'Sharpe': '-7.07',
        'Calmar': '-4.97',
        'System Quality Number (SQN)': '-3.33',
        'Expectancy (ratio)': '-0.33 (-0.12)',
        'Profit factor': '0.771',
        'Total trades / Daily Avg Trades': '1642 / 4.5',
        'Best day': '24.30% | 39.606 USDT',
        'Worst day': '-40.85% | -80.788 USDT',
        'Win/Draw/Loss': '780 / 0 / 862 (WR: 47.50%)',
        'Days win/draw/loss': '144 / 70 / 148',
        'Min. Duration winners': '5 minutes',
        'Avg. Duration winners': '3 hours, 30 minutes',
        'Max. Duration winners': '4 hours',
        'Min. Duration Losers': 'N/A',
        'Avg. Duration Losers': '3 hours, 46 minutes',
        'Max. Duration Losers': '4 hours',
        'Max Consecutive Wins / Loss': '9 / 15',
        'Rejected entry signals': '0',
        'Entry/Exit timeouts': '0 / 0',
        'Canceled Trade Entries': '0',
        'Canceled Entry Orders': '0',
        'Replaced Entry Orders': '0',
        'Long / Short': '1020 / 622',
        'Total profit Long': '-48.247% | -482.47 USDT',
        'Total profit Short': '-6.037% | -60.37 USDT',
        'Min/Max balance (closed trades)': '449.223 USDT / 1000 USDT',
        'Min/Max balance (wallet balance)': '449.223 USDT / 1000 USDT',
        'Market change': '-34.684%',
        'Max Drawdown (Account)': '57.141%',
        'Max Drawdown ABS': '598.926 USDT',
        'Drawdown duration': '237 days 00:50:00',
        'Profit at Drawdown start | end': '48.149 USDT | -550.777 USDT',
        'Drawdown start': '2025-10-21 16:15:00',
        'Drawdown end': '2026-06-15 17:05:00',
        '-- Wallet Balance metrics --': '',
        'Max Drawdown (wallet balance)': '57.141%',
        'Max Drawdown abs (wallet balance)': '598.926 USDT',
        'Drawdown duration (wallet balance)': '237 days 00:50:00',
        'Profit at Drawdown start | end (wallet balance)': '48.149 USDT | -550.777 USDT',
        'Drawdown start (wallet balance)': '2025-10-21 16:20:00',
        'Drawdown end (wallet balance)': '2026-06-15 17:10:00',
        'Sortino (wallet balance)': '-2.22',
        'Sharpe (wallet balance)': '-2.54',
        'Calmar (wallet balance)': '-4.97',
        'Best Pair': 'BTC/USDT',
        'Worst Pair': 'ETH/USDT',
        'Best single Trade': '+12.34% | 123.4 USDT',
        'Worst single Trade': '-8.9% | -89 USDT'
      }
    };
  } finally {
    hasAnalysisData.value = true;
    console.log('hasAnalysisData 设置为 true');
    isLoadingResult.value = false;
    activeTab.value = 'analyze';
  }
};

const loadHistoryResult = async (item) => {
  if (isLoadingResult.value) return;
  isLoadingResult.value = true;
  try {
    const result = await getBacktestHistoryResult({
      filename: item.filename,
      strategy: item.strategy
    });
    if (result) {
      savedBacktestResult.value = result;
      currentResult.value = result;
      name.value = item.strategy
       const result1 =  getStrategyDetail(item.strategy)
   if(result1){
       message.success(t('backtest.analyzeSuccess'));
    hasAnalysisData.value = true
   }
    }
  
  
  } catch (error) {
    console.error('加载回测结果失败:', error);
    message.error(t('backtest.analyzeFailed'));
  } finally {
    isLoadingResult.value = false;
  }
};

const handleBacktest = async () => {
  isRunning.value = true;
  try {
    const startDateStr = dateRange.startDate ? dateRange.startDate.format('YYYYMMDD') : '';
    const endDateStr = dateRange.endDate ? dateRange.endDate.format('YYYYMMDD') : '';
    const dateTimerange = startDateStr && endDateStr ? `${startDateStr}-${endDateStr}` : '';

    const params = {
      dry_run_wallet: 1,
      enable_protections: timerangeParams.enableProtections,
      max_open_trades: backtestParams.maxOpenTrades ? parseInt(backtestParams.maxOpenTrades) : 1,
      stake_amount: backtestParams.unlimitedStake ? 'unlimited' : (backtestParams.stakeAmount || 'unlimited'),
      strategy: selectedStrategy.value,
      timeframe: backtestParams.timerange || '3m',
      timerange: dateTimerange || backtestParams.timerange2 || '20260430-20260625',
      timeframe_detail: dateRange.timeframe || backtestParams.timerange2 || '15m'
    };

    if (timerangeParams.enableFreqAI) {
      params.freqai_identifier = timerangeParams.freqaiIdentifier || '1';
      params.freqai_mode = timerangeParams.freqaiMode || 'regression';
    }

    await runBacktest(params);
    message.success('回测接口调用成功');
  } catch (error) {
    console.error('回测失败:', error);
    message.error('回测失败');
    isRunning.value = false;
  }
};
</script>

<style scoped>
.bt-wrap {
  width: 100%;
}

.bt-main {
  display: grid;
  gap: 14px;
}

.bt-card {
  width: 100%;
  background: var(--ft-panel-surface);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.22);
  border-radius: 10px;
  overflow: hidden;
}

.bt-tabs {
  display: flex;
  justify-content: flex-start;
  gap: 4px;
  border-bottom: 1px solid rgba(var(--ft-panel-edge-rgb), 0.2);
  background: rgba(var(--ft-panel-edge-rgb), 0.05);
  padding: 8px;
}

.bt-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: none;
  background: rgba(var(--ft-panel-edge-rgb), 0.1);
  color: var(--text-dim, #8c90a2);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 6px;
}

.bt-tab:hover {
  color: var(--text, #dae2fd);
  background: rgba(var(--ft-panel-edge-rgb), 0.2);
}

.bt-tab--active {
  color: #1a1a1a;
  background: #4edea3;
}

.bt-tab--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.bt-tab--disabled:hover {
  color: #8c90a2;
  background: rgba(var(--ft-panel-edge-rgb), 0.1);
}

.bt-tab-content {
  padding: 20px;
}

.bt-tab-panel {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.bt-section {
  margin-bottom: 20px;
}

.bt-section-title {
  margin: 0 0 14px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text, #e8e9ed);
}

.bt-history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bt-history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: rgba(var(--ft-panel-edge-rgb), 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.bt-history-item:hover {
  background: rgba(var(--ft-panel-edge-rgb), 0.15);
}

.bt-history-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bt-history-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text, #e8e9ed);
}

.bt-history-time {
  font-size: 11px;
  color: var(--text-dim, #6e7591);
}

.bt-history-stats {
  font-size: 14px;
  font-weight: 600;
}

.bt-profit {
  color: #4edea3;
}

.bt-loss {
  color: #ff5b6b;
}

.bt-load-btn {
  padding: 6px 14px;
  background: rgba(78, 222, 163, 0.15);
  border: 1px solid rgba(78, 222, 163, 0.3);
  border-radius: 6px;
  color: #4edea3;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.bt-load-btn:hover {
  background: rgba(78, 222, 163, 0.25);
}

.bt-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-dim, #6e7591);
}

.bt-empty-state p {
  margin-top: 12px;
  font-size: 13px;
}

.bt-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.bt-refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(var(--ft-panel-edge-rgb), 0.1);
  border: none;
  border-radius: 6px;
  color: var(--text-dim, #8c90a2);
  cursor: pointer;
  transition: all 0.2s ease;
}

.bt-refresh-btn:hover {
  color: var(--text, #dae2fd);
  background: rgba(var(--ft-panel-edge-rgb), 0.2);
}

.bt-loading {
  display: flex;
  justify-content: center;
  padding: 40px;
}

.bt-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.bt-table-container {
  overflow-x: auto;
}

.bt-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.bt-table thead th {
  text-align: left;
  padding: 10px 14px;
  background: rgba(var(--ft-panel-edge-rgb), 0.1);
  color: var(--text-dim, #8c90a2);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.bt-table tbody td {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(var(--ft-panel-edge-rgb), 0.1);
  color: var(--text, #e8e9ed);
}

.bt-table tbody tr:hover {
  background: rgba(var(--ft-panel-edge-rgb), 0.05);
}

.bt-table-actions {
  display: flex;
  gap: 8px;
}

.bt-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.bt-action-btn--load {
  background: rgba(78, 222, 163, 0.1);
  color: #4edea3;
}

.bt-action-btn--load:hover {
  background: rgba(78, 222, 163, 0.2);
}

.bt-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.bt-action-btn--delete {
  background: rgba(248, 113, 113, 0.1);
  color: #f87171;
}

.bt-action-btn--delete:hover {
  background: rgba(248, 113, 113, 0.2);
}

.bt-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(var(--ft-panel-edge-rgb), 0.2);
}

@media (max-width: 900px) {
  .bt-grid {
    grid-template-columns: 1fr;
  }
}

.bt-column {
  display: flex;
  flex-direction: column;
}

.bt-input-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bt-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.bt-input {
  flex: 1;
  padding: 10px 12px;
  background: var(--ft-panel-surface-inset);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  border-radius: 6px;
  color: var(--text, #e8e9ed);
  font-size: 12px;
  box-sizing: border-box;
}

.bt-input:focus {
  outline: none;
  border-color: #4edea3;
}

.bt-input::placeholder {
  color: var(--text-dim, #6e7591);
}

.bt-input-label {
  font-size: 12px;
  color: var(--text-dim, #8c90a2);
  min-width: 120px;
}

.bt-remove-btn,
.bt-add-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  background: var(--ft-panel-surface-inset);
  color: var(--text-dim, #8c90a2);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.bt-remove-btn:hover {
  background: rgba(255, 91, 107, 0.15);
  border-color: #ff5b6b;
  color: #ff5b6b;
}

.bt-add-btn:hover {
  background: rgba(78, 222, 163, 0.15);
  border-color: #4edea3;
  color: #4edea3;
}

.bt-time-section {
  background: rgba(var(--ft-panel-edge-rgb), 0.1);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.bt-time-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.bt-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text, #dae2fd);
}

.bt-checkbox-label input[type="checkbox"] {
  width: 14px;
  height: 14px;
  accent-color: #4edea3;
}

.bt-time-input-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bt-time-label {
  font-size: 12px;
  color: var(--text-dim, #8c90a2);
}

.bt-time-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bt-time-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  background: var(--ft-panel-surface-inset);
  color: var(--text, #dae2fd);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.bt-time-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(78, 222, 163, 0.4);
}

.bt-time-input {
  width: 60px;
  padding: 6px 10px;
  background: var(--ft-panel-surface-inset);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  border-radius: 6px;
  color: var(--text, #e8e9ed);
  font-size: 12px;
  text-align: center;
}

.bt-time-input:focus {
  outline: none;
  border-color: #4edea3;
}

.bt-date-range-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: center;
}

.bt-date-input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bt-date-label {
  font-size: 11px;
  color: var(--text-dim, #6e7591);
}

.bt-date-input {
  padding: 6px 10px;
  background: var(--ft-panel-surface-inset);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  border-radius: 6px;
  color: var(--text, #e8e9ed);
  font-size: 12px;
}

.bt-date-input:focus {
  outline: none;
  border-color: #4edea3;
}

.bt-advanced-section {
  background: rgba(var(--ft-panel-edge-rgb), 0.1);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 20px;
}

.bt-advanced-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: inherit;
}

.bt-rotate {
  transform: rotate(180deg);
}

.bt-advanced-content {
  padding: 0 16px 16px;
}

.bt-checkbox-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.bt-actions {
  display: flex;
  justify-content: center;
}

.bt-backtest-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #4edea3;
  color: #0c111d;
}

.bt-backtest-btn:hover:not(:disabled) {
  background: #5ef7b3;
}

.bt-backtest-btn:disabled {
  background: #4a5568;
  cursor: not-allowed;
}

.bt-collapsible-group {
  background: rgba(var(--ft-panel-edge-rgb), 0.1);
  border-radius: 8px;
  margin-bottom: 12px;
  overflow: hidden;
}

.bt-collapsible-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: inherit;
  transition: background 0.2s ease;
}

.bt-collapsible-header:hover {
  background: rgba(var(--ft-panel-edge-rgb), 0.05);
}

.bt-collapsible-content {
  padding: 0 16px 16px;
}

.bt-form-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.bt-form-row:last-child {
  margin-bottom: 0;
}

.bt-form-label {
  font-size: 12px;
  color: var(--text-dim, #8c90a2);
  min-width: 120px;
}

.bt-select {
  flex: 1;
  min-width: 200px;
  max-width: 300px;
  padding: 10px 12px;
  background: var(--ft-panel-surface-inset);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  border-radius: 6px;
  color: var(--text, #e8e9ed);
  font-size: 12px;
  cursor: pointer;
}

.bt-select:focus {
  outline: none;
  border-color: #4edea3;
}

.bt-select option {
  background: var(--ft-panel-surface);
  color: var(--text, #e8e9ed);
}

.bt-use-default-btn {
  padding: 6px 12px;
  background: transparent;
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  border-radius: 4px;
  color: var(--text-dim, #6e7591);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.bt-use-default-btn:hover {
  background: rgba(var(--ft-panel-edge-rgb), 0.1);
  color: var(--text-dim, #8c90a2);
}

.bt-date-section {
  background: rgba(var(--ft-panel-edge-rgb), 0.1);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.bt-date-range-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.bt-date-input-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bt-date-input-wrap .bt-date-label {
  font-size: 11px;
  color: var(--text-dim, #6e7591);
}

.bt-date-label-wrap {
  display: flex;
  align-items: center;
}

.bt-date-timeframe {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.bt-timeframe-label {
  font-size: 12px;
  color: var(--text-dim, #8c90a2);
}

.bt-input-small {
  width: 120px;
  padding: 6px 10px;
  background: var(--ft-panel-surface-inset);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  border-radius: 6px;
  color: var(--text, #e8e9ed);
  font-size: 12px;
}

.bt-input-small:focus {
  outline: none;
  border-color: #4edea3;
}

.bt-summary-section {
  border-top: 1px solid rgba(var(--ft-panel-edge-rgb), 0.2);
  padding-top: 16px;
}

.bt-summary-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.bt-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.bt-btn-primary {
  background: #4edea3;
  color: #0c111d;
}

.bt-btn-primary:hover:not(:disabled) {
  background: #5ef7b3;
}

.bt-btn-secondary {
  background: rgba(var(--ft-panel-edge-rgb), 0.2);
  color: var(--text, #dae2fd);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
}

.bt-btn-secondary:hover:not(:disabled) {
  background: rgba(var(--ft-panel-edge-rgb), 0.3);
}

.bt-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.bt-analysis-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.bt-analysis-strategy {
  font-size: 14px;
  font-weight: 600;
  color: #4edea3;
}

.bt-analysis-cards {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

@media (max-width: 900px) {
  .bt-analysis-cards {
    grid-template-columns: repeat(3, 1fr);
  }
}

.bt-analysis-card {
  background: rgba(var(--ft-panel-edge-rgb), 0.1);
  border-radius: 8px;
  padding: 14px;
  text-align: center;
}

.bt-analysis-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text, #e8e9ed);
  margin-bottom: 4px;
}

.bt-drawdown {
  color: #ff5b6b;
}

.bt-analysis-label {
  font-size: 11px;
  color: var(--text-dim, #6e7591);
}

.bt-analysis-section {
  background: rgba(var(--ft-panel-edge-rgb), 0.1);
  border-radius: 8px;
  padding: 16px;
}

.bt-analysis-subtitle {
  font-size: 13px;
  font-weight: 600;
  color: var(--text, #dae2fd);
  margin: 0 0 12px;
}

.bt-trade-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bt-trade-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: rgba(var(--ft-panel-edge-rgb), 0.1);
  border-radius: 6px;
  border-left: 3px solid;
}

.bt-trade-win {
  border-left-color: #4edea3;
}

.bt-trade-loss {
  border-left-color: #ff5b6b;
}

.bt-trade-info {
  display: flex;
  gap: 12px;
  font-size: 12px;
}

.bt-trade-pair {
  color: var(--text, #e8e9ed);
}

.bt-trade-time {
  color: var(--text-dim, #6e7591);
}

.bt-trade-direction {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-dim, #8c90a2);
}

.bt-trade-profit {
  font-size: 13px;
  font-weight: 600;
}

.bt-visualization {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.bt-chart-section {
  background: rgba(var(--ft-panel-edge-rgb), 0.1);
  border-radius: 8px;
  padding: 16px;
}

.bt-chart-container {
  overflow-x: auto;
}

.bt-chart {
  position: relative;
}

.bt-line-chart {
  width: 100%;
  max-width: 800px;
  height: 300px;
}

.bt-chart-labels {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 11px;
  color: var(--text-dim, #6e7591);
}

.bt-bar-chart {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

.bt-bar-group {
  display: flex;
  gap: 40px;
}

.bt-bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.bt-bar {
  width: 60px;
  border-radius: 6px 6px 0 0;
  transition: height 0.3s ease;
}

.bt-bar-win {
  background: linear-gradient(180deg, #4edea3 0%, rgba(78, 222, 163, 0.3) 100%);
}

.bt-bar-loss {
  background: linear-gradient(180deg, #ff5b6b 0%, rgba(255, 91, 107, 0.3) 100%);
}

.bt-bar-item span {
  font-size: 12px;
  color: var(--text-dim, #8c90a2);
}

.bt-metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

@media (max-width: 900px) {
  .bt-metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.bt-metric-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: rgba(var(--ft-panel-edge-rgb), 0.1);
  border-radius: 8px;
}

.bt-metric-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(78, 222, 163, 0.1);
  border-radius: 8px;
  color: #4edea3;
}

.bt-metric-content {
  display: flex;
  flex-direction: column;
}

.bt-metric-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text, #e8e9ed);
}

.bt-metric-label {
  font-size: 11px;
  color: var(--text-dim, #6e7591);
}

.bt-analysis-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

@media (max-width: 900px) {
  .bt-analysis-grid {
    grid-template-columns: 1fr;
  }
}

.bt-analysis-section {
  background: rgba(var(--ft-panel-edge-rgb), 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.bt-analysis-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-dim, #8c90a2);
  padding: 12px 14px;
  background: rgba(var(--ft-panel-edge-rgb), 0.1);
  margin: 0;
  border-bottom: 1px solid rgba(var(--ft-panel-edge-rgb), 0.15);
}

.bt-settings-table,
.bt-metrics-table {
  padding: 4px 0;
}

.bt-settings-header,
.bt-metrics-header {
  display: flex;
  padding: 8px 14px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-dim, #6e7591);
  border-bottom: 1px solid rgba(var(--ft-panel-edge-rgb), 0.1);
}

.bt-settings-label,
.bt-metrics-label {
  flex: 1;
}

.bt-settings-value,
.bt-metrics-value {
  text-align: right;
  color: var(--text, #e8e9ed);
}

.bt-settings-row,
.bt-metrics-row {
  display: flex;
  padding: 7px 14px;
  font-size: 12px;
  border-bottom: 1px solid rgba(var(--ft-panel-edge-rgb), 0.05);
}

.bt-settings-row:last-child,
.bt-metrics-row:last-child {
  border-bottom: none;
}

.bt-settings-row:hover,
.bt-metrics-row:hover {
  background: rgba(var(--ft-panel-edge-rgb), 0.05);
}

.bt-settings-row .bt-settings-label,
.bt-metrics-row .bt-metrics-label {
  color: var(--text-dim, #8c90a2);
}

.bt-settings-row .bt-settings-value,
.bt-metrics-row .bt-metrics-value {
  color: var(--text, #e8e9ed);
  font-weight: 500;
}

.bt-analysis-tables {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.bt-results-table {
  background: rgba(var(--ft-panel-edge-rgb), 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.bt-table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  background: rgba(var(--ft-panel-edge-rgb), 0.1);
  border-bottom: 1px solid rgba(var(--ft-panel-edge-rgb), 0.15);
}

.bt-table-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-dim, #8c90a2);
  margin: 0;
}

.bt-table-shown {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-dim, #6e7591);
}

.bt-table-select {
  min-width: 200px;
  padding: 4px 8px;
  background: rgba(var(--ft-panel-edge-rgb), 0.2);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  border-radius: 4px;
  color: var(--text, #e8e9ed);
  font-size: 11px;
  cursor: pointer;
}

:deep(.bt-table-select .ant-select-selector) {
  min-width: 200px;
}

.bt-table-container {
  overflow-x: auto;
}

.bt-data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.bt-data-table thead th {
  text-align: right;
  padding: 8px 12px;
  background: rgba(var(--ft-panel-edge-rgb), 0.05);
  color: var(--text-dim, #6e7591);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-size: 11px;
  white-space: nowrap;
}

.bt-data-table thead th:first-child {
  text-align: left;
}

.bt-data-table tbody td {
  text-align: right;
  padding: 7px 12px;
  border-bottom: 1px solid rgba(var(--ft-panel-edge-rgb), 0.05);
  color: var(--text, #e8e9ed);
  white-space: nowrap;
}

.bt-data-table tbody td:first-child {
  text-align: left;
  color: var(--text, #dae2fd);
}

.bt-data-table tbody tr:hover {
  background: rgba(var(--ft-panel-edge-rgb), 0.05);
}

.bt-data-table tbody tr:last-child td {
  border-bottom: none;
}

.bt-data-table tbody tr:last-child td:first-child {
  color: #4edea3;
  font-weight: 600;
}

.bt-periodic-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 14px;
  background: rgba(var(--ft-panel-edge-rgb), 0.05);
  border-bottom: 1px solid rgba(var(--ft-panel-edge-rgb), 0.15);
}

.bt-periodic-tab {
  padding: 6px 12px;
  background: transparent;
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.2);
  border-radius: 4px;
  color: var(--text-dim, #8c90a2);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.bt-periodic-tab:hover {
  background: rgba(var(--ft-panel-edge-rgb), 0.1);
  color: var(--text, #e8e9ed);
}

.bt-periodic-tab.active {
  background: rgba(78, 222, 163, 0.15);
  border-color: rgba(78, 222, 163, 0.4);
  color: #4edea3;
}

.bt-trades-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.bt-trades-table thead th {
  text-align: left;
  padding: 8px 10px;
  background: rgba(var(--ft-panel-edge-rgb), 0.05);
  color: var(--text-dim, #6e7591);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-size: 10px;
  white-space: nowrap;
}

.bt-trades-table tbody td {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 1px solid rgba(var(--ft-panel-edge-rgb), 0.05);
  color: var(--text, #e8e9ed);
  white-space: nowrap;
}

.bt-trades-table tbody tr:hover {
  background: rgba(var(--ft-panel-edge-rgb), 0.05);
}

.bt-profit-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
}

.bt-profit-cell.profit {
  background: rgba(78, 222, 163, 0.15);
  color: #4edea3;
}

.bt-profit-cell.loss {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.bt-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: rgba(var(--ft-panel-edge-rgb), 0.05);
  border-top: 1px solid rgba(var(--ft-panel-edge-rgb), 0.15);
}

.bt-pagination-btn {
  padding: 4px 10px;
  background: rgba(var(--ft-panel-edge-rgb), 0.2);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  border-radius: 4px;
  color: var(--text-dim, #8c90a2);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.bt-pagination-btn:hover:not(:disabled) {
  background: rgba(var(--ft-panel-edge-rgb), 0.3);
  color: var(--text, #e8e9ed);
}

.bt-pagination-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.bt-pagination-info {
  color: var(--text-dim, #8c90a2);
  font-size: 11px;
}

.bt-pagination-dots {
  padding: 4px 8px;
  color: var(--text-dim, #8c90a2);
  font-size: 12px;
}
</style>