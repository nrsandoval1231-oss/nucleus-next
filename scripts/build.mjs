import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
import { browserCode } from "./browser-build.mjs";
const clientCode = await browserCode();
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
  plugins: [
    {
      name: "embedded-client",
      setup(b) {
        b.onLoad({ filter: /\/apps\/web\/client\.js$/ }, () => ({
          contents: `export default ${JSON.stringify(clientCode)}`,
          loader: "js",
        }));
      },
    },
  ],
});
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
console.log("Built Worker with embedded application assets.");
