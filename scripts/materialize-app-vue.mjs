/**
 * 首次将 index.template.html 中的 #appRoot 壳层抽成 App.vue，并把模板改为仅保留 #app 挂载点。
 * 已迁移后再次运行会因找不到标记而跳过（请直接改 App.vue）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const templatePath = path.join(rootDir, "src", "index.template.html");
const appVuePath = path.join(rootDir, "src", "App.vue");

const shellStart = '<div class="app hidden" id="appRoot">';
const shellEnd = '\n    <script src="./vendor/lightweight-charts.standalone.production.js"></script>';

export function materializeAppVue() {
  const html = fs.readFileSync(templatePath, "utf8");
  const start = html.indexOf(shellStart);
  const end = html.indexOf(shellEnd);
  if (start < 0 || end < 0 || end <= start) {
    console.warn("materialize-app-vue: 未找到 appRoot 壳层（可能已迁移），跳过。");
    return;
  }

  let shellBlock = html.slice(start, end).trimEnd();
  shellBlock = shellBlock.replace(
    '<div id="panelSectionsMount"></div>',
    "<PanelSections />"
  );

  const appVue = `<template>
${shellBlock}
</template>

<script setup>
import { onMounted, nextTick } from "vue";
import { startPanelApp, registerSectionRouteNavigator } from "./app.js";
import { panelRouter } from "./router/index.js";
import { createSectionRouteNavigator } from "./router/bridge.js";
import PanelSections from "./layouts/components/PanelSections.vue";

registerSectionRouteNavigator(createSectionRouteNavigator(panelRouter));

onMounted(async () => {
  await nextTick();
  await startPanelApp();
  const current = String(panelRouter.currentRoute.value.name || "").trim();
  if (!current || !panelRouter.hasRoute(current)) {
    void panelRouter.replace({ name: "overview" });
  }
});
</script>
`;

  fs.writeFileSync(appVuePath, appVue, "utf8");

  const before = html.slice(0, start).trimEnd();
  const after = html.slice(end);
  const merged = `${before}\n\n    <div id="app"></div>\n\n    ${after.replace(/^\s+/, "")}`;
  fs.writeFileSync(templatePath, merged, "utf8");
  console.log("已生成 src/App.vue，并已精简 src/index.template.html（仅保留 #app）。");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  materializeAppVue();
}
