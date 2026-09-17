import { useState } from "react";
import { useAuth } from "./AuthProvider.js";
import { ProjectProvider, useProjectContext, type EntityType } from "./ProjectContext.js";
import { ProjectExplorer } from "../features/projects/ProjectExplorer.js";
import { ProjectDetail } from "../features/projects/ProjectDetail.js";
import { SuiteDetail } from "../features/suites/SuiteDetail.js";
import { CaseDetail } from "../features/cases/CaseDetail.js";
import { RunDetail } from "../features/runs/RunDetail.js";
import { MilestoneDetail } from "../features/milestones/MilestoneDetail.js";
import { ConfigurationDetail } from "../features/configurations/ConfigurationDetail.js";
import { EntityList } from "./EntityList.js";

const NAV_TABS: { type: EntityType; label: string }[] = [
  { type: "project", label: "Projects" },
  { type: "suite", label: "Suites" },
  { type: "case", label: "Cases" },
  { type: "run", label: "Runs" },
  { type: "milestone", label: "Milestones" },
  { type: "configuration", label: "Configs" },
];

function AppShellContent() {
  const { username, logout } = useAuth();
  const { selectedProjectId, selection, setSelection } = useProjectContext();
  const [activeTab, setActiveTab] = useState<EntityType>("project");
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
          <SuiteDetail
            suiteId={selection.id}
            projectId={selection.projectId}
          />
        );
      case "case":
        return (
          <CaseDetail
            caseId={selection.id}
            projectId={selection.projectId}
          />
        );
      case "run":
        return <RunDetail runId={selection.id} />;
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

  const handleTabClick = (type: EntityType) => {
    setActiveTab(type);
    setSelection(null);
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <button
          className="btn btn-ghost sidebar-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle sidebar"
          aria-expanded={sidebarOpen}
        >
          ☰
        </button>
        <span className="app-header__brand">Tucano Test</span>
        {selectedProjectId && (
          <div className="header-context">
            <span className="header-chip">
              Project: {selectedProjectId.slice(0, 8)}…
            </span>
          </div>
        )}
        <div className="header-spacer" />
        <div className="header-user">
          <span>{username}</span>
          <button className="btn btn-ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`app-sidebar ${sidebarOpen ? "app-sidebar--open" : ""}`}
        aria-label="Sidebar"
      >
        <ProjectExplorer />
      </aside>

      <main className="app-main">
        <nav className="nav-tabs" aria-label="Entity type navigation">
          {NAV_TABS.map((tab) => (
            <button
              key={tab.type}
              className={`nav-tab ${activeTab === tab.type ? "nav-tab--active" : ""}`}
              onClick={() => handleTabClick(tab.type)}
              aria-current={activeTab === tab.type ? "page" : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <EntityList entityType={activeTab} />

        {selection && <div className="panel">{renderDetail()}</div>}
      </main>

      <div className="sr-only" aria-live="polite" role="status">
        {selection
          ? `Selected ${selection.type}: ${selection.id}`
          : "No entity selected"}
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
