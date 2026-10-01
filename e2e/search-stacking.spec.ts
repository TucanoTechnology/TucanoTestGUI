import { expect, test } from "@playwright/test";
import { pickProject, signIn } from "./helpers.js";

/**
 * #191 guards the mechanism, not just the paint order. In a compliant
 * engine the dropdown survives even the fragile configuration — a static
 * grid item's z-index still creates a stacking context under the CSS Grid
 * carve-out — so a behaviour-only test can never see a regression here.
 * The test therefore asserts the declared contract directly: the top bar
 * carries an explicit position alongside its z-index, and no longer leans
 * on the carve-out. The geometry checks stay as the anchor that the stack
 * being asserted is the stack the search dropdown actually floats in.
 */
test.describe("global search stacking", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await pickProject(page);
    await page.getByRole("grid", { name: "Test cases" }).waitFor();
  });

  test("the results panel overlaps the list and its hits take the hit", async ({
    page,
  }) => {
    await page.getByRole("searchbox", { name: "Global search" }).fill("Sign in");
    const results = page.getByRole("list", { name: "Search results" });
    await expect(results).toBeVisible();

    // The contract itself: an explicit position and a real z-index on the
    // top bar. Reverting to the grid carve-out (z-index with no position)
    // or "simplifying" the z-index away both fail here, in every engine,
    // whether or not the pixels still happen to look right.
    const stack = await page.locator(".topbar").evaluate((bar) => {
      const style = getComputedStyle(bar);
      return { position: style.position, zIndex: style.zIndex };
    });
    expect(
      stack.position,
      "#191: the top bar's z-index must not depend on the CSS Grid static-item carve-out",
    ).not.toBe("static");
    expect(stack.zIndex).toBe("1");

    // Non-vacuity: the panel must reach into the panes below the top bar.
    // Without that overlap the stacking assertions below would prove
    // nothing — a dropdown floating over empty header space tests nothing.
    const panel = await results.boundingBox();
    const main = await page.locator("#main-content").boundingBox();
    expect(
      panel !== null && main !== null && panel.y + panel.height > main.y,
    ).toBe(true);

    // The topmost element at the DEEPEST hit's centre is the hit itself:
    // it sits fully inside the panes' territory, so a broken stacking
    // context — a list row, a sticky header, any later grid item painting
    // over the top bar — lands between the cursor and the control, and
    // elementFromPoint shows exactly that.
    const deepest = results.getByRole("button").last();
    const reachable = await deepest.evaluate((button) => {
      const rect = button.getBoundingClientRect();
      const top = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return button === top || (top !== null && button.contains(top));
    });
    expect(reachable).toBe(true);

    // A real click lands: Playwright's own hit-testing passes, the dropdown
    // closes and the pick empties the search box as the hit handler does.
    await results.getByRole("button").first().click();
    await expect(results).toHaveCount(0);
    await expect(
      page.getByRole("searchbox", { name: "Global search" }),
    ).toHaveValue("");
  });
});
