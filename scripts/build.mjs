import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await build({
  entryPoints: ["apps/web/worker.mjs"],
  outfile: "dist/server/index.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  loader: { ".html": "text", ".css": "text", ".js": "text" },
  minify: false,
});
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
console.log("Built Worker with embedded application assets.");
