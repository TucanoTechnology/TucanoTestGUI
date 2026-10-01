import { expect, test } from "@playwright/test";
import { signIn, pickProject } from "./helpers.js";

test.describe("theme toggle", () => {
  test("switches between light and dark themes", async ({ page }) => {
    await signIn(page);
    await pickProject(page);

    // Default should be light (no data-theme attribute)
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");

    // Click the theme toggle
    await page.getByRole("button", { name: /switch to dark theme/i }).click();

    // Should now be dark
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // Click again to switch back
    await page.getByRole("button", { name: /switch to light theme/i }).click();

    // Should be light again
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
  });

  test("persists theme choice across page reloads", async ({ page }) => {
    await signIn(page);
    await pickProject(page);

    // Switch to dark
    await page.getByRole("button", { name: /switch to dark theme/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // Reload the page
    await page.reload();

    // Should still be dark
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});
