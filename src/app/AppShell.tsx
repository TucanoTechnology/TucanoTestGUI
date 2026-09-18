import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider.js";
import { ProjectProvider, useProjectContext } from "./ProjectContext.js";
import { ProjectExplorer } from "../features/projects/ProjectExplorer.js";
import { ProjectSwitcher } from "../features/projects/ProjectSwitcher.js";
import { ProjectDetail } from "../features/projects/ProjectDetail.js";
import { SuiteDetail } from "../features/suites/SuiteDetail.js";
import { DIRECT_SUITE_ID, SuiteTree } from "../features/suites/SuiteTree.js";
import { CaseDetail } from "../features/cases/CaseDetail.js";
import { RunDetail } from "../features/runs/RunDetail.js";
import { MilestoneDetail } from "../features/milestones/MilestoneDetail.js";
import { ConfigurationDetail } from "../features/configurations/ConfigurationDetail.js";
import { ReportsView } from "../features/reports/ReportsView.js";
import { EntityList } from "./EntityList.js";

const NAV_ITEMS = [
  { id: "cases", label: "Test Cases", icon: "📋", entityType: "case" },
  { id: "runs", label: "Test Runs", icon: "▶", entityType: "run" },
  { id: "milestones", label: "Milestones", icon: "🎯", entityType: "milestone" },
  {
    id: "configurations",
    label: "Configurations",
    icon: "⚙",
    entityType: "configuration",
  },
  { id: "reports", label: "Reports", icon: "📊", entityType: null },
] as const;

type ModuleId = (typeof NAV_ITEMS)[number]["id"];

function AppShellContent() {
  const { username, logout } = useAuth();
  const { selectedProjectId, selection, setSelection, announcement } =
    useProjectContext();
  const [activeModule, setActiveModule] = useState<ModuleId>("cases");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // The tree node the centre case list is scoped to: `null` is "All test
  // cases", `DIRECT_SUITE_ID` is the cases the project holds itself, and any
  // other value is a suite id. The tree's active node and the list's filter
  // both read it, so the two cannot disagree about what is selected.
  const [suiteScope, setSuiteScope] = useState<string | null>(null);

  const activeItem =
    NAV_ITEMS.find((item) => item.id === activeModule) ?? NAV_ITEMS[0];

  // A node picked in one project's tree does not describe the next project.
  useEffect(() => {
    setSuiteScope(null);
  }, [selectedProjectId]);

  // The two pinned tree nodes are filters the centre list applies, not
  // entities the detail pane can open, so neither carries a selection.
  const selectSuite = (suiteId: string | null) => {
    setSuiteScope(suiteId);
    if (suiteId === null || suiteId === DIRECT_SUITE_ID) {
      setSelection(null);
      return;
    }
    setSelection({
      type: "suite",
      id: suiteId,
      projectId: selectedProjectId ?? undefined,
    });
  };

  const renderDetail = () => {
    if (!selection) {
      return (
        <div className="empty-state">
          <div className="empty-state__icon" aria-hidden="true">
            📋
          </div>
          <p className="empty-state__message">
            Select an entity from the explorer
          </p>
        </div>
      );
    }

    switch (selection.type) {
      case "project":
        return <ProjectDetail projectId={selection.id} />;
      case "suite":
        return (
          <SuiteDetail suiteId={selection.id} projectId={selection.projectId} />
        );
      case "case":
        return <CaseDetail caseId={selection.id} projectId={selection.projectId} />;
      case "run":
        return <RunDetail runId={selection.id} projectId={selection.projectId} />;
      case "milestone":
        return (
          <MilestoneDetail
            milestoneId={selection.id}
            projectId={selection.projectId}
          />
        );
      case "configuration":
        return (
          <ConfigurationDetail
            configId={selection.id}
            projectId={selection.projectId}
          />
        );
      default:
        return null;
    }
  };

  const handleModuleClick = (moduleId: ModuleId) => {
    setActiveModule(moduleId);
    setSelection(null);
    setSidebarOpen(false);
  };

  return (
    <div
      className={`app-layout ${sidebarOpen ? "app-layout--sidebar-open" : ""}`}
    >
      <header className="topbar">
        <button
          type="button"
          className="btn btn-ghost topbar__menu-toggle"
          onClick={() => setSidebarOpen((open) => !open)}
          aria-label="Toggle navigation panes"
          aria-expanded={sidebarOpen}
        >
          ☰
        </button>
        <span className="topbar__brand">Tucano Test</span>
        <ProjectSwitcher />
        <div className="topbar__spacer" />
        <div className="topbar__user">
          <span className="topbar__username">{username}</span>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="navrail" aria-label="Module navigation">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`navrail__item ${
              activeModule === item.id ? "navrail__item--active" : ""
            }`}
            onClick={() => handleModuleClick(item.id)}
            title={item.label}
            aria-label={item.label}
            aria-current={activeModule === item.id ? "page" : undefined}
          >
            <span className="navrail__icon" aria-hidden="true">
              {item.icon}
            </span>
          </button>
        ))}
      </nav>

      <div className="panes">
        <aside
          className="pane-left"
          aria-label={selectedProjectId ? "Suite tree" : "Project explorer"}
        >
          {selectedProjectId ? (
            <SuiteTree
              projectId={selectedProjectId}
              selectedSuiteId={suiteScope}
              onSelectSuite={selectSuite}
            />
          ) : (
            <ProjectExplorer />
          )}
        </aside>

        <main className="pane-center" aria-label={activeItem.label}>
          {activeItem.entityType ? (
            <EntityList
              entityType={activeItem.entityType}
              caseScope={suiteScope}
            />
          ) : (
            <ReportsView />
          )}
        </main>

        <aside className="pane-right" aria-label="Detail panel">
          {renderDetail()}
        </aside>
      </div>

      <div className="sr-only" aria-live="polite" role="status">
        {selection
          ? `Selected ${selection.type}: ${selection.id}`
          : "No entity selected"}
      </div>

      <div className="sr-only" aria-live="polite" role="status">
        {announcement && (
          <span key={announcement.id}>{announcement.message}</span>
        )}
      </div>
    </div>
  );
}

export function AppShell() {
  return (
    <ProjectProvider>
      <AppShellContent />
    </ProjectProvider>
  );
}
