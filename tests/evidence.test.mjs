import test from "node:test";
import assert from "node:assert/strict";
import {
  summarizeChecks,
  projectState,
  evidenceId,
} from "../packages/core/evidence.mjs";
test("a deployment without a resolved SHA cannot match an unknown head", () => {
  assert.notEqual(
    projectState({ deployments: [{ state: "success" }] }).deployment,
    "observed_at_head",
  );
});

test("zero checks and successful checks without an approved profile never prove verification", () => {
  assert.equal(summarizeChecks([], "abc").verification, "unknown");
  assert.equal(
    summarizeChecks(
      [{ head_sha: "abc", status: "completed", conclusion: "success" }],
      "abc",
    ).verification,
    "unknown",
  );
});
test("observed checks distinguish failures, pending, inconclusive and stale heads", () => {
  const c = { head_sha: "abc", status: "completed", conclusion: "success" };
  assert.equal(summarizeChecks([c], "abc").observed, "success");
  assert.equal(
    summarizeChecks([{ ...c, conclusion: "failure" }], "abc").observed,
    "failure",
  );
  assert.equal(
    summarizeChecks([{ ...c, status: "in_progress", conclusion: null }], "abc")
      .observed,
    "pending",
  );
  assert.equal(
    summarizeChecks([{ ...c, conclusion: "skipped" }], "abc").observed,
    "inconclusive",
  );
  assert.equal(summarizeChecks([c], "def").observed, "stale");
});
test("merge, deployment on another SHA and a description cannot imply acceptance or vision", () => {
  const s = projectState({
    head: "abc",
    checks: [],
    merges: [{ merge_commit_sha: "abc" }],
    deployments: [{ sha: "def", state: "success" }],
    description: "owner-approved",
  });
  assert.equal(s.verification, "unknown");
  assert.equal(s.acceptance, "not_recorded");
  assert.equal(s.vision, "not_approved");
  assert.equal(s.deployment, "other_sha");
});
test("evidence identifiers are stable across property order and sensitive to source revision", async () => {
  assert.equal(
    await evidenceId({ b: 2, a: 1 }),
    await evidenceId({ a: 1, b: 2 }),
  );
  assert.notEqual(
    await evidenceId({ sha: "a" }),
    await evidenceId({ sha: "b" }),
  );
});
