# Design tokens

Every colour, space, radius and type value in the GUI lives in the `:root` block at the top of
[`src/styles.css`](../src/styles.css). Components reference the tokens instead of literals, so the
palette can be checked in one place and the status taxonomy stays tied to the API contract.

The rules below are not conventions on trust: [`src/styles.test.ts`](../src/styles.test.ts) parses the
stylesheet, resolves every token and fails the build when one is broken, unused or out of the
`--color-*` spelling.

## Rules for contributors

1. **No colour literal outside `:root`.** A hex or `rgb()`/`rgba()` value anywhere else fails
   `styles.test.ts`. Add a token and reference it.
2. **No unused token.** Every `:root` custom property has to be referenced by a `var(...)` somewhere
   in the stylesheet, so dead tokens are removed rather than left behind.
3. **One spelling.** The colour prefix is `--color-`; the legacy `--colour-` spelling is rejected.
4. **Prefer the semantic token.** Use `--color-border-light` for a divider, not `--color-bg-subtle`;
   both are the same grey today, but only one says what it is for.
5. **Check contrast before choosing a value.** Run `npm test` — the arithmetic checks below are part
   of the suite, not a separate optional step.

## Token groups

| Group | Tokens | Notes |
| --- | --- | --- |
| Surfaces, borders, text | `--color-bg`, `--color-bg-subtle`, `--color-surface`, `--color-border`, `--color-border-light`, `--color-text`, `--color-text-body`, `--color-text-muted`, `--color-text-subtle` | `--color-text-subtle` is the lightest value safe for text on white (4.76:1) |
| Brand and interaction | `--color-primary`, `--color-primary-hover`, `--color-primary-soft`, `--color-selected-bg`, `--color-danger`, `--color-danger-hover`, `--color-danger-bg`, `--color-info`, `--color-info-hover`, `--color-success`, `--color-focus`, `--color-focus-on-dark`, `--color-on-solid` | `--color-on-solid` is the label colour for every filled control |
| Dark chrome | `--color-header-bg`, `--color-header-border`, `--color-rail-bg`, `--color-rail-hover`, `--color-rail-active`, `--color-on-dark`, `--color-on-dark-muted`, `--color-chrome-*` | The chrome surfaces are translucent white over the header, so they are contrast-checked composited |
| Status taxonomy | `--status-{pass,fail,blocked,untested,retest}-{bg,text,border}` | Driven by the API's `TestCaseResult.status` union |
| Priority taxonomy | `--priority-{medium,low}-{bg,text}` | Driven by the API's `Priority` union; high and critical share the danger palette |
| Spacing | `--space-1` … `--space-4` (4/8/12/16px) | |
| Radii | `--radius`, `--radius-control`, `--radius-card`, `--radius-pill` | |
| Type | `--font-size-sm` … `--font-size-xl`, `--weight-medium`, `--weight-semibold` | 12/14/16/18px |
| Density | `--row-padding-y` | Row padding shared by the list and table surfaces |

## Taxonomy follows the contract

The status vocabulary is owned by TucanoTestAPI, so the GUI does not invent it:

- `TestCaseResult.status` — `Passed`, `Failed`, `Blocked`, `Untested`, `Retest`.
  [`StatusBadge.tsx`](../src/components/StatusBadge.tsx) renders the union exhaustively, and
  `StatusBadge.test.tsx` fails if the two lists drift apart in either direction.
- `TestResultRequest.status` — the same five values, for the write path.
- `ImportEntry.status` — `Passed`, `Failed`, `Blocked`, a strict subset; imports cannot carry a
  test that was never run.
- `TestCase.priority` — `Low`, `Medium`, `High`, `Critical`. No priority chip is rendered yet; the
  `.badge-priority-*` rules are a prepared primitive and are checked against the contract instead of
  against component sources.

Anything the API cannot express is deliberately **not** in the GUI: there is no `Draft`, `Approved`,
`Not run` or `Caution` state. A status the contract does not define renders as `Untested` rather
than passing through, which keeps invented vocabulary from leaking into stored results.

> **Known separation of concerns:** `statusVal` in the test-case views still conflates the result
> status with the case's execution state. That is tracked separately and was left untouched here.

## Contrast policy

`styles.test.ts` computes the WCAG 2.1 ratio for every pair the GUI actually paints —
**4.5:1** for text (1.4.3) and **3:1** for focus rings and markers (1.4.11) — from the token values
themselves, including the translucent chrome tokens composited over the header. The suite fails if a
pair regresses.

Two exclusions are recorded in the test file next to the pair lists, not hidden:

- `--color-on-dark-muted` is painted only on `--color-rail-bg` (5.78:1). The hover, active and
  dropdown states switch the label to `--color-on-dark`, so the muted value is never landed on
  `--color-rail-hover`, `--color-rail-active` or the translucent header chips.
- `--color-border`, `--color-border-light` and `--color-success` are decorative dividers and a
  progress fill, not text or identifiers; the milestone percentage is also rendered as text.

This arithmetic is necessary because `axe-core` cannot evaluate its own colour-contrast rule under
jsdom — there is no canvas — and `styles.css` is imported only by `src/main.tsx`, so the component
tests never load it. Vitest therefore runs with `test.css` enabled in
[`vite.config.ts`](../vite.config.ts), which is what lets the tests read the stylesheet as text
through `?raw`. Component-level `axe-core` runs still cover structure, names and roles.

## Decisions recorded here

- The legacy half of `styles.css` (a second copy of the button/input/label/modal rules using an
  undefined `--colour-accent`) was deleted. It silently dropped the primary button's background
  because the later definition won.
- `--color-info` moved from `#0284c7` (4.10:1 on white) to `#0369a1` (5.93:1).
- `--color-focus-on-dark` was added: `--color-focus` on the dark chrome did not reach 3:1.
- `.badge-retest` and the `.tree-node` rules did not exist at all and were added.
- A `--color-text-faint` token was considered for hint text and rejected: `#94a3b8` is 2.56:1 on
  white. Hint text uses `--color-text-subtle` instead.
- Two visible normalisations are intentional: muted headings that were `#1e293b` now use
  `--color-text` (`#0f172a`), and the header context chip label is now `--color-on-dark` (white)
  instead of a light border grey, which was 2.99:1 on the composited header.
- The two `1px solid #f1f5f9` dividers (`.case-row`, `.entity-card-actions`) became
  `--color-border-light` so they match every other divider in the file.
