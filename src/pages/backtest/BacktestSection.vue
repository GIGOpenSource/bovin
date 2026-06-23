<template>
  <section id="backtest" class="section">
    <div class="ft-page bt-wrap">
      <header class="ft-page-hero ft-page-hero--data">
        <div class="ft-page-hero__intro">
          <span class="ft-page-hero__kicker ft-kicker-accent">回测管理</span>
          <h1 class="ft-page-hero__title">回测管理</h1>
          <p class="ft-page-hero__desc">运行和管理策略回测</p>
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
              :class="{ 'bt-tab--active': activeTab === tab.key }"
              @click="activeTab = tab.key"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path :d="tab.icon" />
              </svg>
              <span>{{ tab.label }}</span>
            </button>
          </div>

          <div class="bt-tab-content">
            <div v-show="activeTab === 'load'" class="bt-tab-panel">
              <div class="bt-section">
                <div class="bt-section-header">
                  <h3 class="bt-section-title">加载历史回测结果</h3>
                  <button type="button" class="bt-refresh-btn" @click="loadHistory">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 8l3.26-3.26A9.75 9.75 0 0 1 12 3a9 9 0 0 1 9 9Z"/>
                      <path d="M16 3h5v5"/>
                      <path d="M21 16v5h-5"/>
                    </svg>
                  </button>
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
                        <th>战略</th>
                        <th>详情</th>
                        <th>回测时间</th>
                        <th>文件名</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(item, index) in historyResults" :key="index">
                        <td>{{ item.strategy }}</td>
                        <td>{{ formatDetail(item) }}</td>
                        <td>{{ formatDateTime(item.backtest_start_time) }}</td>
                        <td>{{ item.filename }}</td>
                        <td class="bt-table-actions">
                          <button type="button" class="bt-action-btn bt-action-btn--load" @click="loadHistoryResult(item)">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M9 5l7 7-7 7"/>
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
              <div class="bt-grid">
                <div class="bt-column">
                  <h3 class="bt-section-title">选择策略</h3>
                  <div class="bt-input-list">
                    <div v-for="(strategy, index) in strategies" :key="index" class="bt-input-row">
                      <input type="text" v-model="strategies[index]" class="bt-input" :placeholder="'策略名称'" />
                      <button type="button" class="bt-remove-btn" @click="removeStrategy(index)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <button type="button" class="bt-add-btn" @click="addStrategy">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                  </button>
                </div>

                <div class="bt-column">
                  <h3 class="bt-section-title">选择交易对</h3>
                  <div class="bt-input-list">
                    <div v-for="(pair, index) in pairs" :key="index" class="bt-input-row">
                      <input type="text" v-model="pairs[index]" class="bt-input" :placeholder="'交易对'" />
                      <button type="button" class="bt-remove-btn" @click="removePair(index)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <button type="button" class="bt-add-btn" @click="addPair">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                  </button>
                </div>

                <div class="bt-column">
                  <h3 class="bt-section-title">选择时间周期</h3>
                  <div class="bt-input-list">
                    <div v-for="(tf, index) in timeframes" :key="index" class="bt-input-row">
                      <input type="text" v-model="timeframes[index]" class="bt-input" :placeholder="'时间周期'" />
                      <button type="button" class="bt-remove-btn" @click="removeTimeframe(index)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <button type="button" class="bt-add-btn" @click="addTimeframe">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div class="bt-time-section">
                <div class="bt-time-header">
                  <h3 class="bt-section-title">时间选择</h3>
                  <label class="bt-checkbox-label">
                    <input type="checkbox" v-model="useCustomTimerange" />
                    <span>使用自定义时间范围</span>
                  </label>
                </div>
                
                <div v-show="!useCustomTimerange" class="bt-time-input-wrap">
                  <span class="bt-time-label">回测天数:</span>
                  <div class="bt-time-control">
                    <button type="button" class="bt-time-btn" @click="decreaseDays">-</button>
                    <input type="number" v-model="backtestDays" class="bt-time-input" />
                    <button type="button" class="bt-time-btn" @click="increaseDays">+</button>
                  </div>
                </div>
                
                <div v-show="useCustomTimerange" class="bt-date-range-wrap">
                  <div class="bt-date-input-group">
                    <span class="bt-date-label">开始日期</span>
                    <input type="date" v-model="startDate" class="bt-date-input" />
                  </div>
                  <div class="bt-date-input-group">
                    <span class="bt-date-label">结束日期</span>
                    <input type="date" v-model="endDate" class="bt-date-input" />
                  </div>
                </div>
              </div>

              <div class="bt-advanced-section" :class="{ 'bt-advanced-section--expanded': advancedExpanded }">
                <button type="button" class="bt-advanced-header" @click="toggleAdvanced">
                  <h3 class="bt-section-title">高级选项</h3>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                       :class="{ 'bt-rotate': advancedExpanded }">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
                <div v-show="advancedExpanded" class="bt-advanced-content">
                  <div class="bt-checkbox-list">
                    <label class="bt-checkbox-label">
                      <input type="checkbox" v-model="advancedOptions.enablePositionSizing" />
                      <span>启用仓位管理</span>
                    </label>
                    <label class="bt-checkbox-label">
                      <input type="checkbox" v-model="advancedOptions.enableProtections" />
                      <span>启用保护机制</span>
                    </label>
                    <label class="bt-checkbox-label">
                      <input type="checkbox" v-model="advancedOptions.useDryRun" />
                      <span>模拟交易模式</span>
                    </label>
                  </div>
                  <div class="bt-input-row">
                    <span class="bt-input-label">初始资金 (USDT)</span>
                    <input type="number" v-model="advancedOptions.initialCapital" class="bt-input" />
                  </div>
                  <div class="bt-input-row">
                    <span class="bt-input-label">手续费 (%)</span>
                    <input type="number" step="0.01" v-model="advancedOptions.feePercent" class="bt-input" />
                  </div>
                </div>
              </div>

              <div class="bt-actions">
                <button type="button" class="bt-backtest-btn" :disabled="isRunning" @click="handleBacktest">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 19V5M8 9l4-4 4 4"/>
                  </svg>
                  <span>{{ isRunning ? '回测中...' : '开始回测' }}</span>
                </button>
              </div>
            </div>

            <div v-show="activeTab === 'analyze'" class="bt-tab-panel">
              <div v-if="currentResult" class="bt-analysis">
                <div class="bt-analysis-header">
                  <h3 class="bt-section-title">回测结果分析</h3>
                  <div class="bt-analysis-strategy">{{ currentResult.strategy }}</div>
                </div>
                
                <div class="bt-analysis-cards">
                  <div class="bt-analysis-card">
                    <div class="bt-analysis-value" :class="currentResult.profit >= 0 ? 'bt-profit' : 'bt-loss'">
                      {{ currentResult.profit >= 0 ? '+' : '' }}{{ currentResult.profit }}%
                    </div>
                    <div class="bt-analysis-label">总收益</div>
                  </div>
                  <div class="bt-analysis-card">
                    <div class="bt-analysis-value">{{ currentResult.winRate }}%</div>
                    <div class="bt-analysis-label">胜率</div>
                  </div>
                  <div class="bt-analysis-card">
                    <div class="bt-analysis-value bt-drawdown">{{ currentResult.maxDrawdown }}%</div>
                    <div class="bt-analysis-label">最大回撤</div>
                  </div>
                  <div class="bt-analysis-card">
                    <div class="bt-analysis-value">{{ currentResult.trades }}</div>
                    <div class="bt-analysis-label">交易次数</div>
                  </div>
                  <div class="bt-analysis-card">
                    <div class="bt-analysis-value">{{ currentResult.winCount }}</div>
                    <div class="bt-analysis-label">盈利交易</div>
                  </div>
                  <div class="bt-analysis-card">
                    <div class="bt-analysis-value">{{ currentResult.lossCount }}</div>
                    <div class="bt-analysis-label">亏损交易</div>
                  </div>
                </div>

                <div class="bt-analysis-section">
                  <h4 class="bt-analysis-subtitle">交易明细</h4>
                  <div class="bt-trade-list">
                    <div 
                      v-for="(trade, index) in currentResult.tradesDetail" 
                      :key="index"
                      class="bt-trade-item"
                      :class="trade.profit >= 0 ? 'bt-trade-win' : 'bt-trade-loss'"
                    >
                      <div class="bt-trade-info">
                        <span class="bt-trade-pair">{{ trade.pair }}</span>
                        <span class="bt-trade-time">{{ trade.time }}</span>
                      </div>
                      <div class="bt-trade-direction">{{ trade.direction }}</div>
                      <div class="bt-trade-profit">{{ trade.profit >= 0 ? '+' : '' }}{{ trade.profit }}%</div>
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
                  <h3 class="bt-section-title">收益曲线</h3>
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
                        <span>第1天</span>
                        <span>第10天</span>
                        <span>第20天</span>
                        <span>第30天</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="bt-chart-section">
                  <h3 class="bt-section-title">收益分布</h3>
                  <div class="bt-bar-chart">
                    <div class="bt-bar-group">
                      <div class="bt-bar-item">
                        <div class="bt-bar bt-bar-win" :style="{ height: winRateHeight + '%' }"></div>
                        <span>盈利</span>
                      </div>
                      <div class="bt-bar-item">
                        <div class="bt-bar bt-bar-loss" :style="{ height: (100 - winRateHeight) + '%' }"></div>
                        <span>亏损</span>
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
                      <div class="bt-metric-label">夏普比率</div>
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
                      <div class="bt-metric-label">索提诺比率</div>
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
                      <div class="bt-metric-label">波动率</div>
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
                      <div class="bt-metric-label">最大盈利</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div v-else class="bt-empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6e7591" stroke-width="1.5">
                  <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
                <p>请先运行回测或加载历史结果</p>
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
import { Modal, message } from 'ant-design-vue';
import { getBacktestHistory, getBacktestHistoryResult, deleteBacktestHistory } from '../../api/backtest.js';

const tabs = [
  { key: 'load', label: '加载结果', icon: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3' },
  { key: 'run', label: '运行回测', icon: 'M12 19V5M8 9l4-4 4 4' },
  { key: 'analyze', label: '分析结果', icon: 'M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z' },
  { key: 'visualize', label: '可视化结果', icon: 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' }
];

const activeTab = ref('run');

const strategies = ref(['SampleStrategy']);
const pairs = ref(['BTC/USDT', 'ETH/USDT']);
const timeframes = ref(['5m', '1h']);
const backtestDays = ref(30);
const useCustomTimerange = ref(false);
const advancedExpanded = ref(false);
const startDate = ref('2026-05-01');
const endDate = ref('');
const isRunning = ref(false);
const isLoadingHistory = ref(false);

const advancedOptions = reactive({
  enablePositionSizing: true,
  enableProtections: false,
  useDryRun: true,
  initialCapital: 10000,
  feePercent: 0.1
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
    title: '确认删除',
    content: '确定要删除这条回测记录吗？',
    okText: '确定',
    cancelText: '取消',
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
});

watch(activeTab, (newTab) => {
  if (newTab === 'load') {
    loadHistory();
  }
});

const currentResult = ref(null);

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

const loadHistoryResult = async (item) => {
  try {
    const result = await getBacktestHistoryResult({
      filename: item.filename,
      strategy: item.strategy
    });
    if (result) {
      currentResult.value = result;
    }
  } catch (error) {
    console.error('加载回测结果失败:', error);
  }
};

const handleBacktest = async () => {
  isRunning.value = true;
  try {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    currentResult.value = {
      strategy: strategies.value[0] || 'SampleStrategy',
      profit: 15.3,
      winRate: 58,
      maxDrawdown: 8.2,
      trades: 120,
      winCount: 70,
      lossCount: 50,
      sharpeRatio: 1.8,
      sortinoRatio: 2.5,
      volatility: 12.3,
      maxProfit: 25.6,
      tradesDetail: [
        { pair: 'BTC/USDT', time: '09:30', direction: 'LONG', profit: 2.5 },
        { pair: 'ETH/USDT', time: '10:15', direction: 'SHORT', profit: -1.2 },
        { pair: 'BTC/USDT', time: '11:00', direction: 'LONG', profit: 3.8 },
        { pair: 'BTC/USDT', time: '14:30', direction: 'LONG', profit: 1.5 },
        { pair: 'ETH/USDT', time: '15:45', direction: 'SHORT', profit: 4.2 }
      ]
    };
    
    activeTab.value = 'analyze';
  } catch (error) {
    console.error('回测失败:', error);
  } finally {
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
  color: #8c90a2;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 6px;
}

.bt-tab:hover {
  color: #dae2fd;
  background: rgba(var(--ft-panel-edge-rgb), 0.2);
}

.bt-tab--active {
  color: #1a1a1a;
  background: #4edea3;
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
  color: #e8e9ed;
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
  color: #e8e9ed;
}

.bt-history-time {
  font-size: 11px;
  color: #6e7591;
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
  color: #6e7591;
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
  color: #8c90a2;
  cursor: pointer;
  transition: all 0.2s ease;
}

.bt-refresh-btn:hover {
  color: #dae2fd;
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
  color: #8c90a2;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.bt-table tbody td {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(var(--ft-panel-edge-rgb), 0.1);
  color: #e8e9ed;
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
  color: #e8e9ed;
  font-size: 12px;
  box-sizing: border-box;
}

.bt-input:focus {
  outline: none;
  border-color: #4edea3;
}

.bt-input::placeholder {
  color: #6e7591;
}

.bt-input-label {
  font-size: 12px;
  color: #8c90a2;
  min-width: 120px;
}

.bt-remove-btn,
.bt-add-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  background: var(--ft-panel-surface-inset);
  color: #8c90a2;
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
  color: #dae2fd;
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
  color: #8c90a2;
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
  color: #dae2fd;
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
  color: #e8e9ed;
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
  color: #6e7591;
}

.bt-date-input {
  padding: 6px 10px;
  background: var(--ft-panel-surface-inset);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  border-radius: 6px;
  color: #e8e9ed;
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
  color: #e8e9ed;
  margin-bottom: 4px;
}

.bt-drawdown {
  color: #ff5b6b;
}

.bt-analysis-label {
  font-size: 11px;
  color: #6e7591;
}

.bt-analysis-section {
  background: rgba(var(--ft-panel-edge-rgb), 0.1);
  border-radius: 8px;
  padding: 16px;
}

.bt-analysis-subtitle {
  font-size: 13px;
  font-weight: 600;
  color: #dae2fd;
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
  color: #e8e9ed;
}

.bt-trade-time {
  color: #6e7591;
}

.bt-trade-direction {
  font-size: 12px;
  font-weight: 600;
  color: #8c90a2;
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
  color: #6e7591;
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
  color: #8c90a2;
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
  color: #e8e9ed;
}

.bt-metric-label {
  font-size: 11px;
  color: #6e7591;
}
</style>