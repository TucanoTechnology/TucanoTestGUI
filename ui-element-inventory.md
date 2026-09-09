# UI Element Inventory: Reference Screenshots

A literal, element-by-element breakdown of both screenshots, organized by region. Use this alongside the build prompt as a component checklist, each bullet below should map to one implementable piece.

## Shared chrome pattern (present in both)

- **Global icon rail**: far-left vertical strip, icon-only, no text labels, fixed width (~48-56px), one item shows an active/highlighted state (tinted background or colored tile), sits outside and to the left of the 3-pane content area

## Image 1: Testmo ("Acceptance test run" screen)

### App-level header
- **Top bar**: full-width, solid accent-color background. Left: logo mark + wordmark. Left-center: primary nav tabs (Projects, My work, Admin), active tab gets a pill background. Right: notification bell icon, help icon, user avatar with a small chevron.
- **Left icon rail**: dark background, roughly 9 stacked icon buttons, first one shown active with a distinct colored tile behind it, the rest are plain glyphs.

### Page header bar (sits above the three panes)
- **Title cluster**: run title (bold, large) + info icon (opens a details popover) + a muted, parenthetical context tag (browser/OS).
- **Progress bar**: a single horizontal bar split into colored segments proportional to status counts (pass/other/remaining), with a percentage label beside it.
- **Utility icon buttons**: four plain, borderless icon buttons (view, duplicate, print, export).
- **Close button**: secondary/outlined.
- **Edit split button**: primary label with an attached dropdown caret, opens an actions menu.
- **Section tab bar**: Results / Status / Activity / Issues. Active tab gets a bottom border in the accent color plus bold weight.

### Pane 1: Folder Tree
- **Pane toolbar**: scope-selector dropdown ("Folder") + a collapse-pane chevron.
- **Tree node row** (repeating): expand caret (render only if the node has children, leaf folders get no caret), folder icon, label. Indent scales with nesting depth. Selected row gets a background tint.

### Pane 2: Item List
- **List toolbar**: Filter dropdown, refresh icon button, search input with a leading icon.
- **List header row**: section title (bold) + info icon + item count badge + an overflow menu icon.
- **Pagination control**: "current/total" text with a dropdown, plus prev/next arrow buttons.
- **Add action**: a "+ [Item]" text link, top-right of the list.
- **Bulk-action icon row**: a small row of icon buttons (assign, view toggle, move-to-folder, etc.) tied to the checkbox selection state.
- **Table**:
  - Header row: select-all checkbox, column labels (Test, Priority, Status).
  - **Row** (repeating): row checkbox; file-type icon + name text; priority cell (directional icon, up=High, dot=Medium, down=Low, plus a text label); status cell rendered as a colored, clickable dropdown pill, not a static badge, with a fixed color map (Passed=green, Failed=red, Retest=amber, Skipped=blue, Untested=gray); a row-menu/drag-handle icon at the far right.
  - Row click sets the selected item and loads Pane 3; the active row stays visually highlighted.

### Pane 3: Detail/Results Panel
- **Sticky panel toolbar** (top of pane, stays visible while scrolling): "Add result" action, a "Pass & next" split button, an "Assign" icon button on the left; prev/next navigation arrows, expand/maximize icon, and a close icon on the right.
- **Item header**: title (bold, large), info icon, overflow menu icon, and a status dropdown pill at the far right (same color map as the list).
- **Breadcrumb subtitle**: parent folder/suite name, directly under the title, muted color.
- **Metadata card**: a bordered box with three label+value columns: Template (the test's format, e.g. "Steps", with an icon), Estimate (clock icon + duration), Priority (directional icon + level).
- **Steps section**: header label plus the rendered step content.
- **Local tab bar**: Results / Context / Issues, underline-style active indicator. This is separate from the page-level tab bar above and scopes only this item's panel.
- **Inline composer** (directly under the local tab bar): repeats the "Add result" and "Pass & next" actions from the sticky toolbar, plus a free-text input for a note.
- **Result entry card** (repeating, newest first): circular avatar; author name (bold) + relative timestamp on the same line, muted color; a row-menu icon; a status pill at the far right edge; comment/body text beneath the name line; optional file-attachment chips beneath the body (file-type icon + filename + size + a download affordance), multiple chips can sit side by side.

## Image 2: RTM for Jira ("New Test Case" screen)

### Project sidebar (second column)
- **Project header**: project icon, name (bold) + type subtext, dropdown chevron.
- **Primary nav list** (repeating item): icon + label, optional gray subtext on the first item, a dividing line separates board-level links from project-settings-level links. One item shows an active state (tinted background, bold label) marking the current section.

### Test tree panel (third column)
- **Panel header**: back-navigation icon + "Test Cases" title.
- **Panel toolbar**: add-item icon, add-folder icon, delete icon, a right-aligned search icon, an overflow "..." icon.
- **Tree node, folder variant**: caret, folder icon, label; expanded/collapsed state; a folder itself can be the active selection (tinted row, colored label) since selecting it scopes what shows in the detail panel.
- **Tree node, leaf/case variant**: a distinct icon from folders (small document/list glyph), an ID badge in the accent color (e.g. "RTM-14") followed by the case title in default text color, no caret since it is a leaf.

### Detail/edit panel (fourth column)
- **Breadcrumb**: parent path as slash-separated text.
- **Title row**: back-chevron + heading text.
- **Tab bar**: Details / Steps / Requirements, underline active state.
- **Form fields** (repeating pattern, label above control):
  - Issue Type: icon + text selector.
  - Summary: single-line text input, required (label carries an asterisk).
  - Description: rich text editor with its own mini-toolbar (paragraph-style dropdown, bold, italic, more-formatting, insert menu) and a resizable content area.
  - Select folder: dropdown, pre-filled to whichever folder was active in the tree panel.
  - Add to Test Plan: dropdown, links the case to a run/plan entity.

Note: the small orange badge overlapping the top-right corner of this screenshot is a third-party marketing callout, not part of the app itself. Exclude it from the implementation spec.

## Cross-cutting notes for the agent

- Both examples encode the same skeleton: scope selector, then tree, then list-or-tree-with-leaves, then detail/edit panel. Model selection as two pieces of state: `activeFolderId` (set by the tree, filters the next pane) and `activeItemId` (set by the list or leaf, drives the detail panel's content).
- Status pills are interactive controls, not passive labels. Build one status-pill component (fixed color-to-value map) and reuse it everywhere a status appears: list row, detail header, result entry.
- Treat every "add new" affordance ("+ Results", the add-item icon, "Add result") as the same underlying action at different tree depths: create a child of whatever is currently selected.
- Reuse a single row-menu icon (three lines or dots) as the generic per-row overflow action across every list, tree, and card, rather than inventing a new pattern per surface.
