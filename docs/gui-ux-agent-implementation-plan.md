# GUI UX Agent Implementation Plan

This is the delivery plan for the next AI agent working on the Tucano Test GUI redesign. It translates the wireframe and issue backlog into implementation steps that are specific enough to build and review without losing the product direction.

## Goal

Rebuild the GUI around a tester workflow:

- left nav for product sections
- project/release context at the top
- folder-like case browsing
- dense execution board with visible status signals
- quick actions and bulk actions
- optional detail preview for selected test cases

The app should feel like an operations workspace, not a generic list of CRUD screens.

---

## Implementation strategy

Build in order. Each layer should land in a way that makes the next layer easier and less disruptive.

### Phase 1 — Shell and information architecture

#### Task 1.1: App shell layout

Files likely involved:

- src/App.tsx
- src/styles.css

Implementation:

- Create a three-part shell:
  - header bar
  - left navigation rail
  - main workspace panel
- Ensure the layout is desktop-first and accessible.
- Add semantic landmarks and keyboard focus states.
- Keep the shell consistent on all screens.

Acceptance criteria:

- User can navigate the app without losing context.
- The interface has a persistent header and nav.
- The app is usable with keyboard alone.

#### Task 1.2: Primary workspace structure

Implementation:

- Split main workspace into a folder tree panel and a content panel.
- Reserve space for a secondary detail preview area.
- Use CSS grid/flex layout for predictable resizing.

Acceptance criteria:

- Panels have clear boundaries.
- The layout supports dense information without clutter.
- The app can work at desktop width without excessive scrolling.

---

### Phase 2 — Folder hierarchy and browsing model

#### Task 2.1: Build a folder/tree browsing surface

Files likely involved:

- src/App.tsx
- src/styles.css

Implementation:

- Add a nested tree-style view for test cases.
- Include folder labels, expandable branches, and item counts.
- Provide selected state and hover styles.
- Make the current selection drive the displayed case list.

Acceptance criteria:

- User can browse a hierarchy without a separate page.
- Selected folder state is obvious.
- Tree interactions remain keyboard accessible.

#### Task 2.2: Empty and root states

Implementation:

- Add clear empty-state messaging for folders with no cases.
- Distinguish “all cases” from “folderless cases” from actual folders.

Acceptance criteria:

- Empty states do not feel broken or unstyled.
- The user always knows where they are in the workflow.

---

### Phase 3 — Execution board and case list

#### Task 3.1: Replace generic list with a structured case table

Files likely involved:

- src/App.tsx
- src/styles.css

Implementation:

- Create a compact table for test cases with columns such as:
  - checkbox
  - case ID
  - title
  - owner
  - last result
  - status
  - type
  - actions
- Use strong row separation, consistent spacing, and denser typography.

Acceptance criteria:

- The user can scan multiple cases with minimal effort.
- Critical status data is visible without opening rows.
- The interface remains readable at standard desktop widths.

#### Task 3.2: Status chips and badges

Implementation:

- Standardise status values like Passed, Failed, Blocked, Not run, Draft, Retest.
- Convert all lists and cards to use the same chip pattern.
- Ensure status is conveyed with both colour and text.

Acceptance criteria:

- Status tokens are consistent across all screens.
- They remain legible in low-contrast or no-colour scenarios.

#### Task 3.3: Bulk actions and row actions

Implementation:

- Add a checkbox/select-all pattern.
- Add bulk actions such as run, duplicate, assign, archive, or export as feasible.
- Provide row-level actions for quick actions.

Acceptance criteria:

- The interaction is obvious and discoverable.
- Bulk selection does not obscure the main content area.

---

### Phase 4 — Context and filtering layer

#### Task 4.1: Top chrome context selectors

Implementation:

- Add selectors for project, release, environment, and current workspace.
- Keep them in the top header and ensure they are clearly grouped.
- Keep the current context visible even when the user is deep in the workspace.

Acceptance criteria:

- The user can tell which project/release they are working in at a glance.
- The app does not hide context behind deep navigation.

#### Task 4.2: Search and filter controls

Implementation:

- Add a search field in the toolbar.
- Add filter controls for status, owner, folder, and result summary.
- Make filter state visible and easy to reset.

Acceptance criteria:

- Users can narrow the board quickly.
- Filter state is not hidden or ambiguous.

---

### Phase 5 — Detail preview and case workspace

#### Task 5.1: Detail preview panel

Implementation:

- Add a contextual side panel or drawer for selected test cases.
- Show summary, owner, last executed time, status, and key metadata.
- Include actions such as edit, run, duplicate, and view history.

Acceptance criteria:

- Users can inspect a case without a full separate screen.
- The preview remains compact and relevant.

#### Task 5.2: Preview vs full detail split

Implementation:

- Decide if detail preview is a narrow pane or a slide-out sheet.
- Keep it consistent with the rest of the electron-like desktop narrative.

Acceptance criteria:

- The preview feels like part of the workspace, not a modal interruption.

---

### Phase 6 — Richer workspace analytics

#### Task 6.1: Summary cards and execution rollups

Implementation:

- Add summary cards for pass/fail/blocked/not-run counts.
- Add lightweight reporting blocks for recent activity and release view.

Acceptance criteria:

- The workspace provides decision-making context quickly.
- It helps QA teams understand the current state without opening many screens.

#### Task 6.2: Trend and release views

Implementation:

- Add simple trend indicators or release rollups only after the shell is stable.
- Keep this lightweight and not overdesigned before the foundation exists.

Acceptance criteria:

- Reporting does not obstruct the main workflow.
- Additional visuals reinforce the main board rather than compete with it.

---

### Phase 7 — Design system and polish

#### Task 7.1: Design tokens

Implementation:

- Define a consistent set of design tokens for spacing, colour, radius, density, and typography.
- Keep the tokens in a small CSS theme layer or variable group.

Acceptance criteria:

- The system can be reused across cards, rows, chips, panels, and buttons.
- Visual consistency is easier to maintain.

#### Task 7.2: Component refinement

Implementation:

- Standardise chips, buttons, panel edges, table rows, and nav item states.
- Tune hover, focus, and selected states.

Acceptance criteria:

- The interface feels intentional, dense, and premium.
- It remains accessible and readable.

---

## Recommended issue sequence

This should be the working order of the backlog:

1. P0: GUI UX — redesign the app shell and navigation
2. P0: GUI UX — create a folder-like test case hierarchy
3. P0: GUI UX — redesign the list/table UX for case execution and result tracking
4. P1: GUI UX — add project, release, and tester context selectors
5. P1: GUI UX — create a single, consistent status taxonomy
6. P1: GUI UX — add a compact quick-create and bulk-action toolbar
7. P2: GUI UX — add a split-pane workspace for case folders + detail preview
8. P2: GUI UX — make execution data visually richer with summary, trends, and release rollups
9. P3: GUI UX — polish the visual design system with density, typography, and consistent components

---

## Agent execution notes

### What not to do

- Do not build isolated screens before the workspace shell is in place.
- Do not add too many visual flourishes before the information architecture is correct.
- Do not treat the status taxonomy as purely cosmetic; it is a structural UX layer.
- Do not introduce a complex detail model before the folder and list workflow exists.

### What to do instead

- Start with the layout skeleton and app shell.
- Then attach the folder tree and case list.
- Then fit the context controls and status chips into the same visual language.
- Then add the preview panel and reporting.
- Finish with design polish once the structure is stable.

---

## Expected end state

When complete, the GUI should feel like a modern QA workspace with:

- strong project/release context
- clear test-case hierarchy
- dense execution visibility
- robust actions and quick operations
- accessible semantic structure
- consistent product-level styling

This is the product target that matches the reference screenshots and the long-term workflow of test case management.
