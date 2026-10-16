import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
const html = await readFile(
  new URL("../apps/web/index.html", import.meta.url),
  "utf8",
);
const script = await readFile(
  new URL("../apps/web/client.js", import.meta.url),
  "utf8",
);
const repos = [
  {
    id: "1",
    name: "alpha",
    full_name: "nick/alpha",
    url: "https://github.com/nick/alpha",
    default_branch: "main",
    description: "A project",
    pushed_at: "2026-10-15T12:00:00Z",
  },
  {
    id: "2",
    name: "beta",
    full_name: "nick/beta",
    url: "https://github.com/nick/beta",
    default_branch: "main",
    description: "<img src=x onerror=alert(1)>",
    pushed_at: "2026-10-14T12:00:00Z",
  },
];
const inventory = {
  repositories: repos,
  observed_at: "2026-10-16T00:00:00Z",
  mode: "public",
  durability: "session_only",
  complete: true,
  openWork: {
    complete: true,
    items: [{ repository: "nick/alpha", number: 1, title: "Open work" }],
    state: "current_within_scope",
  },
};
const detail = {
  ...repos[0],
  observed_at: inventory.observed_at,
  coverage: "current_within_scope",
  durability: "session_only",
  policy: "portfolio-observation-v1",
  head: {
    sha: "abc",
    url: "https://github.com/nick/alpha/commit/abc",
    message: "Actual commit",
  },
  state: {
    observed: "success",
    verification: "unknown",
    deployment: "not_established",
  },
  pulls: [],
  checks: [
    {
      head_sha: "abc",
      name: "tests",
      conclusion: "success",
      url: "javascript:alert(1)",
    },
  ],
  merges: [],
  deployments: [],
  releases: [],
  evidence: [],
  sources: {
    head: { observed_at: inventory.observed_at },
    pulls: { complete: true },
  },
  attention: [],
  scope: "Current head only",
};
async function page() {
  const dom = new JSDOM(html, {
      url: "http://localhost",
      runScripts: "outside-only",
    }),
    w = dom.window;
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  let fail = false;
  const calls = [];
  w.fetch = async (url) => {
    calls.push(url);
    if (fail)
      return { ok: false, json: async () => ({ error: "rate_limited" }) };
    return {
      ok: true,
      json: async () =>
        structuredClone(url.startsWith("/api/repository") ? detail : inventory),
    };
  };
  w.eval(script);
  await new Promise((r) => setTimeout(r, 20));
  return { w, dom, calls, fail: () => (fail = true) };
}
test("portfolio loads live reads, filters and searches without running repository HTML", async () => {
  const { w, dom, calls } = await page();
  assert.equal(w.document.querySelectorAll(".project").length, 2);
  assert.equal(calls[0], "/api/portfolio");
  assert.equal(w.document.querySelector(".project img"), null);
  w.document.querySelector('[data-filter="attention"]').click();
  assert.equal(w.document.querySelectorAll(".project").length, 1);
  w.document.querySelector('[data-filter="all"]').click();
  const s = w.document.querySelector("#search");
  s.value = "beta";
  s.dispatchEvent(new w.Event("input"));
  assert.equal(w.document.querySelectorAll(".project").length, 1);
  assert.match(w.document.querySelector(".project").textContent, /beta/);
  dom.window.close();
});
test("inspection opens exact evidence and keeps successful checks separate from verification", async () => {
  const { w, dom, calls } = await page();
  w.document.querySelector('[data-inspect="1"]').click();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(w.document.querySelector("#details").open, true);
  const text = w.document.querySelector("#details").textContent;
  assert.match(text, /Actual commit/);
  assert.match(text, /Unknown · profile missing/);
  assert.match(text, /Not recorded/);
  assert.ok(calls.includes("/api/repository?id=1"));
  assert.equal(w.document.querySelector('a[href^="javascript:"]'), null);
  assert.ok(
    w.document.querySelector(
      'a[href="https://github.com/nick/alpha/commit/abc"]',
    ),
  );
  w.document.querySelector("#details [data-close]").click();
  assert.equal(w.document.querySelector("#details").open, false);
  dom.window.close();
});
test("coverage explains private gaps and refresh failure preserves visible observations", async () => {
  const { w, dom, fail } = await page();
  w.document.querySelector("#coverage-button").click();
  assert.match(
    w.document.querySelector("#coverage").textContent,
    /private repositories unavailable/i,
  );
  w.document.querySelector("#coverage [data-close]").click();
  fail();
  w.document.querySelector("#refresh").click();
  await new Promise((r) => setTimeout(r, 20));
  assert.match(
    w.document.querySelector("#notice").textContent,
    /Prior observations remain visible/,
  );
  assert.equal(w.document.querySelectorAll(".project").length, 2);
  dom.window.close();
});
