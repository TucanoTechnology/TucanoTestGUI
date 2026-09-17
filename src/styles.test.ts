import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync("src/styles.css", "utf8");

function extractTokens(cssText: string): Set<string> {
  const tokens = new Set<string>();
  const rootMatch = cssText.match(/:root\s*\{([^}]+)\}/s);
  if (rootMatch && rootMatch[1]) {
    const declarations = rootMatch[1].matchAll(/--[\w-]+/g);
    for (const match of declarations) {
      tokens.add(match[0]);
    }
  }
  return tokens;
}

function extractUsages(cssText: string, token: string): number {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`var\\(\\s*${escaped}`, "g");
  const matches = cssText.match(pattern);
  return matches?.length ?? 0;
}

describe("design tokens", () => {
  it("every colour token in :root is referenced at least once", () => {
    const tokens = extractTokens(css);
    const colourTokens = [...tokens].filter((t) => t.startsWith("--color-") || t.startsWith("--status-") || t.startsWith("--priority-"));
    const unused = colourTokens.filter(
      (t) => extractUsages(css, t) === 0,
    );
    expect(unused).toEqual([]);
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
});
