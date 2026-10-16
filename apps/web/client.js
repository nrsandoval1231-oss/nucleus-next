const $ = (s) => document.querySelector(s);
const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const safeUrl = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && u.hostname && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
};
const link = (url, text) => {
  const href = safeUrl(url);
  return href
    ? `<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${escape(text)} ↗</a>`
    : `<span>${escape(text)} · link unavailable</span>`;
};
const time = (t) =>
  t
    ? new Date(t).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Unavailable";
const label = (s) => String(s || "unknown").replaceAll("_", " ");
let inventory = null,
  filter = "all",
  loading = false,
  selected = null,
  search = "",
  sort = "activity";
const details = new Map(),
  errors = new Map(),
  inflight = new Map();
function openWork(repo) {
  return (
    details.get(repo.id)?.pulls ??
    inventory?.openWork?.items?.filter(
      (p) => p.repository.toLowerCase() === repo.full_name.toLowerCase(),
    ) ??
    []
  );
}
function needsAttention(repo) {
  const d = details.get(repo.id);
  return (
    openWork(repo).length > 0 || d?.attention?.length > 0 || errors.has(repo.id)
  );
}
async function api(path) {
  const r = await fetch(path, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const x = await r.json();
  if (!r.ok)
    throw Object.assign(new Error(x.error || "provider_error"), {
      retryAt: x.retryAt,
    });
  return x;
}
function notice(text, error = false) {
  $("#notice").textContent = text;
  $("#notice").classList.toggle("error", error);
}
function render() {
  if (!inventory) return;
  const repos = inventory.repositories;
  const inspected = [...details.values()];
  $("#nav-count").textContent = repos.length;
  $("#repo-count").textContent = repos.length;
  $("#attention-count").textContent = repos.filter(needsAttention).length;
  $("#repo-scope").textContent =
    (inventory.mode === "public"
      ? "Public repositories only"
      : "Selected installation repositories") +
    (inventory.complete ? "" : " · partial inventory");
  $("#inspected-count").textContent = inspected.length;
  $("#head-scope").textContent =
    `${inspected.filter((d) => d.coverage !== "current_within_scope").length} with incomplete or stale evidence`;
  const work = inventory.openWork;
  $("#pull-count").textContent = work?.complete ? work.items.length : "Unknown";
  $("#pull-scope").textContent = work?.complete
    ? "Search index · inspect for current state"
    : `Source ${label(work?.state)}`;
  $("#observed").textContent =
    `Inventory observed ${time(inventory.observed_at)}`;
  let list = repos.filter((r) =>
    (r.name + " " + (r.description || ""))
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  if (filter === "attention") list = list.filter(needsAttention);
  if (filter === "inspected") list = list.filter((r) => details.has(r.id));
  if (filter === "archived") list = list.filter((r) => r.archived);
  list.sort((a, b) =>
    sort === "name"
      ? a.name.localeCompare(b.name)
      : sort === "attention"
        ? openWork(b).length - openWork(a).length ||
          a.name.localeCompare(b.name)
        : String(b.pushed_at || "").localeCompare(String(a.pushed_at || "")),
  );
  $("#visible-count").textContent = list.length;
  $("#section-title").firstChild.textContent =
    filter === "attention" ? "Needs a closer look " : "Your projects ";
  $("#projects").innerHTML = list.length
    ? list.map(card).join("")
    : `<div class="empty">${search ? "No repositories match your search." : filter === "attention" ? "No open work or attention items observed in the loaded coverage. Uninspected sources remain unknown." : "No projects in this view."}</div>`;
  document
    .querySelectorAll("[data-inspect]")
    .forEach((b) => (b.onclick = () => showDetails(b.dataset.inspect)));
  document
    .querySelectorAll("[data-filter]")
    .forEach((b) => b.classList.toggle("active", b.dataset.filter === filter));
  document
    .querySelectorAll("[data-view]")
    .forEach((b) =>
      b.classList.toggle(
        "active",
        b.dataset.view === (filter === "attention" ? "attention" : "all"),
      ),
    );
  const bad = inspected.filter((d) => d.state?.observed === "failure");
  if (bad.length) {
    $("#attention-strip strong").textContent =
      `${bad.length} project${bad.length === 1 ? " has" : "s have"} failing checks at the observed default head.`;
    $("#attention-strip p").textContent =
      "Inspect the exact run before treating it as a blocker or regression.";
  } else {
    $("#attention-strip strong").textContent =
      "A useful view starts with honest coverage.";
    $("#attention-strip p").textContent =
      "Repository facts load first. Inspect a project for current commits, checks, merges, and deployments.";
  }
}
function card(r) {
  const d = details.get(r.id),
    prs = openWork(r),
    err = errors.get(r.id);
  const badge = err
    ? "Read unavailable"
    : d?.coverage === "stale"
      ? "Stale evidence"
      : d?.state?.observed === "failure"
        ? "Checks failing"
        : d?.state?.observed === "success"
          ? "Checks succeeded"
          : d?.coverage === "partial"
            ? "Partial evidence"
            : d
              ? "Head inspected"
              : "Not inspected";
  const mood =
    err || d?.state?.observed === "failure"
      ? "bad"
      : d?.state?.observed === "success"
        ? "good"
        : "";
  const prKnown =
    d?.sources.pulls?.complete || (!d && inventory.openWork?.complete);
  return `<article class="project"><div class="project-top"><span class="project-icon">${escape(r.name[0].toUpperCase())}</span><span class="project-type">${r.private ? "PRIVATE" : "PUBLIC"} REPOSITORY${r.archived ? "<br>ARCHIVED" : ""}</span><span class="project-badge ${mood}">${badge}</span></div><h3>${escape(r.name)}</h3><p>${escape(d?.head?.message || r.description || "No repository description supplied.")}</p><div class="repo-name">↳ ${link(r.url, r.full_name)}</div><div class="repo-stats"><div><label>OPEN WORK</label><strong>${prKnown ? `${prs.length} pull request${prs.length === 1 ? "" : "s"}` : "Unavailable"}</strong></div><div><label>CURRENT HEAD CHECKS</label><strong>${d ? escape(label(d.state.observed)) : "Not inspected"}</strong></div><div><label>DEPLOYMENT AT HEAD</label><strong>${d?.state.deployment === "observed_at_head" ? "Success observed" : d?.state.deployment === "other_sha" ? "Other commit only" : "Not established"}</strong></div><div><label>ACCEPTANCE</label><strong>Not recorded</strong></div></div><div class="card-foot"><span>${d ? "Observed " + time(d.observed_at) : "Pushed " + time(r.pushed_at)}</span><button class="inspect" data-inspect="${escape(r.id)}">${d ? "Open evidence" : "Inspect project"} ↗</button></div></article>`;
}
async function loadRepository(id) {
  if (inflight.has(id)) return inflight.get(id);
  const p = api(`/api/repository?id=${encodeURIComponent(id)}`)
    .then((d) => {
      details.set(id, d);
      errors.delete(id);
      render();
      return d;
    })
    .catch((e) => {
      errors.set(id, e);
      render();
      throw e;
    })
    .finally(() => inflight.delete(id));
  inflight.set(id, p);
  return p;
}
function row(url, title, small, state) {
  return `<div class="evidence-row"><div>${url ? link(url, title) : escape(title)}${small ? `<small>${escape(small)}</small>` : ""}</div>${state ? `<span class="pill ${escape(state)}">${escape(label(state))}</span>` : ""}</div>`;
}
function section(title, body) {
  return `<section class="detail-section"><h3>${title}</h3>${body}</section>`;
}
function detailHeader(r) {
  return `<div class="dialog-header"><div><div class="eyebrow">PROJECT EVIDENCE</div><h2 id="detail-title">${escape(r.name)}</h2><div class="detail-subtitle">${link(r.url, r.full_name)} · ${escape(r.default_branch || "No default branch")}</div></div><button class="close" data-close aria-label="Close project">×</button></div>`;
}
async function showDetails(id) {
  selected = id;
  const r = inventory.repositories.find((x) => x.id === id);
  if (!r) return;
  const dialog = $("#details");
  $("#detail-content").innerHTML =
    detailHeader(r) +
    '<div class="loading">Retrieving exact GitHub evidence…</div>';
  bindClose();
  if (!dialog.open) dialog.showModal();
  try {
    const d = await loadRepository(id);
    if (selected === id) renderDetail(d);
  } catch (e) {
    if (selected === id) {
      $("#detail-content").innerHTML =
        detailHeader(r) +
        `<div class="notice error">GitHub read unavailable: ${escape(label(e.message))}.${e.retryAt ? " Retry after " + escape(time(e.retryAt)) + "." : ""} Prior observations are retained where available.</div><button class="refresh" id="retry-detail">Retry read</button>`;
      bindClose();
      $("#retry-detail").onclick = () => showDetails(id);
    }
  }
}
function renderDetail(d) {
  const h = d.head,
    prs = d.pulls || [];
  const currentChecks = d.checks.filter((c) => c.head_sha === h?.sha);
  const deployments = d.deployments.map((x) =>
    row(
      x.status_url || x.url,
      `${x.environment} · ${label(x.state)}`,
      `SHA ${x.sha}${x.sha === h?.sha ? " · current observed head" : " · different or unresolved SHA"}`,
      x.state,
    ),
  );
  const src = Object.entries(d.sources).map(([name, s]) =>
    row(
      s.path ? "https://api.github.com" + s.path : null,
      label(name),
      `${s.observed_at ? time(s.observed_at) + " · " : ""}${s.scope || "Current-state endpoint"}${s.retryAt ? " · retry " + time(s.retryAt) : ""}`,
      s.state,
    ),
  );
  $("#detail-content").innerHTML =
    detailHeader(d) +
    `<div class="detail-subtitle">Observed ${time(d.observed_at)} · ${escape(label(d.coverage))} · ${escape(label(d.durability))} retention<br>Facts below are GitHub observations. Their grouping uses ${escape(d.policy)}.</div>${d.coverage === "stale" ? '<div class="notice error">Refresh failed. These are retained, stale observations.</div>' : ""}<div class="detail-state"><div><small>IMPLEMENTATION</small>${h ? "Commit observed" : "Unavailable"}</div><div><small>VERIFICATION</small>Unknown · profile missing</div><div><small>RECENT MERGES</small>${d.merges.length} in closed-PR sample</div><div><small>DEPLOYMENT</small>${escape(label(d.state.deployment))}</div><div><small>OWNER ACCEPTANCE</small>Not recorded</div><div><small>APPROVED VISION</small>Not established in Nucleus</div></div>` +
    section(
      "Current default-branch commit",
      h
        ? row(
            h.url,
            h.message,
            `SHA ${h.sha} · committed ${time(h.committed_at)} · observed ${time(d.sources.head.observed_at)}`,
          )
        : '<p class="muted">No head could be established. An empty repository or unavailable read is not successful verification.</p>',
    ) +
    section(
      `Open work · ${d.sources.pulls?.complete ? prs.length : "incomplete read"}`,
      prs.length
        ? prs
            .map((p) =>
              row(
                p.url,
                `#${p.number} ${p.title}`,
                `${p.draft ? "Draft" : "Ready for review"} · base ${p.base} · head ${p.head_sha} · PR-head checks not inspected`,
                p.draft ? "draft" : "open",
              ),
            )
            .join("")
        : `<p class="muted">${d.sources.pulls?.complete ? "No open PRs observed." : "Open PRs unavailable; an empty result is not established."}</p>`,
    ) +
    section(
      `Checks observed at this exact SHA · ${currentChecks.length}`,
      currentChecks.length
        ? currentChecks
            .map((c) =>
              row(
                c.url,
                c.name,
                `${c.head_sha} · ${c.kind || "check run"}${c.app_id ? " · app " + c.app_id : ""}`,
                c.conclusion || c.status,
              ),
            )
            .join("")
        : '<p class="muted">No current check evidence loaded. Verification remains unknown.</p>',
    ) +
    '<p class="muted">Individual check outcomes are not an aggregate verification claim. Required checks, reviews, and applicability have no approved profile in this slice.</p>' +
    section(
      "Recent merge observations",
      d.merges.length
        ? d.merges
            .map((p) =>
              row(
                p.url,
                `#${p.number} ${p.title}`,
                `Merged ${time(p.merged_at)} · resulting SHA ${p.merge_commit_sha || "unavailable"}`,
                "merged",
              ),
            )
            .join("")
        : '<p class="muted">No merges observed in the 10 most recently updated closed PRs, or source unavailable. Older merges are outside coverage.</p>',
    ) +
    section(
      "Deployment observations",
      deployments.join("") ||
        '<p class="muted">No deployment observed in the sampled GitHub deployment records, or source unavailable. Deployments outside GitHub are unknown.</p>',
    ) +
    section(
      "Recent releases",
      d.releases
        .map((r) =>
          row(
            r.url,
            r.name,
            `Published ${time(r.published_at)} · release is not deployment`,
            r.draft ? "draft" : r.prerelease ? "prerelease" : "published",
          ),
        )
        .join("") ||
        '<p class="muted">No release observed in the sample, or source unavailable.</p>',
    ) +
    section("Source coverage", src.join("")) +
    section(
      "Evidence references",
      d.evidence
        .map((e) =>
          row(
            "https://api.github.com" + e.api_path,
            label(e.kind),
            `observed_fact · direct · ${time(e.observed_at)} · SHA-256 ${e.id}`,
          ),
        )
        .join(""),
    ) +
    `<p class="muted">${escape(d.scope)}</p>`;
  bindClose();
}
function bindClose() {
  document
    .querySelectorAll("[data-close]")
    .forEach((b) => (b.onclick = () => b.closest("dialog").close()));
}
function showCoverage() {
  const d = inventory;
  $("#coverage-content").innerHTML =
    `<div class="coverage-grid"><div>Connection<small>${d?.mode === "github_app" ? "Dedicated GitHub App · installation scope" : "Live GitHub public API · private repositories unavailable"}</small></div><div>Retention<small>${d?.durability === "postgresql" ? "Central PostgreSQL evidence store" : "Temporary server session. May reset at any time; no durable memory claim."}</small></div></div><div class="coverage-list"><div><strong>Discovered repositories: ${d?.repositories.length ?? "unavailable"}</strong><p>${d?.complete ? "All pages in the declared discovery scope were retrieved." : "Inventory is unavailable or partial."} ${d?.mode === "public" ? "Public discovery does not establish coverage of your private portfolio." : ""}</p></div><div><strong>Current evidence, fetched when you inspect</strong><p>Default head, its checks and commit statuses, all open pull requests up to 1,000, the 10 most recently updated closed PRs, and 5 recent releases and deployments. Each read has its own timestamp and error state.</p></div><div><strong>Open-work overview</strong><p>${escape(d?.openWork?.scope || "Search-index overview unavailable.")} · ${escape(label(d?.openWork?.state))}</p></div><div><strong>Explicitly outside this first slice</strong><p>Approved verification profiles, PR-head checks, review requirements, historical backfill, webhooks, owner vision approval, and acceptance workflows. No overall completion, project regime, or live agent status is inferred.</p></div><div><strong>Read-only integration</strong><p>No repository-write route exists. Runtime App authentication requests read-only grants. Repository descriptions remain source descriptions, never owner-approved vision.</p></div><div><strong>Refresh behavior</strong><p>Reads are coalesced and cached for five minutes to protect GitHub limits. Refresh re-reads discovery and the projects you have inspected; retained observations preserve their original times. A failed source remains unavailable or stale.</p></div><div><strong>Complete private coverage requires runtime configuration</strong><p>A dedicated read-only GitHub App must be installed on selected repositories and its server credentials configured, along with the owner identity. PostgreSQL must be configured for durable central evidence. Neither is claimed active in the public demonstration.</p></div></div>${link("https://github.com/nrsandoval1231-oss/nucleus-next/blob/main/docs/PRD.md", "Canonical product requirements")}`;
  $("#coverage").showModal();
  bindClose();
}
async function refresh() {
  if (loading) return;
  loading = true;
  $("#refresh").disabled = true;
  $("#refresh-icon").classList.add("spinning");
  notice("Reading GitHub coverage…");
  try {
    const d = await api("/api/portfolio");
    inventory = d;
    const allowed = new Set(d.repositories.map((r) => r.id));
    for (const id of details.keys()) if (!allowed.has(id)) details.delete(id);
    render();
    notice(
      `${d.mode === "public" ? "Live public coverage. Private repositories are unavailable until the runtime GitHub App is connected." : "Live installation coverage for selected repositories."} ${d.complete ? "" : "Repository inventory is partial. "}${d.durability === "postgresql" ? "Central PostgreSQL retention active." : "Demo evidence is temporary; durable memory is not configured."}`,
    );
    // Overview is cheap. Detailed endpoint reads are explicit, avoiding a wasteful full-portfolio scan.
    for (const id of [...details.keys()]) {
      try {
        await loadRepository(id);
      } catch {}
    }
  } catch (e) {
    notice(
      `GitHub ${label(e.message)}.${e.retryAt ? " Retry after " + time(e.retryAt) + "." : ""} ${inventory ? "Prior observations remain visible and may be stale." : "No portfolio state could be established."}`,
      true,
    );
    if (inventory) {
      for (const [id, d] of details)
        details.set(id, { ...d, coverage: "stale" });
      render();
    } else
      $("#projects").innerHTML =
        '<div class="empty">Repository discovery is unavailable. Use Refresh to try again.</div>';
  } finally {
    loading = false;
    $("#refresh").disabled = false;
    $("#refresh-icon").classList.remove("spinning");
  }
}
$("#refresh").onclick = refresh;
$("#search").oninput = (e) => {
  search = e.target.value;
  render();
};
$("#sort").onchange = (e) => {
  sort = e.target.value;
  render();
};
document.querySelectorAll("[data-filter]").forEach(
  (b) =>
    (b.onclick = () => {
      filter = b.dataset.filter;
      render();
    }),
);
document.querySelectorAll("[data-view]").forEach(
  (b) =>
    (b.onclick = () => {
      filter = b.dataset.view;
      render();
    }),
);
$("#coverage-button").onclick = showCoverage;
$("#strip-action").onclick = showCoverage;
document.querySelectorAll("dialog").forEach((d) =>
  d.addEventListener("click", (e) => {
    if (e.target === d) {
      const r = d.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        d.close();
    }
  }),
);
refresh();
