import * as esbuild from "esbuild";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");
const isDevBuild = process.argv.includes("--dev");

const indexPath = path.join(__dirname, "index.html");
const mainPath = path.join(__dirname, "main.js");

const baseOpts = {
  absWorkingDir: __dirname,
  entryPoints: [path.join(__dirname, "src", "entry.js")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  minify: !isDevBuild,
  // 生产包不生成 .map，减小体积并避免误提交大文件；调试请 npm run build:dev
  sourcemap: isDevBuild,
  legalComments: "none",
  loader: { ".json": "json" }
};

function patchIndexMainScript(contentHash) {
  let html = fs.readFileSync(indexPath, "utf8");
  const replacement =
    contentHash != null && contentHash !== ""
      ? `<script defer src="./main.js?v=${contentHash}"></script>`
      : `<script defer src="./main.js"></script>`;
  html = html.replace(/<script defer src="\.\/main\.js(\?v=[^"]*)?"><\/script>/, replacement);
  fs.writeFileSync(indexPath, html);
}

if (watch) {
  const ctx = await esbuild.context({ ...baseOpts, outfile: mainPath });
  await ctx.watch();
  patchIndexMainScript(null);
  console.log("esbuild watching… (index main.js without cache-bust query)");
} else if (isDevBuild) {
  await esbuild.build({ ...baseOpts, outfile: mainPath });
  patchIndexMainScript(null);
  console.log("Built main.js (dev, no query)");
} else {
  await esbuild.build({ ...baseOpts, outfile: mainPath });
  const hash = crypto.createHash("sha256").update(fs.readFileSync(mainPath)).digest("hex").slice(0, 12);
  patchIndexMainScript(hash);
  console.log(`Built main.js (prod), index.html cache-bust ?v=${hash}`);
}
