import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PostgresStore } from "../packages/db/postgres.mjs";
test("PostgreSQL schema retains scoped evidence and rolls back incomplete acquisitions", async () => {
  // Actual PostgreSQL engine in WASM; not a mock SQL parser or a production-host claim.
  const db = new PGlite();
  await db.exec(
    await readFile(
      new URL("../packages/db/schema.sql", import.meta.url),
      "utf8",
    ),
  );
  const pool = {
    query: (...a) => db.query(...a),
    connect: async () => ({ query: (...a) => db.query(...a), release() {} }),
  };
  const store = new PostgresStore(undefined, pool);
  const observed_at = "2026-10-16T00:00:00Z";
  const r = {
    id: "1",
    observed_at,
    evidence: [
      { id: "hash", kind: "head", observed_at, payload: { sha: "abc" } },
    ],
    head: { sha: "abc" },
  };
  await store.save("nick", r);
  await store.save("nick", r);
  assert.deepEqual(await store.latest("nick", "1"), r);
  assert.equal(await store.latest("other", "1"), null);
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM nucleus_observation"))
      .rows[0].n,
    1,
  );
  await assert.rejects(() =>
    store.save("nick", {
      ...r,
      observed_at: null,
      evidence: [{ ...r.evidence[0], id: "rolled-back" }],
    }),
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM nucleus_observation WHERE evidence_id='rolled-back'",
      )
    ).rows[0].n,
    0,
  );
  assert.deepEqual(await store.latest("nick", "1"), r);
  await db.close();
});
