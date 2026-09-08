# Three-Panel Layout Implementation

## Overview
Complete GUI redesign implementing a three-panel workspace layout following Testmo/Testiny patterns.

## Architecture

```
┌─────────────────┬──────────────────┬─────────────────────┐
│                 │                  │                     │
│   FOLDER TREE   │    LIST VIEW     │    DETAIL VIEW      │
│   (Left Panel)  │   (Center Panel) │    (Right Panel)    │
│   280px         │   flexible       │    380px            │
│                 │                  │                     │
│  📁 Projects    │  Test Cases      │  Selected Item      │
│  ├─  Suite 1  │  ┌────────────  │  Details            │
│  │  ├─ 📄 Case 1│  │ Case 1     │  │                     │
│  │  └─ 📄 Case 2│  │ Case 2     │  │  • Title            │
│  ├─ 📁 Suite 2  │  │ Case 3     │  │  • Description      │
│  │  └─ 📄 Case 3│  │ Case 4     │  │  • Steps            │
│  └─ 📁 Suite 3  │  └────────────┘  │  • Expected Result  │
│                 │                  │  • Status           │
│                 │                  │  • Actions          │
└─────────────────┴──────────────────┴─────────────────────┘
```

## Implementation Plan

### 1. Layout Structure (App.tsx)
- Three-panel CSS Grid layout
- Resizable panels (optional)
- Responsive breakpoints
- State management for selected items

### 2. Left Panel - FolderHierarchyTree
- Reuse existing component
- Add click handlers to filter center panel
- Breadcrumb navigation
- Search/filter

### 3. Center Panel - TestCaseTable
- Reuse existing component
- Add row click handler to open detail
- Status badges
- Sorting and filtering

### 4. Right Panel - DetailView (NEW)
- Display selected item details
- Edit functionality
- Action buttons
- Attachment list
- Close button

### 5. Integration
- Connect all panels
- State synchronization
- Keyboard navigation
- Empty states

## Files to Create/Modify

**New Files:**
- `src/components/DetailView.tsx` - Right panel component
- `src/components/ThreePanelLayout.tsx` - Main layout wrapper

**Modified Files:**
- `src/App.tsx` - Integrate three-panel layout
- `src/styles.css` - Add layout styles
- `src/components/FolderHierarchyTree.tsx` - Add click handlers
- `src/components/TestCaseTable.tsx` - Add row click handler

## Acceptance Criteria

- [ ] Three-panel layout renders correctly
- [ ] Clicking folder filters center list
- [ ] Clicking list item opens detail panel
- [ ] Detail panel shows all item fields
- [ ] Can edit item from detail panel
- [ ] Can close detail panel
- [ ] Layout is responsive
- [ ] Keyboard navigation works
- [ ] All existing functionality preserved
- [ ] Matches Testmo/Testiny visual style

## Technical Notes

- Use CSS Grid for layout
- Maintain API-driven architecture
- Preserve all existing components
- Ensure accessibility (ARIA labels, keyboard nav)
- Loading and empty states for each panel
