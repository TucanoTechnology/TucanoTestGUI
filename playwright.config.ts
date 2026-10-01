import { defineConfig, devices } from "@playwright/test";

/**
 * The browser accessibility gate (#123).
 *
 * The suite runs against `vite preview` of the real production bundle, with
 * the recorded fixture API behind it (scripts/e2e-api.mjs). Unlike jsdom,
 * axe's colour-contrast rule runs here for real — which is the check #170
 * showed was missing. The build is part of the webServer command so a stale
 * dist can never be what CI green-lights.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
    // A failure must be debuggable without a re-run (AgentRules/test/ui.md).
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node scripts/e2e-api.mjs",
      port: 4174,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run build && npm run preview",
      port: 4173,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
