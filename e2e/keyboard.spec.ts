import { expect, test } from "@playwright/test";
import { gotoModule, pickProject, signIn } from "./helpers.js";

/**
 * The keyboard journeys #123 asks Playwright to verify: a keyboard-only
 * operator can reach the work, move inside it, and get out of what they open.
 */
test.describe("keyboard traversal", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await pickProject(page);
  });

  test("the skip link is the first stop and lands inside the main pane", async ({
    page,
  }) => {
    // jsdom never lays out or focuses per Tab; only the browser can show the
    // README's promise is true.
    await page.keyboard.press("Tab");
    await expect(page.locator(".skip-link")).toBeFocused();
    await expect(page.locator(".skip-link")).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();

    // And from there the next Tab continues inside the content, not at the
    // top of the document: focus the grid's first control and confirm the
    // chain stays within the main pane.
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() =>
      document
        .getElementById("main-content")
        ?.contains(document.activeElement),
    );
    expect(inside).toBe(true);
  });

  test("the nav rail is reachable by Tab alone", async ({ page }) => {
    const visited: string[] = [];
    for (let i = 0; i < 20; i += 1) {
      await page.keyboard.press("Tab");
      visited.push(
        await page.evaluate(
          () =>
            document.activeElement?.getAttribute("aria-label") ??
            document.activeElement?.textContent?.trim() ??
            "",
        ),
      );
    }
    for (const label of [
      "Test Runs",
      "Milestones",
      "Configurations",
      "Reports",
    ]) {
      expect(visited, `Tab reached ${label}`).toContain(label);
    }
  });

  test("case detail tabs move with the arrow keys", async ({ page }) => {
    await page.getByText("Add an item to the cart").first().click();
    const details = page.getByRole("tab", { name: "Details" });
    await expect(details).toBeVisible();
    await details.focus();

    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Steps" })).toBeFocused();
    await expect(page.getByRole("tab", { name: "Steps" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await page.keyboard.press("End");
    await expect(page.getByRole("tab", { name: "History" })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(details).toBeFocused();
  });

  test("Escape closes a dialog and returns focus to its trigger", async ({
    page,
  }) => {
    await page.getByText("Add an item to the cart").first().click();
    const trigger = page.getByRole("button", { name: "Duplicate" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Duplicate case" });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("the module search input filters from the keyboard", async ({ page }) => {
    const search = page.getByRole("searchbox", { name: "Search cases" });
    await search.focus();
    await page.keyboard.type("lock");
    await expect(
      page.getByText("Sign in with a locked account"),
    ).toBeVisible();
    await expect(page.getByText("Add an item to the cart")).toBeHidden();
  });
});
