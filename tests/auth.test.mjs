import test from "node:test";
import assert from "node:assert/strict";
import { installationToken } from "../workers/github-sync/auth.mjs";
test("App token exchange signs a bounded JWT and requests only read grants", async () => {
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
  const pem = Buffer.from(
    await crypto.subtle.exportKey("pkcs8", key.privateKey),
  ).toString("base64");
  let calls = 0;
  const r = await installationToken(
    {
      GITHUB_APP_ID: "123",
      GITHUB_INSTALLATION_ID: "456",
      GITHUB_APP_PRIVATE_KEY: `-----BEGIN PRIVATE KEY-----\n${pem}\n-----END PRIVATE KEY-----`,
    },
    async (url, init) => {
      calls++;
      assert.equal(
        url,
        "https://api.github.com/app/installations/456/access_tokens",
      );
      assert.equal(init.method, "POST");
      assert.ok(
        Object.values(JSON.parse(init.body).permissions).every(
          (p) => p === "read",
        ),
      );
      const jwt = init.headers.Authorization.slice(7).split(".");
      const claims = JSON.parse(Buffer.from(jwt[1], "base64url"));
      assert.equal(claims.iss, "123");
      assert.ok(claims.exp - claims.iat <= 600);
      assert.ok(
        await crypto.subtle.verify(
          "RSASSA-PKCS1-v1_5",
          key.publicKey,
          Buffer.from(jwt[2], "base64url"),
          Buffer.from(jwt.slice(0, 2).join(".")),
        ),
      );
      return Response.json({
        token: "temporary",
        expires_at: "2026-10-16T06:00:00Z",
      });
    },
  );
  assert.equal(calls, 1);
  assert.equal(r.token, "temporary");
});
test("partial credential configuration fails closed", async () => {
  assert.equal(await installationToken({}), null);
  await assert.rejects(
    () => installationToken({ GITHUB_APP_ID: "123" }),
    /Incomplete/,
  );
});
