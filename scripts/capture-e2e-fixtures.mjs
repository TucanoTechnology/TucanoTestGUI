// Re-records e2e/fixtures.json from a live seeded deployment
// (#123). Point it at an authenticated, seeded API and it walks the route set
// the Playwright suite's pages read: project documents, the case list's
// last-results report, run/milestone/configuration documents and progress,
// a seeded case's history, and the reports in both scopes.
//
//   TUCANO_E2E_BASE=http://localhost:3100 \
//   TUCANO_E2E_USER=admin TUCANO_E2E_PASSWORD=... \
//   node scripts/capture-e2e-fixtures.mjs

import { writeFileSync } from "node:fs";

const BASE = process.env.TUCANO_E2E_BASE ?? "http://localhost:3100";
const USER = process.env.TUCANO_E2E_USER ?? "admin";
const PASSWORD = process.env.TUCANO_E2E_PASSWORD ?? "demo-admin-password";

const session = await (
  await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: USER, password: PASSWORD }),
  })
).json();
const headers = { authorization: `Bearer ${session.accessToken}` };

const out = {};
async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  out[path] = { status: res.status, body };
  return body;
}

await get("/projects");
for (const pid of out["/projects"].body) {
  const doc = await get(`/projects/${pid}`);
  await get(`/reports/last-results?projectId=${pid}`);
  for (const rid of await get(`/projects/${pid}/test_runs`)) {
    await get(`/test_runs/${rid}`);
  }
  for (const mid of await get(`/projects/${pid}/milestones`)) {
    await get(`/milestones/${mid}`);
    await get(`/milestones/${mid}/progress`);
  }
  for (const cid of await get(`/projects/${pid}/configurations`)) {
    await get(`/configurations/${cid}`);
  }
  // The History tab of the first suite's first case, and a suite document
  // for the tree click.
  const firstCase = doc.testSuites?.find((s) => (s.testCases ?? []).length)
    ?.testCases?.[0];
  if (firstCase) {
    await get(`/test_cases/${firstCase.testCaseId}/history`);
  }
  if (doc.testSuites?.[0]) {
    await get(`/test_suites/${doc.testSuites[0].suiteId}`);
  }
  await get(`/reports/coverage?projectId=${pid}`);
  await get(`/reports/summary?projectId=${pid}`);
}
await get("/reports/coverage");
await get("/reports/summary");

writeFileSync("e2e/fixtures.json", `${JSON.stringify(out, null, 1)}\n`);
console.log(`captured ${Object.keys(out).length} routes`);
