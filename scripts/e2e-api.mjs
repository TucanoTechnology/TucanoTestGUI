// The hermetic API behind the Playwright suite (#123).
//
// It answers the routes the GUI reads on the pages the suite walks, from a
// fixture map recorded off a seeded live deployment
// (scripts/capture-e2e-fixtures.mjs), so the accessibility gate exercises the
// real application shell against real-shaped data without a database, a
// network, or a second container in CI. Writes are answered with the API's
// message envelope; nothing the suite does persists.

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.E2E_API_PORT ?? 4174);
const fixtures = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../e2e/fixtures.json", import.meta.url)),
    "utf8",
  ),
);

const SESSION = {
  accessToken: "e2e-access-token",
  refreshToken: "e2e-refresh-token",
  tokenType: "Bearer",
  expiresIn: 3600,
};

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = decodeURIComponent(url.pathname);
  const full = url.search ? `${path}${url.search}` : path;

  if (path === "/auth/login" && req.method === "POST") {
    return json(res, 200, SESSION);
  }
  if (path === "/auth/me" && req.method === "GET") {
    // The account the shell names in the top bar and the admin gate consult
    // for the New-project control (#160). The e2e admin sees everything.
    return json(res, 200, {
      id: "e2e-admin",
      username: "admin",
      systemAdmin: true,
      roles: {},
    });
  }
  if (path === "/auth/refresh" && req.method === "POST") {
    return json(res, 200, SESSION);
  }
  if (path === "/auth/logout" && req.method === "POST") {
    return json(res, 200, { message: "Signed out" });
  }
  if (req.method === "GET" && fixtures[full]) {
    const entry = fixtures[full];
    return json(res, entry.status, entry.body);
  }
  // A GET with no fixture is a 404 envelope, exactly as the API answers one.
  if (req.method === "GET") {
    return json(res, 404, {
      error: { code: "not_found", message: `no fixture for ${full}` },
    });
  }
  // Writes never persist; the suite cancels every dialog it opens.
  return json(res, req.method === "POST" ? 201 : 200, {
    message: "Resource updated",
    id: "e2e-stub",
  });
});

server.listen(PORT, () => {
  console.log(`e2e fixture API on http://localhost:${PORT}`);
});
