/**
 * esbuild-plugin-vue3 只编译 SFC 内联的 template，不解析 <template src>。
 * 将各分区 html 写入 *Section.vue；样式留在 src/pages/&lt;id&gt;/&lt;id&gt;.css，由 index.html 全局引入（与旧版单体 styles.css 行为一致，避免 scoped 破坏选择器）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const pagesDir = path.join(rootDir, "src", "pages");

const SECTIONS = ["overview", "positions", "control", "data", "settings", "monitor", "api"];

function sectionVueFilename(id) {
  return `${id[0].toUpperCase()}${id.slice(1)}Section.vue`;
}

for (const id of SECTIONS) {
  const dir = path.join(pagesDir, id);
  const htmlPath = path.join(dir, `${id}.html`);
  const cssPath = path.join(dir, `${id}.css`);
  const vuePath = path.join(dir, sectionVueFilename(id));
  const html = fs.readFileSync(htmlPath, "utf8").trimEnd();
  const body = `<template>\n${html}\n</template>\n\n<style scoped>\n/* 样式在同目录 ${id}.css，由 index.html 引入 */\n</style>\n\n<script setup src="./${id}.js"></script>\n`;
  fs.writeFileSync(vuePath, body, "utf8");
}

console.log("Materialized", SECTIONS.length, "section SFCs.");
