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

  /**
   * The contrast table (#170, #172).
   *
   * WCAG 2.1 SC 1.4.3 asks for 4.5:1, and this application paints almost all
   * of its text at 11–13px — always the ordinary-text bar, never the 3:1
   * large-text exemption. jsdom cannot render, so the unit-level axe calls
   * skip `color-contrast` and the browser job (#123) is the runtime gate;
   * this test is the build-time one: it reads the token VALUES out of `:root`
   * and fails the moment a token edit breaks a pairing any rule depends on.
   * The pairs are the backgrounds each text token is actually drawn on in
   * this stylesheet, including every tinted semantic surface a badge or
   * notice can land on.
   */
  const ROOT_BLOCK = css.match(/:root\s*\{[^}]+\}/s)?.[0] ?? "";
  const tokenValues = new Map<string, string>();
  for (const match of ROOT_BLOCK.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokenValues.set(match[1]!, match[2]!.trim());
  }

  function hexToRgb(hex: string): [number, number, number] {
    const value = hex.replace("#", "");
    const expanded =
      value.length === 3
        ? value
            .split("")
            .map((char) => char + char)
            .join("")
        : value;
    const num = Number.parseInt(expanded, 16);
    if (!/^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex) || Number.isNaN(num)) {
      throw new Error(`not a hex colour: ${hex}`);
    }
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  function relativeLuminance(hex: string): number {
    const channels = hexToRgb(hex).map((byte) => byte / 255);
    const linear = channels.map((c) =>
      c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
    );
    return (
      0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!
    );
  }

  function contrastRatio(fgHex: string, bgHex: string): number {
    const first = relativeLuminance(fgHex);
    const second = relativeLuminance(bgHex);
    const lighter = Math.max(first, second);
    const darker = Math.min(first, second);
    return (lighter + 0.05) / (darker + 0.05);
  }

  const TEXT_TOKENS = [
    "--color-text",
    "--color-text-secondary",
    "--color-text-muted",
  ];
  const SURFACE_TOKENS = [
    "--color-bg",
    "--color-surface",
    "--color-surface-hover",
    "--color-surface-active",
    "--color-primary-light",
    "--color-success-light",
    "--color-danger-light",
    "--color-warning-light",
    "--color-info-light",
  ];

  it("keeps every text token at 4.5:1 on every surface it is drawn on", () => {
    for (const text of TEXT_TOKENS) {
      for (const surface of SURFACE_TOKENS) {
        const fg = tokenValues.get(text);
        const bg = tokenValues.get(surface);
        expect(fg, `${text} is undeclared`).toBeTruthy();
        expect(bg, `${surface} is undeclared`).toBeTruthy();
        const ratio = contrastRatio(fg!, bg!);
        expect(
          ratio,
          `${text} (${fg}) on ${surface} (${bg}) is ${ratio.toFixed(2)}:1, below 4.5:1`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps the semantic badge and control pairings at 4.5:1", () => {
    const pairs: [string, string][] = [
      ["--color-text-success", "--color-success-light"],
      ["--color-text-danger", "--color-danger-light"],
      ["--color-text-warning", "--color-warning-light"],
      ["--color-text-info", "--color-info-light"],
      // error copy outside a tinted notice sits on plain surfaces
      ["--color-text-danger", "--color-surface"],
      ["--color-text-warning", "--color-surface"],
      ["--color-text-info", "--color-surface"],
      // buttons and chips: the inverted and the tinted pairs
      ["--color-primary-text", "--color-primary"],
      ["--color-primary", "--color-surface"],
      ["--color-primary-hover", "--color-primary-light"],
    ];
    for (const [fgToken, bgToken] of pairs) {
      const fg = tokenValues.get(fgToken);
      const bg = tokenValues.get(bgToken);
      expect(fg, `${fgToken} is undeclared`).toBeTruthy();
      expect(bg, `${bgToken} is undeclared`).toBeTruthy();
      const ratio = contrastRatio(fg!, bg!);
      expect(
        ratio,
        `${fgToken} (${fg}) on ${bgToken} (${bg}) is ${ratio.toFixed(2)}:1, below 4.5:1`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});

/* ---------------------------------------------------------------------------
   Cascade evaluation
   jsdom never applies the linked stylesheet, so a computed-style assertion here
   would agree with whatever the file says and prove nothing. These helpers ask
   the question the browser asks instead: for one element of the shell, which
   rule wins `display` in the cascade, and what does it declare. A rule is only
   skipped when it cannot apply to that element, so an unreadable selector or
   at-rule fails the suite rather than silently excusing an override.
--------------------------------------------------------------------------- */

interface StyleRule {
  selector: string;
  /** Enclosing at-rule, e.g. `@media (max-width: 1024px)`, when there is one. */
  condition: string | null;
  declarations: Map<string, string>;
  /** Position in the file; ties in specificity go to the larger value. */
  order: number;
}

/** One element and the ancestors the shell always wraps it in, innermost first. */
interface ElementContext {
  tag: string;
  classes: readonly string[];
  id: string | null;
}

interface CompoundSelector {
  /** The combinator joining this compound to the one on its left. */
  combinator: " " | ">" | null;
  tag: string | null;
  classes: string[];
  ids: string[];
  states: string[];
  pseudoElement: boolean;
}

const STATE_PSEUDO_CLASSES = new Set([
  "active",
  "checked",
  "disabled",
  "focus",
  "focus-visible",
  "focus-within",
  "hover",
  "visited",
]);

function matchingBrace(source: string, open: number): number {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source.charAt(index);
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error(`Unbalanced braces in src/styles.css from offset ${open}`);
}

function parseDeclarations(body: string): Map<string, string> {
  const declarations = new Map<string, string>();
  for (const chunk of body.split(";")) {
    const separator = chunk.indexOf(":");
    if (separator === -1) continue;
    const property = chunk.slice(0, separator).trim().toLowerCase();
    const value = chunk.slice(separator + 1).trim();
    if (property !== "" && value !== "") declarations.set(property, value);
  }
  return declarations;
}

/** Flattens the sheet into one entry per selector, carrying its at-rule. */
function parseRules(
  cssText: string,
  condition: string | null = null,
  rules: StyleRule[] = [],
): StyleRule[] {
  const source = cssText.replace(/\/\*[\s\S]*?\*\//g, "");
  let index = 0;
  while (index < source.length) {
    const open = source.indexOf("{", index);
    if (open === -1) break;
    const prelude = source.slice(index, open).trim();
    const close = matchingBrace(source, open);
    const body = source.slice(open + 1, close);
    if (prelude.startsWith("@")) {
      const nested =
        condition === null ? prelude : `${condition} and ${prelude}`;
      parseRules(body, nested, rules);
    } else {
      const declarations = parseDeclarations(body);
      for (const part of prelude.split(",")) {
        const selector = part.trim();
        if (selector === "") continue;
        rules.push({ selector, condition, declarations, order: rules.length });
      }
    }
    index = close + 1;
  }
  return rules;
}

/** ids*100 + classes*10 + elements, the subset of the cascade the sheet uses. */
function specificity(selector: string): number {
  const ids = selector.match(/#[\w-]+/g)?.length ?? 0;
  const pseudoClasses = selector.match(/(?<!:):[\w-]+/g)?.length ?? 0;
  // `:not()` carries no weight of its own; the argument it wraps does.
  const negations = selector.match(/(?<!:):not\b/g)?.length ?? 0;
  const classes =
    (selector.match(/\.[\w-]+/g)?.length ?? 0) + pseudoClasses - negations;
  const elements = selector.match(/(?:^|[\s>])[a-zA-Z][\w-]*/g)?.length ?? 0;
  return ids * 100 + classes * 10 + elements;
}

function parseSelector(selector: string): CompoundSelector[] {
  const compounds: CompoundSelector[] = [];
  let pendingCombinator: " " | ">" | null = null;
  let index = 0;

  const openCompound = () => {
    compounds.push({
      combinator: compounds.length === 0 ? null : (pendingCombinator ?? " "),
      tag: null,
      classes: [],
      ids: [],
      states: [],
      pseudoElement: false,
    });
    pendingCombinator = null;
  };

  const current = (): CompoundSelector => {
    if (compounds.length === 0 || pendingCombinator !== null) openCompound();
    return compounds[compounds.length - 1]!;
  };

  const readIdentifier = (): string => {
    const start = index;
    while (index < selector.length && /[\w-]/.test(selector.charAt(index))) {
      index += 1;
    }
    const identifier = selector.slice(start, index);
    if (identifier === "") {
      throw new Error(
        `styles.test.ts cannot read the selector "${selector}" past offset ${start}`,
      );
    }
    return identifier;
  };

  while (index < selector.length) {
    const char = selector.charAt(index);
    if (/\s/.test(char)) {
      if (compounds.length > 0) pendingCombinator = pendingCombinator ?? " ";
      index += 1;
      continue;
    }
    if (char === ">") {
      pendingCombinator = ">";
      index += 1;
      continue;
    }
    if (char === "+" || char === "~") {
      throw new Error(
        `styles.test.ts cannot evaluate the "${char}" combinator in "${selector}"`,
      );
    }
    if (char === "*") {
      current().tag = "*";
      index += 1;
      continue;
    }
    if (char === ".") {
      index += 1;
      current().classes.push(readIdentifier());
      continue;
    }
    if (char === "#") {
      index += 1;
      current().ids.push(readIdentifier());
      continue;
    }
    if (char === ":") {
      index += 1;
      if (selector.charAt(index) === ":") {
        index += 1;
        readIdentifier();
        current().pseudoElement = true;
        continue;
      }
      const name = readIdentifier();
      if (!STATE_PSEUDO_CLASSES.has(name)) {
        throw new Error(
          `styles.test.ts cannot evaluate the ":${name}" pseudo-class in "${selector}"`,
        );
      }
      current().states.push(name);
      continue;
    }
    if (/[a-zA-Z]/.test(char)) {
      current().tag = readIdentifier();
      continue;
    }
    throw new Error(
      `styles.test.ts cannot evaluate "${char}" in "${selector}"`,
    );
  }

  if (compounds.length === 0) {
    throw new Error(`styles.test.ts cannot read the selector "${selector}"`);
  }
  return compounds;
}

function matchesCompound(
  compound: CompoundSelector,
  element: ElementContext,
): boolean {
  // A pseudo-element styles a box of its own and a state pseudo-class needs a
  // state the resting shell does not carry, so neither can win anything for the
  // element itself.
  if (compound.pseudoElement || compound.states.length > 0) return false;
  if (
    compound.tag !== null &&
    compound.tag !== "*" &&
    compound.tag !== element.tag
  ) {
    return false;
  }
  if (compound.ids.some((id) => id !== element.id)) return false;
  return compound.classes.every((cls) => element.classes.includes(cls));
}

function matchesSelector(
  selector: string,
  chain: readonly ElementContext[],
): boolean {
  const compounds = parseSelector(selector);
  const element = chain[0];
  if (!element) return false;
  if (!matchesCompound(compounds[compounds.length - 1]!, element)) return false;

  let chainIndex = 1;
  for (let index = compounds.length - 2; index >= 0; index -= 1) {
    const compound = compounds[index]!;
    if (compounds[index + 1]!.combinator === ">") {
      const parent = chain[chainIndex];
      if (!parent || !matchesCompound(compound, parent)) return false;
      chainIndex += 1;
      continue;
    }
    let matched = false;
    while (chainIndex < chain.length) {
      const ancestor = chain[chainIndex]!;
      chainIndex += 1;
      if (matchesCompound(compound, ancestor)) {
        matched = true;
        break;
      }
    }
    if (!matched) return false;
  }
  return true;
}

function conditionMatches(
  condition: string | null,
  viewportWidth: number,
): boolean {
  if (condition === null) return true;
  const width = condition.match(/^@media \((max|min)-width: (\d+(?:\.\d+)?)px\)$/);
  if (!width) {
    throw new Error(
      `styles.test.ts cannot evaluate the at-rule "${condition}" for a viewport of ${viewportWidth}px`,
    );
  }
  const limit = Number(width[2]!);
  return width[1] === "max" ? viewportWidth <= limit : viewportWidth >= limit;
}

/** The rule the browser would take `property` from, or null when none sets it. */
function winningRule(
  rules: readonly StyleRule[],
  chain: readonly ElementContext[],
  property: string,
  viewportWidth: number,
): StyleRule | null {
  let winner: StyleRule | null = null;
  for (const rule of rules) {
    if (!rule.declarations.has(property)) continue;
    if (!matchesSelector(rule.selector, chain)) continue;
    if (!conditionMatches(rule.condition, viewportWidth)) continue;
    const better =
      winner === null ||
      specificity(rule.selector) > specificity(winner.selector) ||
      (specificity(rule.selector) === specificity(winner.selector) &&
        rule.order > winner.order);
    if (better) winner = rule;
  }
  return winner;
}

describe("responsive shell layout", () => {
  const rules = parseRules(css);

  // The markup these chains describe is AppShell's: a button inside the top
  // bar, and an aside inside the pane grid, both inside the shell root.
  const toggleChain: ElementContext[] = [
    {
      tag: "button",
      classes: ["btn", "btn-ghost", "topbar__menu-toggle"],
      id: null,
    },
    { tag: "header", classes: ["topbar"], id: null },
    { tag: "div", classes: ["app-layout"], id: null },
    { tag: "body", classes: [], id: null },
    { tag: "html", classes: [], id: null },
  ];
  const explorerChain: ElementContext[] = [
    { tag: "aside", classes: ["pane-left"], id: null },
    { tag: "div", classes: ["panes"], id: null },
    { tag: "div", classes: ["app-layout"], id: null },
    { tag: "body", classes: [], id: null },
    { tag: "html", classes: [], id: null },
  ];
  const openExplorerChain: ElementContext[] = [
    { tag: "aside", classes: ["pane-left"], id: null },
    { tag: "div", classes: ["panes"], id: null },
    {
      tag: "div",
      classes: ["app-layout", "app-layout--sidebar-open"],
      id: null,
    },
    { tag: "body", classes: [], id: null },
    { tag: "html", classes: [], id: null },
  ];
  const panesChain: ElementContext[] = [
    { tag: "div", classes: ["panes"], id: null },
    { tag: "div", classes: ["app-layout"], id: null },
    { tag: "body", classes: [], id: null },
    { tag: "html", classes: [], id: null },
  ];
  const detailChain: ElementContext[] = [
    { tag: "aside", classes: ["pane-right"], id: null },
    { tag: "div", classes: ["panes"], id: null },
    { tag: "div", classes: ["app-layout"], id: null },
    { tag: "body", classes: [], id: null },
    { tag: "html", classes: [], id: null },
  ];

  const breakpoint = 1024;
  const wide = 1600;
  const narrow = 768;

  it("hides the navigation toggle above the breakpoint", () => {
    for (const viewport of [wide, breakpoint + 1]) {
      const winner = winningRule(rules, toggleChain, "display", viewport);
      expect(
        winner?.declarations.get("display"),
        `at ${viewport}px the toggle takes display from "${winner?.selector ?? "nothing"}"`,
      ).toBe("none");
    }
  });

  it("reveals the navigation toggle at and below the breakpoint", () => {
    for (const viewport of [breakpoint, narrow, 375]) {
      const winner = winningRule(rules, toggleChain, "display", viewport);
      expect(
        winner?.declarations.get("display"),
        `at ${viewport}px the toggle takes display from "${winner?.selector ?? "nothing"}"`,
      ).not.toBe("none");
    }
  });

  it("catches the same-specificity override that hid the toggle in the first place", () => {
    // The defect this guards: a later rule of equal specificity re-showing the
    // toggle. If the evaluator cannot see that, it cannot guard anything.
    const regressed = parseRules(
      [
        ".topbar__menu-toggle { display: none; }",
        ".btn { display: inline-flex; }",
      ].join("\n"),
    );
    const winner = winningRule(regressed, toggleChain, "display", wide);
    expect(winner?.selector).toBe(".btn");
    expect(winner?.declarations.get("display")).toBe("inline-flex");
  });

  it("stacks the panes and keeps the detail panel on screen below the three-pane width", () => {
    expect(
      winningRule(rules, panesChain, "grid-template-columns", narrow)
        ?.declarations.get("grid-template-columns"),
    ).toBe("1fr");
    expect(
      winningRule(rules, detailChain, "display", narrow)?.declarations.get(
        "display",
      ),
    ).not.toBe("none");
  });

  it("hides the explorer and reveals it as an overlay on demand", () => {
    expect(
      winningRule(rules, explorerChain, "display", wide)?.declarations.get(
        "display",
      ),
    ).not.toBe("none");
    expect(
      winningRule(rules, explorerChain, "display", narrow)?.declarations.get(
        "display",
      ),
    ).toBe("none");
    expect(
      winningRule(rules, openExplorerChain, "display", narrow)?.declarations.get(
        "display",
      ),
    ).toBe("block");
  });
});
