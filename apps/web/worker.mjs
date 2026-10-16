import page from "./index.html";
import style from "./style.css";
import client from "./client.js";
import { runtime, securityHeaders } from "./runtime.mjs";
let app;
export default {
  async fetch(request, env) {
    app ??= runtime(env);
    const path = new URL(request.url).pathname;
    if (path.startsWith("/api/")) return app(request);
    if (request.method !== "GET")
      return new Response("Read only", { status: 405 });
    const asset =
      path === "/"
        ? [page, "text/html"]
        : path === "/style.css"
          ? [style, "text/css"]
          : path === "/client.js"
            ? [client, "text/javascript"]
            : null;
    return asset
      ? new Response(asset[0], {
          headers: {
            ...securityHeaders,
            "content-type": asset[1] + "; charset=utf-8",
          },
        })
      : new Response("Not found", { status: 404 });
  },
};
