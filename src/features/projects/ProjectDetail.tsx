import { useEffect, useId, useState, type FormEvent } from "react";
import type { Project, ProjectUpdateRequest } from "../../api/generated/index.js";
import { apiFetch } from "../../api/client.js";
import { readApiError, type ApiErrorInfo } from "../../api/errors.js";
import { useAuth } from "../../app/AuthProvider.js";
import { useProjectContext } from "../../app/ProjectContext.js";
import { Dialog } from "../../app/Dialog.js";
import { ApiErrorNotice } from "../../app/ApiErrorNotice.js";
import { ProjectForm, type ProjectFormValues } from "./ProjectForm.js";

type Mode = "view" | "edit" | "duplicate" | "delete";

function buildUpdateRequest(
  project: Project,
  values: ProjectFormValues,
): ProjectUpdateRequest {
  const requestBody: ProjectUpdateRequest = {};
  const currentTags = project.tags ?? [];

  if (values.name !== project.name) {
    requestBody.name = values.name;
  }
  if (values.description !== (project.description ?? "")) {
    requestBody.description = values.description;
  }
  if (
    values.tags.length !== currentTags.length ||
    values.tags.some((tag, index) => tag !== currentTags[index])
  ) {
    requestBody.tags = values.tags;
  }

  return requestBody;
}

export function ProjectDetail({ projectId }: { projectId: string }) {
  const { client } = useAuth();
  const { setSelection, setSelectedProjectId, refreshProjects, announce } =
    useProjectContext();
  const fieldId = useId();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ApiErrorInfo | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch(() => client.projects.getProject({ id: projectId }))
      .then((data) => {
        if (!cancelled) {
          setProject(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(readApiError(err, "Failed to load project"));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client, projectId, reloadToken]);

  const startAction = (next: Mode) => {
    setActionError(null);
    setMode(next);
  };

  const cancelAction = () => {
    setActionError(null);
    setMode("view");
  };

  const updateProject = async (values: ProjectFormValues) => {
    if (!project) return;
    const requestBody = buildUpdateRequest(project, values);
    if (Object.keys(requestBody).length === 0) {
      setMode("view");
      return;
    }

    setBusy(true);
    setActionError(null);
    try {
      const updated = await apiFetch(() =>
        client.projects.updateProject({ id: projectId, requestBody }),
      );
      setMode("view");
      setReloadToken((token) => token + 1);
      refreshProjects();
      announce(updated.message);
    } catch (err: unknown) {
      setActionError(readApiError(err, "Failed to update project"));
    } finally {
      setBusy(false);
    }
  };

  const duplicateProject = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setActionError(null);
    try {
      const trimmedId = newId.trim();
      const trimmedName = newName.trim();
      const duplicated = await apiFetch(() =>
        client.projects.duplicateProject({
          id: projectId,
          requestBody: {
            ...(trimmedId ? { newId: trimmedId } : {}),
            ...(trimmedName ? { newName: trimmedName } : {}),
          },
        }),
      );
      setMode("view");
      setNewId("");
      setNewName("");
      refreshProjects();
      announce(duplicated.message);
      setSelectedProjectId(duplicated.id);
      setSelection({ type: "project", id: duplicated.id });
    } catch (err: unknown) {
      setActionError(readApiError(err, "Failed to duplicate project"));
    } finally {
      setBusy(false);
    }
  };

  const deleteProject = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const deleted = await apiFetch(() =>
        client.projects.deleteProject({ id: projectId }),
      );
      setMode("view");
      refreshProjects();
      setSelectedProjectId(null);
      setSelection(null);
      announce(deleted.message);
    } catch (err: unknown) {
      setActionError(readApiError(err, "Failed to delete project"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="loading" role="status">
        <div className="loading__spinner" />
        <span className="sr-only">Loading project…</span>
      </div>
    );
  }

  if (error) {
    return <ApiErrorNotice error={error} />;
  }

  if (!project) return null;

  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <h2 className="detail-panel__title">{project.name}</h2>
        <p className="detail-panel__subtitle">
          Project ID: {project.projectId}
        </p>
      </div>

      <div className="detail-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => startAction("edit")}
        >
          Edit
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => startAction("duplicate")}
        >
          Duplicate
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => startAction("delete")}
        >
          Delete
        </button>
      </div>

      {mode === "edit" ? (
        <ProjectForm
          submitLabel="Save changes"
          initialValues={{
            name: project.name,
            description: project.description ?? "",
            tags: project.tags ?? [],
          }}
          busy={busy}
          error={actionError}
          onSubmit={updateProject}
          onCancel={cancelAction}
        />
      ) : (
        <>
          {project.description && (
            <div className="detail-field">
              <div className="detail-field__label">Description</div>
              <div className="detail-field__value">{project.description}</div>
            </div>
          )}

          {project.tags && project.tags.length > 0 && (
            <div className="detail-field">
              <div className="detail-field__label">Tags</div>
              <div className="tag-list">
                {project.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {project.testSuites && project.testSuites.length > 0 && (
            <div className="detail-field">
              <div className="detail-field__label">
                Test Suites ({project.testSuites.length})
              </div>
              <ul className="entity-list">
                {project.testSuites.map((suite) => (
                  <li key={suite.suiteId}>
                    <button
                      className="entity-list__item"
                      onClick={() =>
                        setSelection({
                          type: "suite",
                          id: suite.suiteId,
                          projectId,
                        })
                      }
                    >
                      <span className="entity-list__name">{suite.name}</span>
                      {suite.testCases && (
                        <span className="entity-list__meta">
                          {suite.testCases.length} cases
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {project.testCases && project.testCases.length > 0 && (
            <div className="detail-field">
              <div className="detail-field__label">
                Test Cases ({project.testCases.length})
              </div>
              <ul className="entity-list">
                {project.testCases.map((testCase) => (
                  <li key={testCase.testCaseId}>
                    <button
                      className="entity-list__item"
                      onClick={() =>
                        setSelection({
                          type: "case",
                          id: testCase.testCaseId,
                          projectId,
                        })
                      }
                    >
                      <span className="entity-list__name">
                        {testCase.title}
                      </span>
                      {testCase.priority && (
                        <span className="entity-list__meta">
                          {testCase.priority}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {mode === "duplicate" && (
        <Dialog title="Duplicate project" onClose={cancelAction}>
          <form
            className="project-form"
            onSubmit={duplicateProject}
            aria-label="Duplicate project form"
          >
            {actionError && <ApiErrorNotice error={actionError} />}

            <div className="form-field">
              <label htmlFor={`${fieldId}-new-id`}>New ID (optional)</label>
              <input
                id={`${fieldId}-new-id`}
                type="text"
                value={newId}
                onChange={(event) => setNewId(event.target.value)}
                aria-describedby={`${fieldId}-new-id-hint`}
              />
              <p className="form-field__hint" id={`${fieldId}-new-id-hint`}>
                Leave blank to derive the copy&apos;s ID from the source.
              </p>
            </div>

            <div className="form-field">
              <label htmlFor={`${fieldId}-new-name`}>New name (optional)</label>
              <input
                id={`${fieldId}-new-name`}
                type="text"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                aria-describedby={`${fieldId}-new-name-hint`}
              />
              <p className="form-field__hint" id={`${fieldId}-new-name-hint`}>
                Leave blank to keep the source name.
              </p>
            </div>

            <div className="dialog__actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={cancelAction}
                disabled={busy}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Duplicating…" : "Duplicate project"}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {mode === "delete" && (
        <Dialog title="Delete project" onClose={cancelAction}>
          <p className="dialog__body">
            Delete “{project.name}” ({project.projectId})? Every test suite and
            case it holds goes with it. This cannot be undone.
          </p>

          {actionError && <ApiErrorNotice error={actionError} />}

          <div className="dialog__actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={cancelAction}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={deleteProject}
              disabled={busy}
            >
              {busy ? "Deleting…" : "Delete project"}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
