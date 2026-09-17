import { useEffect, useState } from "react";
import type { Project } from "../../api/generated/index.js";
import { apiFetch } from "../../api/client.js";
import { useAuth } from "../../app/AuthProvider.js";
import { useProjectContext } from "../../app/ProjectContext.js";

export function ProjectExplorer() {
  const { client } = useAuth();
  const { selectedProjectId, setSelectedProjectId, selection, setSelection } =
    useProjectContext();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch(() => client.projects.listProjects({}))
      .then(async (ids) => {
        const docs = await Promise.all(
          ids.map((id) =>
            apiFetch(() => client.projects.getProject({ id })),
          ),
        );
        if (!cancelled) {
          setProjects(docs);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message =
            (err as { body?: { error?: { message?: string } } })?.body?.error
              ?.message ?? "Failed to load projects";
          setError(message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const toggleExpand = (id: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelection({ type: "project", id: projectId });
  };

  const selectSuite = (suiteId: string, projectId: string) => {
    setSelection({ type: "suite", id: suiteId, projectId });
  };

  const selectCase = (caseId: string, projectId: string) => {
    setSelection({ type: "case", id: caseId, projectId });
  };

  if (loading) {
    return (
      <div className="loading" role="status">
        <div className="loading__spinner" />
        <span className="sr-only">Loading projects…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-display" role="alert">
        {error}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__message">No projects found</div>
      </div>
    );
  }

  return (
    <nav aria-label="Project explorer">
      <ul className="tree" role="tree">
        {projects.map((project) => {
          const isExpanded = expandedProjects.has(project.projectId);
          const isActive =
            selectedProjectId === project.projectId &&
            selection?.type === "project";

          return (
            <li
              key={project.projectId}
              role="treeitem"
              aria-expanded={isExpanded}
            >
              <button
                className={`tree-node ${isActive ? "tree-node--active" : ""}`}
                onClick={() => {
                  toggleExpand(project.projectId);
                  selectProject(project.projectId);
                }}
                aria-current={isActive ? "true" : undefined}
              >
                <span className="tree-node__icon" aria-hidden="true">
                  {isExpanded ? "▾" : "▸"}
                </span>
                <span className="tree-node__label">{project.name}</span>
                {project.testSuites && (
                  <span className="tree-node__count">
                    {project.testSuites.length}
                  </span>
                )}
              </button>

              {isExpanded && project.testSuites && (
                <ul role="group">
                  {project.testSuites.map((suite) => {
                    const isSuiteActive = selection?.id === suite.suiteId;
                    const suiteExpanded = expandedProjects.has(suite.suiteId);

                    return (
                      <li
                        key={suite.suiteId}
                        role="treeitem"
                        aria-expanded={
                          suite.testCases ? suiteExpanded : undefined
                        }
                      >
                        <button
                          className={`tree-node tree-node--child ${isSuiteActive ? "tree-node--active" : ""}`}
                          onClick={() => {
                            if (
                              suite.testCases &&
                              suite.testCases.length > 0
                            ) {
                              toggleExpand(suite.suiteId);
                            }
                            selectSuite(suite.suiteId, project.projectId);
                          }}
                          aria-current={isSuiteActive ? "true" : undefined}
                        >
                          <span
                            className="tree-node__icon"
                            aria-hidden="true"
                          >
                            {suite.testCases && suite.testCases.length > 0
                              ? suiteExpanded
                                ? "▾"
                                : "▸"
                              : "📁"}
                          </span>
                          <span className="tree-node__label">{suite.name}</span>
                          {suite.testCases && (
                            <span className="tree-node__count">
                              {suite.testCases.length}
                            </span>
                          )}
                        </button>

                        {suiteExpanded && suite.testCases && (
                          <ul role="group">
                            {suite.testCases.map((tc) => {
                              const isCaseActive =
                                selection?.id === tc.testCaseId;

                              return (
                                <li key={tc.testCaseId} role="treeitem">
                                  <button
                                    className={`tree-node tree-node--grandchild ${isCaseActive ? "tree-node--active" : ""}`}
                                    onClick={() =>
                                      selectCase(
                                        tc.testCaseId,
                                        project.projectId,
                                      )
                                    }
                                    aria-current={
                                      isCaseActive ? "true" : undefined
                                    }
                                  >
                                    <span
                                      className="tree-node__icon"
                                      aria-hidden="true"
                                    >
                                      📄
                                    </span>
                                    <span className="tree-node__label">
                                      {tc.title}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
