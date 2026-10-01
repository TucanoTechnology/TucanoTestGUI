// Serves the built bundle for the Playwright suite and proxies /api to the
// fixture server (#123). Deliberately only Node built-ins: in CI this runs
// inside the Playwright container with the repository bind-mounted, so any
// native binary in the serving path would make the job depend on the image's
// libc matching the host's. The bundle itself is built on the host beforehand.

import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const PORT = Number(process.env.E2E_PORT ?? 4173);
const API_PORT = Number(process.env.E2E_API_PORT ?? 4174);
const DIST = resolve("dist");

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    const target = url.pathname.replace(/^\/api/, "") + url.search;
    const upstream = await fetch(`http://127.0.0.1:${API_PORT}${target}`, {
      method: req.method,
      headers: { "content-type": "application/json" },
      body: ["GET", "HEAD"].includes(req.method) ? undefined : req,
      duplex: "half",
    });
    res.writeHead(upstream.status, {
      "content-type":
        upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
    });
    res.end(Buffer.from(await upstream.arrayBuffer()));
    return;
  }

  const pathname = decodeURIComponent(url.pathname);
  const candidate = join(DIST, pathname === "/" ? "index.html" : pathname);
  let file = existsSync(candidate) && statSync(candidate).isFile()
    ? candidate
    : join(DIST, "index.html"); // SPA fallback

  res.writeHead(200, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`e2e static server for ${DIST} on http://localhost:${PORT}`);
});
