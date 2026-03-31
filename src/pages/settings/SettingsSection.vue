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
                </div>
                <div id="settingsPanelStrategy" class="settings-tab-panel" role="tabpanel" aria-labelledby="settingsTabStrategy">
                  <div class="settings-strategy-list-block mt-10">
                    <div class="settings-strategy-list-toolbar">
                      <div class="settings-strategy-list-toolbar-text">
                        <h4 class="settings-strategy-list-title" data-i18n="settings.strategyListTitle">策略列表</h4>
                      </div>
                      <button type="button" id="newManualStrategyBtn" class="primary settings-new-strategy-btn" data-i18n="settings.newStrategy">新建</button>
                    </div>
                    <div class="settings-strategy-list-panel">
                      <div id="manualStrategiesList" class="bindings-list manual-strategies-list"></div>
                    </div>
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
                </div>
              </div>
            </div>
            </div>
          </div>
        </section>
</template>

<style scoped>
/* settings */
</style>

<script setup src="./settings.js"></script>
