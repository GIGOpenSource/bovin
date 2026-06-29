<template>
  <section id="performance" class="section">
    <div class="ft-page pf-wrap">
      <header class="ft-page-hero ft-page-hero--data">
        <div class="ft-page-hero__intro">
          <span class="ft-page-hero__kicker ft-kicker-accent" data-i18n="page.kicker.data"></span>
          <h1 class="ft-page-hero__title" data-i18n="pf.title">绩效统计</h1>
          <p class="ft-page-hero__desc" data-i18n="page.desc.data"></p>
        </div>
        <div class="ft-page-hero__aside">
          <div class="pf-performance-tabs">
            <button 
              v-for="tab in tabs" 
              :key="tab.key"
              type="button" 
              class="pf-performance-tab"
              :class="{ active: activeTab === tab.key }"
              @click="switchTab(tab.key)"
              :data-i18n="tab.i18nKey"
            >{{ tab.label }}</button>
          </div>
        </div>
      </header>

      <div class="pf-main">
        <div class="pf-performance">
          <div class="pf-performance-table">
            <table>
              <thead>
                <tr>
                  <th :data-i18n="`pf.header.${activeTab}`">{{ currentHeader }}</th>
                  <th data-i18n="pf.header.profitPct">收益率</th>
                  <th data-i18n="pf.header.profitUsdt">收益 USDT</th>
                  <th data-i18n="pf.header.count">数量</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in tableData" :key="index">
                  <td>{{ getFirstColumn(item) }}</td>
                  <td :class="getProfitClass(item)">{{ getProfitPct(item) }}</td>
                  <td>{{ item.profit_abs != null ? item.profit_abs : "-" }}</td>
                  <td>{{ item.count != null ? item.count : "-" }}</td>
                </tr>
                <tr v-if="tableData.length === 0">
                  <td colspan="4" style="text-align: center; color: #8c90a2;">暂无数据</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pf-wrap {
  width: 100%;
}

.pf-main {
  display: grid;
  gap: var(--ft-page-stack-gap);
  min-width: 0;
}

.pf-performance {
  background: var(--ft-panel-surface);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.22);
  margin-bottom: 16px;
  border-radius: 8px;
  overflow: hidden;
}

.pf-performance-tabs {
  display: flex;
  gap: 6px;
}

.pf-performance-tab {
  padding: 6px 14px;
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  background: var(--ft-panel-surface-inset);
  color: var(--text, #dae2fd);
  font-size: 11px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pf-performance-tab:hover {
  background: rgba(255, 255, 255, 0.05);
}

.pf-performance-tab.active {
  color: #4edea3;
  border-color: rgba(78, 222, 163, 0.42);
  background: rgba(78, 222, 163, 0.12);
}

.pf-performance-table {
  padding: 8px 14px;
}

.pf-performance-table table {
  width: 100%;
  border-collapse: collapse;
}

.pf-performance-table th {
  text-align: left;
  padding: 8px 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim, #8c90a2);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.pf-performance-table td {
  padding: 10px 0;
  font-size: 12px;
  color: var(--text, #e8e9ed);
  border-bottom: 1px solid rgba(var(--ft-panel-edge-rgb), 0.1);
}

.pf-performance-table td.positive {
  color: #0d8f5c;
}

.pf-performance-table td.negative {
  color: #c53b30;
}
</style>

<script setup>
import { ref, computed, onMounted } from "vue";
import { getPerformance, getEntries, getExits, getMixTags } from "../../api/performance.js";

const tabs = [
  { key: "performance", label: "绩效统计", i18nKey: "pf.performance" },
  { key: "entries", label: "进入标签", i18nKey: "pf.entries" },
  { key: "exits", label: "退出原因", i18nKey: "pf.exits" },
  { key: "mixTag", label: "混合标签", i18nKey: "pf.mixTag" }
];

const headerNames = {
  performance: "Pair",
  entries: "Enter tag",
  exits: "Exit Reason",
  mixTag: "Mix Tag"
};

const apiMap = {
  performance: getPerformance,
  entries: getEntries,
  exits: getExits,
  mixTag: getMixTags
};

const activeTab = ref("performance");
const tableData = ref([]);

const currentHeader = computed(() => headerNames[activeTab.value] || "Pair");

const getFirstColumn = (item) => {
  switch (activeTab.value) {
    case "performance":
      return item.pair || "-";
    case "entries":
      return item.enter_tag || "-";
    case "exits":
      return item.reason || "-";
    case "mixTag":
      return item.mix_tag || "-";
    default:
      return "-";
  }
};

const getProfitPct = (item) => {
  const profitPct = item.profit_pct != null ? item.profit_pct : item.profit_ratio;
  return profitPct != null ? profitPct : "-";
};

const getProfitClass = (item) => {
  const profitPct = item.profit_pct != null ? item.profit_pct : item.profit_ratio;
  return (profitPct || 0) >= 0 ? "positive" : "negative";
};

const fetchData = async (tabName) => {
  const apiFn = apiMap[tabName];
  if (!apiFn) return;
  
  try {
    const response = await apiFn();
    let data = response;
    if (response && response.data) {
      data = response.data;
    }
    if (Array.isArray(data)) {
      tableData.value = data;
    } else {
      tableData.value = [];
      console.warn(`Unexpected data format for ${tabName}:`, data);
    }
  } catch (error) {
    console.error(`Failed to fetch ${tabName} data:`, error);
    tableData.value = [];
  }
};

const switchTab = (tabName) => {
  activeTab.value = tabName;
  fetchData(tabName);
};

onMounted(() => {
  fetchData("performance");
});
</script>
