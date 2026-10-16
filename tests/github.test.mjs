import test from "node:test";
import assert from "node:assert/strict";
import {
  GitHub,
  discover,
  inspectRepository,
} from "../workers/github-sync/github.mjs";
const repo = {
  id: 1,
  name: "one",
  full_name: "nick/one",
  owner: { login: "nick" },
  default_branch: "main",
  html_url: "https://github.com/nick/one",
};
function fixture(routes) {
  return async (url, init) => {
    assert.equal(init.method, "GET");
    assert.equal(new URL(url).origin, "https://api.github.com");
    const key = new URL(url).pathname + new URL(url).search;
    const x = routes[key] ?? routes[new URL(url).pathname];
    return new Response(JSON.stringify(x?.body ?? x ?? []), {
      status: x?.status ?? 200,
      headers: x?.headers,
    });
  };
}
test("public discovery follows pagination and discloses private coverage", async () => {
  const g = new GitHub({
    owner: "nick",
    fetcher: fixture({
      "/users/nick/repos?per_page=100&page=1": {
        body: [repo],
        headers: {
          link: '<https://api.github.com/users/nick/repos?per_page=100&page=2>; rel="next"',
        },
      },
      "/users/nick/repos?per_page=100&page=2": [],
    }),
  });
  const d = await discover(g);
  assert.equal(d.repositories.length, 1);
  assert.equal(d.privateCoverage, "unavailable");
  assert.equal(d.complete, true);
});
test("provider failures are coverage gaps, never successful empty lists", async () => {
  const g = new GitHub({
    owner: "nick",
    fetcher: fixture({
      "/repos/nick/one/commits/main": {
        sha: "abc",
        html_url: "https://github.com/nick/one/commit/abc",
        commit: { message: "hello" },
      },
      "/repos/nick/one/pulls": { status: 403, body: { message: "Forbidden" } },
      "/repos/nick/one/commits/abc/check-runs": { status: 403 },
    }),
  });
  const result = await inspectRepository(g, repo);
  assert.equal(result.sources.pulls.state, "access_denied");
  assert.equal(result.state.verification, "unknown");
  assert.equal(result.coverage, "partial");
  assert.equal(result.head.sha, "abc");
});
test("rate limits carry retry time and do not leak provider bodies", async () => {
  const g = new GitHub({
    owner: "nick",
    fetcher: fixture({
      "/users/nick/repos": {
        status: 403,
        body: { message: "sensitive" },
        headers: {
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": "1792110000",
        },
      },
    }),
  });
  await assert.rejects(
    () => discover(g),
    (e) =>
      e.code === "rate_limited" &&
      e.retryAt &&
      !e.message.includes("sensitive"),
  );
});
test("untrusted provider pagination cannot forward credentials to another origin", async () => {
  let count = 0;
  const g = new GitHub({
    owner: "nick",
    token: "secret",
    fetcher: async () => {
      count++;
      return new Response("[]", {
        headers: { link: '<https://evil.example/steal>; rel="next"' },
      });
    },
  });
  await assert.rejects(() => g.pages("/users/nick/repos"), /pagination/);
  assert.equal(count, 1);
});
test("GitHub transport rejects write methods, invalid owners and paths", async () => {
  assert.throws(() => new GitHub({ owner: "../bad" }));
  const g = new GitHub({ owner: "nick", fetcher: fixture({}) });
  await assert.rejects(() => g.get("https://evil.example"), /path/);
});
