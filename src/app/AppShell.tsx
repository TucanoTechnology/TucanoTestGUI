import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider.js";
import { ProjectProvider, useProjectContext } from "./ProjectContext.js";
import { ProjectExplorer } from "../features/projects/ProjectExplorer.js";
import { ProjectSwitcher } from "../features/projects/ProjectSwitcher.js";
import { ProjectDetail } from "../features/projects/ProjectDetail.js";
import { SuiteDetail } from "../features/suites/SuiteDetail.js";
import { DIRECT_SUITE_ID, SuiteTree } from "../features/suites/SuiteTree.js";
import { CaseList } from "../features/cases/CaseList.js";
import { CaseDetail } from "../features/cases/CaseDetail.js";
import { RunList } from "../features/runs/RunList.js";
import { RunDetail } from "../features/runs/RunDetail.js";
import { MilestoneList } from "../features/milestones/MilestoneList.js";
import { MilestoneDetail } from "../features/milestones/MilestoneDetail.js";
import { ConfigurationList } from "../features/configurations/ConfigurationList.js";
import { ConfigurationDetail } from "../features/configurations/ConfigurationDetail.js";
import { ReportsView } from "../features/reports/ReportsView.js";
import { GlobalSearch } from "./GlobalSearch.js";
import {
  ChartIcon,
  ClipboardIcon,
  FolderIcon,
  MenuIcon,
  PlayIcon,
  SettingsIcon,
  TargetIcon,
} from "../components/Icon.js";
import { EmptyState } from "../components/StateViews.js";

const NAV_ITEMS = [
  { id: "cases", label: "Test Cases", icon: ClipboardIcon, entityType: "case" },
  { id: "runs", label: "Test Runs", icon: PlayIcon, entityType: "run" },
  { id: "milestones", label: "Milestones", icon: TargetIcon, entityType: "milestone" },
  {
    id: "configurations",
    label: "Configurations",
    icon: SettingsIcon,
    entityType: "configuration",
  },
  { id: "reports", label: "Reports", icon: ChartIcon, entityType: null },
] as const;

type ModuleId = (typeof NAV_ITEMS)[number]["id"];

function AppShellContent() {
  const { username, logout } = useAuth();
  const {
    selectedProjectId,
    setSelectedProjectId,
    selection,
    setSelection,
    announcement,
  } = useProjectContext();
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
            <ClipboardIcon />
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

  const focusMain = () => {
    // The anchor's default jump moves the scroll; focus has to follow for the
    // next Tab to continue inside the content rather than from the top again.
    document.getElementById("main-content")?.focus();
  };

  const renderCenter = () => {
    if (activeModule === "reports") {
      return <ReportsView />;
    }

    if (!selectedProjectId) {
      return (
        <EmptyState
          icon={<FolderIcon />}
          message={`Select a project to view ${NAV_ITEMS.find((i) => i.id === activeModule)?.label.toLowerCase() ?? ""}`}
        />
      );
    }

    switch (activeModule) {
      case "cases":
        return (
          <CaseList
            projectId={selectedProjectId}
            suiteFilter={suiteScope}
            selectedCaseId={selection?.type === "case" ? selection.id : null}
            onSelectCase={(caseId) =>
              setSelection({
                type: "case",
                id: caseId,
                projectId: selectedProjectId,
              })
            }
            onCreateRun={() => {
              setActiveModule("runs");
              setSelection(null);
            }}
          />
        );
      case "runs":
        return (
          <RunList
            projectId={selectedProjectId}
            selectedRunId={selection?.type === "run" ? selection.id : null}
            onSelectRun={(runId) =>
              setSelection({
                type: "run",
                id: runId,
                projectId: selectedProjectId,
              })
            }
          />
        );
      case "milestones":
        return (
          <MilestoneList
            projectId={selectedProjectId}
            selectedMilestoneId={
              selection?.type === "milestone" ? selection.id : null
            }
            onSelectMilestone={(milestoneId) =>
              setSelection({
                type: "milestone",
                id: milestoneId,
                projectId: selectedProjectId,
              })
            }
          />
        );
      case "configurations":
        return (
          <ConfigurationList
            projectId={selectedProjectId}
            selectedConfigId={
              selection?.type === "configuration" ? selection.id : null
            }
            onSelectConfiguration={(configId) =>
              setSelection({
                type: "configuration",
                id: configId,
                projectId: selectedProjectId,
              })
            }
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`app-layout ${sidebarOpen ? "app-layout--sidebar-open" : ""}`}
    >
      {/* First stop on the keyboard: jump past the bar, rail and explorer
          into the working pane. Hidden until focus, per WCAG 2.4.1. */}
      <a className="skip-link" href="#main-content" onClick={() => focusMain()}>
        Skip to content
      </a>
      <header className="topbar">
        <button
          type="button"
          className="btn btn-ghost topbar__menu-toggle"
          onClick={() => setSidebarOpen((open) => !open)}
          aria-label="Toggle navigation panes"
          aria-expanded={sidebarOpen}
        >
          <MenuIcon />
        </button>
        <span className="topbar__brand">Tucano Test</span>
        <ProjectSwitcher />
        <GlobalSearch
          onPick={(hit) => {
            setSelectedProjectId(hit.projectId);
            if (hit.type === "case") setActiveModule("cases");
            if (hit.type === "run") setActiveModule("runs");
            if (hit.type === "milestone") setActiveModule("milestones");
            if (hit.type === "configuration") setActiveModule("configurations");
            if (hit.type === "suite") {
              setActiveModule("cases");
              setSuiteScope(hit.id);
            }
            if (hit.type === "project") {
              setSuiteScope(null);
              setSidebarOpen(false);
            }
            setSelection({
              type: hit.type,
              id: hit.id,
              projectId: hit.projectId,
            });
          }}
        />
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
              <item.icon />
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
              onSelectCase={(suiteId, caseId) => {
                // One click lands the case: scope the list to its suite,
                // select the case, and make sure the centre module showing
                // cases is the one on screen (#178).
                setActiveModule("cases");
                setSuiteScope(suiteId);
                setSelection({
                  type: "case",
                  id: caseId,
                  projectId: selectedProjectId ?? undefined,
                });
                setSidebarOpen(false);
              }}
            />
          ) : (
            <ProjectExplorer />
          )}
        </aside>

        <main
          id="main-content"
          className="pane-center"
          tabIndex={-1}
          aria-label={activeItem.label}
        >
          {renderCenter()}
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
