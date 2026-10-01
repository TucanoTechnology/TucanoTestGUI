import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type {
  DefectLink,
  ImportSummary,
  TestCaseResult,
  TestConfiguration,
  TestRun,
} from "../../api/generated/index.js";
import { apiFetch } from "../../api/client.js";
import { readApiError, type ApiErrorInfo } from "../../api/errors.js";
import { useAuth } from "../../app/AuthProvider.js";
import { useProjectContext } from "../../app/ProjectContext.js";
import { Dialog } from "../../app/Dialog.js";
import { ApiErrorNotice } from "../../app/ApiErrorNotice.js";
import { toJsonKey } from "../../app/keys.js";
import { echoedDocument, echoedResult } from "../../app/echo.js";
import { formatTimestamp } from "../../app/format.js";
import { RunForm, type RunFormValues } from "./RunForm.js";
import { buildRunUpdateRequest } from "./runSelection.js";
import { ResultForm, type DefectLinkValues } from "./ResultForm.js";
import { ImportSection } from "./ImportSection.js";
import { describeImportSummary, type ImportRequest } from "./importResults.js";
import {
  RESULT_STATUSES,
  buildResultRequest,
  buildResultRows,
  formatDuration,
  nextPendingRow,
  type ResultStatus,
  type ResultSubmission,
} from "./results.js";

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
  const [resultCaseId, setResultCaseId] = useState<string | null>(null);
  // #460: the defect links belong to the case behind the result, fetched from
  // the defect route — the run document no longer carries them.
  const [caseDefects, setCaseDefects] = useState<DefectLink[] | null>(null);
  const [defectsError, setDefectsError] = useState<ApiErrorInfo | null>(null);
  // The detail panel shows either the results table or the import form; the
  // run's own fields stay above both.
  const [activeTab, setActiveTab] = useState<"cases" | "import">("cases");
  // The run the document on screen was read with. A reload reads the same run
  // again to pick up what an action changed, and the panel stays on screen
  // while it does, so the state the sections own survives the read. A run that
  // has not been read yet has no document to show and blanks the panel.
  const loadedRunId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    if (loadedRunId.current !== runId) setLoading(true);

    apiFetch(() => client.testRuns.getTestRun({ id: runId }))
      .then((document) => {
        if (cancelled) return;
        setRun(document);
        loadedRunId.current = runId;
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

  const loadDefects = async (caseId: string): Promise<void> => {
    setCaseDefects(null);
    setDefectsError(null);
    try {
      const listed = await apiFetch(() =>
        client.testRuns.listResultDefects({ id: runId, caseId }),
      );
      setCaseDefects(listed.defects);
    } catch (err: unknown) {
      setDefectsError(readApiError(err, "Failed to load the defect links"));
    }
  };

  useEffect(() => {
    if (resultCaseId === null) return;
    let cancelled = false;
    setCaseDefects(null);
    setDefectsError(null);
    apiFetch(() =>
      client.testRuns.listResultDefects({ id: runId, caseId: resultCaseId }),
    )
      .then((listed) => {
        if (!cancelled) setCaseDefects(listed.defects);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDefectsError(readApiError(err, "Failed to load the defect links"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client, runId, resultCaseId]);

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
      // The stored run rides back in the echo (#459) — a run document is
      // fully self-describing, so painting it skips the re-read entirely.
      const echoed = echoedDocument<TestRun>(updated);
      if (echoed) {
        setRun(echoed);
      } else {
        setReloadToken((token) => token + 1);
      }
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
          requestBody: trimmed.length > 0 ? { newId: toJsonKey(trimmed) } : {},
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
  const rows = buildResultRows(run);
  const activeRow =
    resultCaseId === null
      ? null
      : (rows.find((row) => row.testCaseId === resultCaseId) ?? null);

  const startResult = (caseId: string) => {
    setActionError(null);
    setResultCaseId(caseId);
  };

  const cancelResult = () => {
    setActionError(null);
    setResultCaseId(null);
  };

  // Painting an echoed result into the run state, in place: #459 means the
  // record route answers with the stored result, so the table can update
  // without reading the (much larger) run document back.
  const applyStoredResult = (stored: TestCaseResult): void => {
    setRun((previous) =>
      previous
        ? {
            ...previous,
            results: [
              ...(previous.results ?? []).filter(
                (result) => result.testCaseId !== stored.testCaseId,
              ),
              stored,
            ],
          }
        : previous,
    );
  };

  const recordResult = async (values: ResultSubmission, advance = false) => {
    if (!activeRow) return;
    const requestBody = buildResultRequest(
      activeRow.testCaseId,
      values,
      activeRow.result,
    );

    setBusy(true);
    setActionError(null);
    try {
      const recorded = await apiFetch(() =>
        client.testRuns.recordTestRunResult({ id: runId, requestBody }),
      );
      const stored = echoedResult(recorded);
      if (stored) {
        applyStoredResult(stored);
      } else {
        setReloadToken((token) => token + 1);
      }
      if (advance && stored) {
        // The run state has not re-rendered yet, so the next row is computed
        // from what the table would show: the current listing with this
        // case's freshly echoed result painted in (#184).
        const index = rows.findIndex(
          (row) => row.testCaseId === activeRow.testCaseId,
        );
        const painted = rows.map((row) =>
          row.testCaseId === stored.testCaseId
            ? { ...row, result: stored, status: stored.status }
            : row,
        );
        const next = nextPendingRow(painted, index);
        if (next) {
          setResultCaseId(next.testCaseId);
          announce(
            `Recorded ${stored.status} for ${activeRow.testCaseId}. Now recording ${next.testCaseId}${next.title ? ` — ${next.title}` : ""}.`,
          );
          return;
        }
        announce(
          `Recorded ${stored.status} for ${activeRow.testCaseId}. That was the last case awaiting execution.`,
        );
        setResultCaseId(null);
        return;
      }
      setResultCaseId(null);
      announce(recorded.message);
    } catch (err: unknown) {
      setActionError(readApiError(err, "Failed to record test result"));
    } finally {
      setBusy(false);
    }
  };

  // An inline status change from the results table keeps everything the
  // stored result holds beyond the status — its comment, duration, defects and
  // timestamp travel back with the request, because the record route replaces
  // the whole result.
  const setRowStatus = async (
    testCaseId: string,
    status: ResultStatus,
  ): Promise<void> => {
    const row = buildResultRows(run).find(
      (r) => r.testCaseId === testCaseId,
    );
    setBusy(true);
    setActionError(null);
    try {
      const recorded = await apiFetch(() =>
        client.testRuns.recordTestRunResult({
          id: runId,
          requestBody: buildResultRequest(
            testCaseId,
            {
              status,
              notes: row?.result?.notes ?? "",
              durationMs: row?.result?.durationMs,
            },
            row?.result,
          ),
        }),
      );
      const stored = echoedResult(recorded);
      if (stored) {
        applyStoredResult(stored);
      } else {
        setReloadToken((token) => token + 1);
      }
      announce(recorded.message);
    } catch (err: unknown) {
      setActionError(readApiError(err, "Failed to record test result"));
    } finally {
      setBusy(false);
    }
  };

  // A link or an unlink writes the case document, never the run (#460), so
  // the defect list — not the run — is what comes back changed., so the run is read
  // again rather than the table being guessed at locally.
  const linkDefect = async (values: DefectLinkValues): Promise<boolean> => {
    if (!activeRow) return false;
    setBusy(true);
    setActionError(null);
    try {
      const linked = await apiFetch(() =>
        client.testRuns.linkResultDefect({
          id: runId,
          caseId: activeRow.testCaseId,
          requestBody: values,
        }),
      );
      // The link landed on the case document; only the case's list changes.
      await loadDefects(activeRow.testCaseId);
      announce(linked.message);
      return true;
    } catch (err: unknown) {
      setActionError(readApiError(err, "Failed to link defect"));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const unlinkDefect = async (linkId: string): Promise<boolean> => {
    if (!activeRow) return false;
    setBusy(true);
    setActionError(null);
    try {
      const unlinked = await apiFetch(() =>
        client.testRuns.unlinkResultDefect({
          id: runId,
          caseId: activeRow.testCaseId,
          linkId,
        }),
      );
      await loadDefects(activeRow.testCaseId);
      announce(unlinked.message);
      return true;
    } catch (err: unknown) {
      setActionError(readApiError(err, "Failed to unlink defect"));
      return false;
    } finally {
      setBusy(false);
    }
  };

  // An import rewrites the results the run records, so the run is read again
  // rather than the table being guessed at locally. The request the section
  // built carries the format, which is the route it goes to.
  const importResults = async (
    request: ImportRequest,
  ): Promise<ImportSummary> => {
    const summary = await apiFetch(() =>
      request.format === "json"
        ? client.testRuns.importJsonResults({
            id: runId,
            requestBody: request.body,
          })
        : client.testRuns.importJUnitResults({
            id: runId,
            requestBody: request.body,
          }),
    );
    setReloadToken((token) => token + 1);
    refreshProjects();
    announce(describeImportSummary(summary));
    return summary;
  };

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
          <div className="case-detail__tabs" role="tablist" aria-label="Run sections">
            <button
              type="button"
              role="tab"
              id={`run-tab-cases`}
              aria-selected={activeTab === "cases"}
              aria-controls="run-panel-cases"
              tabIndex={activeTab === "cases" ? 0 : -1}
              className={`tab ${activeTab === "cases" ? "tab--active" : ""}`}
              onClick={() => setActiveTab("cases")}
            >
              Cases
            </button>
            <button
              type="button"
              role="tab"
              id={`run-tab-import`}
              aria-selected={activeTab === "import"}
              aria-controls="run-panel-import"
              tabIndex={activeTab === "import" ? 0 : -1}
              className={`tab ${activeTab === "import" ? "tab--active" : ""}`}
              onClick={() => setActiveTab("import")}
            >
              Import
            </button>
          </div>

          {activeTab === "cases" && (
            <div role="tabpanel" id="run-panel-cases" aria-labelledby="run-tab-cases">
              {run.timestamp && (
                <div className="detail-field">
                  <div className="detail-field__label">Timestamp</div>
                  <div className="detail-field__value">
                    {formatTimestamp(run.timestamp)}
                  </div>
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

              {rows.length > 0 && (
                <div className="detail-field">
                  <div className="detail-field__label">
                    Results ({rows.length})
                  </div>
                  <table className="data-table">
                    <caption className="sr-only">
                      Results by test case. Choose a status to record it for
                      the case; open a result to edit its comment, duration and
                      defects.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Case ID</th>
                        <th scope="col">Title</th>
                        <th scope="col">Status</th>
                        <th scope="col">Comment</th>
                        <th scope="col">Duration</th>
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        return (
                          <tr key={row.testCaseId}>
                            <td className="data-table__id">{row.testCaseId}</td>
                            <td>{row.title ?? "—"}</td>
                            <td>
                              {
                                !(RESULT_STATUSES as readonly string[]).includes(
                                  row.status,
                                ) ? (
                                  // A status outside the recorded five — storage
                                  // a hand-edit reaches — is shown as it stands,
                                  // and only the dialog can change it.
                                  <span
                                    className={`status-badge status-badge--${row.status.toLowerCase()}`}
                                  >
                                    {row.status}
                                  </span>
                              ) : (
                                <select
                                  className="status-select"
                                  aria-label={`Status for ${row.testCaseId}`}
                                  value={row.status}
                                  disabled={busy}
                                  onChange={(event) => {
                                    void setRowStatus(
                                      row.testCaseId,
                                      event.target.value as ResultStatus,
                                    );
                                  }}
                                >
                                  {RESULT_STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td>{row.result?.notes ?? "—"}</td>
                            <td>{formatDuration(row.result?.durationMs)}</td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => startResult(row.testCaseId)}
                              >
                                {row.result ? "Edit result" : "Record result"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "import" && (
            <div role="tabpanel" id="run-panel-import" aria-labelledby="run-tab-import">
              <ImportSection busy={busy} onImport={importResults} />
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
                A new ID is one name ending in .json, such as
                nightly-copy.json; the suffix is added for you if you leave it
                off.
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

      {activeRow && (
        <Dialog
          title={activeRow.result ? "Edit result" : "Record result"}
          onClose={cancelResult}
        >
          <ResultForm
            key={activeRow.testCaseId}
            row={activeRow}
            defects={caseDefects}
            defectsError={defectsError}
            busy={busy}
            error={actionError}
            onSubmit={recordResult}
            onLinkDefect={linkDefect}
            onUnlinkDefect={unlinkDefect}
            onCancel={cancelResult}
          />
        </Dialog>
      )}
    </div>
  );
}
