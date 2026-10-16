import test from "node:test";
import assert from "node:assert/strict";
import { createApplication } from "../apps/web/api.mjs";
import { MemoryStore } from "../packages/db/store.mjs";
test("public browser fallback is never offered by the private runtime", async () => {
  const fail = async () => {
    throw Object.assign(new Error("quota"), { code: "rate_limited" });
  };
  const pub = await app({ discoverFn: fail })(
    new Request("http://localhost/api/portfolio"),
  );
  assert.equal((await pub.json()).publicFallback.owner, "nick");
  const priv = await app({
    privateRuntime: true,
    ownerId: "owner",
    discoverFn: fail,
  })(
    new Request("http://localhost/api/portfolio", {
      headers: { "oai-authenticated-user-id": "owner" },
    }),
  );
  assert.equal((await priv.json()).publicFallback, undefined);
});
test("private cached evidence revalidates installation scope before every read", async () => {
  let revoked = false;
  const a = app({
    privateRuntime: true,
    ownerId: "owner",
    discoverFn: async () =>
      revoked ? { ...inventory, repositories: [] } : inventory,
  });
  const request = () =>
    new Request("http://localhost/api/repository?id=1", {
      headers: { "oai-authenticated-user-id": "owner" },
    });
  assert.equal((await a(request())).status, 200);
  revoked = true;
  assert.equal((await a(request())).status, 404);
});
const inventory = {
  repositories: [
    {
      id: "1",
      name: "one",
      full_name: "nick/one",
      default_branch: "main",
      url: "https://github.com/nick/one",
    },
  ],
  complete: true,
  mode: "public",
};
const detail = {
  ...inventory.repositories[0],
  observed_at: "2026-10-15T12:00:00Z",
  evidence: [{ id: "a", kind: "head", payload: { sha: "abc" } }],
  coverage: "current_within_scope",
};
function app(extra = {}) {
  return createApplication({
    owner: "nick",
    store: new MemoryStore(),
    discoverFn: async () => inventory,
    inspectFn: async () => detail,
    ...extra,
  });
}
test("API cannot request arbitrary repositories or mutate GitHub", async () => {
  const a = app();
  assert.equal(
    (await a(new Request("http://localhost/api/repository?id=99"))).status,
    404,
  );
  assert.equal(
    (await a(new Request("http://localhost/api/portfolio", { method: "POST" })))
      .status,
    405,
  );
});
test("private runtime requires configured owner identity and never returns raw evidence payload", async () => {
  const a = app({ privateRuntime: true, ownerId: "owner" });
  assert.equal(
    (await a(new Request("http://localhost/api/portfolio"))).status,
    401,
  );
  assert.equal(
    (
      await a(
        new Request("http://localhost/api/portfolio", {
          headers: { "oai-authenticated-user-id": "other" },
        }),
      )
    ).status,
    403,
  );
  const r = await a(
    new Request("http://localhost/api/repository?id=1", {
      headers: { "oai-authenticated-user-id": "owner" },
    }),
  );
  const d = await r.json();
  assert.equal(d.evidence[0].payload, undefined);
  assert.equal(r.headers.get("cache-control"), "private, no-store");
});
test("failed refresh retains stale evidence while communicating failure", async () => {
  let fail = false;
  const a = app({
    inspectFn: async () => {
      if (fail) throw new Error("secret");
      return detail;
    },
    cacheMs: 0,
  });
  await a(new Request("http://localhost/api/repository?id=1"));
  fail = true;
  const r = await a(new Request("http://localhost/api/repository?id=1"));
  const d = await r.json();
  assert.equal(d.coverage, "stale");
  assert.equal(d.refresh_error, "provider_error");
  assert.equal(JSON.stringify(d).includes("secret"), false);
});
test("concurrent reads share one provider request and retain central evidence", async () => {
  let count = 0;
  const store = new MemoryStore();
  const a = app({
    store,
    inspectFn: async () => {
      count++;
      await new Promise((r) => setTimeout(r, 10));
      return detail;
    },
  });
  await Promise.all(
    [1, 2, 3].map(() => a(new Request("http://localhost/api/repository?id=1"))),
  );
  assert.equal(count, 1);
  assert.equal(
    (await store.latest("nick", "1")).evidence[0].payload.sha,
    "abc",
  );
});
test("lost inventory scope prevents serving cached repository evidence", async () => {
  let revoked = false;
  const a = app({
    cacheMs: 0,
    discoverFn: async () =>
      revoked ? { ...inventory, repositories: [] } : inventory,
  });
  await a(new Request("http://localhost/api/repository?id=1"));
  revoked = true;
  assert.equal(
    (await a(new Request("http://localhost/api/repository?id=1"))).status,
    404,
  );
});
