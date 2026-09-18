import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  debugLoginEnabled,
  initialCredentials,
  readDemoAccounts,
} from "./LoginScreen.js";
import { resetTestApi } from "../test-utils.js";

describe("debug login helpers", () => {
  it("is inactive unless the build sets it to true", () => {
    expect(debugLoginEnabled({})).toBe(false);
    expect(debugLoginEnabled({ VITE_DEBUG_LOGIN: "false" })).toBe(false);
    expect(debugLoginEnabled({ VITE_DEBUG_LOGIN: "true" })).toBe(true);
  });

  it("lists the accounts the seed creates, with the seed's default passwords", () => {
    expect(readDemoAccounts({})).toEqual([
      {
        label: "admin (systemAdmin)",
        username: "admin",
        password: "demo-admin-password",
      },
      {
        label: "viewer (owner on checkout.json)",
        username: "viewer",
        password: "viewer-seed-password",
      },
    ]);
  });

  it("takes the passwords of a deployment's own seed from the build environment", () => {
    const accounts = readDemoAccounts({
      VITE_DEMO_ADMIN_PASSWORD: "s3cret",
      VITE_DEMO_VIEWER_PASSWORD: "other",
    });

    expect(accounts.map((account) => account.password)).toEqual([
      "s3cret",
      "other",
    ]);
  });

  it("pre-fills the first account when active and nothing when inactive", () => {
    const accounts = readDemoAccounts({});

    expect(initialCredentials(true, accounts)).toEqual({
      username: "admin",
      password: "demo-admin-password",
    });
    expect(initialCredentials(false, accounts)).toEqual({
      username: "",
      password: "",
    });
  });
});

describe("LoginScreen with the debug flag enabled", () => {
  let rtl: typeof import("@testing-library/react");
  let createElement: typeof import("react").createElement;
  let App: typeof import("../App.js").App;

  beforeAll(async () => {
    vi.stubEnv("VITE_DEBUG_LOGIN", "true");
    // This suite builds its own React and testing-library instances, so the
    // automatic cleanup hook of the second copy is not registered.
    vi.stubEnv("RTL_SKIP_AUTO_CLEANUP", "true");
    vi.resetModules();
    rtl = await import("@testing-library/react");
    createElement = (await import("react")).createElement;
    ({ App } = await import("../App.js"));
  });

  afterAll(() => {
    rtl.cleanup();
    vi.unstubAllEnvs();
  });

  it("pre-fills the form and lists both seeded accounts", () => {
    resetTestApi();
    rtl.render(createElement(App));

    expect(rtl.screen.getByLabelText("Username")).toHaveValue("admin");
    expect(rtl.screen.getByLabelText("Password")).toHaveValue(
      "demo-admin-password",
    );

    rtl.fireEvent.click(
      rtl.screen.getByRole("button", {
        name: "viewer (owner on checkout.json) — viewer / viewer-seed-password",
      }),
    );

    expect(rtl.screen.getByLabelText("Username")).toHaveValue("viewer");
    expect(rtl.screen.getByLabelText("Password")).toHaveValue(
      "viewer-seed-password",
    );
  });
});
