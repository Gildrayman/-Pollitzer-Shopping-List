// node build.mjs <shopping-app dir> <out index.html>
import * as esbuild from "esbuild";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const here = path.dirname(fileURLToPath(import.meta.url));
const [src, out] = process.argv.slice(2);
const d = new Date(Date.now() + 2 * 3600e3); // Israel time (winter)
const p = (n) => String(n).padStart(2, "0");
const build = `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
const r = await esbuild.build({
  entryPoints: [path.join(src, "main.jsx")], bundle: true, minify: true, write: false, format: "iife",
  jsx: "automatic", nodePaths: [path.join(here, "node_modules")], target: "es2018",
  define: { "process.env.NODE_ENV": '"production"', __BUILD__: JSON.stringify(build) },
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
fs.writeFileSync(out, `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="app-build" content="${build}">
<meta http-equiv="Cache-Control" content="no-cache">
<title>קניות משפחת דריימן</title>
<style>html,body{margin:0}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>
`);
console.log("build", build, fs.statSync(out).size);
