# Design tokens

Every colour, spacing, radius, type and layout value in the GUI lives in the `:root` block at the top
of [`src/styles.css`](../src/styles.css). Components reference the tokens through `var(...)` instead
of literals, so the palette can be reviewed and changed in one place.

`src/styles.css` holds the **token layer, the global resets and the utilities**, and three tickets
have landed rules on top of them so far:

- the **application-shell layout** — the top bar, the icon nav rail, the three-pane grid and its
  narrow-viewport behaviour;
- the **shared control primitives** — `.btn` with its variants, and the bare `input`/`select`/
  `textarea` box; and
- the **suite tree** — the left pane's hierarchy, its two pinned virtual nodes and the case rows a
  suite expands into.

Every other surface (the case list and table, the case detail, the runs, milestones, configurations
and reports surfaces, and the shared state views) is styled by the ticket that owns it (#129–#133),
so those surfaces still render unstyled in a browser until their ticket lands. The token names and
values are frozen: later tickets consume them, they do not re-define them.

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

Three pairs are known to be under the 4.5:1 text floor and are carried to the design-system and
accessibility ticket, which owns the audit rather than each surface's own ticket:

| Pair | Ratio | Used by |
| --- | --- | --- |
| `--color-primary` on `--color-primary-light` | ≈ 4.24:1 | `.navrail__item--active`, `.suite-tree__node--active` |
| `--color-text-secondary` on `--color-bg` | ≈ 4.45:1 | Secondary text against the centre pane |
| `--color-text-muted` on `--color-surface` | ≈ 2.07:1 | Non-essential text only, per the note above |

`--color-primary-hover` on `--color-primary-light` is ≈ 5.49:1, so a darker active-row foreground
clears the floor without a new token.

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
