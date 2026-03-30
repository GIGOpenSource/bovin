/**
 * Slices a legacy monolithic main.js (lines 858+) into src/app.js with ES module header.
 * Point LEGACY_MAIN at a file that still contains the old single-file layout (git history).
 * Example: LEGACY_MAIN=/tmp/main.old.js node scripts/generate-app-src.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const legacyName = process.env.LEGACY_MAIN || "main.monolith.bak.js";
const legacyPath = path.join(root, legacyName);
const outPath = path.join(root, "src", "app.js");

if (!fs.existsSync(legacyPath)) {
  console.error("Missing", legacyPath, "— copy current full main.js there first.");
  process.exit(1);
}

const text = fs.readFileSync(legacyPath, "utf8");
const lines = text.split(/\r?\n/);
// 1-based line 858 => index 857 (skip const $ and everything before)
const body = lines.slice(857).join("\n");

const header = `import { i18n } from "./i18n.js";
import { endpointCatalog } from "./endpoint-catalog.js";
import {
  state,
  uiState,
  persistProfileToLocalStorage,
  applyPanelProfileFromPrefs
} from "./state-core.js";
import {
  apiUrlBases,
  effectiveApiBasePrimary,
  rememberSuccessfulApiBase,
  isLikelyLocalDevFront
} from "./api-bases.js";
import { getCachedJsonGet, setCachedJsonGet } from "./response-cache.js";

function t(key) {
  return i18n[state.lang]?.[key] || i18n["zh-CN"]?.[key] || key;
}

const $ = (id) => document.getElementById(id);

function refreshPanelBackendHint() {
  const el = $("panelBackendBaseHint");
  if (!el) return;
  const override = String(state.baseUrl || "").trim();
  const eff = effectiveApiBasePrimary();
  el.textContent = override
    ? state.lang === "en"
      ? \`Effective API base: \${eff} (custom URL).\`
      : \`当前实际请求：\${eff}（已使用下方自定义地址）。\`
    : state.lang === "en"
      ? \`Effective API base: \${eff} (auto: same site + /api/v1; override only if UI and API are on different origins).\`
      : \`当前实际请求：\${eff}（留空为自动：与当前页面同源 /api/v1，适合与 Freqtrade 同机同端口部署；仅当面板与 API 不同域时再填写下方地址）。\`;
}

`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${header}\n${body}`);
console.log("Wrote", outPath, "from", legacyPath);
