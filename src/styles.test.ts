import { describe, expect, it } from 'vitest';
import specJson from '../api/openapi.json?raw';
import stylesCss from './styles.css?raw';
import { SIZE_CLASSES, STATUS_CONFIG, VALID_STATUSES } from './components/StatusBadge';

/**
 * Contract tests for the design foundation (issue #77).
 *
 * `styles.css` is imported only by src/main.tsx, so the jsdom component tests
 * never load it and axe-core never sees it — axe cannot run its colour-contrast
 * rule without a canvas either. These tests close that gap: the token layer is
 * checked structurally, and every rendered foreground/background pair is
 * contrast-checked arithmetically from the token values.
 *
 * The policy for the exceptions is recorded inline where each one appears.
 */

/** Comments carry prose hex examples in this file, so strip them before parsing. */
const css = stylesCss.replace(/\/\*[\s\S]*?\*\//g, '');

const rootBlock = /:root\s*\{([\s\S]*?)\}/.exec(css)?.[1] ?? '';
const rootStart = css.indexOf(rootBlock);
const rootEnd = rootStart + rootBlock.length;

const tokens = new Map<string, string>();
for (const match of rootBlock.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
  const name = match[1];
  const value = match[2];
  if (name && value) tokens.set(name, value.trim());
}

const references = new Set<string>();
for (const match of css.matchAll(/var\(\s*(--[\w-]+)/g)) {
  if (match[1]) references.add(match[1]);
}

function hasRule(className: string): boolean {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\.${escaped}(?![\\w-])`).test(css);
}

interface SpecSchema {
  properties?: Record<string, { enum?: string[] } | undefined>;
}

interface Spec {
  components?: { schemas?: Record<string, SpecSchema | undefined> };
}

const spec = JSON.parse(specJson) as Spec;

function enumOf(schemaName: string, property: string): string[] {
  const values = spec.components?.schemas?.[schemaName]?.properties?.[property]?.enum;
  if (!values) throw new Error(`${schemaName}.${property} has no enum in the pinned contract`);
  return values;
}

/** `TestCase.priority` — the only priority vocabulary the API accepts. */
function priorityLevels(): string[] {
  return enumOf('TestCase', 'priority');
}

/**
 * Every component source, so the class names actually rendered are checked
 * against the stylesheet rather than a hand-maintained list.
 */
const componentSources = import.meta.glob('./**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const componentFiles = Object.entries(componentSources).filter(
  ([path]) => !path.endsWith('.test.tsx'),
);

/** Removes `${…}` holes so only the static text of a template literal survives. */
function stripInterpolations(source: string): string {
  let current = source;
  let previous = '';
  while (current !== previous) {
    previous = current;
    current = current.replace(/\$\{[^{}]*\}/g, '');
  }
  return current;
}

function classNamesIn(source: string): string[] {
  const literal = stripInterpolations(source);
  const found: string[] = [];
  for (const match of literal.matchAll(
    /className\s*=\s*(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g,
  )) {
    const value = match[1] ?? match[2] ?? match[3] ?? '';
    for (const token of value.split(/\s+/)) {
      if (token) found.push(token);
    }
  }
  return found;
}

const renderedClassNames = new Set(componentFiles.flatMap(([, source]) => classNamesIn(source)));

interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** A token name, or a translucent token painted over an opaque one. */
type ColourSpec = string | { readonly over: string; readonly on: string };

/**
 * Resolves a token to channels. Only a 6-digit hex or an rgba() literal is
 * accepted, so a value that escapes these tests has to be made explicit here.
 */
function channels(name: string): Rgb & { a: number } {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`${name} is not declared in :root`);

  const hex = /^#([0-9a-fA-F]{6})$/.exec(value);
  if (hex?.[1]) {
    const digits = hex[1];
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
      a: 1,
    };
  }

  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(value);
  if (rgba?.[1] && rgba[2] && rgba[3]) {
    return { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]), a: Number(rgba[4] ?? 1) };
  }

  throw new Error(`${name} is neither a 6-digit hex nor an rgba() literal: ${value}`);
}

/** The colour a browser paints for a translucent token over an opaque one. */
function over(translucent: string, opaque: string): Rgb {
  const top = channels(translucent);
  const bottom = channels(opaque);
  const mix = (topChannel: number, bottomChannel: number) =>
    Math.round(topChannel * top.a + bottomChannel * (1 - top.a));
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b) };
}

function evaluate(spec: ColourSpec): Rgb {
  if (typeof spec === 'string') return channels(spec);
  return over(spec.over, spec.on);
}

/** WCAG 2.x relative luminance (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance). */
function relativeLuminance({ r, g, b }: Rgb): number {
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrastRatio(foreground: Rgb, background: Rgb): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const CONTRAST_MINIMUM_TEXT = 4.5;
const CONTRAST_MINIMUM_UI = 3;

const HEADER = '--color-header-bg';

/**
 * Rendered foreground/background pairs. Excluded on purpose:
 *
 * - `--color-on-dark-muted` is painted only on `--color-rail-bg`; the hover,
 *   active and dropdown chip states all switch the label to `--color-on-dark`
 *   (checked below as its own pair), so the muted token never lands on
 *   `--color-rail-hover` / `--color-rail-active` / `--color-chrome-surface`.
 * - `--color-border`, `--color-border-light` and `--color-success` are
 *   decorative dividers and a progress fill, not identifiers or text; 1.4.11
 *   does not apply to them (the milestone percentage is also rendered as text).
 */
const TEXT_PAIRS: ReadonlyArray<{ name: string; fg: ColourSpec; bg: ColourSpec }> = [
  { name: 'body text on a card', fg: '--color-text', bg: '--color-surface' },
  { name: 'body text on the canvas', fg: '--color-text', bg: '--color-bg' },
  { name: 'table cell on a card', fg: '--color-text-body', bg: '--color-surface' },
  { name: 'quiet button label', fg: '--color-text-body', bg: '--color-bg-subtle' },
  { name: 'column header on a card', fg: '--color-text-muted', bg: '--color-surface' },
  { name: 'hint text on a card', fg: '--color-text-subtle', bg: '--color-surface' },
  { name: 'hint text on the canvas', fg: '--color-text-subtle', bg: '--color-bg' },
  { name: 'primary button label', fg: '--color-on-solid', bg: '--color-primary' },
  { name: 'primary button label, hovered', fg: '--color-on-solid', bg: '--color-primary-hover' },
  { name: 'danger button label', fg: '--color-on-solid', bg: '--color-danger' },
  { name: 'danger button label, hovered', fg: '--color-on-solid', bg: '--color-danger-hover' },
  { name: 'info button label', fg: '--color-on-solid', bg: '--color-info' },
  { name: 'info button label, hovered', fg: '--color-on-solid', bg: '--color-info-hover' },
  { name: 'error announcement', fg: '--color-danger-hover', bg: '--color-danger-bg' },
  { name: 'outline button label', fg: '--color-primary', bg: '--color-surface' },
  { name: 'outline button label on the canvas', fg: '--color-primary', bg: '--color-bg' },
  { name: 'selected row label', fg: '--color-primary', bg: '--color-selected-bg' },
  { name: 'Passed badge', fg: '--status-pass-text', bg: '--status-pass-bg' },
  { name: 'Failed badge', fg: '--status-fail-text', bg: '--status-fail-bg' },
  { name: 'Blocked badge', fg: '--status-blocked-text', bg: '--status-blocked-bg' },
  { name: 'Untested badge', fg: '--status-untested-text', bg: '--status-untested-bg' },
  { name: 'Retest badge', fg: '--status-retest-text', bg: '--status-retest-bg' },
  { name: 'medium priority chip', fg: '--priority-medium-text', bg: '--priority-medium-bg' },
  { name: 'low priority chip', fg: '--priority-low-text', bg: '--priority-low-bg' },
  { name: 'header label', fg: '--color-on-dark', bg: HEADER },
  { name: 'header chip label', fg: '--color-on-dark', bg: { over: '--color-chrome-surface', on: HEADER } },
  {
    name: 'header chip label, hovered',
    fg: '--color-on-dark',
    bg: { over: '--color-chrome-surface-hover', on: HEADER },
  },
  { name: 'inactive rail label', fg: '--color-on-dark-muted', bg: '--color-rail-bg' },
  { name: 'hovered rail label', fg: '--color-on-dark', bg: '--color-rail-hover' },
  { name: 'active rail label', fg: '--color-on-dark', bg: '--color-rail-active' },
];

/** Non-text UI: focus indicators and icon/marker affordances (WCAG 1.4.11). */
const UI_PAIRS: ReadonlyArray<{ name: string; fg: ColourSpec; bg: ColourSpec }> = [
  { name: 'focus ring on a card', fg: '--color-focus', bg: '--color-surface' },
  { name: 'focus ring on the canvas', fg: '--color-focus', bg: '--color-bg' },
  { name: 'focus ring in the header', fg: '--color-focus-on-dark', bg: HEADER },
  { name: 'focus ring on a header chip', fg: '--color-focus-on-dark', bg: { over: '--color-chrome-surface', on: HEADER } },
  { name: 'focus ring on the rail', fg: '--color-focus-on-dark', bg: '--color-rail-bg' },
  { name: 'focus ring on the active rail item', fg: '--color-focus-on-dark', bg: '--color-rail-active' },
  { name: 'selected row marker', fg: '--color-primary', bg: '--color-selected-bg' },
];

function failures(
  pairs: ReadonlyArray<{ name: string; fg: ColourSpec; bg: ColourSpec }>,
  minimum: number,
): string[] {
  return pairs
    .map((pair) => ({ ...pair, ratio: contrastRatio(evaluate(pair.fg), evaluate(pair.bg)) }))
    .filter((pair) => pair.ratio < minimum)
    .map((pair) => `${pair.name}: ${pair.ratio.toFixed(2)}:1 (needs ${minimum}:1)`);
}

describe('design tokens', () => {
  it('declares a :root token block', () => {
    expect(rootBlock.length).toBeGreaterThan(0);
    expect(tokens.size).toBeGreaterThan(40);
  });

  it('declares every custom property the stylesheet references', () => {
    expect([...references].filter((name) => !tokens.has(name))).toEqual([]);
  });

  it('declares no token the stylesheet never uses', () => {
    expect([...tokens.keys()].filter((name) => !references.has(name))).toEqual([]);
  });

  it('uses one spelling for the colour prefix', () => {
    const legacy = [...tokens.keys(), ...references].filter((name) => name.startsWith('--colour-'));
    expect(legacy).toEqual([]);
  });

  it('keeps every colour literal inside :root', () => {
    const outside = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)]
      .filter((match) => {
        const at = match.index ?? 0;
        return at < rootStart || at > rootEnd;
      })
      .map((match) => match[0]);
    expect(outside).toEqual([]);
  });
});

describe('stylesheet coverage', () => {
  it('reads every component source', () => {
    expect(componentFiles.length).toBeGreaterThan(3);
    expect(componentFiles.map(([path]) => path).filter((path) => path.endsWith('App.tsx'))).not.toEqual(
      [],
    );
  });

  it('defines a rule for every class name the components render', () => {
    expect([...renderedClassNames].filter((token) => !hasRule(token)).sort()).toEqual([]);
  });

  it('defines a rule for every status badge variant', () => {
    expect(VALID_STATUSES.filter((status) => !hasRule(STATUS_CONFIG[status].className)).sort()).toEqual(
      [],
    );
  });

  it('defines a rule for every badge size', () => {
    expect(Object.values(SIZE_CLASSES).filter((token) => !hasRule(token)).sort()).toEqual([]);
  });

  /**
   * The priority chip is a prepared primitive: no view renders it yet, so it is
   * checked against the contract rather than against component sources. High and
   * critical are both release blockers and share the danger palette, hence one
   * selector list for the two.
   */
  it('defines a chip for every priority the contract allows', () => {
    const priority = priorityLevels();
    expect(priority.length).toBe(4);

    expect(priority.filter((level) => !hasRule(`badge-priority-${level.toLowerCase()}`)).sort()).toEqual(
      [],
    );
  });
});

describe('WCAG contrast', () => {
  it(`meets the ${CONTRAST_MINIMUM_TEXT}:1 text minimum (1.4.3)`, () => {
    expect(failures(TEXT_PAIRS, CONTRAST_MINIMUM_TEXT)).toEqual([]);
  });

  it(`meets the ${CONTRAST_MINIMUM_UI}:1 non-text minimum (1.4.11)`, () => {
    expect(failures(UI_PAIRS, CONTRAST_MINIMUM_UI)).toEqual([]);
  });

  it('rejects a token that is not a resolvable colour', () => {
    expect(() => channels('--space-2')).toThrow();
    expect(() => channels('--color-not-a-token')).toThrow();
  });
});
