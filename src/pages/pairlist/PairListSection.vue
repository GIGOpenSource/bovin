<template>
  <section id="pairlist" class="section">
    <div class="ft-page pl-wrap">
      <header class="ft-page-hero ft-page-hero--data">
        <div class="ft-page-hero__intro">
          <span class="ft-page-hero__kicker ft-kicker-accent" data-i18n="pl.management">交易对管理</span>
          <h1 class="ft-page-hero__title" data-i18n="pl.title">交易对列表</h1>
          <p class="ft-page-hero__desc" data-i18n="pl.desc">管理白名单和黑名单交易对</p>
        </div>
      </header>

      <div class="pl-main">
        <div class="pl-card">
          <h3 class="pl-card-title" data-i18n="pl.methods">白名单方式</h3>
          <div class="pl-methods" id="plMethods">
            <button type="button" class="pl-method-btn active" data-i18n="pl.method.static">静态白名单</button>
          </div>
        </div>

        <div class="pl-card">
          <h3 class="pl-card-title" data-i18n="pl.whitelist">白名单</h3>
          <div class="pl-pairs" id="plWhitelist">
            <span v-for="pair in whitelist" :key="pair" class="pl-pair-tag">{{ pair }}</span>
          </div>
        </div>

        <div class="pl-card pl-card--blacklist">
          <div class="pl-card-header">
            <h3 class="pl-card-title" data-i18n="pl.blacklist">黑名单</h3>
            <div class="pl-card-actions">
              <button type="button" class="pl-action-btn" id="plAddBlacklist" title="添加">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </button>
              <button type="button" class="pl-action-btn" id="plClearBlacklist" title="清空">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="pl-pairs pl-pairs--blacklist" id="plBlacklist">
            <span v-for="pair in blacklist" :key="pair" 
                  class="pl-pair-tag pl-pair-tag--blacklist" 
                  :class="{ 'pl-pair-tag--selected': selectedPairs.includes(pair) }"
                  @click="toggleSelectPair(pair)">
              <svg v-if="selectedPairs.includes(pair)" class="pl-pair-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 13l4 4L19 7"/>
              </svg>
              {{ pair }}
            </span>
          </div>
        </div>
      </div>

      <div id="plModal" class="pl-modal hidden">
        <div class="pl-modal-mask"></div>
        <div class="pl-modal-card">
          <div class="pl-modal-header">
            <h4 data-i18n="pl.modal.title">添加黑名单</h4>
            <button type="button" class="pl-modal-close" id="plModalClose">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="pl-modal-body">
            <input type="text" id="plInput" class="pl-input" data-i18n-placeholder="pl.modal.placeholder" placeholder="如 BTC/USDT 或 BTC/*" />
            <p class="pl-hint" data-i18n="pl.modal.hint">支持通配符匹配，如 BNB/* 匹配所有 BNB 交易对</p>
          </div>
          <div class="pl-modal-footer">
            <button type="button" class="pl-modal-btn pl-modal-btn--cancel" id="plModalCancel" data-i18n="pl.modal.cancel">取消</button>
            <button type="button" class="pl-modal-btn pl-modal-btn--confirm" id="plModalConfirm" data-i18n="pl.modal.confirm">确认</button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pl-wrap {
  width: 100%;
}

.pl-main {
  display: grid;
  gap: 14px;
  max-width: 600px;
}

.pl-card {
  background: var(--ft-panel-surface);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.22);
  border-radius: 10px;
  padding: 16px;
}

.pl-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.pl-card-title {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text, #e8e9ed);
}

.pl-card-header .pl-card-title {
  margin-bottom: 0;
}

.pl-card-actions {
  display: flex;
  gap: 4px;
}

.pl-action-btn {
  width: 28px;
  height: 28px;
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  background: var(--ft-panel-surface-inset);
  color: var(--text, #dae2fd);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.pl-action-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(78, 222, 163, 0.4);
  color: #4edea3;
}

.pl-methods {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pl-method-btn {
  padding: 8px 16px;
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  background: var(--ft-panel-surface-inset);
  color: var(--text, #dae2fd);
  font-size: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pl-method-btn:hover {
  background: rgba(255, 255, 255, 0.05);
}

.pl-method-btn.active {
  background: #4edea3;
  color: #0c111d;
  font-weight: 600;
  border-color: #4edea3;
}

.pl-pairs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pl-pair-tag {
  padding: 6px 12px;
  background: rgba(var(--ft-panel-edge-rgb), 0.15);
  color: var(--text, #e8e9ed);
  font-size: 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.pl-pair-tag:hover {
  background: rgba(255, 255, 255, 0.1);
}

.pl-pair-tag--blacklist {
  background: rgba(255, 91, 107, 0.15);
  color: #ff5b6b;
}

.pl-pair-tag--blacklist:hover {
  background: rgba(255, 91, 107, 0.25);
}

.pl-pair-tag--selected {
  background: #4edea3;
  color: #0c111d;
  font-weight: 600;
}

.pl-pair-check {
  width: 12px;
  height: 12px;
  margin-right: 4px;
  display: inline-block;
  vertical-align: middle;
}

.pl-modal {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pl-modal.hidden {
  display: none;
}

.pl-modal-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
}

.pl-modal-card {
  position: relative;
  background: var(--ft-panel-surface);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  overflow: hidden;
}

.pl-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(var(--ft-panel-edge-rgb), 0.2);
}

.pl-modal-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text, #e8e9ed);
}

.pl-modal-close {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-dim, #8c90a2);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.pl-modal-close:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text, #e8e9ed);
}

.pl-modal-body {
  padding: 16px;
}

.pl-input {
  width: 100%;
  padding: 10px 12px;
  background: var(--ft-panel-surface-inset);
  border: 1px solid rgba(var(--ft-panel-edge-rgb), 0.3);
  border-radius: 8px;
  color: var(--text, #e8e9ed);
  font-size: 13px;
  box-sizing: border-box;
  transition: border-color 0.2s ease;
}

.pl-input:focus {
  outline: none;
  border-color: #4edea3;
}

.pl-input::placeholder {
  color: var(--text-dim, #6e7591);
}

.pl-hint {
  margin: 8px 0 0;
  font-size: 11px;
  color: var(--text-dim, #6e7591);
}

.pl-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 16px;
  border-top: 1px solid rgba(var(--ft-panel-edge-rgb), 0.2);
}

.pl-modal-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pl-modal-btn--cancel {
  background: var(--ft-panel-surface-inset);
  color: var(--text, #dae2fd);
}

.pl-modal-btn--cancel:hover {
  background: rgba(255, 255, 255, 0.05);
}

.pl-modal-btn--confirm {
  background: #4edea3;
  color: #0c111d;
}

.pl-modal-btn--confirm:hover {
  background: #5ef7b3;
}
</style>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { Modal } from "ant-design-vue";
import { getWhitelist, getBlacklist, postBlacklist, deleteBlacklistPairs } from "../../api/positions.js";

const whitelist = ref([]);
const blacklist = ref([]);
const selectedPairs = ref([]);
let disposePairList = null;

const addBlacklist = async (value) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) return;
  
  if (blacklist.value.includes(trimmedValue)) return;
  
  try {
    await postBlacklist({ blacklist: [trimmedValue] });
    blacklist.value.push(trimmedValue);
  } catch (e) {
    console.error("Failed to add blacklist:", e);
    throw e;
  }
};

const toggleSelectPair = (pair) => {
  const index = selectedPairs.value.indexOf(pair);
  if (index > -1) {
    selectedPairs.value.splice(index, 1);
  } else {
    selectedPairs.value.push(pair);
  }
};

const removeSelectedPairs = async () => {
  if (!selectedPairs.value.length) return;
  
  Modal.confirm({
    title: "确认删除",
    content: `确定要删除选中的 ${selectedPairs.value.length} 个交易对吗？`,
    okText: "确定",
    cancelText: "取消",
    okType: "danger",
    maskClosable: true,
    async onOk() {
      try {
        await deleteBlacklistPairs([...selectedPairs.value]);
        for (const pair of selectedPairs.value) {
          const idx = blacklist.value.indexOf(pair);
          if (idx > -1) {
            blacklist.value.splice(idx, 1);
          }
        }
        selectedPairs.value = [];
      } catch (e) {
        console.error("Failed to remove blacklist:", e);
        Modal.error({ title: "删除失败", content: String(e?.message || e) });
      }
    }
  });
};

const clearBlacklist = async () => {
  if (!blacklist.value.length) return;
  
  Modal.confirm({
    title: "确认清空",
    content: "确定要清空所有黑名单交易对吗？",
    okText: "确定",
    cancelText: "取消",
    okType: "danger",
    maskClosable: true,
    async onOk() {
      try {
        await deleteBlacklistPairs([...blacklist.value]);
        blacklist.value = [];
        selectedPairs.value = [];
      } catch (e) {
        console.error("Failed to clear blacklist:", e);
        Modal.error({ title: "清空失败", content: String(e?.message || e) });
      }
    }
  });
};

onMounted(async () => {
  try {
    const res = await getWhitelist();
    whitelist.value = res?.whitelist || [];
  } catch (e) {
    console.error("Failed to fetch whitelist:", e);
  }

  try {
    const res = await getBlacklist();
    blacklist.value = res?.blacklist || [];
  } catch (e) {
    console.error("Failed to fetch blacklist:", e);
  }

  const addBtn = document.getElementById("plAddBlacklist");
  const clearBtn = document.getElementById("plClearBlacklist");
  const modal = document.getElementById("plModal");
  const modalClose = document.getElementById("plModalClose");
  const modalCancel = document.getElementById("plModalCancel");
  const modalConfirm = document.getElementById("plModalConfirm");
  const input = document.getElementById("plInput");

  const openModal = () => {
    modal.classList.remove("hidden");
    input.value = "";
    input.focus();
  };

  const closeModal = () => {
    modal.classList.add("hidden");
    input.value = "";
  };

  const handleConfirm = async () => {
    const value = input.value.trim();
    if (value) {
      try {
        await addBlacklist(value);
        closeModal();
      } catch (e) {
        window.alert("添加失败: " + (e?.message || e));
      }
    }
  };

  addBtn?.addEventListener("click", openModal);
  clearBtn?.addEventListener("click", () => {
    if (selectedPairs.value.length > 0) {
      removeSelectedPairs();
    } else {
      clearBlacklist();
    }
  });
  modalClose?.addEventListener("click", closeModal);
  modalCancel?.addEventListener("click", closeModal);
  modalConfirm?.addEventListener("click", handleConfirm);

  input?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      await handleConfirm();
    } else if (e.key === "Escape") {
      closeModal();
    }
  });

  disposePairList = () => {
    addBtn?.removeEventListener("click", openModal);
    clearBtn?.removeEventListener("click", clearBlacklist);
    modalClose?.removeEventListener("click", closeModal);
    modalCancel?.removeEventListener("click", closeModal);
    modalConfirm?.removeEventListener("click", handleConfirm);
    input?.removeEventListener("keydown", () => {});
  };
});

onUnmounted(() => {
  disposePairList?.();
  disposePairList = null;
});
</script>