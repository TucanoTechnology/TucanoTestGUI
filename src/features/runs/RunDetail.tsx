import { useEffect, useId, useState, type FormEvent } from "react";
import type { TestConfiguration, TestRun } from "../../api/generated/index.js";
import { apiFetch } from "../../api/client.js";
import { readApiError, type ApiErrorInfo } from "../../api/errors.js";
import { useAuth } from "../../app/AuthProvider.js";
import { useProjectContext } from "../../app/ProjectContext.js";
import { Dialog } from "../../app/Dialog.js";
import { ApiErrorNotice } from "../../app/ApiErrorNotice.js";
import { RunForm, type RunFormValues } from "./RunForm.js";
import { buildRunUpdateRequest } from "./runSelection.js";

type Mode = "view" | "edit" | "duplicate" | "delete";

export function RunDetail({
  runId,
  projectId,
}: {
  runId: string;
  projectId?: string;
}) {
  const { client } = useAuth();
  const { setSelection, refreshProjects, announce } = useProjectContext();
  const fieldId = useId();
  const [run, setRun] = useState<TestRun | null>(null);
  const [configurations, setConfigurations] = useState<TestConfiguration[] | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [busy, setBusy] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [actionError, setActionError] = useState<ApiErrorInfo | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [newId, setNewId] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch(() => client.testRuns.getTestRun({ id: runId }))
      .then((document) => {
        if (cancelled) return;
        setRun(document);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(readApiError(err, "Failed to load test run"));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, runId, reloadToken]);

  const startAction = (next: Mode) => {
    setActionError(null);
    setMode(next);
  };

  const cancelAction = () => {
    setActionError(null);
    setMode("view");
  };

  // The stored run already carries the configuration it links, so the project's
  // configurations are only read when the edit form has to offer them.
  const startEdit = async () => {
    if (!run) return;
    setActionError(null);
    setMode("edit");
    setOptionsLoading(true);

    // A run names its home project in its own document, and a rename never
    // moves the run, so the selection's project is only a fallback.
    const homeProjectId = projectId ?? run.projects?.[0]?.projectId;

    try {
      let loaded: TestConfiguration[] = [];
      if (homeProjectId) {
        const configIds = await apiFetch(() =>
          client.projects.listProjectConfigurations({ id: homeProjectId }),
        );
        loaded = await Promise.all(
          configIds.map((configId) =>
            apiFetch(() =>
              client.configurations.getConfiguration({ id: configId }),
            ),
          ),
        );
      }
      setConfigurations(loaded);
    } catch (err: unknown) {
      setActionError(readApiError(err, "Failed to load configurations"));
    } finally {
      setOptionsLoading(false);
    }
  };

  const updateRun = async (values: RunFormValues) => {
    if (!run) return;
    const requestBody = buildRunUpdateRequest(
      run,
      values,
      configurations ?? [],
    );
    if (Object.keys(requestBody).length === 0) {
      cancelAction();
      return;
    }

    setBusy(true);
    setActionError(null);
    try {
      const updated = await apiFetch(() =>
        client.testRuns.updateTestRun({ id: runId, requestBody }),
      );
      setMode("view");
      setReloadToken((token) => token + 1);
      refreshProjects();
      announce(updated.message);
    } catch (err: unknown) {
      setActionError(readApiError(err, "Failed to update test run"));
    } finally {
      setBusy(false);
    }
  };

  const duplicateRun = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newId.trim();

    setBusy(true);
    setActionError(null);
    try {
      const duplicated = await apiFetch(() =>
        client.testRuns.duplicateTestRun({
          id: runId,
          requestBody: trimmed.length > 0 ? { newId: trimmed } : {},
        }),
      );
      setNewId("");
      setMode("view");
      refreshProjects();
      announce(duplicated.message);
      setSelection({ type: "run", id: duplicated.id, projectId });
    } catch (err: unknown) {
      setActionError(readApiError(err, "Failed to duplicate test run"));
    } finally {
      setBusy(false);
    }
  };

  const deleteRun = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const deleted = await apiFetch(() =>
        client.testRuns.deleteTestRun({ id: runId }),
      );
      setMode("view");
      refreshProjects();
      setSelection(null);
      announce(deleted.message);
    } catch (err: unknown) {
      setActionError(readApiError(err, "Failed to delete test run"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="loading" role="status">
        <div className="loading__spinner" />
        <span className="sr-only">Loading test run…</span>
      </div>
    );
  }

  if (error) {
    return <ApiErrorNotice error={error} />;
  }

  if (!run) return null;

  const configuration = run.configurations?.[0];

  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <h2 className="detail-panel__title">
          {run.name ?? run.testRunId ?? runId}
        </h2>
        <p className="detail-panel__subtitle">Run ID: {runId}</p>
      </div>

      <div className="detail-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            void startEdit();
          }}
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
        optionsLoading ? (
          <div className="loading" role="status">
            <div className="loading__spinner" />
            <span className="sr-only">Loading configurations…</span>
          </div>
        ) : configurations === null ? (
          <>
            {actionError && <ApiErrorNotice error={actionError} />}
            <div className="dialog__actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={cancelAction}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <RunForm
            submitLabel="Save changes"
            initialValues={{
              name: run.name ?? "",
              tags: run.tags ?? [],
              configId: configuration?.configId ?? "",
            }}
            configurationOptions={configurations}
            busy={busy}
            error={actionError}
            onSubmit={updateRun}
            onCancel={cancelAction}
          />
        )
      ) : (
        <>
          {run.timestamp && (
            <div className="detail-field">
              <div className="detail-field__label">Timestamp</div>
              <div className="detail-field__value">{run.timestamp}</div>
            </div>
          )}

          {run.tags && run.tags.length > 0 && (
            <div className="detail-field">
              <div className="detail-field__label">Tags</div>
              <div className="tag-list">
                {run.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="detail-field">
            <div className="detail-field__label">Configuration</div>
            <div className="detail-field__value">
              {configuration ? configuration.name : "None"}
            </div>
          </div>

          {run.projects && run.projects.length > 0 && (
            <div className="detail-field">
              <div className="detail-field__label">
                Projects ({run.projects.length})
              </div>
              <ul className="entity-list">
                {run.projects.map((p) => (
                  <li key={p.projectId} className="entity-list__item">
                    <span className="entity-list__name">{p.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {run.testSuites && run.testSuites.length > 0 && (
            <div className="detail-field">
              <div className="detail-field__label">
                Suites ({run.testSuites.length})
              </div>
              <ul className="entity-list">
                {run.testSuites.map((s) => (
                  <li key={s.suiteId} className="entity-list__item">
                    <span className="entity-list__name">{s.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {run.testCases && run.testCases.length > 0 && (
            <div className="detail-field">
              <div className="detail-field__label">
                Test Cases ({run.testCases.length})
              </div>
              <ul className="entity-list">
                {run.testCases.map((testCase) => (
                  <li key={testCase.testCaseId} className="entity-list__item">
                    <span className="entity-list__name">{testCase.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {run.results && run.results.length > 0 && (
            <div className="detail-field">
              <div className="detail-field__label">
                Results ({run.results.length})
              </div>
              <ul className="entity-list">
                {run.results.map((r, i) => (
                  <li key={i} className="entity-list__item">
                    <span className="entity-list__name">{r.testCaseId}</span>
                    <span
                      className={`badge badge-${r.status?.toLowerCase() ?? "untested"}`}
                    >
                      {r.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {mode === "duplicate" && (
        <Dialog title="Duplicate test run" onClose={cancelAction}>
          <form
            className="run-form"
            onSubmit={duplicateRun}
            aria-label="Duplicate test run form"
          >
            {actionError && <ApiErrorNotice error={actionError} />}
            <div className="form-field">
              <label htmlFor={`${fieldId}-new-id`}>New run ID</label>
              <input
                id={`${fieldId}-new-id`}
                value={newId}
                onChange={(event) => setNewId(event.target.value)}
                aria-describedby={`${fieldId}-new-id-hint`}
              />
              <p className="form-field__hint" id={`${fieldId}-new-id-hint`}>
                The copy keeps this run&apos;s name and drops its recorded
                results. Leave blank to derive the copy&apos;s ID from this one.
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
                {busy ? "Duplicating…" : "Duplicate run"}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {mode === "delete" && (
        <Dialog title="Delete test run" onClose={cancelAction}>
          <p className="dialog__body">
            Delete <strong>{run.name ?? runId}</strong> and the results it
            holds? This cannot be undone.
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
              onClick={deleteRun}
              disabled={busy}
            >
              {busy ? "Deleting…" : "Delete run"}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
