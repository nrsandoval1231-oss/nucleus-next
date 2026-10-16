import { createApplication } from "./api.mjs";
import { MemoryStore } from "../../packages/db/store.mjs";
import { GitHub } from "../../workers/github-sync/github.mjs";
import { installationToken } from "../../workers/github-sync/auth.mjs";
export function runtime(env, store = new MemoryStore()) {
  const owner = env.GITHUB_OWNER || "nrsandoval1231-oss";
  const configured = Boolean(
    env.GITHUB_APP_ID ||
    env.GITHUB_INSTALLATION_ID ||
    env.GITHUB_APP_PRIVATE_KEY,
  );
  let credential, pendingCredential;
  const getGitHub = async () => {
    if (
      configured &&
      (!credential || Date.parse(credential.expires_at) - Date.now() < 120000)
    ) {
      pendingCredential ??= installationToken(env).finally(() => {
        pendingCredential = null;
      });
      credential = await pendingCredential;
    }
    return new GitHub({ owner, token: credential?.token });
  };
  return createApplication({
    owner,
    store,
    getGitHub,
    privateRuntime: configured,
    ownerId: env.NUCLEUS_OWNER_ID,
  });
}
export const securityHeaders = {
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "cache-control": "private, no-store",
};
