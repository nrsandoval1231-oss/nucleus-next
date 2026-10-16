const encode = (value) =>
  btoa(String.fromCharCode(...new Uint8Array(value)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
const json = (value) => encode(new TextEncoder().encode(JSON.stringify(value)));
export async function installationToken(env, fetcher = fetch) {
  if (
    !env.GITHUB_APP_ID &&
    !env.GITHUB_INSTALLATION_ID &&
    !env.GITHUB_APP_PRIVATE_KEY
  )
    return null;
  if (
    !/^\d+$/.test(env.GITHUB_APP_ID) ||
    !/^\d+$/.test(env.GITHUB_INSTALLATION_ID) ||
    !env.GITHUB_APP_PRIVATE_KEY
  )
    throw new Error("Incomplete GitHub App configuration");
  const keyText = env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n")
    .replace(/-----[^-]+-----/g, "")
    .replace(/\s/g, "");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(keyText), (c) => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const now = Math.floor(Date.now() / 1000),
    unsigned =
      json({ alg: "RS256", typ: "JWT" }) +
      "." +
      json({ iat: now - 30, exp: now + 540, iss: env.GITHUB_APP_ID });
  const jwt =
    unsigned +
    "." +
    encode(
      await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        key,
        new TextEncoder().encode(unsigned),
      ),
    );
  // The sole GitHub POST mints a short-lived read-only installation credential; it changes no repository.
  const r = await fetcher(
    `https://api.github.com/app/installations/${env.GITHUB_INSTALLATION_ID}/access_tokens`,
    {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(12000),
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Nucleus-Next",
      },
      body: JSON.stringify({
        permissions: {
          metadata: "read",
          contents: "read",
          pull_requests: "read",
          actions: "read",
          checks: "read",
          statuses: "read",
          deployments: "read",
        },
      }),
    },
  );
  if (!r.ok) throw new Error("GitHub App authentication unavailable");
  const result = await r.json();
  return { token: result.token, expires_at: result.expires_at };
}
