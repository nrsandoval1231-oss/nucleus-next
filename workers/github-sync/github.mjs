import {
  projectState,
  attention,
  evidenceId,
  POLICY,
} from "../../packages/core/evidence.mjs";
export class ProviderError extends Error {
  constructor(code, retryAt = null) {
    super(`GitHub ${code}`);
    this.code = code;
    this.retryAt = retryAt;
  }
}
export class GitHub {
  constructor({
    owner,
    token,
    fetcher = fetch,
    now = () => new Date().toISOString(),
  }) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/.test(owner))
      throw new Error("Invalid owner");
    this.owner = owner;
    this.token = token;
    this.fetcher = fetcher;
    this.now = now;
    this.active = 0;
    this.waiters = [];
  }
  async get(path) {
    if (
      !path.startsWith("/") ||
      path.startsWith("//") ||
      path.includes("..") ||
      path.includes("\\")
    )
      throw new Error("Invalid GitHub path");
    if (this.limited) throw this.limited;
    if (this.active >= 4)
      await new Promise((resolve) => this.waiters.push(resolve));
    this.active++;
    try {
      const r = await this.fetcher("https://api.github.com" + path, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(12000),
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "Nucleus-Next",
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
      });
      if (!r.ok) {
        const limited =
          r.status === 429 ||
          (r.status === 403 &&
            (r.headers.get("x-ratelimit-remaining") === "0" ||
              r.headers.has("retry-after")));
        const reset = r.headers.get("x-ratelimit-reset");
        const retry = r.headers.get("retry-after");
        const retryAt = retry
          ? new Date(Date.now() + Number(retry) * 1000).toISOString()
          : reset
            ? new Date(Number(reset) * 1000).toISOString()
            : null;
        const e = new ProviderError(
          limited
            ? "rate_limited"
            : r.status === 401
              ? "disconnected"
              : r.status === 403
                ? "access_denied"
                : r.status === 404
                  ? "unavailable"
                  : "provider_error",
          retryAt,
        );
        if (limited) this.limited = e;
        throw e;
      }
      return {
        data: await r.json(),
        link: r.headers.get("link"),
        observed_at: this.now(),
      };
    } finally {
      this.active--;
      this.waiters.shift()?.();
    }
  }
  async pages(path, { maxPages = 10, key } = {}) {
    let next = path,
      items = [],
      observed_at;
    for (let page = 1; page <= maxPages; page++) {
      const r = await this.get(next);
      observed_at = r.observed_at;
      const values = key ? r.data[key] : r.data;
      if (!Array.isArray(values)) throw new ProviderError("invalid_response");
      items.push(...values);
      const match = r.link?.match(/<([^>]+)>; rel="next"/);
      if (!match)
        return {
          items,
          complete:
            !r.data.incomplete_results &&
            (!key || !r.data.total_count || r.data.total_count <= items.length),
          observed_at,
        };
      const u = new URL(match[1]);
      if (
        u.origin !== "https://api.github.com" ||
        u.username ||
        u.password ||
        u.pathname !== new URL("https://api.github.com" + path).pathname
      )
        throw new Error("Unsafe pagination");
      next = u.pathname + u.search;
    }
    return { items, complete: false, observed_at };
  }
}
export function repositoryMeta(r) {
  return {
    id: String(r.id),
    name: r.name,
    full_name: r.full_name,
    url: r.html_url || `https://github.com/${r.full_name}`,
    default_branch: r.default_branch,
    private: r.private ?? false,
    archived: r.archived ?? false,
    description: r.description ?? null,
    pushed_at: r.pushed_at ?? null,
  };
}
export async function discover(g) {
  // Installation tokens enumerate only repositories granted to the dedicated read-only App.
  const r = await g.pages(
    g.token
      ? "/installation/repositories?per_page=100&page=1"
      : `/users/${g.owner}/repos?per_page=100&page=1`,
    { key: g.token ? "repositories" : undefined },
  );
  const repositories = r.items
    .filter((x) => x.owner?.login.toLowerCase() === g.owner.toLowerCase())
    .map(repositoryMeta);
  let openWork = { state: "not_started", items: [], complete: false };
  try {
    const p = await g.pages(
      `/search/issues?q=${encodeURIComponent(`user:${g.owner} is:pr is:open`)}&per_page=100&page=1`,
      { key: "items", maxPages: 3 },
    );
    const ids = new Set(repositories.map((x) => x.full_name.toLowerCase()));
    openWork = {
      state: p.complete ? "current_within_scope" : "partial",
      items: p.items
        .filter((x) =>
          ids.has(x.repository_url?.split("/repos/")[1]?.toLowerCase()),
        )
        .map((x) => ({
          id: x.id,
          number: x.number,
          title: x.title,
          url: x.html_url,
          repository: x.repository_url.split("/repos/")[1],
          draft: x.draft,
          updated_at: x.updated_at,
        })),
      complete: p.complete,
      observed_at: p.observed_at,
      scope:
        "GitHub search index; up to 300 open PRs; may lag live repository endpoints",
    };
  } catch (e) {
    openWork = {
      state: e.code || "provider_error",
      items: [],
      complete: false,
    };
  }
  return {
    repositories,
    openWork,
    complete: r.complete,
    observed_at: r.observed_at,
    mode: g.token ? "github_app" : "public",
    privateCoverage: g.token ? "installation_scope" : "unavailable",
    scopeOwner: g.owner,
  };
}
const sourceError = (e) => ({
  state: e.code || "provider_error",
  complete: false,
  retryAt: e.retryAt || null,
  observed_at: new Date().toISOString(),
});
function checkValue(c) {
  return {
    id: c.id,
    name: c.name,
    head_sha: c.head_sha,
    status: c.status,
    conclusion: c.conclusion,
    app_id: c.app?.id,
    url: c.html_url,
    completed_at: c.completed_at,
    started_at: c.started_at,
  };
}
function pullValue(p) {
  return {
    id: p.id,
    number: p.number,
    title: p.title,
    url: p.html_url,
    draft: p.draft,
    head_sha: p.head?.sha,
    base: p.base?.ref,
    updated_at: p.updated_at,
    merged_at: p.merged_at,
    merge_commit_sha: p.merge_commit_sha,
  };
}
export async function inspectRepository(g, raw) {
  const meta = raw.url ? raw : repositoryMeta(raw);
  const root = `/repos/${meta.full_name}`,
    sources = {},
    evidence = [];
  async function read(kind, path, opts) {
    try {
      const r = opts ? await g.pages(path, opts) : await g.get(path);
      sources[kind] = {
        state: opts && !r.complete ? "partial" : "current_within_scope",
        complete: opts ? r.complete : true,
        observed_at: r.observed_at,
        path,
      };
      const payload = opts ? r.items : r.data;
      evidence.push({
        id: await evidenceId({ repo_id: meta.id, kind, payload }),
        category: "observed_fact",
        confidence: "direct",
        repo_id: meta.id,
        kind,
        observed_at: r.observed_at,
        api_path: path,
        payload,
      });
      return payload;
    } catch (e) {
      sources[kind] = { ...sourceError(e), path };
      return null;
    }
  }
  const h = await read(
    "head",
    `${root}/commits/${encodeURIComponent(meta.default_branch || "HEAD")}`,
  );
  const sha = h?.sha;
  const [pulls, closed, checks, statuses, deps, releases] = await Promise.all([
    read("pulls", `${root}/pulls?state=open&per_page=100&page=1`, {
      maxPages: 10,
    }),
    read(
      "recent_closed",
      `${root}/pulls?state=closed&sort=updated&direction=desc&per_page=10`,
    ),
    sha
      ? read(
          "checks",
          `${root}/commits/${sha}/check-runs?per_page=100&filter=latest`,
          { key: "check_runs", maxPages: 10 },
        )
      : null,
    sha ? read("statuses", `${root}/commits/${sha}/status`) : null,
    read("deployments", `${root}/deployments?per_page=5`),
    read("releases", `${root}/releases?per_page=5`),
  ]);
  if (!sha) {
    sources.checks = { state: "not_started", complete: false };
    sources.statuses = { state: "not_started", complete: false };
  }
  // Sampling is explicit; no complete historical inventory is claimed.
  if (sources.recent_closed)
    sources.recent_closed.scope =
      "10 most recently updated closed PRs; merges outside this sample unavailable";
  if (sources.deployments)
    sources.deployments.scope =
      "5 most recent deployments plus their latest status";
  if (sources.releases) sources.releases.scope = "5 most recent releases";
  const deployments = await Promise.all(
    (Array.isArray(deps) ? deps : []).map(async (d) => {
      const s = await read(
        `deployment_${d.id}`,
        `${root}/deployments/${d.id}/statuses?per_page=1`,
      );
      return {
        id: d.id,
        sha: d.sha,
        environment: d.environment,
        url: d.url,
        state: s?.[0]?.state || "unknown",
        status_url: s?.[0]?.url,
        environment_url: s?.[0]?.environment_url,
        created_at: s?.[0]?.created_at,
      };
    }),
  );
  const open = Array.isArray(pulls) ? pulls.map(pullValue) : [];
  // Bound initial work; PR-head checks remain unknown unless requested in a later slice.
  const normalizedChecks = (Array.isArray(checks) ? checks : []).map(
    checkValue,
  );
  const normalizedStatuses = (statuses?.statuses || []).map((s) => ({
    id: s.id,
    name: s.context,
    head_sha: sha,
    status: s.state === "pending" ? "in_progress" : "completed",
    conclusion:
      s.state === "success"
        ? "success"
        : ["error", "failure"].includes(s.state)
          ? "failure"
          : null,
    url: s.target_url,
    updated_at: s.updated_at,
    kind: "commit_status",
  }));
  if (statuses?.total_count > normalizedStatuses.length)
    sources.statuses = {
      ...sources.statuses,
      state: "partial",
      complete: false,
    };
  const allChecks = [...normalizedChecks, ...normalizedStatuses];
  const result = {
    ...meta,
    head: sha
      ? {
          sha,
          url: h.html_url,
          message: h.commit?.message?.split("\n")[0],
          committed_at: h.commit?.committer?.date,
        }
      : null,
    pulls: open,
    merges: (Array.isArray(closed) ? closed : [])
      .filter((p) => p.merged_at)
      .map(pullValue),
    checks: allChecks,
    deployments,
    releases: (Array.isArray(releases) ? releases : []).map((r) => ({
      id: r.id,
      name: r.name || r.tag_name,
      url: r.html_url,
      draft: r.draft,
      prerelease: r.prerelease,
      published_at: r.published_at,
    })),
    sources,
    evidence,
    observed_at: g.now(),
    policy: POLICY,
    coverage: Object.values(sources).every((s) => s.complete)
      ? "current_within_scope"
      : "partial",
    scope:
      "Current default head, all open PRs (up to 1,000), sampled recent merges/releases/deployments. No backfill, reviews, required-check profile, or PR-head verification in this slice.",
  };
  result.state = projectState({ head: sha, checks: allChecks, deployments });
  result.attention = attention(result);
  return result;
}
