import { expect, test } from "@playwright/test";
import { expectAccessible, gotoModule, pickProject, signIn } from "./helpers.js";

/**
 * One axe pass per page and per reachable panel state (#123): the pages the
 * unit-level calls could not verify colour on now run under a real engine,
 * the palette from #172 included.
 */
test.describe("accessibility", () => {
  test("the sign-in screen stands alone", async ({ page }) => {
    await page.goto("/");
    await expectAccessible(page, "login screen");
  });

  test.describe("authenticated shell", () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
      await pickProject(page);
    });

    test("the case list, scoped and searched", async ({ page }) => {
      await expectAccessible(page, "case list");

      await page.getByRole("searchbox", { name: "Global search" }).fill("cart");
      await expectAccessible(page, "global search results");
      await page.getByRole("searchbox", { name: "Global search" }).fill("");

      await page.getByRole("searchbox", { name: "Search cases" }).fill("lock");
      await expect(page.getByText("Sign in with a locked account")).toBeVisible();
      await expectAccessible(page, "filtered case list");
      await page.getByRole("searchbox", { name: "Search cases" }).fill("nothing matches");
      await expectAccessible(page, "empty case list");
    });

    test("the case list bulk toolbar, once a selection exists", async ({ page }) => {
      await page.getByLabel("Select TC-CART-1").check();
      await expect(
        page.getByRole("toolbar", { name: "Bulk case operations" }),
      ).toBeVisible();
      await expectAccessible(page, "bulk toolbar");
    });

    test("the project explorer, before any project is active", async ({ page }) => {
      await page.getByRole("combobox", { name: "Active project" }).selectOption("");
      await expect(
        page.getByRole("complementary", { name: "Project explorer" }),
      ).toBeVisible();
      await expectAccessible(page, "project explorer");
    });

    test("case detail, tab by tab", async ({ page }) => {
      await page.getByText("Add an item to the cart").first().click();
      await expect(page.getByRole("tab", { name: "Details" })).toBeVisible();
      await expectAccessible(page, "case detail / Details");

      for (const tab of ["Steps", "Attachments", "History"] as const) {
        await page.getByRole("tab", { name: tab }).click();
        await expectAccessible(page, `case detail / ${tab}`);
      }
    });

    test("case detail dialogs", async ({ page }) => {
      await page.getByText("Add an item to the cart").first().click();
      await page.getByRole("button", { name: "Duplicate" }).click();
      await expect(page.getByRole("dialog", { name: "Duplicate case" })).toBeVisible();
      await expectAccessible(page, "duplicate-case dialog");
      await page.keyboard.press("Escape");

      await page.getByRole("button", { name: "Delete" }).click();
      await expect(page.getByRole("dialog", { name: "Delete case" })).toBeVisible();
      await expectAccessible(page, "delete-case dialog");
      await page.keyboard.press("Escape");
    });

    test("the run list, a run's detail and its Import tab", async ({ page }) => {
      await gotoModule(page, "Test Runs");
      await expect(page.getByRole("table", { name: "Test runs" })).toBeVisible();
      await expectAccessible(page, "run list");

      await page.getByText("nightly", { exact: true }).first().click();
      await expect(
        page.getByRole("heading", { name: "nightly" }).first(),
      ).toBeVisible();
      await expectAccessible(page, "run detail / Cases");

      await page.getByRole("tab", { name: "Import" }).click();
      await expectAccessible(page, "run detail / Import");
    });

    test("milestones: list, detail and the duplicate dialog", async ({ page }) => {
      await gotoModule(page, "Milestones");
      await expect(page.getByRole("table", { name: "Milestones" })).toBeVisible();
      await expectAccessible(page, "milestone list");

      await page.getByText("v1.0", { exact: true }).first().click();
      await expectAccessible(page, "milestone detail");

      await page.getByRole("button", { name: "Duplicate" }).click();
      await expect(
        page.getByRole("dialog", { name: "Duplicate milestone" }),
      ).toBeVisible();
      await expectAccessible(page, "duplicate-milestone dialog");
      await page.keyboard.press("Escape");
    });

    test("configurations: list and detail", async ({ page }) => {
      await gotoModule(page, "Configurations");
      await expect(
        page.getByRole("table", { name: "Configurations" }),
      ).toBeVisible();
      await expectAccessible(page, "configuration list");

      await page.getByText("chrome-linux", { exact: true }).first().click();
      await expectAccessible(page, "configuration detail");
    });

    test("the reports module", async ({ page }) => {
      await gotoModule(page, "Reports");
      await expect(page.getByRole("group", { name: "Report filters" })).toBeVisible();
      await expectAccessible(page, "reports");
    });
  });
});

  test("dark theme has no accessibility violations", async ({ page }) => {
    await signIn(page);
    await pickProject(page);
    
    // Switch to dark theme
    await page.getByRole("button", { name: /switch to dark theme/i }).click();
    await page.waitForTimeout(100);
    
    await expectAccessible(page, "dark theme case list");
  });
