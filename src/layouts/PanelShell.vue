<template>
<div class="app hidden" id="appRoot">
      <aside class="sidebar">
        <div class="brand-wrap">
          <div class="brand-dot"></div>
          <div class="brand-block">
            <div class="brand" data-i18n="brand.main">Bovin</div>
            <div class="brand-sub" data-i18n="brand.sub">加密交易控制台</div>
          </div>
        </div>
        <nav class="sidebar-nav" data-i18n-aria="aria.mainNav" aria-label="主导航">
          <button type="button" class="nav-btn active" data-section="overview" data-i18n="nav.overview">系统概览</button>
          <button type="button" class="nav-btn" data-section="positions" data-i18n="nav.positions">持仓与订单</button>
          <button type="button" class="nav-btn" data-section="control" data-i18n="nav.control">策略AI控制台</button>
          <button type="button" class="nav-btn" data-section="data" data-i18n="nav.data">数据面板</button>
          <button type="button" class="nav-btn" data-section="settings" data-i18n="nav.settings">设置中心</button>
          <!-- 暂时隐藏：系统监控、接口能力面板
          <button type="button" class="nav-btn" data-section="monitor" data-i18n="nav.monitor">系统监控</button>
          <button type="button" class="nav-btn" data-section="api" data-i18n="nav.api">接口能力面板</button>
          -->
        </nav>
        <div class="sidebar-footer">
          <button
            type="button"
            class="status-pill status-pill-toggle"
            id="dataSourceBadge"
            aria-pressed="false"
            data-i18n-aria="aria.dataSourceToggle"
            aria-label="切换模拟数据与实时数据"
          >
            <span class="status-pill-label">数据源: 实时</span>
            <span class="status-pill-switch" aria-hidden="true"><span class="status-pill-knob"></span></span>
          </button>
          <div id="appVersionLabel" class="sidebar-version" aria-label="Panel version"></div>
        </div>
      </aside>

      <main class="main">
        <div class="topbar">
          <div class="topbar-left">
            <div class="topbar-brandline" data-i18n="brand.main">Bovin</div>
            <div class="topbar-statusline">
              <span id="topbarNetwork"></span>
              <span id="topbarMarket"></span>
            </div>
            <div class="sr-only" id="pageTitle">系统概览</div>
            <div class="sr-only" id="pageSubtitle"></div>
          </div>
          <div class="api-config">
            <div class="system-online-badge"><span class="dot"></span><span id="topbarSystemText"></span></div>
            <span id="rpcLiveBadge" class="rpc-live-badge rpc-live-badge--poll" role="status">HTTP 轮询</span>
            <button type="button" class="icon-btn" id="topbarNotifyBtn" data-i18n-aria="aria.notify" aria-label="通知" aria-expanded="false" aria-haspopup="dialog"><BellOutlined /></button>
            <button type="button" class="icon-btn" id="topbarThemeBtn" data-i18n-aria="aria.theme" aria-label="主题">
              <BulbOutlined class="theme-icon theme-icon-off" />
              <BulbFilled class="theme-icon theme-icon-on" />
            </button>
            <button type="button" class="icon-btn" id="topbarAccountBtn" data-i18n-aria="aria.account" aria-label="账户" aria-expanded="false" aria-haspopup="dialog"><UserOutlined /></button>
            <button id="langQuickToggle" type="button" class="lang-card-toggle">中 / EN</button>
            <select id="langSwitch" class="hidden-control">
              <option value="zh-CN">简体中文</option>
              <option value="en">English</option>
            </select>
            <button id="toggleMock" type="button" class="ghost toggle-mock hidden-control" aria-pressed="false">模拟数据: OFF</button>
            <button id="openSettings" type="button" class="ghost hidden-control" data-i18n="btn.openSettings">设置</button>
            <button id="logoutBtn" type="button" class="ghost" data-i18n="btn.logout">退出</button>
          </div>
        </div>

        <PanelSections />

        <div id="apiBindingModal" class="modal hidden" role="presentation">
          <div class="modal-mask" aria-hidden="true"></div>
          <div class="modal-card modal-card--binding modal-card--api-binding" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
            <header class="modal-head modal-head--binding">
              <div class="modal-head-text">
                <h4 id="modalTitle" class="modal-title" data-i18n="modal.apiBindingTitleNew">新增 API 对接关系</h4>
                <p class="modal-sub" data-i18n="modal.apiBindingSub">密钥写入本地面板与服务端 user_data；请勿在不可信网络填写生产凭据。</p>
              </div>
              <button type="button" id="closeApiBindingModal" class="ghost modal-close-btn" data-i18n="btn.close">关闭</button>
            </header>
            <div class="modal-body">
              <label class="binding-field">
                <span class="binding-field-label" data-i18n="modal.api.bindingDisplayName">映射显示名称</span>
                <input
                  id="mBindingLabel"
                  name="mBindingLabel"
                  type="text"
                  maxlength="120"
                  autocomplete="off"
                  data-i18n-placeholder="modal.api.bindingDisplayNamePh"
                  placeholder="留空则列表显示为「映射 #序号」"
                />
                <p class="modal-hint" data-i18n="modal.api.bindingDisplayNameHint">用于列表标题区分多组对接；与下方交易所 id 无关。</p>
              </label>
              <div class="binding-grid binding-grid--modal">
                <section class="binding-column" aria-labelledby="binding-col-llm">
                  <h5 id="binding-col-llm" data-i18n="modal.api.colLlm">大模型 API</h5>
                  <label class="binding-field">
                    <span class="binding-field-label" data-i18n="modal.api.llmProvider">服务商</span>
                    <input type="hidden" id="mLlmProvider" name="mLlmProvider" value="deepseek" autocomplete="off" />
                    <a-select
                      v-model:value="llmProviderVal"
                      :options="llmProviderOptions"
                      size="large"
                      class="bovin-select-full"
                      popup-class-name="bovin-select-dropdown"
                      :get-popup-container="selectPopupContainer"
                    />
                  </label>
                  <label class="binding-field">
                    <span class="binding-field-label" data-i18n="modal.api.llmBaseUrl">Base URL</span>
                    <input id="mLlmBaseUrl" name="mLlmBaseUrl" type="url" autocomplete="url" />
                  </label>
                  <label class="binding-field">
                    <span class="binding-field-label" data-i18n="modal.api.llmApiKey">API Key</span>
                    <input id="mLlmApiKey" name="mLlmApiKey" type="password" autocomplete="off" />
                  </label>
                  <label class="binding-field">
                    <span class="binding-field-label" data-i18n="modal.api.llmModel">模型</span>
                    <input id="mLlmModel" name="mLlmModel" type="text" autocomplete="off" />
                  </label>
                  <div class="binding-field">
                    <label class="binding-field-label" for="mBindingEnabled" data-i18n="modal.api.bindingEnabledLabel">启用本映射</label>
                    <div class="binding-checkbox-control">
                      <input
                        id="mBindingEnabled"
                        name="mBindingEnabled"
                        type="checkbox"
                        checked
                        aria-describedby="mBindingEnabledHint"
                      />
                      <p class="modal-hint binding-checkbox-hint" id="mBindingEnabledHint" data-i18n="modal.api.bindingEnabledHint">关闭后不参与同步与生效</p>
                    </div>
                  </div>
                  <div class="binding-field">
                    <label class="binding-field-label" for="mBindToBot" data-i18n="modal.api.bindToBot">保存时同步到机器人 config（exchange 段）</label>
                    <div class="binding-checkbox-control">
                      <input
                        id="mBindToBot"
                        name="mBindToBot"
                        type="checkbox"
                        aria-describedby="mBindToBotHint"
                      />
                      <p class="modal-hint binding-checkbox-hint" id="mBindToBotHint" data-i18n="modal.api.bindToBotHint">仅一行可勾选；会写入磁盘上的主配置文件中的 exchange；须重启 trade/webserver 后进程内配置才刷新。</p>
                    </div>
                  </div>
                </section>
                <section class="binding-column" aria-labelledby="binding-col-exchange">
                  <h5 id="binding-col-exchange" data-i18n="modal.api.colExchange">交易所 API</h5>
                  <label class="binding-field">
                    <span class="binding-field-label" data-i18n="modal.api.exchangeRestBaseUrl">Base URL（可选）</span>
                    <input
                      id="mExchangeRestBaseUrl"
                      name="mExchangeRestBaseUrl"
                      type="text"
                      inputmode="url"
                      autocomplete="off"
                      spellcheck="false"
                      data-i18n-placeholder="modal.api.exchangeRestBaseUrlPh"
                      placeholder="https://api.binance.com"
                    />
                  </label>
                  <label class="binding-field">
                    <span class="binding-field-label" data-i18n="modal.api.exchangeApiKey">API Key</span>
                    <input id="mExchangeApiKey" name="mExchangeApiKey" type="text" autocomplete="off" spellcheck="false" />
                  </label>
                  <label class="binding-field">
                    <span class="binding-field-label" data-i18n="modal.api.exchangeApiSecret">API Secret</span>
                    <input id="mExchangeApiSecret" name="mExchangeApiSecret" type="password" autocomplete="off" />
                  </label>
                  <label class="binding-field">
                    <span class="binding-field-label" data-i18n="modal.api.exchangePassphrase">Passphrase（可选）</span>
                    <input id="mExchangePassphrase" name="mExchangePassphrase" type="password" autocomplete="off" />
                    <p id="mExchangePassphraseNote" class="modal-hint"></p>
                  </label>
                  <input type="hidden" id="mExchangeName" name="mExchangeName" value="" />
                </section>
              </div>
            </div>
            <footer class="modal-actions modal-actions--split modal-actions--api-binding-footer">
              <div
                id="llmProbeFeedback"
                class="llm-probe-feedback hidden"
                aria-hidden="true"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                <p id="llmProbeExchangeStatusText" class="llm-probe-feedback__text"></p>
                <p id="llmProbeLlmStatusText" class="llm-probe-feedback__text"></p>
              </div>
              <div class="modal-actions-row">
                <button type="button" id="btnLlmProbe" class="ghost" data-i18n="btn.llmProbe">测试交易所与 LLM 连通性</button>
                <div class="modal-actions-end">
                  <button type="button" id="saveApiBindingModal" class="primary" data-i18n="btn.saveBinding">保存关系</button>
                </div>
              </div>
            </footer>
          </div>
        </div>

        <div id="panelUserModal" class="modal hidden" role="presentation">
          <div class="modal-mask" aria-hidden="true"></div>
          <div class="modal-card modal-card--binding modal-card--panel-user" role="dialog" aria-modal="true" aria-labelledby="panelUserModalTitle">
            <header class="modal-head modal-head--binding">
              <div class="modal-head-text">
                <h4 id="panelUserModalTitle" class="modal-title" data-i18n="users.add">新建用户</h4>
                <p class="modal-sub" data-i18n="users.menuPermissions">菜单权限（只读 / 编辑）</p>
              </div>
              <button type="button" id="closePanelUserModal" class="ghost modal-close-btn" data-i18n="btn.close">关闭</button>
            </header>
            <div class="modal-body">
              <div class="binding-grid binding-grid--modal">
                <label class="binding-field">
                  <span class="binding-field-label" data-i18n="users.username">用户名</span>
                  <input id="puUsername" name="puUsername" type="text" autocomplete="username" />
                </label>
                <label class="binding-field">
                  <span class="binding-field-label" data-i18n="users.password">密码</span>
                  <input id="puPassword" name="puPassword" type="password" autocomplete="new-password" />
                </label>
              </div>
              <div class="pu-perm-grid" aria-label="menu permissions">
                <div class="pu-perm-item">
                  <span data-i18n="nav.overview">系统概览</span>
                  <input type="hidden" id="puPerm-overview" value="read" />
                  <a-select
                    v-model:value="puPermOverview"
                    :options="permSelectOptions"
                    class="bovin-select-full"
                    popup-class-name="bovin-select-dropdown"
                    :get-popup-container="selectPopupContainer"
                  />
                </div>
                <div class="pu-perm-item">
                  <span data-i18n="nav.positions">持仓与订单</span>
                  <input type="hidden" id="puPerm-positions" value="read" />
                  <a-select
                    v-model:value="puPermPositions"
                    :options="permSelectOptions"
                    class="bovin-select-full"
                    popup-class-name="bovin-select-dropdown"
                    :get-popup-container="selectPopupContainer"
                  />
                </div>
                <div class="pu-perm-item">
                  <span data-i18n="nav.control">策略AI控制台</span>
                  <input type="hidden" id="puPerm-control" value="read" />
                  <a-select
                    v-model:value="puPermControl"
                    :options="permSelectOptions"
                    class="bovin-select-full"
                    popup-class-name="bovin-select-dropdown"
                    :get-popup-container="selectPopupContainer"
                  />
                </div>
                <div class="pu-perm-item">
                  <span data-i18n="nav.data">数据面板</span>
                  <input type="hidden" id="puPerm-data" value="read" />
                  <a-select
                    v-model:value="puPermData"
                    :options="permSelectOptions"
                    class="bovin-select-full"
                    popup-class-name="bovin-select-dropdown"
                    :get-popup-container="selectPopupContainer"
                  />
                </div>
                <div class="pu-perm-item">
                  <span data-i18n="nav.settings">设置中心</span>
                  <input type="hidden" id="puPerm-settings" value="read" />
                  <a-select
                    v-model:value="puPermSettings"
                    :options="permSelectOptions"
                    class="bovin-select-full"
                    popup-class-name="bovin-select-dropdown"
                    :get-popup-container="selectPopupContainer"
                  />
                </div>
                <div class="pu-perm-item">
                  <span data-i18n="nav.monitor">系统监控</span>
                  <input type="hidden" id="puPerm-monitor" value="read" />
                  <a-select
                    v-model:value="puPermMonitor"
                    :options="permSelectOptions"
                    class="bovin-select-full"
                    popup-class-name="bovin-select-dropdown"
                    :get-popup-container="selectPopupContainer"
                  />
                </div>
                <div class="pu-perm-item">
                  <span data-i18n="nav.api">接口能力面板</span>
                  <input type="hidden" id="puPerm-api" value="read" />
                  <a-select
                    v-model:value="puPermApi"
                    :options="permSelectOptions"
                    class="bovin-select-full"
                    popup-class-name="bovin-select-dropdown"
                    :get-popup-container="selectPopupContainer"
                  />
                </div>
              </div>
            </div>
            <footer class="modal-actions">
              <button type="button" id="savePanelUserModal" class="primary" data-i18n="users.save">保存用户</button>
            </footer>
          </div>
        </div>

        <div id="strategyMemoModal" class="modal hidden" role="presentation">
          <div class="modal-mask" aria-hidden="true"></div>
          <div class="modal-card modal-card--binding modal-card--strategy-memo" role="dialog" aria-modal="true" aria-labelledby="strategyMemoModalTitle">
            <header class="modal-head modal-head--binding">
              <div class="modal-head-text">
                <h4 id="strategyMemoModalTitle" class="modal-title" data-i18n="modal.strategyConfigTitle">策略配置</h4>
                <p class="modal-sub" data-i18n="modal.strategyConfigSub">保存至 panel_profile。</p>
              </div>
              <button type="button" id="closeStrategyMemoModal" class="ghost modal-close-btn" data-i18n="btn.close">关闭</button>
            </header>
            <div class="modal-body">
              <div class="binding-grid binding-grid--modal strategy-memo-grid">
                <label class="binding-field">
                  <span class="binding-field-label" data-i18n="label.strategyName">策略名称 / 偏好</span>
                  <input id="mStrategyName" name="mStrategyName" type="text" autocomplete="off" maxlength="200" />
                </label>
                <label class="binding-field">
                  <span class="binding-field-label" data-i18n="label.strategyRpcBase">独立 trade 进程 API 基址</span>
                  <input
                    id="mStrategyRpcBase"
                    name="mStrategyRpcBase"
                    type="url"
                    inputmode="url"
                    autocomplete="off"
                    spellcheck="false"
                    maxlength="512"
                    data-i18n-placeholder="placeholder.strategyRpcBase"
                    placeholder="留空则使用设置中心全局 Base URL；多实例示例 http://127.0.0.1:18081/api/v1"
                  />
                  <p class="modal-hint binding-checkbox-hint" data-i18n="label.strategyRpcBaseHint">
                    每个 Bovin trade 进程一个端口与独立 config/db。填此处后该策略卡片单独对该地址执行 /start、/pause、/show_config；须与全局使用相同 API 账号密码，并在各进程 config 中放行浏览器来源（CORS）。
                  </p>
                </label>
                <div class="binding-field">
                  <label class="binding-field-label" for="mControlShowStrategyCards" data-i18n="settings.controlShowStrategyCards">在策略 AI 控制台展示策略卡片列表</label>
                  <div class="binding-checkbox-control">
                    <input
                      type="checkbox"
                      id="mControlShowStrategyCards"
                      name="mControlShowStrategyCards"
                      aria-describedby="mControlShowStrategyCardsHint"
                    />
                    <p class="modal-hint binding-checkbox-hint" id="mControlShowStrategyCardsHint" data-i18n="settings.controlShowStrategyCardsHint">
                      仅对本条策略生效：关闭后该策略在控制台不再展示来自 /panel/strategies 的多卡片网格，仅显示简短说明。
                    </p>
                  </div>
                </div>
                <label class="binding-field">
                  <span class="binding-field-label">
                    <span data-i18n="label.strategyAuthorizedAmount">授权金额</span><span id="mStrategyAuthorizedStakeCur" class="strategy-authorized-stake-cur mono"></span>
                  </span>
                  <input id="mStrategyAuthorizedAmount" name="mStrategyAuthorizedAmount" type="number" step="any" min="0" autocomplete="off" data-i18n-placeholder="placeholder.strategyAuthorizedAmount" />
                </label>
                <label class="binding-field">
                  <span class="binding-field-label" data-i18n="label.strategyTargetAnnualReturnPct">目标年化收益 (%)</span>
                  <input id="mStrategyTargetAnnualReturnPct" name="mStrategyTargetAnnualReturnPct" type="number" step="0.1" min="0" autocomplete="off" data-i18n-placeholder="placeholder.riskPercent" placeholder="例: 15" />
                </label>
                <div class="binding-field">
                  <label class="binding-field-label" for="mAiTakeoverTrading" data-i18n="label.aiTakeoverTrading">启用 AI 接管交易</label>
                  <div class="binding-checkbox-control">
                    <input
                      type="checkbox"
                      id="mAiTakeoverTrading"
                      name="mAiTakeoverTrading"
                      aria-describedby="mAiTakeoverTradingHint"
                    />
                    <p class="modal-hint binding-checkbox-hint" id="mAiTakeoverTradingHint" data-i18n="label.aiTakeoverTradingHint">
                      跳过经典策略路径，启用 AI 接管交易（面板标记，需外部 AI 编排配合）
                    </p>
                  </div>
                </div>
                <div class="binding-field">
                  <label class="binding-field-label" for="mPaperTrading" data-i18n="label.paperTrading">模拟交易（仅用 AI，不调交易 API）</label>
                  <div class="binding-checkbox-control">
                    <input
                      type="checkbox"
                      id="mPaperTrading"
                      name="mPaperTrading"
                      aria-describedby="mPaperTradingHint"
                    />
                    <p class="modal-hint binding-checkbox-hint" id="mPaperTradingHint" data-i18n="label.paperTradingHint">
                      开启后仍可使用对接里的 LLM 等 AI 接口与面板规则备忘；控制台不调用 /start、/pause 等机器人交易接口，「同步并启动」仅保存配置、不请求 /start。
                    </p>
                  </div>
                </div>
                <div class="binding-field">
                  <label class="binding-field-label" for="mRiskUseFreqaiLimits" data-i18n="label.riskUseFreqaiLimits">优先采用 Bovin AI 回撤上限</label>
                  <div class="binding-checkbox-control">
                    <input
                      type="checkbox"
                      id="mRiskUseFreqaiLimits"
                      name="mRiskUseFreqaiLimits"
                      aria-describedby="mRiskUseFreqaiLimitsHint"
                    />
                    <p class="modal-hint binding-checkbox-hint" id="mRiskUseFreqaiLimitsHint" data-i18n="label.riskUseFreqaiLimitsHint">
                      回撤上限优先使用 Bovin AI 的 max_training_drawdown_pct（与下方手动百分比二选一展示）
                    </p>
                  </div>
                </div>
                <label class="binding-field">
                  <span class="binding-field-label" data-i18n="label.riskMaxDrawdownLimitPct">最大回撤上限 (%)</span>
                  <input id="mRiskMaxDrawdownLimitPct" name="mRiskMaxDrawdownLimitPct" type="number" step="0.1" min="0" max="100" autocomplete="off" placeholder="例: 20" data-i18n-placeholder="placeholder.riskPercent" />
                </label>
                <label class="binding-field">
                  <span class="binding-field-label" data-i18n="label.riskThresholdPct">风险阈值 (%)</span>
                  <input id="mRiskThresholdPct" name="mRiskThresholdPct" type="number" step="0.1" min="0" max="100" autocomplete="off" placeholder="例: 10" data-i18n-placeholder="placeholder.riskPercent" />
                </label>
                <label class="binding-field">
                  <span class="binding-field-label" data-i18n="label.strategyNotes">说明与参数备忘</span>
                  <textarea id="mStrategyNotes" name="mStrategyNotes" rows="4" autocomplete="off"></textarea>
                </label>
                <label class="binding-field">
                  <span class="binding-field-label" data-i18n="label.strategyExtraJson">扩展 JSON（可选）</span>
                  <textarea id="mStrategyExtraJson" name="mStrategyExtraJson" rows="4" autocomplete="off" spellcheck="false"></textarea>
                </label>
                <label class="binding-field">
                  <span class="binding-field-label" data-i18n="label.strategyRulesOutput">策略规则输出</span>
                  <textarea id="mStrategyRulesOutput" name="mStrategyRulesOutput" rows="6" autocomplete="off" spellcheck="false"></textarea>
                </label>
                <label class="binding-field">
                  <span class="binding-field-label" data-i18n="label.strategySlotDetailJson">详细策略 JSON</span>
                  <textarea id="mEntrySlotDetailJson" name="mEntrySlotDetailJson" rows="6" autocomplete="off" spellcheck="false"></textarea>
                </label>
                <label class="binding-field">
                  <span class="binding-field-label" data-i18n="label.strategySlotMml">MML</span>
                  <textarea id="mEntrySlotMml" name="mEntrySlotMml" rows="6" autocomplete="off" spellcheck="false"></textarea>
                </label>
                <p class="modal-hint strategy-slot-hint" data-i18n="hint.strategySlotEither">与全局「扩展 JSON」不同：按策略类名存储，供控制台卡片与外部工具使用。</p>
                <div class="binding-field">
                  <label class="binding-field-label" for="mStrategyShowOnConsole" data-i18n="settings.manualStrategyShowOnConsole">控制台展示卡片</label>
                  <div class="binding-checkbox-control">
                    <input
                      type="checkbox"
                      id="mStrategyShowOnConsole"
                      name="mStrategyShowOnConsole"
                      aria-describedby="mStrategyShowOnConsoleHint"
                    />
                    <p class="modal-hint binding-checkbox-hint" id="mStrategyShowOnConsoleHint" data-i18n="settings.manualStrategyShowOnConsoleHint">
                      仅对本条策略：开启后在策略 AI 控制台展示该策略对应卡片（含 JSON/MML）；未出现在 /panel/strategies 时也可手工维护类名。
                    </p>
                  </div>
                </div>
                <p class="modal-hint strategy-file-hint" data-i18n="hint.strategyFileManual">要把接管期间的交易逻辑固化成可复用的主策略：请根据操作/决策日志整理要点，或借助 LLM 生成策略代码草稿，再在 user_data/strategies 中手动保存并后续迭代。本处仅存备忘与规则文本，不会自动写入 .py 策略文件。</p>
              </div>
            </div>
            <footer class="modal-actions">
              <button type="button" id="saveStrategyMemoModal" class="primary" data-i18n="btn.saveStrategyConfig">保存配置</button>
            </footer>
          </div>
        </div>

        <div id="strategySlotModal" class="modal hidden" role="presentation">
          <div class="modal-mask" aria-hidden="true"></div>
          <div class="modal-card modal-card--binding modal-card--strategy-slot" role="dialog" aria-modal="true" aria-labelledby="strategySlotModalTitle">
            <header class="modal-head modal-head--binding">
              <div class="modal-head-text">
                <h4 id="strategySlotModalTitle" class="modal-title" data-i18n="modal.strategySlotTitle">策略 JSON / MML</h4>
                <p class="modal-sub" data-i18n="modal.strategySlotSub">按策略类名保存；详细策略 JSON 与 MML 可只填其一，也可同时填写。</p>
              </div>
              <button type="button" id="closeStrategySlotModal" class="ghost modal-close-btn" data-i18n="btn.close">关闭</button>
            </header>
            <div class="modal-body">
              <div class="strategy-slot-modal-layout">
                <section class="strategy-slot-modal-top" aria-labelledby="strategySlotSelectLabel">
                  <label id="strategySlotSelectLabel" class="strategy-slot-select-wrap">
                    <span class="binding-field-label" data-i18n="label.strategySlotName">策略类名</span>
                    <input type="hidden" id="mStrategySlotNameSelect" name="mStrategySlotNameSelect" value="" autocomplete="off" />
                    <a-select
                      v-model:value="strategySlotClassName"
                      :options="strategySlotOptions"
                      allow-clear
                      show-search
                      :filter-option="filterStrategySlotOption"
                      class="bovin-select-full strategy-slot-ant-select"
                      popup-class-name="bovin-select-dropdown"
                      :get-popup-container="selectPopupContainer"
                      :placeholder="strategySlotPlaceholder"
                      :aria-label="strategySlotAria"
                    />
                  </label>
                </section>
                <div class="strategy-slot-modal-columns">
                  <label class="binding-field strategy-slot-field">
                    <span class="binding-field-label" data-i18n="label.strategySlotDetailJson">详细策略 JSON</span>
                    <textarea id="mStrategySlotDetailJson" name="mStrategySlotDetailJson" rows="10" autocomplete="off" spellcheck="false"></textarea>
                  </label>
                  <label class="binding-field strategy-slot-field">
                    <span class="binding-field-label" data-i18n="label.strategySlotMml">MML</span>
                    <textarea id="mStrategySlotMml" name="mStrategySlotMml" rows="10" autocomplete="off" spellcheck="false"></textarea>
                  </label>
                </div>
                <p class="modal-hint strategy-slot-hint" data-i18n="hint.strategySlotEither">与全局「策略配置」中的扩展 JSON 不同：此处按每张策略卡片单独存储，供编排或外部工具使用。</p>
              </div>
            </div>
            <footer class="modal-actions">
              <button type="button" id="saveStrategySlotModal" class="primary" data-i18n="btn.saveStrategySlot">保存</button>
            </footer>
          </div>
        </div>

        <div id="whitelistAddModal" class="modal hidden" role="presentation">
          <div class="modal-mask" aria-hidden="true"></div>
          <div
            class="modal-card modal-card--binding modal-card--whitelist-add"
            role="dialog"
            aria-modal="true"
            aria-labelledby="whitelistAddModalTitle"
          >
            <header class="modal-head modal-head--binding">
              <div class="modal-head-text">
                <h4 id="whitelistAddModalTitle" class="modal-title" data-i18n="modal.whitelistAddTitle">添加白名单</h4>
                <p class="modal-sub" data-i18n="modal.whitelistAddSub">每行一个交易对，可添加多条后一次性提交。</p>
              </div>
              <button type="button" id="closeWhitelistAddModal" class="ghost modal-close-btn" data-i18n="btn.close">
                关闭
              </button>
            </header>
            <div class="modal-body">
              <div id="whitelistAddRows" class="whitelist-add-rows"></div>
              <button type="button" id="whitelistAddRowBtn" class="ghost whitelist-add-row-btn" data-i18n="modal.whitelistAddRow">
                添加一条
              </button>
            </div>
            <footer class="modal-actions">
              <button type="button" id="saveWhitelistAddModal" class="primary" data-i18n="btn.submitWhitelistAdd">
                提交添加
              </button>
            </footer>
          </div>
        </div>

      </main>
    </div>
</template>

<script setup>
import { onMounted, onUnmounted, nextTick, ref, watch } from "vue";
import { BellOutlined, BulbOutlined, BulbFilled, UserOutlined } from "@ant-design/icons-vue";
import { startPanelApp, registerSectionRouteNavigator } from "../app.js";
import { panelRouter } from "../router/index.js";
import { createSectionRouteNavigator } from "../router/bridge.js";
import PanelSections from "./components/PanelSections.vue";

registerSectionRouteNavigator(createSectionRouteNavigator(panelRouter));

const selectPopupContainer = () => document.body;

const llmProviderVal = ref("deepseek");
const llmProviderOptions = [
  { value: "deepseek", label: "DeepSeek" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" }
];

const permSelectOptions = [
  { value: "read", label: "只读" },
  { value: "edit", label: "编辑" },
  { value: "hidden", label: "不可见" }
];

const puPermOverview = ref("read");
const puPermPositions = ref("read");
const puPermControl = ref("read");
const puPermData = ref("read");
const puPermSettings = ref("read");
const puPermMonitor = ref("read");
const puPermApi = ref("read");

const strategySlotClassName = ref(undefined);
const strategySlotOptions = ref([]);
const strategySlotPlaceholder = "选择或搜索策略类名";
const strategySlotAria = "选择要编辑槽位的策略类名";

function filterStrategySlotOption(input, option) {
  const q = String(input || "").trim().toLowerCase();
  const label = String(option?.label ?? option?.value ?? "").toLowerCase();
  return !q || label.includes(q);
}

function syncHiddenSelect(id, value) {
  const el = document.getElementById(id);
  if (el instanceof HTMLInputElement && el.type === "hidden") {
    el.value = value == null || value === "" ? "" : String(value);
  }
}

watch(llmProviderVal, (v) => syncHiddenSelect("mLlmProvider", v));
watch(puPermOverview, (v) => syncHiddenSelect("puPerm-overview", v));
watch(puPermPositions, (v) => syncHiddenSelect("puPerm-positions", v));
watch(puPermControl, (v) => syncHiddenSelect("puPerm-control", v));
watch(puPermData, (v) => syncHiddenSelect("puPerm-data", v));
watch(puPermSettings, (v) => syncHiddenSelect("puPerm-settings", v));
watch(puPermMonitor, (v) => syncHiddenSelect("puPerm-monitor", v));
watch(puPermApi, (v) => syncHiddenSelect("puPerm-api", v));
watch(strategySlotClassName, (v) => syncHiddenSelect("mStrategySlotNameSelect", v));

function onFormFieldPatch(ev) {
  const d = ev?.detail;
  if (!d || d.id !== "mLlmProvider") return;
  llmProviderVal.value = String(d.value || "deepseek");
}

function onStrategySlotNames(ev) {
  const names = ev?.detail?.names;
  if (!Array.isArray(names)) return;
  const opts = names.map((x) => {
    const s = String(x ?? "").trim();
    return s ? { value: s, label: s } : null;
  }).filter(Boolean);
  strategySlotOptions.value = opts;
}

onMounted(async () => {
  window.addEventListener("bovin-form-patch", onFormFieldPatch);
  window.addEventListener("bovin-strategy-slot-names", onStrategySlotNames);
  await nextTick();
  await startPanelApp();

  const readHidden = (id, assign) => {
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement && el.type === "hidden" && el.value) assign(el.value);
  };
  readHidden("mLlmProvider", (v) => {
    llmProviderVal.value = v;
  });
  readHidden("puPerm-overview", (v) => {
    puPermOverview.value = v;
  });
  readHidden("puPerm-positions", (v) => {
    puPermPositions.value = v;
  });
  readHidden("puPerm-control", (v) => {
    puPermControl.value = v;
  });
  readHidden("puPerm-data", (v) => {
    puPermData.value = v;
  });
  readHidden("puPerm-settings", (v) => {
    puPermSettings.value = v;
  });
  readHidden("puPerm-monitor", (v) => {
    puPermMonitor.value = v;
  });
  readHidden("puPerm-api", (v) => {
    puPermApi.value = v;
  });
  readHidden("mStrategySlotNameSelect", (v) => {
    strategySlotClassName.value = v;
    if (v && !strategySlotOptions.value.some((o) => o.value === v)) {
      strategySlotOptions.value = [...strategySlotOptions.value, { value: v, label: v }];
    }
  });

  const current = String(panelRouter.currentRoute.value.name || "").trim();
  if (!current || !panelRouter.hasRoute(current)) {
    void panelRouter.replace({ name: "overview" });
  }
});

onUnmounted(() => {
  window.removeEventListener("bovin-form-patch", onFormFieldPatch);
  window.removeEventListener("bovin-strategy-slot-names", onStrategySlotNames);
});
</script>
