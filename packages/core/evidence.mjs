// Pure, versioned interpretation. Observed check outcomes are not an approved verification profile.
export const POLICY = "portfolio-observation-v1";
export function summarizeChecks(checks, sha) {
  const current = checks.filter((c) => c.head_sha === sha);
  let observed = "unknown";
  if (current.length) {
    if (current.some((c) => ["failure", "timed_out"].includes(c.conclusion)))
      observed = "failure";
    else if (current.some((c) => c.status !== "completed"))
      observed = "pending";
    else if (current.every((c) => c.conclusion === "success"))
      observed = "success";
    else observed = "inconclusive";
  } else if (checks.length) observed = "stale";
  return {
    observed,
    verification: "unknown",
    profile: "not_configured",
    count: current.length,
  };
}
export function projectState({ head, checks = [], deployments = [] }) {
  const check = summarizeChecks(checks, head);
  const success = deployments.filter((d) => d.state === "success");
  return {
    ...check,
    acceptance: "not_recorded",
    vision: "not_approved",
    deployment:
      head && success.some((d) => d.sha === head)
        ? "observed_at_head"
        : success.length
          ? "other_sha"
          : "not_established",
  };
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical(value[k])]),
    );
  return value;
}
export async function evidenceId(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export function attention(result) {
  const items = [];
  if (result.coverage !== "current_within_scope")
    items.push({
      priority: 0,
      label: "Evidence incomplete",
      reason: "One or more GitHub sources could not be fully observed.",
      action: "Inspect source coverage",
    });
  if (result.state.observed === "failure")
    items.push({
      priority: 1,
      label: "Failing checks observed",
      reason:
        "At least one check reports failure at the current default head. No regression is inferred.",
      action: "Open the failing check",
    });
  if (result.pulls.some((p) => !p.draft))
    items.push({
      priority: 2,
      label: "Review open work",
      reason:
        "A non-draft pull request is open. This does not establish a required approval or blocker.",
      action: "Review open pull requests",
    });
  if (result.state.observed === "pending")
    items.push({
      priority: 3,
      label: "Checks running",
      reason: "Current default-head checks have not all completed.",
      action: "Open running checks",
    });
  return items.sort((a, b) => a.priority - b.priority);
}
