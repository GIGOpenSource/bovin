# Bovin 前端控制台

该目录为基于 `量化` 需求文档和 `stitch` 视觉稿整理的前端实现，**产品品牌为 Bovin / Bovin AI**，与 **Bovin 核心（兼容原 Freqtrade 协议与目录习惯）** 的服务端能力对齐。

## 页面结构

- `总览仪表盘`：`/ping` `/health` `/count` `/profit` `/sysinfo` `/logs`
- `持仓与订单`：`/status` `/trades`
- `策略AI控制台`：`/start` `/pause` `/stop` `/reload_config` `/forceenter` `/forceexit` `/whitelist` `/blacklist`
- `数据面板`：`/available_pairs` `/pair_candles` `/pair_history` `/strategies`
- `接口能力面板`：内置服务端接口目录，便于前后端一致性核查

## 测试与排障文档（已迁至 `docs/panel/`）

- **总索引（交易 + 面板）**：[../docs/文档索引-交易与面板.md](../docs/文档索引-交易与面板.md)  
- **开发文档**：[../docs/panel/DEVELOPMENT.md](../docs/panel/DEVELOPMENT.md)  
- **部署要点与交易所对接异常速查**：[../docs/panel/DEPLOYMENT.md](../docs/panel/DEPLOYMENT.md)  
- **风险与隐患审计**：[../docs/panel/RISKS_AND_AUDIT.md](../docs/panel/RISKS_AND_AUDIT.md)  
- 全站字段级测试清单：[../docs/panel/TEST_CHECKLIST.md](../docs/panel/TEST_CHECKLIST.md)  
- K 线链路说明：[../docs/panel/KLINE_PIPELINE.md](../docs/panel/KLINE_PIPELINE.md)  
- 量化与 AI 名词表：[../docs/量化与AI量化知识名词表.md](../docs/量化与AI量化知识名词表.md)

## UI 与交互规范（标准化）

- **设计令牌**（`styles.css` 的 `:root`）：`--ft-radius-control`、`--ft-radius-icon`、`--ft-radius-card`、`--ft-control-min-h`、`--ft-transition`、`--ft-focus-ring` 等，供按钮、输入框、卡片、模态统一引用。
- **焦点**：主要可点击控件支持 `:focus-visible` 键盘焦点环；系统开启「减少动态效果」时全局缩短 `transition`。
- **导航**：侧栏 `.nav-btn` 切换时写入 **`aria-current="page"`**，仅作用于 `.sidebar-nav` 内按钮，避免误匹配其它 `data-section` 元素。

## 部署

- **本地化 vs 服务器、HTTPS、反代与验收清单**：见 **[部署指南.md](./部署指南.md)**。

## 运行方式

**推荐（全流程：交易 API + 代理 + 面板）**：在仓库根目录执行（默认启动 **`bovin trade`**，策略控制台可 `/start`）：

```bash
chmod +x scripts/start_panel_dev.sh && ./scripts/start_panel_dev.sh
```

仅数据/回测、不需要面板启停机器人时：`BOVIN_MODE=webserver ./scripts/start_panel_dev.sh`

---

仅静态面板（需已自行启动 Bovin 与代理）时，在项目（fork）根目录执行：

```bash
python3 -m http.server 3000 --directory frontend
```

浏览器访问：

- 本机：`http://127.0.0.1:3000`
- **局域网其它设备**：电脑与手机需在同一局域网；用 **宿主机的局域网 IPv4**（如 `http://192.168.1.5:3000`）。`start_frontend.sh` 默认监听 `0.0.0.0` 已允许外网卡访问；若仍无法打开，检查 **系统防火墙** 是否放行该端口。仅需本机时可：`FRONTEND_HOST=127.0.0.1 ./start_frontend.sh`

前端启动前可先执行健康检查：

```bash
cd frontend
chmod +x check_frontend_health.sh
./check_frontend_health.sh
```

该脚本会检查：

- `GET /health`
- `GET /api/v1/ticker24hr`（样例 `BTCUSDT` / `ETHUSDT`）

也可以使用一键启动脚本（先检查，再启动）：

```bash
cd frontend
chmod +x start_frontend.sh
./start_frontend.sh
```

可选参数：

- 仅检查不启动：`./start_frontend.sh --check-only`
- 自定义端口：`FRONTEND_PORT=3001 ./start_frontend.sh`
- 仅监听本机（禁止局域网）：`FRONTEND_HOST=127.0.0.1 ./start_frontend.sh`

**HTTPS 局域网**：`python3 serve_https_lan.py` 默认已为 `0.0.0.0:3443`；手机访问 `https://<电脑局域网IP>:3443/` 时需在手机上信任自签名证书或点「高级 → 继续」。

**HTTP + HTTPS 同时开**（本机用 HTTP、手机用 HTTPS 均可）：`chmod +x start_frontend_dual.sh && ./start_frontend_dual.sh` —— 并行监听默认 **HTTP `:3000`** 与 **HTTPS `:3443`**（后者带 `/api/v1`、`/health` 反代）。前端逻辑已对两种协议自动选 API 基址（HTTPS 走同源反代；HTTP 局域网 IP 走 `http://<同主机>:19090`，须在服务端配置 CORS）。

## 服务端要求

1. **本机 Bovin REST API**（例如 `http://127.0.0.1:18080`，端口以你配置为准）需已启动。
2. **推荐：经本地聚合代理访问（避免内置浏览器 / 跨端口 CORS 导致的 `Failed to fetch`）**  
   - 启动：`python3 frontend/binance_proxy.py`（默认监听 `19090`）  
   - 代理会把 `/api/v1/klines`、`/api/v1/ticker24hr` 转到币安，**其余 `/api/v1/*` 转发到 Bovin 核心**（上游默认 `FREQTRADE_UPSTREAM=http://127.0.0.1:18080`）。  
   - 面板默认 **Base URL**：`http://192.168.77.46:8000/api/v1`。浏览器只与 `19090` 通信，由代理回显 `Origin`，**HISTORICAL_LOGS（`pair_history`）等鉴权接口**与系统遥测一般可恢复正常。  
   - 若浏览器请求未带 `Authorization`，代理使用环境变量 **`FREQTRADE_PROXY_USER` / `FREQTRADE_PROXY_PASSWORD`**（默认 **`admin`**，与仓库 `api_server` 默认一致），需与 Bovin `api_server` 一致。
3. **直连 Bovin（不设代理）**：在设置里把 Base URL 改为 `http://127.0.0.1:18080/api/v1`（或你的真实端口），并在 `user_data/config.api.json` 配置 `CORS_origins` / `CORS_origin_regex`，**修改后重启 Bovin 进程**。系统浏览器通常比编辑器内置预览更省心。

请勿用 `file://` 打开页面；请使用 `http://127.0.0.1:端口`。

可用性检查示例：`curl -sS http://192.168.77.46:8000/api/v1/ping`（先启代理）或直连 Bovin 的 `/api/v1/ping`。

## 面板登录与 401 排障（按顺序做即可）

下面假设你在用**本机开发**：先起 Bovin API，再起 `binance_proxy`，浏览器打开 `http://127.0.0.1:3000/`（或你的一键脚本自动打开的地址）。

### 第一步：先确认「API 账号密码」写在哪

1. 用记事本 / VS Code 打开仓库里的 **`user_data/config.api.json`**（没有就看 **`user_data/config.json`** 里同名段）。
2. 找到 **`"api_server"`** 这一块，记下里面的 **`username`** 和 **`password`**。  
   - 这就是 Bovin REST 的 **HTTP Basic** 账号，**不是**随便起的「面板昵称」。
   - 仓库默认 **`username` / `password` 均为 `admin`**（与配置校验填空一致）；若你已修改 config，则以文件为准。

### 第二步：重启一次 Bovin（让面板用户和 API 账号对齐）

**为什么要重启**：第一次或升级后，程序会在数据库里**自动创建/更新**与 `api_server` 同名的面板登录用户（否则旧数据里可能只剩 `admin`，和 API 账号对不上）。

1. **若你正在终端里跑 Bovin**：在该终端按 **`Ctrl + C`** 停掉进程。
2. **再按你平时的方式重新启动**（推荐 `./scripts/start_panel_dev.sh`：默认 **`BOVIN_MODE=trade`**，策略控制台可用 `/start`；若只要数据/回测接口可设 **`BOVIN_MODE=webserver ./scripts/start_panel_dev.sh`**）。
3. 看启动日志里是否出现类似字样（有其一即可）：
   - **`Created panel_user ... from api_server`** → 已为 API 用户名新建面板账号。
   - **`Synced panel_user password ...`** → 已把面板里该用户的密码改成与 `api_server` 一致。

没有这两行也不一定是坏事（可能用户早已对齐），**继续第三步**。

### 第三步：在面板登录框里填什么

在登录页输入：

- **用户名** = 第一步里 `api_server.username` 的**完全一致**的字符串（区分大小写按你配置来，不要多空格）。
- **密码** = 第一步里 `api_server.password` 的**完全一致**的字符串。

**默认对齐**：当前仓库把 **`api_server` 与面板** 的推荐默认都定为 **`admin` / `admin`**；若你在 config 里改成了别的账号，登录框须与之一致。

### 第四步：若仍然提示 401 或「无法读取 /show_config」

按下面逐项检查：

1. **再打开 `config.api.json`**，重新核对 `api_server.username` / `password`，与登录框是否**逐字相同**。
2. **若走了 `binance_proxy`（端口 19090）**：浏览器请求一般会带上你输入的账号密码。若你改过 API 密码，**请重新登录面板**（或清掉站点数据后重登），不要用旧会话。
3. **代理环境变量**：若浏览器**没有**带登录信息，代理会用 **`FREQTRADE_PROXY_USER` / `FREQTRADE_PROXY_PASSWORD`**（默认 **`admin`**）。这时必须与 `api_server` 一致，否则会 401。
4. **自测 API**（把端口改成你的 Bovin 端口，把 `用户`/`密码` 换成真实值）：

```bash
curl -sS -u '用户:密码' http://127.0.0.1:18080/api/v1/show_config | head -c 200
```

若这里也是 401，说明问题在 **Bovin 配置或账号密码**，与浏览器无关；先改对 `config` 并重启 Bovin。

## 设计对齐说明

- 颜色与层级参考 `stitch/quant_edge/DESIGN.md`
- 信息架构参考：
  - `量化/功能清单 (Feature List).md`
  - `量化/可视化面板与数据面板产品需求文档 (PRD).md`

## 构建（推荐）

源码按 ES 模块拆在 `src/`（`app.js` 为主体逻辑，`locales/*.json` 为文案），发布后仍为**单个**压缩后的 `main.js`，`index.html` 无需改成 `type="module"`。

```bash
cd frontend
npm install
npm run build        # 输出 minify 的 ./main.js，并在 index.html 为 main.js 写入 ?v=<内容哈希>
# npm run build:dev  # 不压缩 + sourcemap；index 仍为 ./main.js（无 query）
# npm run watch      # 开发时监听重建
```

**重要**：线上或静态托管若引用的是仓库根目录 `main.js`（非 `type="module"` 直连 `src/app.js`），则**每次修改 `src/` 下逻辑或文案后必须执行 `npm run build`**，否则浏览器仍在跑旧打包产物。

修改翻译：直接编辑 `src/locales/zh-CN.json`、`src/locales/en.json` 后重新 `npm run build`。若曾从旧版单体 `main.js` 抽过文案，可用 `npm run extract-i18n`（需该文件内仍存在完整 `const i18n = { ... }`）。

**部署缓存**：HTML 建议短缓存、`main.js` 长缓存；生产构建已带 `?v=` 便于强制刷新脚本。

## 安全与隐私（上线必读）

- **登录 / API 默认口令**：页面不再预填账号密码；首次部署请修改 Bovin 与面板默认用户。
- **Bovin API 密码**：仅存 **sessionStorage**（关闭标签页后清除），不写 `localStorage`；退出面板会话会清空。服务端 `GET/POST /panel/preferences` 仍可能持久化密码字段，以你方 **panel_store.sqlite** 与运维策略为准。
- **API 对接绑定（交易所 / LLM）**：非模拟模式下浏览器的 `ft_api_bindings` **仅脱敏副本**；完整密钥以服务端为准。模拟模式可写完整对象便于离线演示；旧键 `ft_pwd` 会迁移到 session 后从 localStorage 删除。
- **面板菜单权限**：仅前端展示约束；**启停、强平、名单等写操作**必须依赖 Bovin `api_server` 鉴权。
- **CSP**：`index.html` 的 `script-src` 为 **`'self' 'unsafe-inline'`**（不含 `unsafe-eval`）；K 线与行情条经 **同源** `GET /api/v1/panel/*` 由服务端转发，浏览器不再直连交易所。`connect-src` 仍含 `https:`、`http:`、`ws:`、`wss:` 以便局域网代理；**生产**建议由 **Nginx/Caddy** 收紧为 `'self'` 或固定上游。
- **HTTPS 调 HTTP API**：会被浏览器拦截；须 **同源 HTTPS 反代** API 或内网 HTTP。
- **运行顺序（本地）**：先起 Bovin（REST，常见 `:18080`），再 `python3 frontend/binance_proxy.py`（`:19090`），再按需起静态页；WebSocket 直连 Bovin，与 REST 是否经代理无关。
- **本地化资源**：界面字体为 **系统字体栈 + 随仓库提供的 `vendor/material-symbols-outlined.ttf`**，不加载 Google Fonts CDN。面板默认不向交易所公网发起 `fetch`（避免 CORS 报错）；数据经 Bovin `/panel/*_klines`、`/panel/binance_board` 或本机 `binance_proxy`。
- **不向云端回传**：前端**不提供**错误上报到远程 URL 的能力；排障请用浏览器控制台与本机 Bovin 日志。

## 已知限制

- 排障优先查阅 **[../docs/panel/KLINE_PIPELINE.md](../docs/panel/KLINE_PIPELINE.md)**、**[部署指南.md](./部署指南.md)**、**[API_INTEGRATION.md](./API_INTEGRATION.md)**。
- `pair_history` 与 `pair_candles` 的具体请求参数在不同策略/版本可能存在差异，页面保留原始错误回显用于调试。
- WebSocket 推送（`/message/ws`）可在下一版加到实时事件流模块。
- K 线库通过 `vendor/lightweight-charts.standalone.production.js` 同步加载；构建产物 `main.js` 为 **IIFE 单文件**，以 **`defer` 普通脚本** 引入。若编辑器内置预览仍拦截 `connect-src`，请用 **Safari / Chrome** 打开 `http://127.0.0.1:3000/` 等同源环境。
- 内置预览里若 `/sysinfo` 等仍报 CORS，请 **重启 Bovin** 以加载最新的 `CORS_origin_regex`（已包含 `vscode-webview`、`vscode-cdn` 等常见来源），或直接在 **Safari / Chrome** 中访问前端。
