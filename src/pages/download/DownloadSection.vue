<template>
  <section id="download" class="section">
    <div class="ft-page dl-wrap">
      <header class="ft-page-hero ft-page-hero--data">
        <div class="ft-page-hero__intro">
          <span class="ft-page-hero__kicker ft-kicker-accent" data-i18n="page.kicker.download">数据下载</span>
          <h1 class="ft-page-hero__title" data-i18n="page.title.download">下载数据</h1>
          <p class="ft-page-hero__desc" data-i18n="page.desc.download">下载交易对历史数据</p>
        </div>
      </header>

      <div class="dl-main">
        <div class="dl-card">
          <div class="dl-grid">
            <div class="dl-column">
              <h3 class="dl-section-title" data-i18n="download.selectPair">选择交易对</h3>
              <div class="dl-input-list">
                <div v-for="(pair, index) in pairs" :key="index" class="dl-input-row">
                  <input type="text" v-model="pairs[index]" class="dl-input" :placeholder="t('download.pairPlaceholder')" />
                  <button type="button" class="dl-remove-btn" @click="removePair(index)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
              <button type="button" class="dl-add-btn" style="margin-top: 10px;" @click="addPair">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </button>
            </div>

            <div class="dl-column">
              <h3 class="dl-section-title" data-i18n="download.importFromTemplate">从模板导入交易对</h3>
              <div class="dl-template-buttons">
                <button type="button" class="dl-template-btn" @click="addTemplatePair('.*/USDT')" data-i18n="download.allUsdtPairs">所有 USDT 交易对</button>
                <button type="button" class="dl-template-btn" @click="addTemplatePair('.*/USDT:USDT')" data-i18n="download.allUsdtFutures">所有 USDT 期货交易对</button>
                <!-- <button type="button" class="dl-template-btn">所有 USDT 期货合约</button>
                <button type="button" class="dl-template-btn dl-template-btn-secondary">使用交易对列表配置</button> -->
              </div>
            </div>

            <div class="dl-column">
              <h3 class="dl-section-title" data-i18n="download.selectTimeframe">选择时间周期</h3>
              <div class="dl-input-list">
                <div v-for="(tf, index) in timeframes" :key="index" class="dl-input-row">
                  <input type="text" v-model="timeframes[index]" class="dl-input" :placeholder="t('download.timeframePlaceholder')" />
                  <button type="button" class="dl-remove-btn" @click="removeTimeframe(index)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
              <button type="button" class="dl-add-btn" style="margin-top: 10px;" @click="addTimeframe">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="dl-time-section">
            <div class="dl-time-header">
              <h3 class="dl-section-title" data-i18n="download.timeSelection">时间选择</h3>
              <label class="dl-checkbox-label">
                <input type="checkbox" v-model="useCustomTimerange" />
                <span data-i18n="download.useCustomTimerange">使用自定义时间范围</span>
              </label>
            </div>
            
            <div v-show="!useCustomTimerange" class="dl-time-input-wrap">
              <span class="dl-time-label" data-i18n="download.downloadDays">下载天数:</span>
              <div class="dl-time-control">
                <button type="button" class="dl-time-btn" @click="decreaseDays">-</button>
                <input type="number" v-model="downloadDays" class="dl-time-input" />
                <button type="button" class="dl-time-btn " @click="increaseDays">+</button>
              </div>
            </div>
            
            <div v-show="useCustomTimerange" class="dl-date-range-wrap">
              <div class="dl-date-input-group">
                <span class="dl-date-label" data-i18n="download.startDate">开始日期</span>
                <a-date-picker
                  v-model="startDate"
                  class="dl-date-picker"
                  :placeholder="'yyyy-mm-dd'"
                  format="YYYY-MM-DD"
                  @change="handleStartDateChange"
                />
              </div>
              <div class="dl-date-input-group">
                <span class="dl-date-label" data-i18n="download.endDate">结束日期</span>
                <a-date-picker
                  v-model="endDate"
                  class="dl-date-picker"
                  :placeholder="'yyyy-mm-dd'"
                  format="YYYY-MM-DD"
                  @change="handleEndDateChange"
                />
              </div>
            </div>
          </div>

          <div class="dl-advanced-section" :class="{ 'dl-advanced-section--expanded': advancedExpanded }">
            <button type="button" class="dl-advanced-header" @click="toggleAdvanced">
              <h3 class="dl-section-title" data-i18n="download.advancedOptions">高级选项</h3>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   :class="{ 'dl-rotate': advancedExpanded }">
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
            <div v-show="advancedExpanded" class="dl-advanced-content">
              <div class="dl-advanced-hint" data-i18n="download.advancedHint">
                高级选项（删除数据、下载交易数据和自定义交易所设置）仅在展开此部分时生效。
              </div>
              <div class="dl-checkbox-list">
                <label class="dl-checkbox-label">
                  <input type="checkbox" v-model="advancedOptions.eraseExisting" />
                  <span data-i18n="download.eraseExisting">删除现有数据</span>
                </label>
                <label class="dl-checkbox-label">
                  <input type="checkbox" v-model="advancedOptions.prependData" />
                  <span data-i18n="download.prependData">下载时前置数据</span>
                </label>
                <label class="dl-checkbox-label">
                  <input type="checkbox" v-model="advancedOptions.downloadTrades" />
                  <span data-i18n="download.downloadTrades">下载交易数据而非 OHLCV 数据</span>
                </label>
              </div>
              <div class="dl-select-wrap">
                <a-select
                  v-model="candleTypes"
                  @change="handleChange"
                  mode="multiple"
                  class="dl-select"
                  :placeholder="candleTypePlaceholder"
                  :show-arrow="false"
                  :options="candleTypeOptions"
                  :option-label-prop="'label'"
                  :custom-tag-render="renderCustomTag"
                ></a-select>
                <span class="dl-select-hint" data-i18n="download.candleTypeHint">当未选择蜡烛类型时，freqtrade 将自动下载常规操作所需的蜡烛类型。</span>
              </div>
              <label class="dl-checkbox-label">
                <input type="checkbox" v-model="advancedOptions.customExchange" />
                <span data-i18n="download.customExchange">自定义交易所</span>
              </label>

              <div v-if="advancedOptions.customExchange" class="dl-custom-exchange">
                <div class="dl-exchange-row">
                  <a-select v-model="customExchangeValue" :default-value="customExchangeValue" class="dl-select" :show-arrow="false">
                    <a-select-option value="binance">Binance</a-select-option>
                    <a-select-option value="binance_us">Binance US</a-select-option>
                    <a-select-option value="binance_usdm">Binance USDⓈ-M</a-select-option>
                  </a-select>
                </div>
                <div class="dl-exchange-row">
                  <div class="dl-static-value">
                    <span data-i18n="download.cash">现金</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="dl-actions">
            <button type="button" class="dl-download-btn" :disabled="isDownloading" @click="handleDownload">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              <span :data-i18n="isDownloading ? 'download.downloading' : 'download.startDownload'">开始下载</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, h } from 'vue';
import { message } from 'ant-design-vue';
import { downloadData, getBackgroundStatus } from '../../api/download.js';
import { i18n } from '../../i18n/index.js';
import { state } from '../../store/state-core.js';

function t(key) {
  const lang = state.lang || "zh-CN";
  return i18n[lang]?.[key] ?? i18n["zh-CN"]?.[key] ?? key;
}

const pairs = ref(['BTC/USDT', 'ETH/USDT']);
const timeframes = ref(['5m', '1h']);
const downloadDays = ref(30);
const useCustomTimerange = ref(false);
const advancedExpanded = ref(false);
const startDate = ref('2026-05-01');
const endDate = ref('');
const isDownloading = ref(false);
const candleTypes = ref([]);
const customExchangeValue = ref('binance');
const candleTypePlaceholder = ref(t('download.selectCandleType'));
const candleTypeOptions = ref([
  { value: 'spot', label: t('download.spot') },
  { value: 'futures', label: t('download.futures') },
  { value: 'funding_rate', label: t('download.fundingRate') },
  { value: 'mark', label: t('download.markPrice') },
  { value: 'index', label: t('download.index') },
  { value: 'premium_index', label: t('download.premiumIndex') }
]);

const advancedOptions = reactive({
  eraseExisting: false,
  prependData: false,
  prependData2: false,
  downloadTrades: false,
  customExchange: false
});

const addPair = () => {
  pairs.value.push('');
};

const removePair = (index) => {
  pairs.value.splice(index, 1);
};

const addTemplatePair = (pair) => {
  pairs.value.push(pair);
};

const addTimeframe = () => {
  timeframes.value.push('');
};

const removeTimeframe = (index) => {
  timeframes.value.splice(index, 1);
};

const increaseDays = () => {
  downloadDays.value++;
};

const decreaseDays = () => {
  if (downloadDays.value > 1) {
    downloadDays.value--;
  }
};

const toggleAdvanced = () => {
  advancedExpanded.value = !advancedExpanded.value;
};

const formatDate = (date) => {
  if (!date) return '';
  if (date instanceof Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }
  if (typeof date === 'string') {
    const match = date.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[1]}${match[2]}${match[3]}`;
    }
  }
  return '';
};
const handleChange = (val) => {
  console.log(val,'val')
  candleTypes.value = val
}
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const pollBackgroundStatus = async (jobId) => {
  while (true) {
    const result = await getBackgroundStatus(jobId);
    
    if (result.status === 'failed') {
      message.error(result.error || t('download.failed'));
      return;
    }
    
    if (!result.running) {
      message.success(t('download.success'));
      return;
    }
    
    await sleep(2000);
  }
};
const handleStartDateChange = (val) => {
  startDate.value = val;
}
const handleEndDateChange = (val) => {
  endDate.value = val;
}
const handleDownload = async () => {
  isDownloading.value = true;
  try {
    const params = {
      pairs: pairs.value.filter(p => p.trim()),
      timeframes: timeframes.value.filter(tf => tf.trim()),
      erase: advancedOptions.eraseExisting,
      download_trades: advancedOptions.downloadTrades,
      prepend_data: advancedOptions.prependData,
      candle_types: candleTypes.value
    };
    console.log(startDate.value,'startDate.value')
    console.log(endDate.value,'endDate.value');
    
    if (useCustomTimerange.value) {
      const startVal = startDate.value instanceof Date ? startDate.value : (startDate.value?.$d || startDate.value);
      const endVal = endDate.value instanceof Date ? endDate.value : (endDate.value?.$d || endDate.value);
      
      if (!startVal) {
        message.error(t('download.pleaseSelectStartDate'));
        return;
      }
      if (!endVal) {
        message.error(t('download.pleaseSelectEndDate'));
        return;
      }
      const start = formatDate(startVal);
      const end = formatDate(endVal);
      params.timerange = `${start}-${end}`;
    } else {
      params.days = downloadDays.value;
    }
    
    if (advancedOptions.customExchange) {
      params.exchange = customExchangeValue.value;
      params.trading_mode = "spot";
    }
    
    const downloadResult = await downloadData(params);
    if (downloadResult && downloadResult.job_id) {
      await pollBackgroundStatus(downloadResult.job_id);
    } else {
      message.success(t('download.success'));
    }
  } catch (error) {
    console.error(t('download.failed'), error);
    message.error(t('download.failed'));
  } finally {
    isDownloading.value = false;
  }
};

function renderCustomTag(props) {
  const option = candleTypeOptions.value.find(opt => opt.value === props.value);
  const label = option ? option.label : props.value;
  return {
    tag: () => h('span', null, label)
  };
}

function handleLangChange() {
  candleTypePlaceholder.value = t('download.selectCandleType');
  candleTypeOptions.value = [
    { value: 'spot', label: t('download.spot') },
    { value: 'futures', label: t('download.futures') },
    { value: 'funding_rate', label: t('download.fundingRate') },
    { value: 'mark', label: t('download.markPrice') },
    { value: 'index', label: t('download.index') },
    { value: 'premium_index', label: t('download.premiumIndex') }
  ];
}

window.addEventListener("bovin-lang-changed", handleLangChange);
</script>

<style scoped>
.dl-wrap {
  width: 100%;
  max-width: 1200px;
}

.dl-main {
  display: grid;
  gap: 14px;
}

.dl-card {
  background: var(--ft-panel-surface);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.22);
  border-radius: 10px;
  padding: 20px;
}

.dl-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(var(--ft-panel-edge-rgb), 0.2);
}

@media (max-width: 900px) {
  .dl-grid {
    grid-template-columns: 1fr;
  }
}

.dl-column {
  display: flex;
  flex-direction: column;
}

.dl-section-title {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text, #e8e9ed);
}

.dl-input-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dl-input-row {
  display: flex;
  gap: 8px;
}

.dl-input {
  flex: 1;
  padding: 10px 12px;
  background: var(--ft-panel-surface-inset);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  border-radius: 6px;
  color: var(--text, #e8e9ed);
  font-size: 12px;
  box-sizing: border-box;
}

.dl-input:focus {
  outline: none;
  border-color: #4edea3;
}

.dl-input::placeholder {
  color: var(--text-dim, #6e7591);
}

.dl-remove-btn,
.dl-add-btn {
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

.dl-remove-btn:hover,
.dl-add-btn:hover {
  background: rgba(255, 91, 107, 0.15);
  border-color: #ff5b6b;
  color: #ff5b6b;
}

.dl-add-btn:hover {
  background: rgba(78, 222, 163, 0.15);
  border-color: #4edea3;
  color: #4edea3;
}

.dl-add-btn {
  margin-top: -4px;
}

.dl-template-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dl-template-btn {
  padding: 10px 12px;
  background: var(--ft-panel-surface-inset);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  border-radius: 6px;
  color: var(--text, #dae2fd);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
}

.dl-template-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(78, 222, 163, 0.4);
}

.dl-template-btn-secondary {
  background: rgba(var(--ft-panel-edge-rgb), 0.15);
  color: var(--text-dim, #8c90a2);
}

.dl-time-section {
  background: rgba(var(--ft-panel-edge-rgb), 0.1);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.dl-time-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.dl-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text, #dae2fd);
}

.dl-checkbox-label input[type="checkbox"] {
  width: 14px;
  height: 14px;
  accent-color: #4edea3;
}

.dl-time-input-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dl-time-label {
  font-size: 12px;
  color: var(--text-dim, #8c90a2);
}

.dl-time-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dl-time-btn {
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

.dl-time-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(78, 222, 163, 0.4);
}

.dl-time-input {
  width: 60px;
  padding: 6px 10px;
  background: var(--ft-panel-surface-inset);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  border-radius: 6px;
  color: var(--text, #e8e9ed);
  font-size: 12px;
  text-align: center;
}

.dl-time-input:focus {
  outline: none;
  border-color: #4edea3;
}

.dl-date-range-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: center;
  justify-content: flex-start;
}

.dl-date-input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dl-date-label {
  font-size: 11px;
  color: var(--text-dim, #6e7591);
}

.dl-date-input-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dl-date-picker :deep(.ant-picker) {
  padding: 6px 10px;
  background: var(--ft-panel-surface-inset);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  border-radius: 6px;
  color: var(--text, #e8e9ed);
  font-size: 12px;
  min-width: 140px;
}

.dl-date-picker :deep(.ant-picker:hover) {
  border-color: rgba(78, 222, 163, 0.4);
}

.dl-date-picker :deep(.ant-picker:focus),
.dl-date-picker :deep(.ant-picker-focused) {
  outline: none;
  border-color: #4edea3;
  box-shadow: 0 0 0 2px rgba(78, 222, 163, 0.1);
}

.dl-date-picker :deep(.ant-picker-input > input) {
  color: var(--text, #e8e9ed);
}

.dl-date-picker :deep(.ant-picker-placeholder) {
  color: var(--text-dim, #6e7591);
}

.dl-date-picker :deep(.ant-picker-suffix) {
  color: var(--text-dim, #8c90a2);
}

.dl-date-picker :deep(.ant-picker-panel) {
  background: var(--ft-panel-surface);
  border-color: rgba(var(--ft-panel-edge-rgb), 0.3);
}

.dl-date-picker :deep(.ant-picker-cell-inner) {
  display: flex;
  align-items: center;
  justify-content: center;
}

.dl-date-picker :deep(.ant-picker-cell-selected .ant-picker-cell-inner) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.dl-date-picker :deep(.ant-picker-cell-selected::before) {
  display: flex;
  align-items: center;
  justify-content: center;
}

.dl-advanced-section {
  background: rgba(var(--ft-panel-edge-rgb), 0.1);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 20px;
}

.dl-advanced-header {
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

.dl-rotate {
  transform: rotate(180deg);
}

.dl-advanced-content {
  padding: 0 16px 16px;
}

.dl-advanced-hint {
  padding: 10px 12px;
  background: rgba(78, 222, 163, 0.1);
  border-radius: 6px;
  font-size: 11px;
  color: #4edea3;
  margin-bottom: 16px;
}

.dl-checkbox-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.dl-select-wrap {
  margin-bottom: 16px;
}

.dl-select {
  width: 100%;
  padding: 10px 12px;
  background: var(--ft-panel-surface-inset);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  border-radius: 6px;
  color: var(--text, #e8e9ed);
  font-size: 12px;
  cursor: pointer;
  margin-bottom: 8px;
}

.dl-select:focus {
  outline: none;
  border-color: #4edea3;
}

.dl-select .ant-select-selector {
  background: var(--ft-panel-surface-inset) !important;
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3) !important;
  border-radius: 6px !important;
  padding: 6px 8px !important;
}

.dl-select .ant-select-selector:hover {
  border-color: rgba(var(--ft-accent-rgb), 0.5) !important;
}

.dl-select .ant-select-selector:focus {
  border-color: #4edea3 !important;
  box-shadow: 0 0 0 2px rgba(78, 222, 163, 0.2) !important;
}

.dl-select .ant-select-selection-item {
  background: rgba(var(--ft-accent-rgb), 0.15) !important;
  border: 1px solid rgba(var(--ft-accent-rgb), 0.35) !important;
  border-radius: 4px !important;
  color: var(--primary) !important;
  font-size: 12px !important;
  padding: 2px 8px !important;
}

.dl-select .ant-select-selection-item-remove {
  color: var(--primary) !important;
  margin-left: 6px !important;
}

.dl-select .ant-select-selection-item-remove:hover {
  color: #ffb3ad !important;
}

.dl-select .ant-select-selection-placeholder {
  color: var(--text-dim) !important;
  font-size: 12px !important;
}

.dl-select-hint {
  font-size: 11px;
  color: var(--text-dim, #6e7591);
}

.dl-custom-exchange {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(var(--ft-panel-edge-rgb), 0.2);
}

.dl-exchange-row {
  margin-bottom: 12px;
}

.dl-exchange-row:last-child {
  margin-bottom: 0;
}

.dl-static-value {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: var(--ft-panel-surface-inset);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  border-radius: 6px;
  color: var(--text, #e8e9ed);
  font-size: 12px;
  min-width: 200px;
}

.dl-actions {
  display: flex;
  justify-content: center;
}

.dl-download-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  background: #4edea3;
  border: none;
  border-radius: 8px;
  color: #0c111d;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dl-download-btn:hover {
  background: #5ef7b3;
}
</style>