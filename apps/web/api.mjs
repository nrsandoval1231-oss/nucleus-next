import {
  GitHub,
  discover,
  inspectRepository,
} from "../../workers/github-sync/github.mjs";
import { evidenceId } from "../../packages/core/evidence.mjs";
const json = (x, status = 200) =>
  new Response(JSON.stringify(x), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
const exposed = (r) => ({
  ...r,
  evidence: r.evidence?.map(({ payload, ...e }) => e),
});
export function createApplication({
  owner,
  store,
  getGitHub = async () => new GitHub({ owner }),
  discoverFn = discover,
  inspectFn = inspectRepository,
  privateRuntime = false,
  ownerId,
  cacheMs = 300000,
}) {
  let inventory,
    pendingInventory,
    inventoryAt = 0;
  const pending = new Map(),
    cache = new Map();
  async function scope(g) {
    if (!privateRuntime && inventory && Date.now() - inventoryAt < cacheMs)
      return inventory;
    if (!pendingInventory)
      pendingInventory = discoverFn(g)
        .then(async (d) => {
          if (d.observed_at)
            await store.save(owner, {
              ...d,
              id: "_inventory",
              evidence: [
                {
                  id: await evidenceId(d),
                  kind: "repository_discovery",
                  observed_at: d.observed_at,
                  category: "observed_fact",
                  confidence: "direct",
                  payload: d,
                },
              ],
            });
          inventory = d;
          inventoryAt = Date.now();
          return d;
        })
        .finally(() => (pendingInventory = null));
    return pendingInventory;
  }
  return async (request) => {
    if (request.method !== "GET") return json({ error: "read_only" }, 405);
    if (privateRuntime) {
      if (!ownerId)
        return json({ error: "owner_identity_not_configured" }, 503);
      const identity = request.headers.get("oai-authenticated-user-id");
      if (!identity) return json({ error: "sign_in_required" }, 401);
      if (identity !== ownerId) return json({ error: "access_denied" }, 403);
    }
    try {
      const url = new URL(request.url);
      if (!["/api/portfolio", "/api/repository"].includes(url.pathname))
        return json({ error: "not_found" }, 404);
      const g = await getGitHub(),
        d = await scope(g);
      if (url.pathname === "/api/portfolio")
        return json({
          ...d,
          durability: store.durability,
          refreshInterval: cacheMs / 1000,
          policy: "portfolio-observation-v1",
        });
      const id = url.searchParams.get("id");
      const meta = d.repositories.find((r) => r.id === id);
      if (!meta) return json({ error: "repository_not_in_current_scope" }, 404);
      const previous = cache.get(id);
      if (previous && Date.now() - previous.at < cacheMs)
        return json({
          ...exposed(previous.value),
          cached: true,
          durability: store.durability,
        });
      if (!pending.has(id))
        pending.set(
          id,
          (async () => {
            try {
              const r = await inspectFn(g, meta);
              // Persist acquisition and projection together before presenting retained evidence.
              await store.save(owner, r);
              cache.set(id, { at: Date.now(), value: r });
              return { ...exposed(r), durability: store.durability };
            } catch (e) {
              const old = previous?.value || (await store.latest(owner, id));
              if (old)
                return {
                  ...exposed(old),
                  coverage: "stale",
                  refresh_error: e.code || "provider_error",
                  durability: store.durability,
                };
              throw e;
            } finally {
              pending.delete(id);
            }
          })(),
        );
      return json(await pending.get(id));
    } catch (e) {
      return json(
        {
          error: e.code || "provider_error",
          retryAt: e.retryAt || null,
          ...(!privateRuntime && e.code === "rate_limited"
            ? { publicFallback: { owner } }
            : {}),
        },
        503,
      );
    }
  };
}
