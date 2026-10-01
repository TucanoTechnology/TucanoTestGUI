# Design tokens

Every colour, spacing, radius, type and layout value in the GUI lives in the `:root` block at the top
of [`src/styles.css`](../src/styles.css). Components reference the tokens through `var(...)` instead
of literals, so the palette can be reviewed and changed in one place.

`src/styles.css` holds the **token layer, the global resets and the utilities**, with landed rules
grouped as:

- the **application-shell layout** — the top bar, the icon nav rail, the three-pane grid and its
  narrow-viewport behaviour;
- the **shared control primitives** — `.btn` with its variants, and the bare `input`/`select`/
  `textarea` box; and
- the **suite tree** — the left pane's hierarchy, its two pinned virtual nodes and the case rows a
  suite expands into; and
- the **module surfaces** — the case list and detail, runs, milestones, configurations, reports and
  the shared state views, styled by the design-phase tickets (#129–#133), and the modernisation
  pass (#180) which re-scaled the radius and shadow tiers, lifted the type floor and added the
  sticky table headers, tabular figures and hover elevation — all through these tokens, never
  literals.

The token names are frozen: later tickets consume them; rescaling a value is a design decision
recorded here, not a silent edit.

## What the suite enforces

[`src/styles.test.ts`](../src/styles.test.ts) parses the stylesheet as text and fails the build when
any of these invariants breaks:

1. **Tokens are declared in `:root`.** The layer cannot be emptied out.
2. **Every `var(...)` reference resolves.** A `var(--x)` with no matching declaration in the
   stylesheet is a dangling custom property and fails the test.
3. **No colour literal outside `:root`.** A hex or `rgb()`/`rgba()` value anywhere else fails the
   test. Add a token and reference it. The check is a text search over the whole file, so it also
   reads comments: a ticket reference like `#127` inside one trips it. Write the number bare.
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
| Typography | `--font-family`, `--font-size-sm` … `--font-size-2xl`, `--font-weight-{normal,medium,semibold,bold}`, `--line-height-{tight,normal}` | 12–24px. #180 retired `--font-size-xs` (11px) — the floor is 12px — and date/ID/code cells carry `font-variant-numeric: tabular-nums` |
| Borders | `--radius-{sm,md,lg,full}` | 6/8/12px + pill (#180 re-scale; formerly 3/6/8) |
| Shadows | `--shadow-{rest,raise,sm,md,lg}` | `rest`/`raise` (#180) are the two-tier pair cards use at rest and on hover; the hover lift is a `transform`, so `prefers-reduced-motion` pins it flat |
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

Two levels check it, and both run in CI:

- `src/styles.test.ts` computes WCAG 1.4.3 ratios against the `:root` **values** — every text
  token over every surface it is drawn on, plus the named badge and control pairings — so a token
  edit that breaks a measured pair fails `npm test` with the ratio in the message.
- The Playwright suite (`npm run test:e2e`, CI job `e2e`) runs axe with `color-contrast` **live**
  over every page, tab and dialog of the built bundle — the runtime gate jsdom could never be.

The pairs that once sat under the floor (`--color-text-muted` at ≈ 2:1, the pastel badge texts,
primary-on-primary-light) were re-tuned by #172/#174 to values that clear 4.5:1 on every surface
they are drawn on, and the tables above and in `styles.test.ts` are the record. A new pairing goes
into the `styles.test.ts` table in the same change that draws it — checked against the token it is
composited on, never against white alone.

## Decisions recorded here

- The ~700 lines of legacy component rules that referenced the pre-rebuild token names were deleted
  with this rewrite rather than migrated, because they named 44 custom properties the new `:root`
  does not define. The components are being rebuilt from the token layer up.
- The semantic colours are four pairs (`success`/`warning`/`danger`/`info`, each with a `-light`
  companion) instead of the previous per-status and per-priority token families. Mapping the API's
  status and priority unions onto these is the responsibility of the tickets that render them, so
  no `--status-*` or `--priority-*` token exists.
- `--color-text-muted` is the lightest text value in the layer (#172: `#5b6470`, measured ≥ 4.9:1
  on every surface it is drawn on). It stays reserved for meta text — keys, parent paths, codes —
  and the `styles.test.ts` pair grid is what keeps that promise when a token moves.
- `.btn` and the bare form-control box live in a shared-controls section rather than in any one
  component's ticket: the shell's JSX and every later module's JSX use `.btn`, `.btn-primary`, and
  `.btn-ghost`, and no design ticket owns those class names. `.btn-danger`'s hover state deepens the
  fill it already has, because the frozen layer names no danger-hover colour.
- The shell departs from the layout ticket in one place. The ticket hides `.pane-left` and
  `.pane-right` below 1024px, which strands the project hierarchy with no way to reach it again.
  That rule is kept, and a top-bar toggle (labelled, with `aria-expanded`) reveals the left pane as
  an overlay while `.app-layout--sidebar-open` is set, so the tree stays reachable from the
  keyboard on a narrow viewport.
- The suite tree's data is flat. `TestSuite` carries no parent field, so the ticket's recursive
  "nested suites" sketch has nothing to recurse over: the tree is one level deep and expanding a
  suite reveals the cases it holds. The two virtual nodes the case list filters on ("All test
  cases" and "Directly in project") are pinned above the project's suites and carry case counts,
  but selecting either clears the detail selection instead of opening a detail panel, because
  neither is an entity the API can return.
- A case row inside an expanded suite is a leaf, not a control: the ticket gives the tree no
  case-selection callback, and the centre pane's case list is what opens a case. The row therefore
  keeps the `.suite-tree__label`/`.suite-tree__count` spans but drops the pointer affordances the
  suite rows carry.
- The shell swaps the left pane by project: the project explorer (the only place a project can be
  created) renders while no project is active, and the suite tree takes its place once one is, with
  the pane's accessible name following. Picking the switcher's empty option returns to the
  explorer, so project creation stays reachable.
