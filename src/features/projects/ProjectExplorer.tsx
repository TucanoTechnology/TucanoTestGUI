import { useEffect, useId, useState, type FormEvent } from "react";
import type { Project } from "../../api/generated/index.js";
import { apiFetch } from "../../api/client.js";
import { readApiError, type ApiErrorInfo } from "../../api/errors.js";
import { useAuth } from "../../app/AuthProvider.js";
import { useProjectContext } from "../../app/ProjectContext.js";
import { Dialog } from "../../app/Dialog.js";
import { ApiErrorNotice } from "../../app/ApiErrorNotice.js";
import { EntityForm, type EntityFormValues } from "../../app/EntityForm.js";
import { parseTags } from "../../app/tags.js";

export function ProjectExplorer() {
  const { client, systemAdmin } = useAuth();
  const fieldId = useId();
  const {
    selectedProjectId,
    setSelectedProjectId,
    selection,
    setSelection,
    projectsVersion,
    refreshProjects,
    announce,
  } = useProjectContext();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(),
  );
  const [creating, setCreating] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<ApiErrorInfo | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [tagsFilter, setTagsFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError(null);
    // `GET /projects` is the only list route the contract gives a `tags`
    // parameter. The API reads an empty one as matching nothing at all, so the
    // parameter is left off the request rather than sent blank.
    apiFetch(() =>
      client.projects.listProjects(
        tagsFilter === "" ? {} : { tags: tagsFilter },
      ),
    )
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
          setError(readApiError(err, "Failed to load projects"));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client, projectsVersion, tagsFilter]);

  const applyTagFilter = (event: FormEvent) => {
    event.preventDefault();
    setTagsFilter(parseTags(tagInput).join(","));
  };

  const clearTagFilter = () => {
    setTagInput("");
    setTagsFilter("");
  };

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

  const openCreate = () => {
    setCreateError(null);
    setCreating(true);
  };

  const closeCreate = () => {
    setCreating(false);
    setCreateError(null);
  };

  const createProject = async (values: EntityFormValues) => {
    setCreateBusy(true);
    setCreateError(null);
    try {
      const created = await apiFetch(() =>
        client.projects.createProject({
          requestBody: {
            name: values.name,
            description: values.description,
            tags: values.tags,
          },
        }),
      );
      closeCreate();
      refreshProjects();
      announce(created.message);
      selectProject(created.id);
    } catch (err: unknown) {
      setCreateError(readApiError(err, "Failed to create project"));
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <nav className="explorer" aria-label="Project explorer">
      <div className="explorer__toolbar">
        {systemAdmin ? (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            New Project
          </button>
        ) : (
          // `POST /projects` is the one create answered `forbidden` to everyone
          // but a system administrator, so the control is not offered to an
          // account whose authority cannot use it. The API's refusal is still
          // rendered if one arrives.
          <p className="explorer__notice">
            Only a system administrator can create a project.
          </p>
        )}
      </div>

      <form
        className="explorer__filter"
        onSubmit={applyTagFilter}
        aria-label="Filter projects by tags"
      >
        <div className="form-field">
          <label htmlFor={`${fieldId}-tags`}>Filter by tags</label>
          <input
            id={`${fieldId}-tags`}
            type="text"
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            aria-describedby={`${fieldId}-tags-hint`}
          />
          <p className="form-field__hint" id={`${fieldId}-tags-hint`}>
            A project matches any tag it carries. Separate tags with commas.
          </p>
        </div>
        <div className="dialog__actions">
          {tagsFilter !== "" && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={clearTagFilter}
            >
              Clear
            </button>
          )}
          <button type="submit" className="btn btn-primary">
            Filter
          </button>
        </div>
      </form>

      {creating && (
        <Dialog title="New project" onClose={closeCreate}>
          <EntityForm
            submitLabel="Create project"
            derivedIdLabel="project"
            busy={createBusy}
            error={createError}
            onSubmit={createProject}
            onCancel={closeCreate}
          />
        </Dialog>
      )}

      {loading ? (
        <div className="loading" role="status">
          <div className="loading__spinner" />
          <span className="sr-only">Loading projects…</span>
        </div>
      ) : error ? (
        <div className="explorer__notice">
          <ApiErrorNotice error={error} />
        </div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__message">
            {tagsFilter === ""
              ? "No projects found"
              : `No projects carry “${tagsFilter}”`}
          </div>
        </div>
      ) : (
        <ul className="tree" role="tree">
          {projects.map((project) => {
            const isExpanded = expandedProjects.has(project.projectId);
            const isActive =
              selectedProjectId === project.projectId &&
              selection?.type === "project";
            // Reads embed the suites with their cases and add `testCases` for the
            // cases the project holds directly, so both are children here.
            const suites = project.testSuites ?? [];
            const directCases = project.testCases ?? [];
            const childCount = suites.length + directCases.length;

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
                  {childCount > 0 && (
                    <span className="tree-node__count">{childCount}</span>
                  )}
                </button>

                {isExpanded && childCount > 0 && (
                  <ul role="group">
                    {suites.map((suite) => {
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
                            <span className="tree-node__label">
                              {suite.name}
                            </span>
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
                    {directCases.map((tc) => {
                      const isCaseActive = selection?.id === tc.testCaseId;

                      return (
                        <li key={tc.testCaseId} role="treeitem">
                          <button
                            className={`tree-node tree-node--grandchild ${isCaseActive ? "tree-node--active" : ""}`}
                            onClick={() =>
                              selectCase(tc.testCaseId, project.projectId)
                            }
                            aria-current={isCaseActive ? "true" : undefined}
                          >
                            <span className="tree-node__icon" aria-hidden="true">
                              📄
                            </span>
                            <span className="tree-node__label">{tc.title}</span>
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
    </nav>
  );
}
