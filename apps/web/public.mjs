import {
  GitHub,
  discover,
  inspectRepository,
} from "../../workers/github-sync/github.mjs";
// Demo-only public transport. No credential or durable memory is placed in the browser.
export async function publicPortfolio(owner) {
  return {
    ...(await discover(new GitHub({ owner }))),
    durability: "browser_session_only",
    transport: "direct_public_browser",
  };
}
export async function publicRepository(owner, meta) {
  const d = await inspectRepository(new GitHub({ owner }), meta);
  return {
    ...d,
    evidence: d.evidence.map(({ payload, ...reference }) => reference),
    durability: "browser_session_only",
  };
}
