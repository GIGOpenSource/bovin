# 前端 ↔ Bovin API 对接清单

说明：后端按 **runmode** 挂载路由：`api_trading` 需 `TRADE_MODES`（如 dry-run / live）；`api_webserver` 等需 `webserver` 模式。同一进程不会同时满足两者，部分接口在错误模式下返回 **503**。

## 1. 前端已调用接口

| 接口 | 用途 | 所需模式 / 依赖 | 备注 |
|------|------|-----------------|------|
| `GET /ping` | 总览 Bot 状态占位 | 无 | 公开。 |
| `GET /sysinfo` | 系统信息面板 | 无 | 公开。 |
| `GET /show_config` | 运行模式提示等 | 可选 RPC | `get_rpc_optional`。 |
| `GET /logs` | 日志面板 | 需认证 | 静态 RPC，无 RPC 时仍可返回。 |
| `GET /health` | KPI 健康时间 | 需认证 + **RPC** | `Depends(get_rpc)`，纯 webserver 无交易进程时会失败。 |
| `GET /count` | 未平仓数量 KPI | **交易模式** | |
| `GET /profit` | 总收益 KPI | **交易模式** | 前端读取 `profit_all_coin` / `profit_all_fiat` 等（与 `Profit` 模型一致）。 |
| `GET /status` | 持仓表格 | **交易模式** | |
| `GET /trades` | 「待成交/订单」表数据 | **交易模式** | ⚠️ 服务端 **`/trades` 仅为已平仓记录**，与 UI 文案「Pending」语义不一致。 |
| `GET /whitelist`、`GET /blacklist` | 列表展示 | **交易模式** | |
| `POST /blacklist` | 拉黑交易对 | **交易模式** | 前端未接 `DELETE /blacklist`。 |
| `POST /forceenter`、`POST /forceexit` | 控制台 | **交易模式** | |
| `GET /strategies`、`GET /available_pairs` | 数据面板下拉与历史 | **webserver**（或与 pair_history 同组挂载） | |
| `GET /pair_history` | K 线/历史信号 | **webserver** | |
| `GET /pair_candles` | mock、“加载历史”按钮、回退 | **交易模式** | 非 mock 实盘 K 线主要走 Binance/Bybit/本地代理，**未优先**走此接口。 |
| `POST /start`、`/pause`、`/stop`、`/reload_config` | 控制台按钮 | **交易模式** | |
| `GET/POST /panel/preferences` | 面板 **模拟开关**、**Bovin 连接**、**账号/钱包/策略备忘**、交易所/LLM 绑定 | **任意模式**（需认证） | **SQLite**：`user_data/panel_store.sqlite`。表：`panel_settings`（`simulation_ui`、`theme`）、`panel_api_binding`（交易所/LLM 行）、`panel_profile`（单行 `id=1`：`baseUrl`/`username`/`password` 映射列、`account_name`、`wallet_*`、`strategy_*` 等）。旧的 `panel_preferences.json` 在库为空时自动导入并重命名为 `panel_preferences.json.bak_imported`。 |
| `GET /panel/ticker` | 数据面板 headline **24h 涨跌**（交易所 ccxt） | **任意模式**（需认证） | 依赖配置交易所公共行情；失败时前端仍用 K 线兜底。 |

## 2. 服务端主要能力、前端未使用（缺口候选）

若产品需要「一站全量控制台」，可考虑后续接入：

- **资金与绩效**：`GET /balance`、`/performance`、`/profit_all`、`/stats`、`/daily`、`/weekly`、`/monthly`
- **交易细节**：`GET /trade/{id}`、`DELETE /trades/{id}`、订单相关删除/重载、custom-data
- **黑名单**：`DELETE /blacklist`
- **锁仓**：`GET/POST/DELETE /locks`
- **行情/策略元数据**：`GET /markets`、`GET /version`、`GET /strategy/{name}`、`GET /plot_config`
- **回放/下载/回测**：`/backtest*`、`/download_data`、`/background*`、`/pairlists/*`
- **WebSocket**：实时推送（若后端已启用）

## 3. 已知语义/展示问题

1. **`/health` 响应模型**（`Health`）字段为 `last_process` 等；前端已兼容 `last_process`，若扩展模型可增加本地化时间显示。
2. **webserver 模式**下：总览里 `/count`、`/profit`、`/status` 等会 503，属预期；前端已有 `runmode === "webserver"` 的日志提示。
3. **数据面板**：实盘蜡烛来自交易所 HTTP；与 bot 内数据可能不完全一致。
4. **装饰性 UI**（Connect Wallet、部分 KPI/风险矩阵占位）与 Bovin API **无对应**。

## 3.1 设置页与 `/panel/preferences` 字段

**GET** 返回：`simulation_ui`、`theme`、`api_bindings`（snake_case，与机器人 REST 风格一致）以及档案字段（camelCase）：`baseUrl`、`username`、`password`、`strategyName`、`strategyNotes`、`strategyExtraJson`。`panel_profile` 仍保留 `account_name` / `wallet_*` 等列且接口可读，但设置页已不再编辑；`POST` 未传对应字段时按模型默认空串更新。

**POST** 请求体沿用同一套字段名；服务端 `save_panel_state` 会对**空密码**与**脱敏后的空密钥**与库内旧值做合并，避免误清空。前端在模拟开关、绑定增删、**保存连接**或各设置弹窗保存时会 POST 当前完整 `state`。

**`panel_profile` 说明**：存的是面板侧「连接 + 展示备忘」，**不是** Bovin `config.json` 里的交易所密钥；密码等为明文 SQLite，与 `panel_api_binding` 中密钥风险同级。策略多行配置以 **`strategy_entries_json`**（接口字段 `strategyEntries`）为权威。

## 3.2 设置页「API 对接关系列表」说明

- 该列表数据来自 **`GET/POST /panel/preferences`**（`panel_api_binding` 表）并与 `localStorage` 缓存同步；旧版 JSON 会一次性迁移进库。
- **与 Bovin 机器人真实交易配置无关**：`config.json` 中的币安 API **不会**自动出现在此列表；可通过 **`GET /show_config`** 看交易所名称等元信息（不含密钥）。
- 若希望在列表里看到币安：在设置页 **新增关系** 并在弹窗内保存，或点击 **保存连接** 将当前整包偏好写入 SQLite。

## 3.3 数据结构梳理：三块永久落库与「策略 AI 控制台」联动

以下均为 **非 mock** 下的设计真源；mock 模式仅在浏览器内存/本地演示。

### 3.3.1 三块设置数据的永久存储（SQLite `user_data/panel_store.sqlite`）

| 设置中心区块 | 数据库位置 | HTTP 接口 | 说明 |
|--------------|------------|-----------|------|
| **API integration map**（API 对接映射） | 表 **`panel_api_binding`**（多行；保存时整表按 POST 顺序重写，并与旧行按索引合并密钥） | `GET/POST /panel/preferences` 的 `api_bindings` | 浏览器 `localStorage` 仅存**脱敏**副本，**不能**当作权威数据。 |
| **Strategy config**（策略配置 Tab + 策略配置/策略槽弹窗） | 表 **`panel_profile`**（`id=1`）：**`strategy_entries_json`**、`strategy_slots_json`、衍生列及首行扁平策略字段等 | `GET/POST /panel/preferences` 的 `strategyEntries`、`strategySlots` 等 camelCase 字段 | 多条策略以 **`strategyEntries`** 数组为权威；`strategySlots` 按策略类名存 JSON/MML。 |
| **Users**（用户与菜单权限） | 表 **`panel_user`**、**`panel_user_menu`** | `GET/POST /panel/users`、`PATCH/DELETE /panel/users/{id}`、`POST /panel/auth/login` | **不在** `/panel/preferences` 的 POST 体内维护；与面板登录相关，与 Bovin REST Basic 账号相互独立。 |

连接字段（Base URL、Bovin REST 用户名/密码）也在 **`panel_profile`** 中，随同一 `POST /panel/preferences` 持久化。

### 3.3.2 Strategy AI Console 策略展示 ← Strategy config 规则

实现入口：`frontend/src/control-console.js` 中 **`renderControlStrategyCards`**（由 **`renderControlHeroAndCards`** 调用）。

| 规则 | 数据来源（Strategy config → `state`） | 作用 |
|------|----------------------------------------|------|
| **候选策略类名列表** | `GET /panel/strategies` → `uiState.panelStrategyList`；与 **`state.manualStrategyNames`**（由 `strategyEntries` 推导）、机器人 **`show_config.strategy`**、**`state.strategyName`** 经 **`orderedStrategyNames`** 合并排序 | 决定控制台可能出现哪些策略名。 |
| **是否隐藏整张卡片** | **`strategyHiddenFromConsole`**（条目上 `showOnConsole: false` 的策略名集合） | 从候选列表中剔除，不渲染该策略。 |
| **完整卡片 vs 简短提示条** | **`strategyEntries`** 中与类名匹配行的 **`controlShowStrategyCards`**（`entryWantsStrategyGrid`） | 关闭时仅显示简短说明卡片，不展示完整多指标卡片布局。 |
| **卡片内 KPI**（授权金额、目标年化、备忘摘要、AI 接管等） | 同上 **`strategyEntries`** 中匹配 **`strategyName`** 的条目；缺省字段回退全局 `state.*` | `formatPanelStrategyKpisHtml`。 |
| **JSON/MML 槽位与编辑按钮** | **`state.strategySlots[strategyClassName]`**（库列 `strategy_slots_json`） | `formatStrategySlotRowHtml`。 |
| **机器人启停/强平等操作挂在哪张卡** | 与 **`show_config.strategy`** 同名，或无配置时与 **`state.strategyName`**（首条偏好）同名的一张卡视为「当前焦点」 | `metricsActive`；其余卡为「未激活」展示。 |

**小结**：控制台**展示哪些策略、是否显示、卡片形态与面板 KPI 文案**由 **Strategy config**（`strategyEntries` + `strategySlots` + 隐藏列表）决定；**当前实盘跑哪条策略**仍以 Bovin **`show_config` / `config.json`** 为准，二者可以不同（例如面板备忘多条、机器人只跑一条）。

### 3.3.3 前端：展示 / 编辑 / 保存以数据库为真源（非 mock）

- **展示**：登录或恢复会话后先 **`await GET /panel/preferences`** 与 **`GET /panel/users`**，再 **`setConfigInputs`**，避免未拉库前用 `localStorage` 冒充服务端数据。
- **编辑**：表单与弹窗改 `state`；用户表走 **`/panel/users*`**。
- **保存**：**`POST /panel/preferences`** 写 SQLite；用户写用户接口。若 GET 偏好失败，清空对接/策略占位并显示 `#settingsDbSourceHint`（`settings.prefsLoadFailed`），不再回退到本地脱敏绑定当真相。

## 4. 维护建议

- 新增页面功能时，在本表追加一行：**接口 / 模式 / UI 区块 / 已接或计划**。
- Mock（`mockApiCall`）中 `/profit` 已补充与正式 API 对齐的字段名，便于本地联调。

## 5. 有展示但服务端未对接 / 仅视觉稿（汇总）

以下按页面归类：「**未对接**」= 无对应 Bovin API 或按钮无逻辑；「**伪数据**」= 走了接口但表格/数字用公式或占位规则生成，**不能当实盘**。

### 5.1 顶栏 `topbar`

| 展示项 | 状态 |
|--------|------|
| `Network Status: Stable` / `Market: Open` | 静态文案 |
| `System Online` 徽章 | 静态 |
| **Connect Wallet** | 无链上/钱包逻辑，与 Bovin 无关 |
| 通知 / 主题 / 账户图标 | 无功能绑定 |

### 5.2 系统概览 `overview`

| 展示项 | 状态 |
|--------|------|
| Hero 侧栏 **Latency 15ms**、**Uptime 99.98%** | 静态 |
| KPI 卡副标题：`+2.4%`（首卡 `em` 初值）、**Target Met**、**Risk Threshold** | HTML 初值；首卡 `em` 登录后会被 `ping` 替换，其余副标题仍静态 |
| 卡一标题为「Net Value」，实际大数字为 **未平仓笔数**（`/count`），语义不一致 | 产品文案/字段待对齐 |
| 卡三标题为「Total Drawdown」，实际为 **`/health` 最近处理时间** | 文案与数据不对齐 |
| **Risk Exposure Matrix**（杠杆率、行业板块占比条） | 完全静态 |
| **Active Strategies** 表格（3 行示例策略、24h PnL 等） | 完全静态，与 `show_config.strategy` 等未联动 |
| 迷你走势图 `svg path` | 装饰，非真实净值曲线 |

### 5.3 持仓与订单 `positions`

| 展示项 | 状态 |
|--------|------|
| **Total Floating P&L** | 已用 `/status` 汇总 `profit_abs`（依赖字段含义与 stake 币种） |
| **Active Exposure** | **伪数据**：`行数 × 71445.06`（`main.js`），非 `/balance` 或名义仓位 |
| 持仓表 **Current Price** | **伪数据**：由 `open_rate` 与 `profit_abs` 推算，非行情 |
| **Position Size** 列 | **伪数据**：按交易对前缀写死 BTC/ETH/SOL 文案 |
| 配对下方小字 **Cross 10x / Isolated 20x** | **伪数据**：未读真实杠杆 |
| **Close Position** 按钮 | 未接 `forceexit` / 单笔接口 |
区块 **Pending Orders** | 数据来自 **`/trades`（已平仓）**，与「挂单/待成交」语义不符；表内订单类型、价格、数量、状态均为 **规则伪造** |
| **Filter** / **Cancel All** | 无逻辑 |

### 5.4 策略控制台 `control`

| 展示项 | 状态 |
|--------|------|
| Hero **Total PnL (24h)** `+$14,204.42` | 静态 |
| 多张 **sc-card**（策略名、ID、Performance %、Exposure、Uptime、Last Run） | 静态；仅部分按钮接 `POST /start|pause|stop|reload_config` |
| **Force Close All Positions** | 需确认是否接 `forceexit`（与单卡逻辑并列存在） |
| **Backtest** | 未接 `/backtest` |
| **Asset Access Governance**：白名单/黑名单可视化列表、**Export Config**、**Add Asset**、条目上的关闭/撤销 | **静态演示**；真实 JSON 在隐藏区 `#whitelist` / `#blacklist`，与主视觉不同区块 |
| **Live Execution Feed** | 静态示例流；**View Full Audit Logs** 未接 |

标记为 **`sc-card-demo` / `feed-row-demo`** 的区块在设计上是「非真实」演示。

### 5.5 数据面板 `data`

| 展示项 | 状态 |
|--------|------|
| Hero **NODE_ACTIVE**、**LATENCY: 12MS** | 静态 |
| 左侧 **Strategies** 列表 | **名称**来自 `GET /strategies`；**收益率、WIN RATE** 为前端哈希生成的 **伪指标**，非回测/实盘统计 |
| **NETWORK_VOLUME** 柱状 | 静态 CSS 高度 |
| 图表区 **Price**、**24h Chg** | 来自 **当前 K 线最后两根收盘价**；文案写「24h」时实为 **相邻 K 线涨跌**，与交易所 24h ticker 不一致（除非用 1d 且自行约定） |
| 工具栏 **tune** 按钮 | 无功能 |
| **EXPORT_CSV** | 需确认是否仅导出当前 DOM 数据（非独立报表 API） |

行情 **Board**（`renderMarketBoard`）数据来自 Binance/Bybit **公开 REST**，不是 Bovin。

### 5.6 设置中心 `settings`

| 展示项 | 状态 |
|--------|------|
| **Panel Backend**（Base URL / 用户名 / 密码） | 写入 `panel_profile`，`GET/POST /panel/preferences` 同步 |
| **账号 / 钱包 / 策略备忘** | 写入 `panel_profile`，同上 |
| **API 对接关系列表**（交易所 Key、大模型 Key 等） | **`panel_api_binding` + SQLite**，非 Bovin 交易 `config.json` |

### 5.7 接口能力面板 `api`

| 展示项 | 状态 |
|--------|------|
| `endpointCatalog` 表格 | 人工维护子集，**未穷尽** FastAPI 全部路由；不等同于「已在前端业务中对接」 |

---

**归纳**：凡 **DeFi 钱包、行业板块、多策略 KPI、执行 Feed、治理台清单、控制台大数字 hero** 等仍为 **产品壳**；与 Bovin **强相关**且建议优先对齐的是：持仓表的 **真实字段**（`OpenTradeSchema`）、**名义金额/杠杆**（`/status` + `/balance`）、**订单/平仓**语义（应用 `/status` 开仓 + 订单 API，而非把 `/trades` 当挂单），以及概览 KPI **文案与字段**一致。
