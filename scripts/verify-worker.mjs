import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import workerd from "workerd";
await mkdir(".artifacts", { recursive: true });
await build({
  entryPoints: ["tests/worker-runtime.mjs"],
  outfile: ".artifacts/worker-test.mjs",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
});
const r = spawnSync(workerd.default, ["test", "tests/worker.capnp"], {
  stdio: "inherit",
});
process.exit(r.status ?? 1);
