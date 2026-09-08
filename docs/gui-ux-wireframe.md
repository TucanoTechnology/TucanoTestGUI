# GUI UX Wireframe for Tester Workflow

This document is the implementation blueprint for the prioritized GUI UX issues in the Tucano Test GUI project. It translates the reference screenshots into a concrete product pattern so the next AI agent can implement the work in a consistent, sequenced way.

## 1. Product intent

The GUI should feel like a test operations workspace, not an administration form set.

The design principles are:

- Workflow first: the user is triaging, running, and reviewing tests, not filling CRUD forms.
- Strong context: project, release, environment, and current suite are always visible.
- Dense but readable: the interface should pack information without becoming noisy.
- Fast decision-making: status, ownership, and last result are visible at a glance.
- Hierarchical browsing: test cases live in folder-like structures before they live in a flat list.

---

## 2. Screen model: overall shell

The app shell should be structured in three layers:

1. Top header / context bar
2. Left navigation rail
3. Main workspace panel

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ TOP HEADER / CONTEXT BAR                                                    │
│ [Tucano logo] [Project selector] [Release selector] [Environment] [Search] │
│ [Create] [Refresh] [Reports] [User menu]                                   │
└──────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────┬───────────────────────────────────────────────────────┐
│ LEFT NAV RAIL        │ MAIN WORKSPACE                                         │
│ Dashboard            │  ┌───────────────────────────────────────────────┐  │
│ Test Cases           │  │ Toolbar: New / Create / Quick Create /      │  │
│ Test Plans           │  │ Filter / Bulk actions                      │  │
│ Test Runs            │  └───────────────────────────────────────────────┘  │
│ Milestones           │  ┌─────────────┬──────────────────────────────────┐  │
│ Integrations         │  │ FOLDER TREE │ CASE TABLE / BOARD              │  │
│ Settings             │  │ - Root      │ ID | Title | Owner | Status    │  │
│                      │  │ - Common    │ ...                               │  │
│                      │  │ - Functional│ ...                               │  │
│                      │  │ ...         │ ...                               │  │
│                      │  └─────────────┴──────────────────────────────────┘  │
│                      │  ┌─────────────┬──────────────────────────────────┐  │
│                      │  │ DETAIL PREVIEW (optional collapsible)     │  │
│                      │  │ selected case summary + evidence           │  │
│                      │  └─────────────┴──────────────────────────────────┘  │
└──────────────────────┴───────────────────────────────────────────────────────┘
```

### Responsibilities

- Header anchors the user in a project, release, and context.
- Left rail is persistent and narrow.
- Main area manages the working board and detail view.
- The shell is intentionally dense and resembles a tester workstation rather than a generic admin dashboard.

---

## 3. Workspace composition

### 3.1 Folder tree panel

This is the first major restructuring item. It should sit on the left of the main board and behave like a browsing tree.

```text
┌────────────────────┐
│ Test case folders  │
├────────────────────┤
│ All test cases      │ 279
│ Test cases in no folder │ 0
│ > Code Coverage     │ 2
│ > Custom Fields     │ 8
│ > Dashboard         │ 5
│ > Editor            │ 5
│ > Event Tracking    │ 4
│ > Export            │ 5
│ > General Behaviour │ 24
│ > Jira Integration  │ 33
│ > Project Management│ 17
│ > Reporting         │ 2
│ > Routing           │ 15
│ > Settings          │ 48
│ > SignUp            │ 9
└────────────────────┘
```

Requirements:

- Expand/collapse branches.
- Show item counts per folder.
- Allow current selection to affect main list content.
- Keep tree readable without introducing deep nesting too early.

### 3.2 Primary execution board

This is the heart of the tester workflow.

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ All test cases                                           Create test run │
├────────────────────────────────────────────────────────────────────────────┤
│ [Create] [Quick create]                              [Filter by keyword] │
├────────────────────────────────────────────────────────────────────────────┤
│ Checkbox | ID | Title | Owner | Last result | Status | Type | Actions │
│ [ ]      | TC-963 | Code Coverage: Snapshot ... | Alex | Passed | ... | ... │
│ [ ]      | TC-964 | Code Coverage: Combined ... | Alex | Passed | ... | ... │
│ [ ]      | TC-961 | Editing Custom Fields ... | Hanna | Passed | ... | ... │
│ [ ]      | TC-984 | Custom Fields in Table ... | Alex | Passed | ... | ... │
│ [ ]      | TC-967 | [deprecated] Custom Field ... | Hanna | Passed | ... | ... │
│ ...                                                                      │
└────────────────────────────────────────────────────────────────────────────┘
```

Requirements:

- Strong column density.
- Status chips and last-result indicators are visible without opening the row.
- Action column surfaces quick actions.
- Multi-select and bulk actions are supported.

### 3.3 Detail preview panel

This panel is optional at first but should be planned early because it is a key UX device in the reference designs.

```text
┌────────────────────────────────────────────────────────────┐
│ Selected case: TC-967                                    │
│ [deprecated] Custom Field ...                             │
├────────────────────────────────────────────────────────────┤
│ Execution status: Passed                                  │
│ Owner: Hanna                                              │
│ Last executed: 21-Jul-2019                                 │
│ Type: Functional                                          │
│ Release: All Releases                                     │
│ Summary: Existing issue with legacy field rendering.      │
│ Evidence: attachment / screenshot / log link              │
│ Actions: Edit | Duplicate | Run | View history            │
└────────────────────────────────────────────────────────────┘
```

This should not become a heavyweight modal; it should exist as a contextual preview surface.

---

## 4. Visual language

### 4.1 Status semantics

The UI should use a consistent status taxonomy and colour mapping. This should be treated as a shared design primitive across rows, chips, filters, and summary cards.

```text
Passed      = green
Failed      = red
Blocked     = purple / dark red
Not run     = grey
Caution     = amber
Draft       = neutral blue / grey
Approved    = teal
Retest      = orange
```

All statuses must remain understandable without relying only on colour.

### 4.2 Density and spacing

The design should prefer:

- tighter row spacing,
- compact but crisp controls,
- visible hover states,
- stronger table borders and row grouping,
- minimal chrome around the main working area.

### 4.3 Interaction patterns

- Toolbar actions should be visible and contextual.
- Filtering should happen inline and stay visible.
- User context should be obvious without requiring a wizard.
- Row selection should be visually distinct and keyboard accessible.

---

## 5. Implementation order for the AI agent

This is the recommended execution sequence.

### Phase 1 — Shell and structure

1. Create a persistent app shell with header + nav + workspace.
2. Split the workspace into folder tree and content area.
3. Add active state styling for nav and selected folder.
4. Ensure responsive desktop layout and keyboard focus states.

Related issues:

- Issue #22 — redesign the app shell and navigation
- Issue #23 — folder-like test case hierarchy

### Phase 2 — Execution board UX

1. Replace flat lists with a compact dense table.
2. Add status chips and filter controls.
3. Add row actions and bulk select model.
4. Add quick-create and create-run affordances.

Related issues:

- Issue #24 — execution board redesign
- Issue #27 — quick-create and bulk-action toolbar

### Phase 3 — Context and semantic layer

1. Add project, release, environment, and user context selectors.
2. Normalise status synonyms and row indicators.
3. Wire filters and sorting to consistent semantic values.

Related issues:

- Issue #25 — context selectors
- Issue #26 — status taxonomy

### Phase 4 — Workspace richness

1. Add a preview panel for selected case details.
2. Add summary cards and lightweight reporting visuals.
3. Extend the workspace into a richer tester-centric view.

Related issues:

- Issue #28 — split-pane workspace
- Issue #29 — execution rollups / trends

### Phase 5 — Design polish

1. Define a design token layer.
2. Standardise typography, spacing, and component density.
3. Rework buttons, tables, chips, cards, and actions into a coherent system.

Related issues:

- Issue #30 — design system polish

---

## 6. Acceptance criteria for the overall UX redesign

The full redesign is successful when:

- the GUI feels like a tester workspace, not a generic admin dashboard,
- project and release context are visible without extra clicks,
- case folders make large test sets trackable,
- row status is legible at a glance,
- the working board supports bulk and individual actions,
- the design remains accessible and keyboard-friendly,
- the visual density supports a professional QA workflow on desktop.

---

## 7. Key agent guidance

When implementing, the AI should not treat each issue as isolated polishing. The issues are intentionally sequenced so that:

- shell structure comes before inner table logic,
- folder hierarchy comes before advanced detail panes,
- status semantics come before rich reporting,
- visual polish comes last.

The goal is to build the UX in layers, with each layer making the next one easier to implement without rework.
