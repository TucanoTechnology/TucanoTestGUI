import { useEffect, useState } from "react";
import { apiFetch } from "../api/client.js";
import { readApiError, type ApiErrorInfo } from "../api/errors.js";
import { ApiErrorNotice } from "./ApiErrorNotice.js";
import { useAuth } from "./AuthProvider.js";
import { Dialog } from "./Dialog.js";
import { useProjectContext, type EntityType } from "./ProjectContext.js";
import { CaseForm, type CaseFormValues } from "../features/cases/CaseForm.js";
import { RunForm, type RunFormValues } from "../features/runs/RunForm.js";
import {
  buildRunCreateRequest,
  buildRunSelectionOptions,
  type RunSelectionOptions,
} from "../features/runs/runSelection.js";

interface EntityItem {
  id: string;
  name: string;
  meta?: string;
}

export function EntityList({ entityType }: { entityType: EntityType }) {
  const { client } = useAuth();
  const {
    selectedProjectId,
    selection,
    setSelection,
    projectsVersion,
    refreshProjects,
    announce,
  } = useProjectContext();
  const [items, setItems] = useState<EntityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [creating, setCreating] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<ApiErrorInfo | null>(null);
  const [runOptions, setRunOptions] = useState<RunSelectionOptions | null>(
    null,
  );
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<ApiErrorInfo | null>(null);

  // A case is created inside the project the list is showing; suites are made
  // and filled where a suite is shown.
  const canCreateCase = entityType === "case" && selectedProjectId !== null;

  // A run is created inside the project it covers, and both cases and suites
  // are selected from that project.
  const canCreateRun = entityType === "run" && selectedProjectId !== null;

  const openCreate = () => {
    setCreateError(null);
    if (canCreateRun) {
      setRunOptions(null);
      setOptionsLoading(true);
      setOptionsError(null);
    }
    setCreating(true);
  };

  const closeCreate = () => {
    setCreating(false);
    setCreateError(null);
  };

  const createCase = async (values: CaseFormValues) => {
    if (!selectedProjectId) return;
    setCreateBusy(true);
    setCreateError(null);
    try {
      const created = await apiFetch(() =>
        client.projects.addProjectTestCase({
          id: selectedProjectId,
          requestBody: {
            testCaseId: values.testCaseId,
            title: values.title,
            expectedResult: values.expectedResult,
            ...(values.description ? { description: values.description } : {}),
            ...(values.preconditions
              ? { preconditions: values.preconditions }
              : {}),
            ...(values.priority ? { priority: values.priority } : {}),
            ...(values.severity ? { severity: values.severity } : {}),
            ...(values.tags.length > 0 ? { tags: values.tags } : {}),
          },
        }),
      );
      closeCreate();
      refreshProjects();
      announce(created.message);
      setSelection({
        type: "case",
        id: created.id,
        projectId: selectedProjectId,
      });
    } catch (err: unknown) {
      setCreateError(readApiError(err, "Failed to create test case"));
    } finally {
      setCreateBusy(false);
    }
  };

  const createRun = async (values: RunFormValues) => {
    if (!selectedProjectId || !runOptions) return;
    setCreateBusy(true);
    setCreateError(null);
    try {
      const created = await apiFetch(() =>
        client.projects.addProjectTestRun({
          id: selectedProjectId,
          requestBody: buildRunCreateRequest(values, runOptions),
        }),
      );
      closeCreate();
      refreshProjects();
      announce(created.message);
      setSelection({
        type: "run",
        id: created.id,
        projectId: selectedProjectId,
      });
    } catch (err: unknown) {
      setCreateError(readApiError(err, "Failed to create test run"));
    } finally {
      setCreateBusy(false);
    }
  };

  // The cases and suites a run can cover are only read once the form is asked
  // for, so a plain list of runs costs one request.
  useEffect(() => {
    if (!creating || !canCreateRun || !selectedProjectId) return;
    let cancelled = false;

    const loadOptions = async () => {
      const project = await apiFetch(() =>
        client.projects.getProject({ id: selectedProjectId }),
      );
      const configIds = await apiFetch(() =>
        client.projects.listProjectConfigurations({ id: selectedProjectId }),
      );
      const configurations = await Promise.all(
        configIds.map((configId) =>
          apiFetch(() =>
            client.configurations.getConfiguration({ id: configId }),
          ),
        ),
      );
      return buildRunSelectionOptions(project, configurations);
    };

    loadOptions()
      .then((options) => {
        if (cancelled) return;
        setRunOptions(options);
        setOptionsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setOptionsError(readApiError(err, "Failed to load run options"));
        setOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, creating, canCreateRun, selectedProjectId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchItems = async (): Promise<EntityItem[]> => {
      switch (entityType) {
        case "project": {
          const ids = await apiFetch(() => client.projects.listProjects({}));
          return Promise.all(
            ids.map(async (id) => {
              const p = await apiFetch(() =>
                client.projects.getProject({ id }),
              );
              return { id: p.projectId, name: p.name, meta: p.description };
            }),
          );
        }
        case "suite": {
          if (!selectedProjectId) return [];
          const ids = await apiFetch(() =>
            client.projects.listProjectTestSuites({ id: selectedProjectId }),
          );
          return Promise.all(
            ids.map(async (id) => {
              const s = await apiFetch(() =>
                client.testSuites.getTestSuite({ id }),
              );
              return { id: s.suiteId, name: s.name, meta: s.description };
            }),
          );
        }
        case "case": {
          if (!selectedProjectId) return [];
          // A bare identifier that several parents hold is a 409 on
          // `GET /test_cases/{id}`, and the seeded dataset holds such a case, so
          // the list comes from the project document instead: the cases its
          // suites carry plus the ones it holds itself.
          const project = await apiFetch(() =>
            client.projects.getProject({ id: selectedProjectId }),
          );
          return [
            ...(project.testCases ?? []),
            ...(project.testSuites ?? []).flatMap((s) => s.testCases ?? []),
          ].map((c) => ({
            id: c.testCaseId,
            name: c.title,
            meta: c.priority,
          }));
        }
        case "run": {
          if (!selectedProjectId) return [];
          const ids = await apiFetch(() =>
            client.projects.listProjectTestRuns({ id: selectedProjectId }),
          );
          return Promise.all(
            ids.map(async (id) => {
              const r = await apiFetch(() =>
                client.testRuns.getTestRun({ id }),
              );
              // The listing key is what addresses the run: a run document need
              // not carry a `testRunId`, and a rename never moves the key.
              return { id, name: r.name ?? id, meta: r.timestamp };
            }),
          );
        }
        case "milestone": {
          if (!selectedProjectId) return [];
          const ids = await apiFetch(() =>
            client.projects.listProjectMilestones({ id: selectedProjectId }),
          );
          return Promise.all(
            ids.map(async (id) => {
              const m = await apiFetch(() =>
                client.milestones.getMilestone({ id }),
              );
              return { id: m.milestoneId, name: m.name, meta: m.status };
            }),
          );
        }
        case "configuration": {
          if (!selectedProjectId) return [];
          const ids = await apiFetch(() =>
            client.projects.listProjectConfigurations({
              id: selectedProjectId,
            }),
          );
          return Promise.all(
            ids.map(async (id) => {
              const c = await apiFetch(() =>
                client.configurations.getConfiguration({ id }),
              );
              return {
                id: c.configId,
                name: c.name,
                meta: [c.browser, c.os].filter(Boolean).join(", "),
              };
            }),
          );
        }
        default:
          return [];
      }
    };

    fetchItems()
      .then((data) => {
        if (!cancelled) {
          setItems(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(readApiError(err, `Failed to load ${entityType}s`));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, entityType, selectedProjectId, projectsVersion]);

  if (entityType !== "project" && !selectedProjectId) {
    return (
      <div className="empty-state">
        <p className="empty-state__message">
          Select a project from the explorer to view {entityType}s
        </p>
      </div>
    );
  }

  return (
    <>
      {canCreateCase && (
        <div className="entity-list__toolbar">
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreate}
          >
            New case
          </button>
        </div>
      )}

      {canCreateRun && (
        <div className="entity-list__toolbar">
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreate}
          >
            New run
          </button>
        </div>
      )}

      {creating && canCreateRun && (
        <Dialog title="New run" onClose={closeCreate}>
          {optionsLoading ? (
            <div className="loading" role="status">
              <div className="loading__spinner" />
              <span className="sr-only">Loading run options…</span>
            </div>
          ) : optionsError ? (
            <ApiErrorNotice error={optionsError} />
          ) : runOptions ? (
            <RunForm
              submitLabel="Create run"
              suiteOptions={runOptions.suites}
              caseOptions={runOptions.cases}
              configurationOptions={runOptions.configurations}
              busy={createBusy}
              error={createError}
              onSubmit={createRun}
              onCancel={closeCreate}
            />
          ) : null}
        </Dialog>
      )}

      {creating && canCreateCase && (
        <Dialog title="New case" onClose={closeCreate}>
          <CaseForm
            submitLabel="Create case"
            busy={createBusy}
            error={createError}
            onSubmit={createCase}
            onCancel={closeCreate}
          />
        </Dialog>
      )}

      {loading ? (
        <div className="loading" role="status">
          <div className="loading__spinner" />
          <span className="sr-only">Loading {entityType}s…</span>
        </div>
      ) : error ? (
        <ApiErrorNotice error={error} />
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__message">No {entityType}s found</p>
        </div>
      ) : (
        <ul className="entity-list" aria-label={`${entityType} list`}>
          {items.map((item) => {
            const isActive = selection?.id === item.id;
            return (
              <li key={item.id}>
                <button
                  className={`entity-list__item ${isActive ? "entity-list__item--active" : ""}`}
                  onClick={() =>
                    setSelection({
                      type: entityType,
                      id: item.id,
                      projectId: selectedProjectId ?? undefined,
                    })
                  }
                  aria-current={isActive ? "true" : undefined}
                >
                  <span className="entity-list__name">{item.name}</span>
                  {item.meta && (
                    <span className="entity-list__meta">{item.meta}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
