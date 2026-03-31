import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const indexPath = path.join(rootDir, "index.html");
const templatePath = path.join(rootDir, "src", "index.template.html");

/**
 * 若存在 src/index.template.html，则同步到根目录 index.html。
 * 无模板时以现有 index.html 为准，不报错。
 */
export function composeIndexHtml() {
  if (!fs.existsSync(templatePath)) {
    return;
  }
  const html = fs.readFileSync(templatePath, "utf8");
  fs.writeFileSync(indexPath, `${html.trimEnd()}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  composeIndexHtml();
  if (fs.existsSync(templatePath)) {
    console.log("Wrote index.html from src/index.template.html");
  } else {
    console.log("No src/index.template.html; left index.html unchanged.");
  }
}
