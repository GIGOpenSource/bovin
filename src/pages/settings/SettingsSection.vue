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

<style>
/* settings */

.settings-page .bindings-list .binding-row:not(.api-binding-card) {
  margin-block: 4px;
  padding-top: 12px;
  padding-bottom: 12px;
}

/* API 对接映射：卡片 + 字段块（与设置中心视觉稿一致） */
#apiBindingsList.bindings-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.settings-page .binding-row.api-binding-card {
  margin-block: 0;
  padding: 0;
  border: 1px solid rgba(var(--ft-line-rgb), 0.22);
  border-radius: 14px;
  background: rgba(16, 24, 44, 0.96);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  overflow: hidden;
}

.api-binding-card__inner {
  padding: 14px 16px 16px;
}

.api-binding-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(var(--ft-line-rgb), 0.16);
}

.api-binding-card__title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #f0f4ff;
  font-family: var(--ft-font-display, inherit);
}

.api-binding-card__head .binding-row-head-tools {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 10px;
  justify-content: flex-end;
}

.api-binding-card__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  align-items: stretch;
}

@media (max-width: 900px) {
  .api-binding-card__grid {
    grid-template-columns: 1fr;
  }
}

.api-binding-field {
  min-width: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(10, 16, 32, 0.85);
  border: 1px solid rgba(var(--ft-line-rgb), 0.2);
}

.api-binding-field__label {
  display: block;
  font-size: 11px;
  font-weight: 500;
  color: #8ea0cf;
  margin-bottom: 6px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.api-binding-field__value {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #f5f8ff;
  line-height: 1.35;
  word-break: break-word;
}

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
  align-items: center;
  font-size: 10px;
  color: #aeb9db;
}

.strategy-config-cells .strategy-config-name {
  color: #f0f4ff;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  align-self: center;
  display: flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
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
  align-content: center;
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
  min-height: 36px;
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 12px;
}

.panel-user-actions .ghost.tiny {
  min-height: 36px;
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 12px;
}
</style>

<script>
export * from "../../api/settings.js";
</script>

<script setup>
import { createVNode, onMounted, onUnmounted } from "vue";
import { Modal, message } from "ant-design-vue";
import { ExclamationCircleFilled } from "@ant-design/icons-vue";
import { i18n } from "../../i18n/index.js";
import { refreshStrategyConsoleAfterPrefs } from "../../app.js";
import {
  deletePanelUser,
  deletePanelApiBinding,
  getPanelPreferences,
  getPanelUsers,
  patchPanelUser,
  postPanelPreferences,
  postPanelUser
} from "../../api/settings.js";
import {
  deletePanelStrategySlot,
  getPanelStrategySlots,
  patchPanelStrategySlot,
  postPanelStrategySlot
} from "../../api/overview.js";
import {
  extractPanelStrategyListPayload,
  panelStrategySlotRowName,
  rowServerSlotId,
  slotRowDetailJsonText,
  slotRowMmlText
} from "../../utils/data-strategies-list.js";
import {
  state,
  defaultStrategyEntry,
  normalizeStrategyEntries,
  normalizeStrategySlots,
  persistProfileToLocalStorage,
  syncStrategyEntriesDerivedState
} from "../../store/state-core.js";

let disposeTabs = null;
let disposeApiBindingModal = null;
let editingBindingRow = null;
let disposeStrategyModal = null;
let disposeUserModal = null;
let editingPanelUser = null;

const esc = (v) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function readFieldStr(id) {
  const el = document.getElementById(id);
  if (!el || !("value" in el)) return "";
  return String(el.value ?? "");
}

function readFieldNumOrNull(id) {
  const el = document.getElementById(id);
  if (!el || !("value" in el)) return null;
  const s = String(el.value ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function readCheckbox(id) {
  const el = document.getElementById(id);
  return Boolean(el && "checked" in el && el.checked);
}

function tS(key) {
  const lang = state.lang || "zh-CN";
  return i18n[lang]?.[key] ?? i18n["zh-CN"]?.[key] ?? key;
}

function showWarn(content) {
  message.open({
    type: "warning",
    content: String(content || ""),
    icon: createVNode(ExclamationCircleFilled, {
      style: { color: "rgb(248, 113, 113)" }
    })
  });
}

function showError(content) {
  message.error(String(content || ""));
}

function pickFirst(o, keys) {
  if (!o || typeof o !== "object") return undefined;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(o, k) && o[k] != null) return o[k];
  }
  return undefined;
}

function normalizePermValue(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "edit" || s === "write" || s === "rw") return "edit";
  if (s === "hidden" || s === "none" || s === "deny") return "hidden";
  return "read";
}

function normalizeUserMenuPermissions(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    overview: normalizePermValue(src.overview ?? src.Overview),
    positions: normalizePermValue(src.positions ?? src.Positions),
    control: normalizePermValue(src.control ?? src.Control),
    data: normalizePermValue(src.data ?? src.Data),
    settings: normalizePermValue(src.settings ?? src.Settings),
    monitor: normalizePermValue(src.monitor ?? src.Monitor),
    api: normalizePermValue(src.api ?? src.Api)
  };
}

function extractPanelUsersList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const o = payload;
  for (const k of ["users", "items", "data", "rows", "results", "list"]) {
    const v = o[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const nested = extractPanelUsersList(v);
      if (nested.length) return nested;
    }
  }
  return [];
}

function mapPanelUserRow(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const id = pickFirst(o, ["id", "user_id", "userId", "uid", "username"]);
  const username = String(pickFirst(o, ["username", "user_name", "name", "login", "account"]) ?? "").trim();
  const permsRaw =
    pickFirst(o, ["menu_permissions", "menuPermissions", "permissions", "menus", "menu_perm"]) ?? {};
  return {
    id: String(id ?? username).trim(),
    username,
    perms: normalizeUserMenuPermissions(permsRaw),
    raw: o
  };
}

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
    let editingBindingId = "";
    const openModal = () => apiBindingModal.classList.remove("hidden");
    const closeModal = () => apiBindingModal.classList.add("hidden");

    const resetApiBindingModalForm = () => {
      const clearIds = [
        "mBindingLabel",
        "mLlmBaseUrl",
        "mLlmApiKey",
        "mLlmModel",
        "mExchangeRestBaseUrl",
        "mExchangeApiKey",
        "mExchangeApiSecret",
        "mExchangePassphrase",
        "mExchangeName",
      ];
      for (const id of clearIds) {
        const el = document.getElementById(id);
        if (el && "value" in el) el.value = "";
      }
      const enabledEl = document.getElementById("mBindingEnabled");
      if (enabledEl instanceof HTMLInputElement && enabledEl.type === "checkbox") enabledEl.checked = true;
      const bindBot = document.getElementById("mBindToBot");
      if (bindBot instanceof HTMLInputElement && bindBot.type === "checkbox") bindBot.checked = false;
      const llmHid = document.getElementById("mLlmProvider");
      if (llmHid instanceof HTMLInputElement) llmHid.value = "deepseek";
      try {
        window.dispatchEvent(
          new CustomEvent("bovin-form-patch", { detail: { id: "mLlmProvider", value: "deepseek" } })
        );
      } catch {
        /* ignore */
      }
      const passNote = document.getElementById("mExchangePassphraseNote");
      if (passNote) passNote.textContent = "";
      const probeFb = document.getElementById("llmProbeFeedback");
      if (probeFb) {
        probeFb.classList.add("hidden");
        probeFb.textContent = "";
        probeFb.setAttribute("aria-hidden", "true");
      }
    };

    const openModalForNewBinding = () => {
      editingBindingId = "";
      editingBindingRow = null;
      resetApiBindingModalForm();
      openModal();
    };
    const saveBtn = document.getElementById("saveApiBindingModal");
    const onEsc = (e) => {
      if (e.key === "Escape") closeModal();
    };
    const normalizeApiBindingsFromPrefs = (prefsBody) => {
      if (!prefsBody || typeof prefsBody !== "object") return [];
      const o = prefsBody;
      const arr = o.api_bindings ?? o.apiBindings;
      if (!Array.isArray(arr)) return [];
      return arr
        .filter((x) => x && typeof x === "object")
        .map((x, idx) => {
          const b = x;
          const id = String(
            b.id ??
              b.binding_id ??
              b.bindingId ??
              b.uuid ??
              b.label ??
              b.exchangeName ??
              `row-${idx}`
          ).trim();
          return {
            ...b,
            _rowId: id || `row-${idx}`
          };
        });
    };

    const renderApiBindings = (bindings) => {
      if (!bindingsList) return;
      const list = Array.isArray(bindings) ? bindings : [];
      bindingsList.innerHTML = list
        .map((b, idx) => {
          const label = String(b.label ?? b.bindingLabel ?? "").trim() || `映射 #${idx + 1}`;
          const exName = String(b.exchangeName ?? "").trim() || "binance";
          const exKey = String(b.exchangeApiKey ?? "").trim();
          const llmProvider = String(b.llmProvider ?? "").trim() || "deepseek";
          const llmModel = String(b.llmModel ?? "").trim();
          const enabled = b.enabled !== false;
          const enabledText = enabled ? "生效" : "停用";
          const keyDisplay = exKey ? "••••••••" : tS("binding.keyEmpty");
          const llmText = llmModel ? `${llmProvider} / ${llmModel}` : llmProvider;
          const rowId = String(b._rowId ?? b.id ?? `row-${idx}`).trim() || `row-${idx}`;
          return `
        <article class="binding-row api-binding-card"
          data-binding-id="${esc(rowId)}"
          data-binding-label="${esc(label)}"
          data-exchange-name="${esc(exName)}"
          data-exchange-api-key="${esc(exKey)}"
          data-llm-provider="${esc(llmProvider)}"
          data-llm-model="${esc(llmModel)}"
          data-binding-enabled="${enabled ? "1" : "0"}">
          <div class="api-binding-card__inner">
            <div class="api-binding-card__head">
              <strong class="api-binding-card__title">${esc(label)}</strong>
              <div class="binding-row-head-tools">
                <label class="binding-row-effective">
                  <input type="checkbox" data-binding-enabled-toggle="1" ${enabled ? "checked" : ""} />
                  <span data-binding-enabled-text="1">${esc(enabledText)}</span>
                </label>
                <div class="actions">
                  <button type="button" class="ghost tiny" data-binding-edit="1">${esc(tS("users.edit"))}</button>
                  <button type="button" class="ghost tiny" data-binding-delete="1">${esc(tS("users.delete"))}</button>
                </div>
              </div>
            </div>
            <div class="api-binding-card__grid">
              <div class="api-binding-field">
                <span class="api-binding-field__label">${esc(tS("binding.exchange"))}</span>
                <span class="api-binding-field__value">${esc(exName)}</span>
              </div>
              <div class="api-binding-field">
                <span class="api-binding-field__label">${esc(tS("binding.apiKey"))}</span>
                <span class="api-binding-field__value">${esc(keyDisplay)}</span>
              </div>
              <div class="api-binding-field">
                <span class="api-binding-field__label">${esc(tS("binding.llm"))}</span>
                <span class="api-binding-field__value">${esc(llmText)}</span>
              </div>
            </div>
          </div>
        </article>`;
        })
        .join("");
      syncBindingsHint();
    };

    const syncApiBindingsToServer = async (nextBindings) => {
      const payload = {
        api_bindings: nextBindings.map(({ _rowId, ...b }) => ({ ...b, enabled: b.enabled !== false }))
      };
      await postPanelPreferences(payload);
      state.apiBindings = payload.api_bindings.map((b, idx) => ({
        ...b,
        _rowId:
          String(
            b.id ?? b.binding_id ?? b.bindingId ?? b.uuid ?? b.label ?? b.exchangeName ?? `row-${idx}`
          ).trim() || `row-${idx}`
      }));
      renderApiBindings(state.apiBindings);
    };

    const loadApiBindings = async () => {
      try {
        const prefs = await getPanelPreferences();
        const list = normalizeApiBindingsFromPrefs(prefs?.data && typeof prefs.data === "object" ? prefs.data : prefs);
        state.apiBindings = list;
        renderApiBindings(list);
      } catch {
        /* 回退：使用已同步到 state 的快照（通常来自 app.js 登录后同步） */
        renderApiBindings(
          Array.isArray(state.apiBindings)
            ? state.apiBindings.map((b, idx) => ({
                ...b,
                _rowId:
                  String(
                    b.id ?? b.binding_id ?? b.bindingId ?? b.uuid ?? b.label ?? b.exchangeName ?? `row-${idx}`
                  ).trim() || `row-${idx}`
              }))
            : []
        );
      }
    };

    const onSave = async () => {
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
      const current = Array.isArray(state.apiBindings) ? [...state.apiBindings] : [];
      const nextOne = {
        label,
        exchangeName: exName,
        exchangeApiKey: exKey,
        llmProvider,
        llmModel,
        enabled
      };
      let next = current;
      if (editingBindingId) {
        next = current.map((b) => (String(b._rowId || "") === editingBindingId ? { ...b, ...nextOne } : b));
      } else {
        next = [{ ...nextOne, _rowId: `tmp-${Date.now()}` }, ...current];
      }
      try {
        await syncApiBindingsToServer(next);
        editingBindingRow = null;
        editingBindingId = "";
        closeModal();
      } catch (e) {
        showError(e && typeof e === "object" && "message" in e ? String(e.message) : String(e));
      }
    };
    const onListAction = async (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target || !bindingsList) return;
      const row = target.closest(".binding-row");
      if (!row) return;
      const toggle = target.closest("[data-binding-enabled-toggle='1']");
      if (toggle) {
        const checked = Boolean(toggle.checked);
        const rowId = String(row.getAttribute("data-binding-id") || "").trim();
        const current = Array.isArray(state.apiBindings) ? [...state.apiBindings] : [];
        const next = current.map((b) =>
          String(b._rowId || "") === rowId ? { ...b, enabled: checked } : b
        );
        try {
          await syncApiBindingsToServer(next);
        } catch (e) {
          showError(e && typeof e === "object" && "message" in e ? String(e.message) : String(e));
        }
        return;
      }
      const delBtn = target.closest("[data-binding-delete='1']");
      if (delBtn) {
        const rowId = String(row.getAttribute("data-binding-id") || "").trim();
        try {
          await deletePanelApiBinding(rowId);
          const current = Array.isArray(state.apiBindings) ? [...state.apiBindings] : [];
          state.apiBindings = current.filter((b) => String(b._rowId || "") !== rowId);
          renderApiBindings(state.apiBindings);
        } catch (e) {
          showError(e && typeof e === "object" && "message" in e ? String(e.message) : String(e));
        }
        return;
      }
      const editBtn = target.closest("[data-binding-edit='1']");
      if (!editBtn) return;
      editingBindingRow = row;
      editingBindingId = String(row.getAttribute("data-binding-id") || "").trim();
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
    addApiBindingBtn.addEventListener("click", openModalForNewBinding);
    closeApiBindingBtn?.addEventListener("click", closeModal);
    apiBindingMask?.addEventListener("click", closeModal);
    saveBtn?.addEventListener("click", onSave);
    bindingsList?.addEventListener("click", onListAction);
    window.addEventListener("keydown", onEsc);
      void loadApiBindings();

    disposeApiBindingModal = () => {
      addApiBindingBtn.removeEventListener("click", openModalForNewBinding);
      closeApiBindingBtn?.removeEventListener("click", closeModal);
      apiBindingMask?.removeEventListener("click", closeModal);
      saveBtn?.removeEventListener("click", onSave);
      bindingsList?.removeEventListener("click", onListAction);
      window.removeEventListener("keydown", onEsc);
    };
  }

  if (strategyModal) {
    const saveStrategyMemoBtn = document.getElementById("saveStrategyMemoModal");
    const strategyListEl = document.getElementById("manualStrategiesList");
    let editingStrategySlotId = "";

    const normalizeSlotRows = (payload) => {
      const raw = extractPanelStrategyListPayload(payload);
      if (!Array.isArray(raw)) return [];
      return raw
        .map((x) => ({
          id: String(rowServerSlotId(x) || "").trim(),
          strategyName: String(panelStrategySlotRowName(x) || "").trim(),
          detailJson: String(slotRowDetailJsonText(x) || ""),
          mml: String(slotRowMmlText(x) || "")
        }))
        .filter((x) => x.strategyName);
    };

    const renderStrategyRows = (rows) => {
      if (!strategyListEl) return;
      if (!Array.isArray(rows) || rows.length === 0) {
        strategyListEl.innerHTML = "";
        return;
      }
      const entries = normalizeStrategyEntries(state.strategyEntries);
      const byName = new Map(
        entries.map((e) => [String(e.strategyName || "").trim(), e]).filter(([k]) => Boolean(k))
      );
      const yn = (v) => (v ? tS("label.on") : tS("label.off"));
      const fmtNum = (v) => (v == null || v === "" || Number.isNaN(Number(v)) ? "—" : String(v));
      strategyListEl.innerHTML = rows
        .map((r) => {
          const ent = byName.get(String(r.strategyName || "").trim()) || {};
          return `<article class="binding-row strategy-config-row" data-strategy-slot-id="${esc(r.id)}">
            <div class="strategy-config-cells">
              <span class="strategy-config-name" title="${esc(
                r.strategyName || tS("settings.strategyEntryUntitled")
              )}">${esc(r.strategyName || tS("settings.strategyEntryUntitled"))}</span>
              <div class="strategy-config-kv"><span class="strategy-config-k">${esc(tS("settings.entryLineAi"))}</span><span class="strategy-config-v">${esc(yn(Boolean(ent.aiTakeoverTrading)))}</span></div>
              <div class="strategy-config-kv"><span class="strategy-config-k">${esc(tS("settings.entryLineDedicatedRpc"))}</span><span class="strategy-config-v">${esc(String(ent.strategyRpcBase || "").trim() ? tS("label.on") : tS("label.off"))}</span></div>
              <div class="strategy-config-kv"><span class="strategy-config-k">${esc(tS("settings.entryLineFreqai"))}</span><span class="strategy-config-v">${esc(yn(Boolean(ent.riskUseFreqaiLimits)))}</span></div>
              <div class="strategy-config-kv"><span class="strategy-config-k">${esc(tS("settings.entryLineStrategyCardGrid"))}</span><span class="strategy-config-v">${esc(yn(ent.controlShowStrategyCards !== false))}</span></div>
              <div class="strategy-config-kv"><span class="strategy-config-k">${esc(tS("label.strategyAuthorizedAmount"))}</span><span class="strategy-config-v">${esc(fmtNum(ent.strategyAuthorizedAmount))}</span></div>
              <div class="strategy-config-kv"><span class="strategy-config-k">${esc(tS("label.strategyTargetAnnualReturnPct"))}</span><span class="strategy-config-v">${esc(fmtNum(ent.strategyTargetAnnualReturnPct))}</span></div>
              <div class="strategy-config-kv"><span class="strategy-config-k">${esc(tS("label.riskMaxDrawdownLimitPct"))}</span><span class="strategy-config-v">${esc(fmtNum(ent.riskMaxDrawdownLimitPct))}</span></div>
              <div class="strategy-config-kv"><span class="strategy-config-k">${esc(tS("label.riskThresholdPct"))}</span><span class="strategy-config-v">${esc(fmtNum(ent.riskThresholdPct))}</span></div>
              <div class="strategy-config-kv"><span class="strategy-config-k">${esc(tS("label.strategySlotDetailJson"))}</span><span class="strategy-config-v">${esc(yn(Boolean(r.detailJson)))}</span></div>
              <div class="strategy-config-kv"><span class="strategy-config-k">${esc(tS("label.strategySlotMml"))}</span><span class="strategy-config-v">${esc(yn(Boolean(r.mml)))}</span></div>
            </div>
            <div class="actions">
              <button type="button" class="ghost tiny" data-strategy-edit="1">${esc(tS("users.edit"))}</button>
              <button type="button" class="ghost tiny" data-strategy-delete="1">${esc(tS("users.delete"))}</button>
            </div>
          </article>`;
        })
        .join("");
    };

    const loadStrategySlots = async () => {
      try {
        const payload = await getPanelStrategySlots({ includeBodies: true });
        const rows = normalizeSlotRows(payload);
        renderStrategyRows(rows);
      } catch (e) {
        console.error(e);
      }
    };

    const openStrategyModal = (mode, row = null) => {
      strategyModal.classList.remove("hidden");
      editingStrategySlotId = mode === "edit" ? String(row?.id || "").trim() : "";
      const setVal = (id, v) => {
        const el = document.getElementById(id);
        if (el && "value" in el) el.value = String(v ?? "");
      };
      if (mode === "edit" && row) {
        setVal("mStrategyName", row.strategyName || "");
        setVal("mEntrySlotDetailJson", row.detailJson || "");
        setVal("mEntrySlotMml", row.mml || "");
      } else {
        setVal("mStrategyName", "");
        setVal("mEntrySlotDetailJson", "");
        setVal("mEntrySlotMml", "");
      }
      if (strategyModalTitle) {
        strategyModalTitle.textContent = mode === "new" ? "新增策略（完整条目）" : "编辑策略（完整条目）";
      }
    };
    const closeStrategyModal = () => strategyModal.classList.add("hidden");
    const onNewStrategy = () => openStrategyModal("new", null);
    const onStrategyListClick = async (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
      const rowEl = target.closest(".strategy-config-row");
      if (!rowEl) return;
      const sid = String(rowEl.getAttribute("data-strategy-slot-id") || "").trim();
      const name = String(rowEl.querySelector("strong")?.textContent || "").trim();
      const row = {
        id: sid,
        strategyName: name,
        detailJson: readFieldStr("mEntrySlotDetailJson"),
        mml: readFieldStr("mEntrySlotMml")
      };
      const editBtn = target.closest("[data-strategy-edit='1']");
      if (editBtn) {
        try {
          const payload = await getPanelStrategySlots({ includeBodies: true });
          const rows = normalizeSlotRows(payload);
          const full = rows.find((x) => x.id === sid || x.strategyName === name) || row;
          openStrategyModal("edit", full);
        } catch {
          openStrategyModal("edit", row);
        }
        return;
      }
      const delBtn = target.closest("[data-strategy-delete='1']");
      if (delBtn) {
        Modal.confirm({
          title: tS("modal.confirmTitle"),
          content: tS("settings.confirmRemoveManualStrategy"),
          icon: createVNode(ExclamationCircleFilled, {
            style: { color: "rgb(248, 113, 113)" }
          }),
          okText: tS("btn.confirm"),
          cancelText: tS("btn.cancel"),
          okButtonProps: { danger: true },
          centered: true,
          maskClosable: true,
          async onOk() {
            if (!sid) return;
            await deletePanelStrategySlot(sid);
            await loadStrategySlots();
          }
        });
      }
    };
    const onEscStrategy = (e) => {
      if (e.key === "Escape") closeStrategyModal();
    };

    const onSaveStrategyMemo = async () => {
      const name = readFieldStr("mStrategyName").trim();
      if (!name) {
        showWarn(tS("settings.strategyNameRequired"));
        return;
      }
      const entries = normalizeStrategyEntries(state.strategyEntries);
      const idx = entries.findIndex((e) => String(e.strategyName || "").trim() === name);
      const patch = {
        strategyName: name,
        strategyRpcBase: readFieldStr("mStrategyRpcBase").trim(),
        controlShowStrategyCards: readCheckbox("mControlShowStrategyCards"),
        strategyAuthorizedAmount: readFieldNumOrNull("mStrategyAuthorizedAmount"),
        strategyTargetAnnualReturnPct: readFieldNumOrNull("mStrategyTargetAnnualReturnPct"),
        aiTakeoverTrading: readCheckbox("mAiTakeoverTrading"),
        paperTrading: readCheckbox("mPaperTrading"),
        riskUseFreqaiLimits: readCheckbox("mRiskUseFreqaiLimits"),
        riskMaxDrawdownLimitPct: readFieldNumOrNull("mRiskMaxDrawdownLimitPct"),
        riskThresholdPct: readFieldNumOrNull("mRiskThresholdPct"),
        strategyNotes: readFieldStr("mStrategyNotes"),
        strategyExtraJson: readFieldStr("mStrategyExtraJson"),
        strategyRulesOutput: readFieldStr("mStrategyRulesOutput"),
        showOnConsole: readCheckbox("mStrategyShowOnConsole")
      };
      const nextEnt =
        idx >= 0 ? defaultStrategyEntry({ ...entries[idx], ...patch }) : defaultStrategyEntry({ ...patch });
      if (idx >= 0) entries[idx] = nextEnt;
      else entries.push(nextEnt);
      state.strategyEntries = normalizeStrategyEntries(entries);
      syncStrategyEntriesDerivedState();

      const dj = readFieldStr("mEntrySlotDetailJson").trim();
      const mm = readFieldStr("mEntrySlotMml").trim();
      const slotMap =
        state.strategySlots && typeof state.strategySlots === "object" && !Array.isArray(state.strategySlots)
          ? { ...state.strategySlots }
          : {};
      const slot = {};
      if (dj) slot.detailJson = dj;
      if (mm) slot.mml = mm;
      slotMap[name] = slot;
      state.strategySlots = normalizeStrategySlots(slotMap);

      try {
        const body = {
          strategyName: name,
          strategy: name,
          name,
          detailJson: dj,
          mml: mm
        };
        if (editingStrategySlotId) {
          /** @type {Record<string, string>} */
          const patchBody = {};
          if (dj !== "") patchBody.detailJson = dj;
          if (mm !== "") patchBody.mml = mm;
          patchBody.strategyName = name;
          await patchPanelStrategySlot(editingStrategySlotId, patchBody);
        } else {
          await postPanelStrategySlot(body);
        }
        await loadStrategySlots();
        persistProfileToLocalStorage();
        refreshStrategyConsoleAfterPrefs();
      } catch (err) {
        console.error(err);
        showError(err && typeof err === "object" && "message" in err ? String(err.message) : String(err));
        return;
      }
      closeStrategyModal();
    };

    newStrategyBtn?.addEventListener("click", onNewStrategy);
    closeStrategyModalBtn?.addEventListener("click", closeStrategyModal);
    strategyModalMask?.addEventListener("click", closeStrategyModal);
    saveStrategyMemoBtn?.addEventListener("click", onSaveStrategyMemo);
    strategyListEl?.addEventListener("click", onStrategyListClick);
    window.addEventListener("keydown", onEscStrategy);
    void loadStrategySlots();

    disposeStrategyModal = () => {
      newStrategyBtn?.removeEventListener("click", onNewStrategy);
      closeStrategyModalBtn?.removeEventListener("click", closeStrategyModal);
      strategyModalMask?.removeEventListener("click", closeStrategyModal);
      saveStrategyMemoBtn?.removeEventListener("click", onSaveStrategyMemo);
      strategyListEl?.removeEventListener("click", onStrategyListClick);
      window.removeEventListener("keydown", onEscStrategy);
    };
  }

  if (addPanelUserBtn && panelUserModal) {
    const savePanelUserBtn = document.getElementById("savePanelUserModal");
    const panelUserModalTitle = document.getElementById("panelUserModalTitle");
    const readonlyHint = document.getElementById("panelUsersReadonlyHint");
    const isReadonly = document.body.classList.contains("perm-no-edit-settings");

    const setPermInputsFromObject = (perms) => {
      const p = normalizeUserMenuPermissions(perms);
      const setVal = (id, v) => {
        const el = document.getElementById(id);
        if (el && "value" in el) el.value = v;
        try {
          window.dispatchEvent(new CustomEvent("bovin-form-patch", { detail: { id, value: v } }));
        } catch {
          /* ignore */
        }
      };
      setVal("puPerm-overview", p.overview);
      setVal("puPerm-positions", p.positions);
      setVal("puPerm-control", p.control);
      setVal("puPerm-data", p.data);
      setVal("puPerm-settings", p.settings);
      setVal("puPerm-monitor", p.monitor);
      setVal("puPerm-api", p.api);
    };

    const readPermInputs = () => ({
      overview: normalizePermValue(readFieldStr("puPerm-overview")),
      positions: normalizePermValue(readFieldStr("puPerm-positions")),
      control: normalizePermValue(readFieldStr("puPerm-control")),
      data: normalizePermValue(readFieldStr("puPerm-data")),
      settings: normalizePermValue(readFieldStr("puPerm-settings")),
      monitor: normalizePermValue(readFieldStr("puPerm-monitor")),
      api: normalizePermValue(readFieldStr("puPerm-api"))
    });

    const permsSummaryText = (perms) => {
      const p = normalizeUserMenuPermissions(perms);
      const labels = {
        overview: tS("nav.overview"),
        positions: tS("nav.positions"),
        control: tS("nav.control"),
        data: tS("nav.data"),
        settings: tS("nav.settings"),
        monitor: tS("nav.monitor"),
        api: tS("nav.api")
      };
      return Object.keys(labels)
        .map((k) => {
          const permLabel =
            p[k] === "edit"
              ? tS("users.perm.edit")
              : p[k] === "hidden"
                ? tS("users.perm.hidden")
                : tS("users.perm.read");
          return `${labels[k]}:${permLabel}`;
        })
        .join(" · ");
    };

    const renderUsers = (rows) => {
      if (!panelUsersList) return;
      panelUsersList.innerHTML = rows
        .map((u) => {
          const summary = permsSummaryText(u.perms);
          return `<article class="binding-row panel-user-row" data-user-id="${esc(u.id)}" data-username="${esc(u.username)}">
            <strong>${esc(u.username || "—")}</strong>
            <span class="muted">${esc(summary)}</span>
            <div class="panel-user-actions">
              <button type="button" class="ghost tiny panel-user-edit" data-user-edit="1">${esc(tS("users.edit"))}</button>
              <button type="button" class="ghost tiny panel-user-del" data-user-delete="1">${esc(tS("users.delete"))}</button>
            </div>
          </article>`;
        })
        .join("");
      if (panelUsersEmptyHint) panelUsersEmptyHint.classList.toggle("hidden", rows.length > 0);
      if (readonlyHint) readonlyHint.classList.toggle("hidden", !isReadonly);
    };

    const loadUsers = async () => {
      try {
        const payload = await getPanelUsers();
        const rows = extractPanelUsersList(payload).map(mapPanelUserRow).filter((x) => x.username);
        renderUsers(rows);
      } catch {
        if (panelUsersList) panelUsersList.innerHTML = "";
        if (panelUsersEmptyHint) {
          panelUsersEmptyHint.textContent = tS("settings.panelUsersUpstreamOnly");
          panelUsersEmptyHint.classList.remove("hidden");
        }
      }
    };

    const openUserModal = (mode = "new", row = null) => {
      editingPanelUser = mode === "edit" ? row : null;
      const usernameEl = document.getElementById("puUsername");
      const passwordEl = document.getElementById("puPassword");
      if (usernameEl && "value" in usernameEl) usernameEl.value = row?.username ?? "";
      if (passwordEl && "value" in passwordEl) passwordEl.value = "";
      setPermInputsFromObject(row?.perms ?? {});
      if (panelUserModalTitle) {
        panelUserModalTitle.textContent = mode === "edit" ? tS("users.editUser") : tS("users.addUser");
      }
      panelUserModal.classList.remove("hidden");
    };
    const closeUserModal = () => panelUserModal.classList.add("hidden");
    const onEscUser = (e) => {
      if (e.key === "Escape") closeUserModal();
    };

    const onSaveUser = async () => {
      if (isReadonly) return;
      const username = readFieldStr("puUsername").trim();
      const password = readFieldStr("puPassword");
      if (!username) {
        showWarn(tS("users.usernameRequired"));
        return;
      }
      const perms = readPermInputs();
      const body = {
        username,
        menu_permissions: perms,
        menuPermissions: perms
      };
      if (password.trim()) body.password = password;
      try {
        const targetId = String(editingPanelUser?.id || username).trim();
        if (editingPanelUser) await patchPanelUser(targetId, body);
        else await postPanelUser(body);
        closeUserModal();
        await loadUsers();
      } catch (e) {
        const msg = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
        showError(msg);
      }
    };

    const onUsersListClick = async (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target || !panelUsersList) return;
      const rowEl = target.closest(".panel-user-row");
      if (!rowEl) return;
      const row = {
        id: String(rowEl.getAttribute("data-user-id") || "").trim(),
        username: String(rowEl.getAttribute("data-username") || "").trim(),
        perms: {}
      };
      if (target.closest("[data-user-edit='1']")) {
        if (isReadonly) return;
        try {
          const payload = await getPanelUsers();
          const list = extractPanelUsersList(payload).map(mapPanelUserRow);
          const full = list.find((x) => x.id === row.id || x.username === row.username) || row;
          openUserModal("edit", full);
        } catch {
          openUserModal("edit", row);
        }
        return;
      }
      if (target.closest("[data-user-delete='1']")) {
        if (isReadonly) return;
        Modal.confirm({
          title: tS("modal.confirmTitle"),
          content: tS("users.confirmDelete"),
          icon: createVNode(ExclamationCircleFilled, {
            style: { color: "rgb(248, 113, 113)" }
          }),
          okText: tS("btn.confirm"),
          cancelText: tS("btn.cancel"),
          okButtonProps: { danger: true },
          centered: true,
          maskClosable: true,
          async onOk() {
            try {
              await deletePanelUser(row.id || row.username);
              await loadUsers();
            } catch (e2) {
              const msg =
                e2 && typeof e2 === "object" && "message" in e2 ? String(e2.message) : String(e2);
              showError(msg);
              throw e2;
            }
          }
        });
      }
    };

    addPanelUserBtn.addEventListener("click", () => openUserModal("new", null));
    closePanelUserModalBtn?.addEventListener("click", closeUserModal);
    panelUserMask?.addEventListener("click", closeUserModal);
    savePanelUserBtn?.addEventListener("click", onSaveUser);
    panelUsersList?.addEventListener("click", onUsersListClick);
    window.addEventListener("keydown", onEscUser);
    void loadUsers();

    disposeUserModal = () => {
      closePanelUserModalBtn?.removeEventListener("click", closeUserModal);
      panelUserMask?.removeEventListener("click", closeUserModal);
      savePanelUserBtn?.removeEventListener("click", onSaveUser);
      panelUsersList?.removeEventListener("click", onUsersListClick);
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
