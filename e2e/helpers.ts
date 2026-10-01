import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Sign in through the real form; the fixture API accepts any credentials. */
export async function signIn(page: Page): Promise<void> {
  await page.goto("/");
  await page.fill("#username", "admin");
  await page.fill("#password", "e2e-password");
  await page.click(".login-form__submit");
  await expect(
    page.getByRole("combobox", { name: "Active project" }),
  ).toBeVisible();
}

/** Point the shell at the seeded checkout project; the case list is the proof. */
export async function pickProject(
  page: Page,
  id = "checkout.json",
): Promise<void> {
  await page
    .getByRole("combobox", { name: "Active project" })
    .selectOption(id);
  await expect(page.getByRole("grid", { name: "Test cases" })).toBeVisible();
}

export async function gotoModule(page: Page, label: string): Promise<void> {
  await page.getByRole("button", { name: label, exact: true }).click();
}

/**
 * Run axe — with `color-contrast` live, which only a real engine can compute —
 * over the page's current state, and fail listing every rule, impact and node
 * so a broken pairing points straight at its selector.
 */
export async function expectAccessible(page: Page, where: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const violations = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact ?? "unknown"}) — ${violation.help}: ` +
      violation.nodes.map((node) => node.target.join(" ")).join(" | "),
  );
  expect(violations, `axe violations on ${where}`).toEqual([]);
}
export async function setTheme(page: any, theme: "light" | "dark") {
  const currentTheme = await page.evaluate(() => 
    document.documentElement.getAttribute("data-theme")
  );
  if (currentTheme !== theme) {
    await page.getByRole("button", { 
      name: new RegExp(`switch to ${theme} theme`, "i") 
    }).click();
    await page.waitForTimeout(100); // Wait for theme to apply
  }
}
