import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import {
  GitHub,
  discover,
  inspectRepository,
} from "../workers/github-sync/github.mjs";
import { MemoryStore } from "../packages/db/store.mjs";
import { createApplication } from "../apps/web/api.mjs";

test("real public GitHub inventory and Nucleus exact-head evidence traverse the application", async () => {
  const g = new GitHub({ owner: "nrsandoval1231-oss" });
  const inventory = await discover(g);
  assert.equal(inventory.mode, "public");
  assert.equal(inventory.privateCoverage, "unavailable");
  assert.ok(inventory.repositories.length > 0);
  const meta = inventory.repositories.find((r) => r.name === "nucleus-next");
  assert.ok(meta);
  const store = new MemoryStore();
  const app = createApplication({
    owner: g.owner,
    store,
    getGitHub: async () => g,
    discoverFn: async () => inventory,
  });
  const response = await app(
    new Request(`http://localhost/api/repository?id=${meta.id}`),
  );
  assert.equal(response.status, 200);
  const r = await response.json();
  assert.match(r.head.sha, /^[0-9a-f]{40}$/);
  assert.equal(r.head.url, `${meta.url}/commit/${r.head.sha}`);
  assert.equal(r.state.acceptance, "not_recorded");
  assert.equal(r.state.verification, "unknown");
  assert.ok(r.evidence.length > 0);
  assert.ok(r.evidence.every((e) => e.id && e.observed_at && !e.payload));
  assert.ok(
    (await store.latest(g.owner, meta.id)).evidence.some(
      (e) => e.kind === "head" && e.payload.sha === r.head.sha,
    ),
  );
  await mkdir(".artifacts", { recursive: true });
  await writeFile(
    ".artifacts/live-integration.json",
    JSON.stringify({ inventory, repository: r }, null, 2),
  );
  console.log(
    JSON.stringify({
      discovered: inventory.repositories.length,
      openWork: inventory.openWork.state,
      head: r.head.sha,
      coverage: r.coverage,
      sources: Object.fromEntries(
        Object.entries(r.sources).map(([k, v]) => [k, v.state]),
      ),
      observed_at: r.observed_at,
    }),
  );
});
