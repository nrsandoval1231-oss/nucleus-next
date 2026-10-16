import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { runtime, securityHeaders } from "./runtime.mjs";
import { browserCode } from "../../scripts/browser-build.mjs";
const clientCode = await browserCode();
let store;
if (process.env.DATABASE_URL) {
  const { PostgresStore } = await import("../../packages/db/postgres.mjs");
  store = new PostgresStore(process.env.DATABASE_URL);
}
const app = runtime(process.env, store);
const assets = {
  "/": ["index.html", "text/html"],
  "/style.css": ["style.css", "text/css"],
  "/client.js": ["client.js", "text/javascript"],
};
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, "http://localhost").pathname;
    let response;
    if (path.startsWith("/api/")) {
      const headers = new Headers();
      // Identity is trusted only from an explicitly configured authenticating reverse proxy on loopback.
      if (
        process.env.NUCLEUS_TRUST_PROXY === "1" &&
        req.headers["oai-authenticated-user-id"]
      )
        headers.set(
          "oai-authenticated-user-id",
          req.headers["oai-authenticated-user-id"],
        );
      response = await app(
        new Request("http://localhost" + req.url, {
          method: req.method,
          headers,
        }),
      );
    } else if (req.method !== "GET")
      response = new Response("Read only", { status: 405 });
    else if (assets[path])
      response = new Response(
        path === "/client.js"
          ? clientCode
          : await readFile(new URL(assets[path][0], import.meta.url)),
        {
          headers: {
            "content-type": assets[path][1] + "; charset=utf-8",
            ...securityHeaders,
          },
        },
      );
    else response = new Response("Not found", { status: 404 });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500, {
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    res.end('{"error":"server_error"}');
  }
});
const preview =
  process.argv.includes("--host") &&
  !process.env.GITHUB_APP_ID &&
  !process.env.DATABASE_URL;
server.listen(
  Number(process.env.PORT || 4173),
  preview ? "0.0.0.0" : "127.0.0.1",
  () => console.log("Nucleus Next ready"),
);
