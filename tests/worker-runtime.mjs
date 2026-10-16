import { runtime } from "../apps/web/runtime.mjs";
import { GitHub } from "../workers/github-sync/github.mjs";
import { installationToken } from "../workers/github-sync/auth.mjs";
export const authentication = {
  async test() {
    const key = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );
    const bytes = new Uint8Array(
      await crypto.subtle.exportKey("pkcs8", key.privateKey),
    );
    const pem = btoa(String.fromCharCode(...bytes));
    const token = await installationToken({
      GITHUB_APP_ID: "123",
      GITHUB_INSTALLATION_ID: "456",
      GITHUB_APP_PRIVATE_KEY: `-----BEGIN PRIVATE KEY-----\n${pem}\n-----END PRIVATE KEY-----`,
    });
    if (token.token !== "fixture-token")
      throw new Error("Worker App exchange failed");
  },
};
export const transport = {
  async test() {
    const r = await new GitHub({ owner: "nick" }).get("/users/nick/repos");
    if (r.data[0]?.name !== "one")
      throw new Error("Worker transport fixture missing");
  },
};
export default {
  async test() {
    const app = runtime({ GITHUB_OWNER: "nick" });
    const r = await app(new Request("https://nucleus.test/api/portfolio"));
    const d = await r.json();
    if (r.status !== 200)
      throw new Error(
        `Worker discovery failed: ${r.status} ${JSON.stringify(d)}`,
      );
    if (d.repositories[0]?.full_name !== "nick/one")
      throw new Error("Worker did not retrieve fixture metadata");
  },
};
