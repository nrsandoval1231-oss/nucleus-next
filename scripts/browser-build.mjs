import { build } from "esbuild";
export async function browserCode() {
  const r = await build({
    entryPoints: ["apps/web/client.js"],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "es2022",
  });
  return r.outputFiles[0].text;
}
