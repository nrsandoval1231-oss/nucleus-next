import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { browserCode } from "../scripts/browser-build.mjs";
const html = await readFile(
  new URL("../apps/web/index.html", import.meta.url),
  "utf8",
);
const script = await browserCode();
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
async function page({ fallback = false } = {}) {
  const dom = new JSDOM(html, {
      url: "http://localhost",
      runScripts: "outside-only",
    }),
    w = dom.window;
  w.AbortSignal = AbortSignal;
  w.TextEncoder = TextEncoder;
  Object.defineProperty(w.crypto, "subtle", { value: crypto.subtle });
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  let fail = false,
    currentDetail = structuredClone(detail);
  const calls = [];
  w.fetch = async (url, init) => {
    calls.push(url);
    if (fallback && url === "/api/portfolio")
      return {
        ok: false,
        json: async () => ({
          error: "rate_limited",
          publicFallback: { owner: "nick" },
        }),
      };
    if (String(url).startsWith("https://api.github.com/")) {
      assert.equal(init.method, "GET");
      assert.equal(init.headers.Authorization, undefined);
      const p = new URL(url).pathname;
      return Response.json(
        p.startsWith("/users/")
          ? repos.map((r) => ({
              ...r,
              html_url: r.url,
              owner: { login: "nick" },
            }))
          : p.startsWith("/search/")
            ? { items: [], total_count: 0 }
            : p.endsWith("/commits/main")
              ? {
                  sha: "abc",
                  html_url: detail.head.url,
                  commit: { message: "Actual commit" },
                }
              : p.endsWith("/check-runs")
                ? { check_runs: [], total_count: 0 }
                : p.endsWith("/status")
                  ? { statuses: [], total_count: 0 }
                  : [],
      );
    }
    if (fail)
      return { ok: false, json: async () => ({ error: "rate_limited" }) };
    return {
      ok: true,
      json: async () =>
        structuredClone(
          url.startsWith("/api/repository") ? currentDetail : inventory,
        ),
    };
  };
  w.eval(script);
  await new Promise((r) => setTimeout(r, 20));
  return {
    w,
    dom,
    calls,
    fail: () => (fail = true),
    setDetail: (value) => (currentDetail = value),
  };
}
test("rate-limited public demo uses credential-free direct reads and identifies temporary retention", async () => {
  const { w, dom, calls } = await page({ fallback: true });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(w.document.querySelectorAll(".project").length, 2);
  assert.match(w.document.querySelector("#notice").textContent, /directly/);
  assert.match(
    w.document.querySelector("#notice").textContent,
    /browser session/,
  );
  w.document.querySelector('[data-inspect="1"]').click();
  await new Promise((r) => setTimeout(r, 50));
  assert.match(
    w.document.querySelector("#details").textContent,
    /Actual commit/,
  );
  assert.match(
    w.document.querySelector("#details").textContent,
    /browser session only/,
  );
  assert.ok(
    calls.some((u) => u.startsWith("https://api.github.com/users/nick/repos")),
  );
  assert.equal(
    calls.some((u) => u.startsWith("/api/repository")),
    false,
  );
  dom.window.close();
});
test("attention headline clears after checks recover", async () => {
  const { w, dom, setDetail } = await page();
  setDetail({ ...detail, state: { ...detail.state, observed: "failure" } });
  w.document.querySelector('[data-inspect="1"]').click();
  await new Promise((r) => setTimeout(r, 20));
  assert.match(
    w.document.querySelector("#attention-strip strong").textContent,
    /failing checks/,
  );
  w.document.querySelector("#details [data-close]").click();
  setDetail(detail);
  w.document.querySelector('[data-inspect="1"]').click();
  await new Promise((r) => setTimeout(r, 20));
  assert.doesNotMatch(
    w.document.querySelector("#attention-strip strong").textContent,
    /failing checks/,
  );
  dom.window.close();
});
test("external HTTPS status evidence opens the actual CI provider", async () => {
  const { w, dom, setDetail } = await page();
  setDetail({
    ...detail,
    checks: [
      { ...detail.checks[0], url: "https://app.circleci.com/pipelines/1" },
    ],
  });
  w.document.querySelector('[data-inspect="1"]').click();
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(
    w.document.querySelector('a[href="https://app.circleci.com/pipelines/1"]'),
  );
  dom.window.close();
});
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
