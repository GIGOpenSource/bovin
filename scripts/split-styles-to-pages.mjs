/**
 * 将根目录 styles.css 按行块拆到 src/pages（与 materialize-section-sfcs 使用的各 *.css 对齐）。
 * 全局块：common/*.css，由 index.html 单独引入；分区块：写入各 page/*.css，随 Vue SFC scoped 生效。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "styles.css");

if (!fs.existsSync(src)) {
  console.error("Missing styles.css（已拆分则勿重复运行；需从版本库恢复后再执行）。");
  process.exit(1);
}

function sliceInclusive(lines, start1, end1) {
  return lines.slice(start1 - 1, end1).join("\n").trimEnd() + "\n";
}

const text = fs.readFileSync(src, "utf8");
const lines = text.split(/\r?\n/);
const n = lines.length;

const chunks = [
  { out: path.join(root, "src", "pages", "common", "shell.css"), start: 1, end: 2187 },
  { out: path.join(root, "src", "pages", "common", "ft-page.css"), start: 2189, end: 2304 },
  { out: path.join(root, "src", "pages", "overview", "overview.css"), start: 2305, end: 2487 },
  { out: path.join(root, "src", "pages", "positions", "positions.css"), start: 2489, end: 2603 },
  { out: path.join(root, "src", "pages", "control", "control.css"), start: 2605, end: 3285 },
  { out: path.join(root, "src", "pages", "data", "data.css"), start: 3287, end: 4186 },
  { out: path.join(root, "src", "pages", "common", "components-tables-responsive.css"), start: 4187, end: 4670 },
  { out: path.join(root, "src", "pages", "monitor", "monitor.css"), start: 4672, end: 4735 },
  { out: path.join(root, "src", "pages", "common", "settings-overlays.css"), start: 4737, end: 4918 },
  { out: path.join(root, "src", "pages", "common", "theme-light.css"), start: 4919, end: n }
];

for (const { out, start, end } of chunks) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, sliceInclusive(lines, start, end), "utf8");
  console.log("Wrote", path.relative(root, out), `(${start}-${end})`);
}

fs.unlinkSync(src);
console.log("Removed styles.css");
