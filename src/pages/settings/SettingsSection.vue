<template>
<section id="settings" class="section">
          <div class="ft-page settings-page">
            <header class="ft-page-hero">
              <div class="ft-page-hero__intro">
                <span class="ft-page-hero__kicker" data-i18n="page.kicker.settings"></span>
                <h1 class="ft-page-hero__title" id="settingsPageHeading" data-i18n="page.title.settings"></h1>
                <p class="ft-page-hero__desc" data-i18n="page.desc.settings"></p>
              </div>
            </header>
            <div class="card settings-page-card" role="region" aria-labelledby="settingsPageHeading">
            <p id="settingsDbSourceHint" class="settings-db-source-hint hidden" role="status"></p>
            <p id="settingsBotContext" class="settings-bot-context hidden" role="status" aria-live="polite"></p>
            <!-- 连接参数由程序自动推断 + 登录凭据；保留节点供 app.js 绑定 ID，不向用户展示 -->
            <div class="settings-block hidden" aria-hidden="true">
              <h4 data-i18n="settings.panelBackend">面板后端</h4>
              <p id="panelBackendBaseHint" class="panel-backend-hint" role="note"></p>
              <div class="settings-form settings-inline">
                <label class="settings-field-stacked">
                  <span class="settings-label-line"><span data-i18n="settings.baseUrlLabel">Bovin Base URL</span> <em class="settings-optional-mark" data-i18n="settings.baseUrlOptionalMark">可选 · 留空为自动</em></span>
                  <input id="baseUrl" name="baseUrl" type="url" value="" autocomplete="url" data-i18n-placeholder="settings.baseUrlPlaceholder" />
                </label>
                <input type="hidden" id="username" name="bovin_api_username" value="" autocomplete="username" />
                <input type="hidden" id="password" name="bovin_api_password" value="" autocomplete="current-password" />
                <p class="settings-field-hint" data-i18n="settings.apiCredsFromLoginHint"></p>
                <div class="settings-panel-backend-save-row">
                  <button type="button" id="savePanelBackend" class="primary" data-i18n="settings.savePanelBackend">保存连接</button>
                </div>
                <label class="settings-field-stacked mt-10">
                  <span class="settings-label-line">
                    <span data-i18n="settings.wsApiV1Label">WebSocket API 根地址</span>
                    <em class="settings-optional-mark" data-i18n="settings.wsApiV1Optional">可选 · 与 REST 同形 …/api/v1</em>
                  </span>
                  <input id="wsApiV1Base" name="wsApiV1Base" type="url" value="" autocomplete="off" data-i18n-placeholder="settings.wsApiV1Placeholder" />
                </label>
                <label class="settings-field-stacked">
                  <span class="settings-label-line">
                    <span data-i18n="settings.wsTokenLabel">ws_token（实时推送）</span>
                    <em class="settings-optional-mark" data-i18n="settings.wsTokenOptional">与 config 中 api_server.ws_token 一致</em>
                  </span>
                  <input id="wsToken" name="wsToken" type="password" autocomplete="off" data-i18n-placeholder="settings.wsTokenPlaceholder" />
                  <p id="wsTokenHint" class="settings-field-hint" data-i18n="settings.wsTokenHint"></p>
                </label>
              </div>
            </div>

            <div class="settings-block mt-14 settings-dual-wrap">
              <div class="settings-dual-tabs" role="tablist" data-i18n-aria="aria.settingsTabs" aria-label="设置分区">
                <button type="button" role="tab" class="settings-dual-tab active" id="settingsTabIntegrations" data-settings-tab="integrations" data-i18n="settings.tab.integrations" aria-selected="true">API 对接映射</button>
                <button type="button" role="tab" class="settings-dual-tab" id="settingsTabStrategy" data-settings-tab="strategy" data-i18n="settings.tab.strategy" aria-selected="false">策略配置</button>
                <button type="button" role="tab" class="settings-dual-tab" id="settingsTabUsers" data-settings-tab="users" data-i18n="settings.tab.users" aria-selected="false">用户管理</button>
              </div>
              <div class="settings-dual-panels">
                <div id="settingsPanelIntegrations" class="settings-tab-panel active" role="tabpanel" aria-labelledby="settingsTabIntegrations">
                  <div class="settings-list-head mt-10">
                    <h4 data-i18n="panel.integrationList">API 对接关系列表</h4>
                    <button type="button" id="addApiBinding" class="ghost" data-i18n="btn.addBinding">新增关系</button>
                  </div>
                  <div id="apiBindingsList" class="bindings-list"></div>
                  <p id="apiBindingsEmptyHint" class="bindings-empty" data-i18n="settings.bindingsUnavailableUpstream">
                    暂无法加载对接关系（服务端未响应）。这不表示数据库里一定没有记录；请先修复 REST/上游连接后刷新本页。
                  </p>
                </div>
                <div id="settingsPanelStrategy" class="settings-tab-panel" role="tabpanel" aria-labelledby="settingsTabStrategy">
                  <div class="settings-strategy-list-block mt-10">
                    <div class="settings-strategy-list-toolbar">
                      <div class="settings-strategy-list-toolbar-text">
                        <h4 class="settings-strategy-list-title" data-i18n="settings.strategyListTitle">策略列表</h4>
                      </div>
                      <button type="button" id="newManualStrategyBtn" class="primary settings-new-strategy-btn" data-i18n="settings.newStrategy">新建</button>
                    </div>
                    <div class="settings-strategy-list-panel strategy-config-list-panel">
                      <div id="manualStrategiesList" class="bindings-list manual-strategies-list strategy-config-list">
                        <article class="binding-row strategy-config-row">
                          <div class="strategy-config-cells">
                            <strong>（未命名策略）</strong>
                            <div class="strategy-config-kv"><span class="strategy-config-k">绑定映射</span><span class="strategy-config-v">—</span></div>
                            <div class="strategy-config-kv"><span class="strategy-config-k">启用收益池化 (%)</span><span class="strategy-config-v">关闭</span></div>
                            <div class="strategy-config-kv"><span class="strategy-config-k">AI 策略</span><span class="strategy-config-v">独立 API</span></div>
                            <div class="strategy-config-kv"><span class="strategy-config-k">策略状态</span><span class="strategy-config-v">关</span></div>
                            <div class="strategy-config-kv"><span class="strategy-config-k">Bovin AI 已绑定</span><span class="strategy-config-v">否</span></div>
                            <div class="strategy-config-kv"><span class="strategy-config-k">最大回撤上限 (%)</span><span class="strategy-config-v">—</span></div>
                            <div class="strategy-config-kv"><span class="strategy-config-k">风险阈值 (%)</span><span class="strategy-config-v">—</span></div>
                            <div class="strategy-config-kv"><span class="strategy-config-k">控制台展示卡片</span><span class="strategy-config-v">开</span></div>
                            <div class="strategy-config-kv"><span class="strategy-config-k">策略卡片网络</span><span class="strategy-config-v">开</span></div>
                          </div>
                          <div class="actions">
                            <button type="button" class="ghost tiny" data-strategy-edit="1">编辑配置</button>
                            <button type="button" class="ghost tiny">删除</button>
                          </div>
                        </article>
                      </div>
                    </div>
                    <div style="height: 10px;"></div>
                    <p class="modal-hint settings-strategy-list-footnote" data-i18n="settings.manualStrategiesHint"></p>
                  </div>
                </div>
                <div id="settingsPanelUsers" class="settings-tab-panel" role="tabpanel" aria-labelledby="settingsTabUsers">
                  <div class="settings-list-head mt-10">
                    <h4 data-i18n="users.title">用户与菜单权限</h4>
                    <button type="button" id="addPanelUserBtn" class="ghost" data-i18n="users.add">新建用户</button>
                  </div>
                  <p id="panelUsersReadonlyHint" class="modal-hint hidden settings-users-hint" data-i18n="users.readonlyHint"></p>
                  <div id="panelUsersList" class="bindings-list panel-users-list"></div>
                  <p id="panelUsersEmptyHint" class="bindings-empty">暂无用户</p>
                </div>
              </div>
            </div>
            </div>
          </div>
        </section>
</template>

<style scoped>
/* settings */

.strategy-config-list-panel {
  border: 1px solid rgba(var(--ft-line-rgb), 0.22);
  border-radius: 10px;
  padding: 10px;
  background: rgba(11, 20, 40, 0.55);
}

.strategy-config-list .strategy-config-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  border: 1px solid rgba(var(--ft-line-rgb), 0.22);
  border-radius: 12px;
  padding: 9px 12px;
  background: rgba(24, 35, 61, 0.78);
}

.strategy-config-cells {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: 130px repeat(10, minmax(64px, 1fr));
  gap: 8px 10px;
  align-items: start;
  font-size: 10px;
  color: #aeb9db;
}

.strategy-config-cells strong {
  color: #f0f4ff;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  align-self: center;
  display: inline-flex;
  align-items: center;
  min-height: 32px;
}

.strategy-config-cells span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.strategy-config-kv {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.strategy-config-k {
  font-size: 10px;
  color: #8ea0cf;
}

.strategy-config-v {
  font-size: 11px;
  color: #dbe4ff;
}

.strategy-config-list .strategy-config-row .actions {
  display: inline-flex;
  gap: 8px;
  flex-shrink: 0;
}

.strategy-config-list .strategy-config-row .actions .ghost.tiny {
  min-height: 26px;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 11px;
}
</style>

<script>
export * from "../../api/settings.js";
</script>

<script setup>
import { onMounted, onUnmounted } from "vue";

let disposeTabs = null;
let disposeApiBindingModal = null;
let editingBindingRow = null;
let disposeStrategyModal = null;
let disposeUserModal = null;

const esc = (v) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

onMounted(() => {
  const tabs = Array.from(document.querySelectorAll(".settings-dual-tab"));
  const panels = Array.from(document.querySelectorAll(".settings-tab-panel"));
  const bindingsList = document.getElementById("apiBindingsList");
  const bindingsHint = document.getElementById("apiBindingsEmptyHint");
  const addApiBindingBtn = document.getElementById("addApiBinding");
  const apiBindingModal = document.getElementById("apiBindingModal");
  const closeApiBindingBtn = document.getElementById("closeApiBindingModal");
  const apiBindingMask = apiBindingModal?.querySelector(".modal-mask") || null;
  const newStrategyBtn = document.getElementById("newManualStrategyBtn");
  const strategyModal = document.getElementById("strategyMemoModal");
  const closeStrategyModalBtn = document.getElementById("closeStrategyMemoModal");
  const strategyModalMask = strategyModal?.querySelector(".modal-mask") || null;
  const strategyModalTitle = document.getElementById("strategyMemoModalTitle");
  const addPanelUserBtn = document.getElementById("addPanelUserBtn");
  const panelUserModal = document.getElementById("panelUserModal");
  const closePanelUserModalBtn = document.getElementById("closePanelUserModal");
  const panelUserMask = panelUserModal?.querySelector(".modal-mask") || null;
  const panelUsersList = document.getElementById("panelUsersList");
  const panelUsersEmptyHint = document.getElementById("panelUsersEmptyHint");
  if (!tabs.length || !panels.length) return;

  const activate = (key) => {
    for (const tab of tabs) {
      const on = tab.getAttribute("data-settings-tab") === key;
      tab.classList.toggle("active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    }
    for (const panel of panels) {
      const id = panel.id || "";
      const on = id === `settingsPanel${String(key).charAt(0).toUpperCase()}${String(key).slice(1)}`;
      panel.classList.toggle("active", on);
    }
  };

  const onClick = (e) => {
    const tab = e.target instanceof Element ? e.target.closest(".settings-dual-tab[data-settings-tab]") : null;
    if (!tab) return;
    const key = tab.getAttribute("data-settings-tab");
    if (!key) return;
    activate(key);
  };

  for (const tab of tabs) tab.addEventListener("click", onClick);
  activate("integrations");

  const syncBindingsHint = () => {
    if (!bindingsList || !bindingsHint) return;
    const hasRows = bindingsList.querySelector(".binding-row");
    bindingsHint.classList.toggle("hidden", Boolean(hasRows));
  };
  syncBindingsHint();
  const mo = bindingsList
    ? new MutationObserver(() => syncBindingsHint())
    : null;
  mo?.observe(bindingsList, { childList: true, subtree: true });

  const syncUsersHint = () => {
    if (!panelUsersList || !panelUsersEmptyHint) return;
    const hasRows = panelUsersList.querySelector(".binding-row");
    panelUsersEmptyHint.classList.toggle("hidden", Boolean(hasRows));
  };
  syncUsersHint();
  const usersMo = panelUsersList
    ? new MutationObserver(() => syncUsersHint())
    : null;
  usersMo?.observe(panelUsersList, { childList: true, subtree: true });

  disposeTabs = () => {
    for (const tab of tabs) tab.removeEventListener("click", onClick);
    mo?.disconnect();
    usersMo?.disconnect();
  };

  if (addApiBindingBtn && apiBindingModal) {
    const openModal = () => apiBindingModal.classList.remove("hidden");
    const closeModal = () => apiBindingModal.classList.add("hidden");
    const saveBtn = document.getElementById("saveApiBindingModal");
    const onEsc = (e) => {
      if (e.key === "Escape") closeModal();
    };
    const onSave = () => {
      if (!bindingsList) return;
      const label = document.getElementById("mBindingLabel")?.value?.trim() || "";
      const exName =
        document.getElementById("mExchangeName")?.value?.trim() ||
        document.getElementById("mExchangeRestBaseUrl")?.value?.trim() ||
        "binance";
      const exKey = document.getElementById("mExchangeApiKey")?.value?.trim() || "";
      const llmProvEl = document.getElementById("mLlmProvider");
      const llmProvider = (llmProvEl && "value" in llmProvEl ? String(llmProvEl.value) : "").trim() || "deepseek";
      const llmModel = document.getElementById("mLlmModel")?.value?.trim() || "";
      const enabled = document.getElementById("mBindingEnabled")?.checked !== false;

      const idx = bindingsList.querySelectorAll(".binding-row").length + 1;
      const title = label || `映射 #${idx}`;
      const enabledText = enabled ? "生效" : "停用";
      const exKeyText = exKey ? exKey : "未填写";
      const llmText = llmModel ? `${llmProvider} / ${llmModel}` : llmProvider;

      const row = editingBindingRow || document.createElement("article");
      row.className = "binding-row";
      row.dataset.bindingLabel = title;
      row.dataset.exchangeName = exName;
      row.dataset.exchangeApiKey = exKey;
      row.dataset.llmProvider = llmProvider;
      row.dataset.llmModel = llmModel;
      row.dataset.bindingEnabled = enabled ? "1" : "0";
      row.innerHTML = `
        <div class="binding-row-head">
          <div class="binding-row-head-main">
            <strong class="binding-row-title">${esc(title)}</strong>
          </div>
          <div class="binding-row-head-tools">
            <label class="binding-row-effective">
              <input type="checkbox" data-binding-enabled-toggle="1" ${enabled ? "checked" : ""} />
              <span data-binding-enabled-text="1">${esc(enabledText)}</span>
            </label>
            <div class="actions">
              <button type="button" class="ghost tiny" data-binding-edit="1">编辑</button>
              <button type="button" class="ghost tiny" data-binding-delete="1">删除</button>
            </div>
          </div>
        </div>
        <div class="binding-summary">
          <div class="binding-kv"><span class="binding-kv-k">交易所</span><span class="binding-kv-v">${esc(exName)}</span></div>
          <div class="binding-kv"><span class="binding-kv-k">API KEY</span><span class="binding-kv-v">${esc(exKeyText)}</span></div>
          <div class="binding-kv"><span class="binding-kv-k">语言模型</span><span class="binding-kv-v">${esc(llmText)}</span></div>
        </div>
      `;
      if (!editingBindingRow) bindingsList.prepend(row);
      editingBindingRow = null;
      closeModal();
    };
    const onListAction = (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target || !bindingsList) return;
      const row = target.closest(".binding-row");
      if (!row) return;
      const toggle = target.closest("[data-binding-enabled-toggle='1']");
      if (toggle) {
        const checked = Boolean(toggle.checked);
        row.dataset.bindingEnabled = checked ? "1" : "0";
        const txt = row.querySelector("[data-binding-enabled-text='1']");
        if (txt) txt.textContent = checked ? "生效" : "停用";
        return;
      }
      const delBtn = target.closest("[data-binding-delete='1']");
      if (delBtn) {
        row.remove();
        return;
      }
      const editBtn = target.closest("[data-binding-edit='1']");
      if (!editBtn) return;
      editingBindingRow = row;
      const setVal = (id, v) => {
        const el = document.getElementById(id);
        if (!el) return;
        if ("value" in el) el.value = String(v ?? "");
        try {
          window.dispatchEvent(
            new CustomEvent("bovin-form-patch", { detail: { id, value: String(v ?? "") } })
          );
        } catch {
          /* ignore */
        }
      };
      setVal("mBindingLabel", row.dataset.bindingLabel || "");
      setVal("mExchangeName", row.dataset.exchangeName || "");
      setVal("mExchangeApiKey", row.dataset.exchangeApiKey || "");
      setVal("mLlmProvider", row.dataset.llmProvider || "deepseek");
      setVal("mLlmModel", row.dataset.llmModel || "");
      const enabledEl = document.getElementById("mBindingEnabled");
      if (enabledEl && "checked" in enabledEl) enabledEl.checked = row.dataset.bindingEnabled !== "0";
      openModal();
    };
    addApiBindingBtn.addEventListener("click", openModal);
    closeApiBindingBtn?.addEventListener("click", closeModal);
    apiBindingMask?.addEventListener("click", closeModal);
    saveBtn?.addEventListener("click", onSave);
    bindingsList?.addEventListener("click", onListAction);
    window.addEventListener("keydown", onEsc);

    disposeApiBindingModal = () => {
      addApiBindingBtn.removeEventListener("click", openModal);
      closeApiBindingBtn?.removeEventListener("click", closeModal);
      apiBindingMask?.removeEventListener("click", closeModal);
      saveBtn?.removeEventListener("click", onSave);
      bindingsList?.removeEventListener("click", onListAction);
      window.removeEventListener("keydown", onEsc);
    };
  }

  if (strategyModal) {
    const openStrategyModal = (mode) => {
      strategyModal.classList.remove("hidden");
      if (strategyModalTitle) {
        strategyModalTitle.textContent = mode === "new" ? "新增策略（完整条目）" : "编辑策略（完整条目）";
      }
    };
    const closeStrategyModal = () => strategyModal.classList.add("hidden");
    const onNewStrategy = () => openStrategyModal("new");
    const onStrategyListClick = (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
      const editBtn = target.closest("[data-strategy-edit='1']");
      if (editBtn) openStrategyModal("edit");
    };
    const onEscStrategy = (e) => {
      if (e.key === "Escape") closeStrategyModal();
    };

    newStrategyBtn?.addEventListener("click", onNewStrategy);
    closeStrategyModalBtn?.addEventListener("click", closeStrategyModal);
    strategyModalMask?.addEventListener("click", closeStrategyModal);
    document.getElementById("manualStrategiesList")?.addEventListener("click", onStrategyListClick);
    window.addEventListener("keydown", onEscStrategy);

    disposeStrategyModal = () => {
      newStrategyBtn?.removeEventListener("click", onNewStrategy);
      closeStrategyModalBtn?.removeEventListener("click", closeStrategyModal);
      strategyModalMask?.removeEventListener("click", closeStrategyModal);
      document.getElementById("manualStrategiesList")?.removeEventListener("click", onStrategyListClick);
      window.removeEventListener("keydown", onEscStrategy);
    };
  }

  if (addPanelUserBtn && panelUserModal) {
    const openUserModal = () => panelUserModal.classList.remove("hidden");
    const closeUserModal = () => panelUserModal.classList.add("hidden");
    const onEscUser = (e) => {
      if (e.key === "Escape") closeUserModal();
    };
    addPanelUserBtn.addEventListener("click", openUserModal);
    closePanelUserModalBtn?.addEventListener("click", closeUserModal);
    panelUserMask?.addEventListener("click", closeUserModal);
    window.addEventListener("keydown", onEscUser);

    disposeUserModal = () => {
      addPanelUserBtn.removeEventListener("click", openUserModal);
      closePanelUserModalBtn?.removeEventListener("click", closeUserModal);
      panelUserMask?.removeEventListener("click", closeUserModal);
      window.removeEventListener("keydown", onEscUser);
    };
  }
});

onUnmounted(() => {
  disposeTabs?.();
  disposeTabs = null;
  disposeApiBindingModal?.();
  disposeApiBindingModal = null;
  disposeStrategyModal?.();
  disposeStrategyModal = null;
  disposeUserModal?.();
  disposeUserModal = null;
});
</script>
