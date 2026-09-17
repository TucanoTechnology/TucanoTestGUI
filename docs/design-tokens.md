# Design tokens

Every colour, spacing, radius, type and layout value in the GUI lives in the `:root` block at the top
of [`src/styles.css`](../src/styles.css). Components reference the tokens through `var(...)` instead
of literals, so the palette can be reviewed and changed in one place.

`src/styles.css` is currently the **token layer plus global resets and utilities only**. Component
rules are added back ticket by ticket (#127 onwards), so until those land the components render
unstyled in a browser. The token names and values are frozen: later tickets consume them, they do
not re-define them.

## What the suite enforces

[`src/styles.test.ts`](../src/styles.test.ts) parses the stylesheet as text and fails the build when
any of these invariants breaks:

1. **Tokens are declared in `:root`.** The layer cannot be emptied out.
2. **Every `var(...)` reference resolves.** A `var(--x)` with no matching declaration in the
   stylesheet is a dangling custom property and fails the test.
3. **No colour literal outside `:root`.** A hex or `rgb()`/`rgba()` value anywhere else fails the
   test. Add a token and reference it.
4. **One spelling.** The colour prefix is `--color-`; the legacy `--colour-` spelling is rejected.
5. **The utilities exist.** `.sr-only` and `.truncate` are part of the public surface the components
   rely on.

Note that the suite does **not** assert that every token is referenced. Tokens are the interface for
rules that land in later tickets, so an unreferenced token is expected state here, not debt.

## Token groups

| Group | Tokens | Notes |
| --- | --- | --- |
| Neutrals | `--color-bg`, `--color-surface`, `--color-surface-hover`, `--color-surface-active`, `--color-border`, `--color-border-light`, `--color-text`, `--color-text-secondary`, `--color-text-muted` | Surfaces, dividers and the three text weights |
| Brand | `--color-primary`, `--color-primary-hover`, `--color-primary-light`, `--color-primary-text` | `--color-primary-text` is the label colour on a filled primary control |
| Semantic | `--color-{success,warning,danger,info}` and their `-light` backgrounds | Status and feedback. The API's status and priority vocabularies map onto these rather than getting tokens of their own |
| Spacing | `--space-1` … `--space-12` | 4px base: 4, 8, 12, 16, 20, 24, 32, 40, 48 |
| Typography | `--font-family`, `--font-size-xs` … `--font-size-2xl`, `--font-weight-{normal,medium,semibold,bold}`, `--line-height-{tight,normal}` | 11–24px sizes |
| Borders | `--radius-{sm,md,lg,full}` | |
| Shadows | `--shadow-{sm,md,lg}` | |
| Layout | `--topbar-height`, `--navrail-width`, `--leftpane-width`, `--rightpane-width` | The shell geometry shared by the three-pane layout |
| Transitions | `--transition-{fast,normal}` | |

## Global resets

Alongside the tokens, the stylesheet owns the resets the whole application depends on: a
`border-box` box-sizing and zero margin/padding reset on `*`, the `body` default type and colours,
`font: inherit` on `button`/`input`/`select`/`textarea`, and a `:focus-visible` outline drawn from
`--color-primary`. The focus ring is a release gate, not decoration: every interactive control needs
a visible focus indicator.

A `prefers-reduced-motion: reduce` block that collapses animation and transition durations is also
kept here as a global accessibility guarantee.

## Contrast

The GUI targets **WCAG 2.1 Level AA**: 4.5:1 for text (1.4.3) and 3:1 for focus rings and markers
(1.4.11).

Two things are worth knowing about how that is checked:

- `axe-core` runs in `src/App.test.tsx`, but it cannot evaluate its own colour-contrast rule under
  jsdom, because there is no canvas. Colour contrast therefore cannot be asserted from the unit
  suite at all.
- `src/styles.test.ts` covers structure — no literal outside the token layer — not arithmetic.
  It does not compute WCAG ratios, so a passing `npm test` is not evidence that a pair meets 4.5:1.

Before release, verify any new colour pair in a real browser (or with an axe browser run), and check
it against the token it is composited on rather than against white alone.

## Decisions recorded here

- The ~700 lines of legacy component rules that referenced the pre-rebuild token names were deleted
  with this rewrite rather than migrated, because they named 44 custom properties the new `:root`
  does not define. The components are being rebuilt from the token layer up.
- The semantic colours are four pairs (`success`/`warning`/`danger`/`info`, each with a `-light`
  companion) instead of the previous per-status and per-priority token families. Mapping the API's
  status and priority unions onto these is the responsibility of the tickets that render them, so
  no `--status-*` or `--priority-*` token exists.
- `--color-text-muted` is the lightest text value in the layer. It is reserved for non-essential
  text; verify it against its actual background before putting real content in it.
