import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync("src/styles.css", "utf8");

function extractDeclaredTokens(cssText: string): Set<string> {
  const tokens = new Set<string>();
  const declarations = cssText.matchAll(/(--[\w-]+)\s*:/g);
  for (const match of declarations) {
    tokens.add(match[1]!);
  }
  return tokens;
}

function extractReferencedTokens(cssText: string): Set<string> {
  const tokens = new Set<string>();
  const references = cssText.matchAll(/var\(\s*(--[\w-]+)/g);
  for (const match of references) {
    tokens.add(match[1]!);
  }
  return tokens;
}

describe("design tokens", () => {
  it("declares tokens in :root", () => {
    const declared = extractDeclaredTokens(
      css.match(/:root\s*\{[^}]+\}/s)?.[0] ?? "",
    );
    expect(declared.size).toBeGreaterThan(0);
  });

  it("every var() reference resolves to a declared token", () => {
    const declared = extractDeclaredTokens(css);
    const dangling = [...extractReferencedTokens(css)].filter(
      (t) => !declared.has(t),
    );
    expect(dangling).toEqual([]);
  });

  it("no colour literal outside :root", () => {
    const rootMatch = css.match(/:root\s*\{[^}]+\}/s);
    const rootBlock = rootMatch ? rootMatch[0] : "";
    const outsideRoot = css.replace(rootBlock, "");
    const hexLiterals = outsideRoot.match(/#[0-9a-fA-F]{3,8}\b/g);
    const rgbaLiterals = outsideRoot.match(/rgba?\(/g);
    expect(hexLiterals ?? []).toEqual([]);
    expect(rgbaLiterals ?? []).toEqual([]);
  });

  it("uses --color- prefix (no --colour- spelling)", () => {
    expect(css).not.toMatch(/--colour-/);
  });

  it("provides the screen-reader and truncation utilities", () => {
    expect(css).toMatch(/\.sr-only\s*\{/);
    expect(css).toMatch(/\.truncate\s*\{/);
  });
});

describe("responsive shell layout", () => {
  /** The nested rules close indented, so the block ends at the first flush `}`. */
  const narrowBlock =
    css.match(/@media \(max-width: 1024px\) \{[\s\S]*?\n\}/)?.[0] ?? "";

  it("keeps the detail panel on screen below the three-pane width", () => {
    expect(narrowBlock).not.toBe("");
    expect(narrowBlock).not.toMatch(/\.pane-right\s*\{[^}]*display:\s*none/);
    expect(narrowBlock).toMatch(/\.panes\s*\{[^}]*grid-template-columns: 1fr/);
  });

  it("hides the explorer and reveals it as an overlay on demand", () => {
    expect(narrowBlock).toMatch(/\.pane-left \{\s*display: none;/);
    expect(narrowBlock).toMatch(
      /\.app-layout--sidebar-open \.pane-left \{\s*display: block;/,
    );
    expect(narrowBlock).toMatch(
      /\.topbar__menu-toggle \{\s*display: block;/,
    );
  });
});
