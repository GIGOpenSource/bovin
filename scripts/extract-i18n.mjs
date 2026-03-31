/**
 * One-off / maintenance: parse const i18n = { ... } from legacy main and write zh.json + en.json.
 * Run: node scripts/extract-i18n.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const mainPath = path.join(root, "main.js");
const code = fs.readFileSync(mainPath, "utf8");
const marker = "const i18n = ";
const start = code.indexOf(marker);
if (start < 0) throw new Error("const i18n not found");
let i = start + marker.length;
let depth = 0;
let end = -1;
for (; i < code.length; i++) {
  const c = code[i];
  if (c === "{") depth++;
  if (c === "}") {
    depth--;
    if (depth === 0) {
      end = i + 1;
      break;
    }
  }
}
if (end < 0) throw new Error("could not match i18n object");
const expr = code.slice(start + marker.length, end);
// eslint-disable-next-line no-new-func
const i18n = Function(`"use strict"; return (${expr})`)();
const zhLocale = path.join(root, "src", "i18n", "locales", "zh-CN.json");
const enLocale = path.join(root, "src", "i18n", "locales", "en.json");
fs.mkdirSync(path.dirname(zhLocale), { recursive: true });
fs.writeFileSync(zhLocale, `${JSON.stringify(i18n["zh-CN"], null, 2)}\n`);
fs.writeFileSync(enLocale, `${JSON.stringify(i18n.en, null, 2)}\n`);
console.log("Wrote", zhLocale, enLocale);
