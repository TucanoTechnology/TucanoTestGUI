import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useId } from "react";
import type {
  CaseHistoryEntry,
  Project,
  TestCase,
  TestCaseUpdateRequest,
  TestStep,
} from "../../api/generated/index.js";
import { apiFetch } from "../../api/client.js";
import { readApiError, type ApiErrorInfo } from "../../api/errors.js";
import { useAuth } from "../../app/AuthProvider.js";
import { useProjectContext } from "../../app/ProjectContext.js";
import { Dialog } from "../../app/Dialog.js";
import { ApiErrorNotice } from "../../app/ApiErrorNotice.js";
import { formatTimestamp } from "../../app/format.js";
import { parseTags } from "../../app/tags.js";
import {
  CASE_PRIORITIES,
  CASE_SEVERITIES,
  type CasePriority,
  type CaseSeverity,
} from "./CaseForm.js";
import { StepsEditor } from "./StepsEditor.js";
import { AttachmentSection } from "./AttachmentSection.js";
import { echoedDocument } from "../../app/echo.js";
import { EmptyState, ErrorState, LoadingSkeleton } from "../../components/StateViews.js";

const TABS = ["Details", "Steps", "Attachments", "History"] as const;
type TabName = (typeof TABS)[number];

/** Where the case lives, so the header can name its parent. */
interface CaseLocation {
  testCase: TestCase;
  parentPath: string;
}

/**
 * A case identifier is unique inside its parent, not deployment-wide, so
 * `GET /test_cases/{id}` answers `409` when several parents hold the same case
 * (the seeded `TC-LOGIN-1` sits in two projects). A project document embeds
 * every case its suites carry plus the ones it owns itself, so it resolves the
 * case without the ambiguity — and names the parent it was found under.
 */
function findCaseInProject(
  project: Project,
  caseId: string,
): CaseLocation | undefined {
  const direct = (project.testCases ?? []).find(
    (testCase) => testCase.testCaseId === caseId,
  );
  if (direct) return { testCase: direct, parentPath: "project root" };

  for (const suite of project.testSuites ?? []) {
    const inSuite = (suite.testCases ?? []).find(
      (testCase) => testCase.testCaseId === caseId,
    );
    if (inSuite) return { testCase: inSuite, parentPath: suite.name };
  }

  return undefined;
}

export function CaseDetail({
  caseId,
  projectId,
}: {
  caseId: string;
  projectId?: string;
}) {
  const { client } = useAuth();
  const { setSelection, refreshProjects, announce } = useProjectContext();
  const fieldId = useId();
  const [snapshot, setSnapshot] = useState<{
    key: string;
    location: CaseLocation | null;
  } | null>(null);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [mode, setMode] = useState<"view" | "duplicate" | "delete">("view");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ApiErrorInfo | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [newId, setNewId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [activeTab, setActiveTab] = useState<TabName>("Details");

  // The loaded case belongs to the target it was read for: a selection change
  // shows the skeleton rather than the previous case, while a re-fetch after a
  // mutation leaves the case on screen until the fresh one lands.
  const target = `${projectId ?? ""}\u0000${caseId}`;
  const location = snapshot?.key === target ? snapshot.location : null;
  const testCase = location?.testCase ?? null;
  const loading = snapshot?.key !== target;

  useEffect(() => {
    let cancelled = false;
    setError(null);

    const request = projectId
      ? apiFetch(() => client.projects.getProject({ id: projectId })).then(
          (project) => findCaseInProject(project, caseId),
        )
      : apiFetch(() => client.testCases.getTestCase({ id: caseId })).then(
          (resolved) =>
            resolved
              ? { testCase: resolved, parentPath: "—" }
              : undefined,
        );

    request
      .then((found) => {
        if (cancelled) return;
        setSnapshot({ key: target, location: found ?? null });
        if (!found) {
          setError({
            code: null,
            message: `Test case ${caseId} is not part of project ${projectId}`,
          });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSnapshot({ key: target, location: null });
        setError(readApiError(err, "Failed to load test case"));
      });

    return () => {
      cancelled = true;
    };
  }, [client, caseId, projectId, target, reloadToken]);

  useEffect(() => {
    setActiveTab("Details");
  }, [caseId, projectId]);

  /**
   * Only the changed field travels: the API replaces every field a request
   * carries, so a value resent unchanged would still spend a revision
   * snapshot on the case.
   */
  const saveField = useCallback(
    async (field: TestCaseUpdateRequest) => {
      if (Object.keys(field).length === 0) return;
      setBusy(true);
      setActionError(null);
      try {
        const updated = await apiFetch(() =>
          client.testCases.updateTestCase({ id: caseId, requestBody: field }),
        );
        // The stored case — new `version`, new `lastModified` and all — rides
        // back in the echo (#459); painting it skips this panel's re-read.
        const echoed = echoedDocument<TestCase>(updated);
        if (echoed) {
          setSnapshot((previous) =>
            previous && previous.location
              ? { ...previous, location: { ...previous.location, testCase: echoed } }
              : previous,
          );
        } else {
          setReloadToken((token) => token + 1);
        }
        refreshProjects();
        announce(updated.message);
      } catch (err: unknown) {
        setActionError(readApiError(err, "Failed to save changes"));
      } finally {
        setBusy(false);
      }
    },
    [announce, caseId, client, refreshProjects],
  );

  const saveTitle = (event: { currentTarget: HTMLElement }) => {
    const next = (event.currentTarget.textContent ?? "").trim();
    if (!testCase || next.length === 0 || next === testCase.title) return;
    void saveField({ title: next });
  };

  const saveSteps = async (steps: TestStep[]): Promise<boolean> => {
    setBusy(true);
    setActionError(null);
    try {
      const updated = await apiFetch(() =>
        client.testCases.updateTestCase({ id: caseId, requestBody: { steps } }),
      );
      const echoed = echoedDocument<TestCase>(updated);
      if (echoed && location) {
        setSnapshot({ key: target, location: { ...location, testCase: echoed } });
      } else {
        setReloadToken((token) => token + 1);
      }
      announce(updated.message);
      return true;
    } catch (err: unknown) {
      setActionError(readApiError(err, "Failed to save steps"));
      return false;
    } finally {
      setBusy(false);
    }
  };

  /**
   * Every attachment mutation re-reads the case: an upload is stored under a
   * name only the API knows, and a delete has to drop its row. It shares `busy`
   * with the step actions because a steps `PUT` sends the whole array — one
   * built from a document read before an upload would drop that file.
   */
  const mutateAttachments = async (
    request: () => Promise<{ message: string }>,
  ): Promise<void> => {
    setBusy(true);
    try {
      const response = await apiFetch(request);
      setReloadToken((token) => token + 1);
      refreshProjects();
      announce(response.message);
    } finally {
      setBusy(false);
    }
  };

  const uploadCaseAttachment = (file: File) =>
    mutateAttachments(() =>
      client.testCases.uploadTestCaseAttachment({
        id: caseId,
        formData: { file },
      }),
    );

  const deleteCaseAttachment = (filename: string) =>
    mutateAttachments(() =>
      client.testCases.deleteTestCaseAttachment({ id: caseId, filename }),
    );

  const uploadStepAttachment = (stepIndex: number, file: File) =>
    mutateAttachments(() =>
      client.testCases.uploadStepAttachment({
        id: caseId,
        stepIndex,
        formData: { file },
      }),
    );

  const deleteStepAttachment = (stepIndex: number, filename: string) =>
    mutateAttachments(() =>
      client.testCases.deleteStepAttachment({
        id: caseId,
        stepIndex,
        filename,
      }),
    );

  const duplicateCase = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setActionError(null);
    try {
      const trimmedId = newId.trim();
      const trimmedTitle = newTitle.trim();
      const duplicated = await apiFetch(() =>
        client.testCases.duplicateTestCase({
          id: caseId,
          requestBody: {
            ...(trimmedId ? { newId: trimmedId } : {}),
            ...(trimmedTitle ? { newTitle: trimmedTitle } : {}),
          },
        }),
      );
      setMode("view");
      setNewId("");
      setNewTitle("");
      refreshProjects();
      announce(duplicated.message);
      setSelection({ type: "case", id: duplicated.id, projectId });
    } catch (err: unknown) {
      setActionError(readApiError(err, "Failed to duplicate test case"));
    } finally {
      setBusy(false);
    }
  };

  const deleteCase = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const deleted = await apiFetch(() =>
        client.testCases.deleteTestCase({ id: caseId }),
      );
      setMode("view");
      refreshProjects();
      setSelection(null);
      announce(deleted.message);
    } catch (err: unknown) {
      setActionError(readApiError(err, "Failed to delete test case"));
    } finally {
      setBusy(false);
    }
  };

  const onTabKeyDown = (event: KeyboardEvent, index: number) => {
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = TABS.length - 1;
    if (next !== null) {
      event.preventDefault();
      setActiveTab(TABS[next]!);
      document.getElementById(`case-detail-tab-${TABS[next]}`)?.focus();
    }
  };

  if (loading) {
    return <LoadingSkeleton rows={4} columns={1} />;
  }

  if (error) {
    return (
      <ErrorState
        code={error.code}
        message={error.message}
        onRetry={() => setReloadToken((token) => token + 1)}
      />
    );
  }

  if (!testCase || !location) return null;

  const tagValue = (testCase.tags ?? []).join(", ");

  return (
    <div className="case-detail">
      <div className="case-detail__header">
        <div className="case-detail__id-row">
          <span className="case-detail__id">{testCase.testCaseId}</span>
          <span className="case-detail__parent">{location.parentPath}</span>
        </div>
        <h2
          className="case-detail__title"
          contentEditable
          suppressContentEditableWarning
          onBlur={saveTitle}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        >
          {testCase.title}
        </h2>
        <div className="detail-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setActionError(null);
              setMode("duplicate");
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              setActionError(null);
              setMode("delete");
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {actionError && (
        <div className="case-detail__error">
          <ApiErrorNotice error={actionError} />
        </div>
      )}

      <div className="case-detail__tabs" role="tablist" aria-label="Test case sections">
        {TABS.map((tab, index) => (
          <button
            key={tab}
            id={`case-detail-tab-${tab}`}
            role="tab"
            type="button"
            tabIndex={activeTab === tab ? 0 : -1}
            aria-selected={activeTab === tab}
            aria-controls={`case-detail-panel-${tab}`}
            className={`tab ${activeTab === tab ? "tab--active" : ""}`}
            onClick={() => setActiveTab(tab)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div
        className="case-detail__content"
        role="tabpanel"
        id={`case-detail-panel-${activeTab}`}
        aria-labelledby={`case-detail-tab-${activeTab}`}
        tabIndex={0}
      >
        {activeTab === "Details" && (
          <div className="case-detail__grid">
            <label className="case-detail__field">
              Priority
              <select
                value={testCase.priority ?? ""}
                disabled={busy}
                onChange={(event) =>
                  void saveField({
                    priority:
                      (event.target.value as CasePriority) || undefined,
                  })
                }
              >
                <option value="">Unset</option>
                {CASE_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>
            <label className="case-detail__field">
              Severity
              <select
                value={testCase.severity ?? ""}
                disabled={busy}
                onChange={(event) =>
                  void saveField({
                    severity:
                      (event.target.value as CaseSeverity) || undefined,
                  })
                }
              >
                <option value="">Unset</option>
                {CASE_SEVERITIES.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </label>
            <label className="case-detail__field case-detail__field--wide">
              Tags (comma-separated)
              <input
                type="text"
                defaultValue={tagValue}
                disabled={busy}
                key={`tags-${caseId}-${tagValue}`}
                onBlur={(event) => {
                  const tags = parseTags(event.target.value);
                  const current = testCase.tags ?? [];
                  const changed =
                    tags.length !== current.length ||
                    tags.some((tag, index) => tag !== current[index]);
                  if (changed) void saveField({ tags });
                }}
              />
              <span className="case-detail__chips">
                {(testCase.tags ?? []).map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </span>
            </label>
            <label className="case-detail__field case-detail__field--wide">
              Precondition
              <textarea
                defaultValue={testCase.preconditions ?? ""}
                disabled={busy}
                key={`pre-${caseId}-${testCase.preconditions ?? ""}`}
                onBlur={(event) => {
                  const next = event.target.value;
                  if (next !== (testCase.preconditions ?? "")) {
                    void saveField({ preconditions: next });
                  }
                }}
              />
            </label>
            <label className="case-detail__field case-detail__field--wide">
              Description
              <textarea
                defaultValue={testCase.description ?? ""}
                disabled={busy}
                key={`desc-${caseId}-${testCase.description ?? ""}`}
                onBlur={(event) => {
                  const next = event.target.value;
                  if (next !== (testCase.description ?? "")) {
                    void saveField({ description: next });
                  }
                }}
              />
            </label>
            {/* The case's own defect links (#460): written through the run
                result routes, stored and read with the case. */}
            <div className="case-detail__field case-detail__field--wide">
              <span>Defects ({(testCase.defectLinks ?? []).length})</span>
              {(testCase.defectLinks ?? []).length > 0 ? (
                <ul className="entity-list">
                  {(testCase.defectLinks ?? []).map((defect) => (
                    <li key={defect.linkId} className="entity-list__item">
                      <span className="entity-list__name">
                        {defect.defectId}
                      </span>
                      <span className="entity-list__meta">
                        {defect.trackerType}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="form-field__hint">
                  No defects are linked to this case. Links are made from a
                  run&apos;s result.
                </p>
              )}
            </div>
            <label className="case-detail__field case-detail__field--wide">
              Expected Result
              <textarea
                defaultValue={testCase.expectedResult ?? ""}
                disabled={busy}
                key={`exp-${caseId}-${testCase.expectedResult ?? ""}`}
                onBlur={(event) => {
                  const next = event.target.value;
                  if (next !== (testCase.expectedResult ?? "")) {
                    void saveField({ expectedResult: next });
                  }
                }}
              />
            </label>
          </div>
        )}

        {activeTab === "Steps" && (
          <StepsEditor
            steps={testCase.steps ?? []}
            busy={busy}
            error={actionError}
            onSave={saveSteps}
            onDismissError={() => setActionError(null)}
            renderStepAttachments={(step, index) => (
              <AttachmentSection
                scope={`step ${index + 1}`}
                attachments={step.attachments ?? []}
                busy={busy}
                onUpload={(file) => uploadStepAttachment(index, file)}
                onDelete={(filename) => deleteStepAttachment(index, filename)}
              />
            )}
          />
        )}

        {activeTab === "Attachments" && (
          <AttachmentSection
            scope="this case"
            attachments={testCase.attachments ?? []}
            busy={busy}
            onUpload={uploadCaseAttachment}
            onDelete={deleteCaseAttachment}
            onDownload={(filename) =>
              apiFetch(() =>
                client.testCases.downloadTestCaseAttachment({
                  id: caseId,
                  filename,
                }),
              )
            }
          />
        )}

        {activeTab === "History" && <HistoryTab caseId={caseId} />}
      </div>

      {mode === "duplicate" && (
        <Dialog title="Duplicate case" onClose={() => setMode("view")}>
          <form
            className="case-form"
            onSubmit={duplicateCase}
            aria-label="Duplicate case form"
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
              <label htmlFor={`${fieldId}-new-title`}>
                New title (optional)
              </label>
              <input
                id={`${fieldId}-new-title`}
                type="text"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                aria-describedby={`${fieldId}-new-title-hint`}
              />
              <p className="form-field__hint" id={`${fieldId}-new-title-hint`}>
                Leave blank to keep the source title.
              </p>
            </div>

            <div className="dialog__actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setMode("view")}
                disabled={busy}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Duplicating…" : "Duplicate case"}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {mode === "delete" && (
        <Dialog title="Delete case" onClose={() => setMode("view")}>
          <p className="dialog__body">
            Delete “{testCase.title}” ({testCase.testCaseId})? Every test suite
            that holds it loses it, and the case is gone from the project. This
            cannot be undone.
          </p>

          {actionError && <ApiErrorNotice error={actionError} />}

          <div className="dialog__actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setMode("view")}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => void deleteCase()}
              disabled={busy}
            >
              {busy ? "Deleting…" : "Delete case"}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

/**
 * The case's recorded revisions. Snapshots only advance on qualifying updates
 * (`title`, `steps`, `preconditions`, `expectedResult`), so the list is the
 * API's, never a count of saves.
 */
function HistoryTab({ caseId }: { caseId: string }) {
  const { client } = useAuth();
  const [entries, setEntries] = useState<CaseHistoryEntry[] | null>(null);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [snapshot, setSnapshot] = useState<TestCase | null>(null);
  const [snapshotError, setSnapshotError] = useState<ApiErrorInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setEntries(null);

    apiFetch(() => client.testCases.listTestCaseHistory({ id: caseId }))
      .then((loaded) => {
        if (!cancelled) setEntries(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(readApiError(err, "Failed to load case history"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, caseId]);

  const viewVersion = async (version: number) => {
    setSnapshotError(null);
    try {
      setSnapshot(await apiFetch(() => client.testCases.getTestCaseVersion({ id: caseId, version })));
    } catch (err: unknown) {
      setSnapshotError(readApiError(err, "Failed to read the revision"));
    }
  };

  if (error) {
    return (
      <ErrorState
        code={error.code}
        message={error.message}
        onRetry={() => {
          setEntries(null);
          setError(null);
        }}
      />
    );
  }

  if (entries === null) {
    return <LoadingSkeleton rows={3} columns={1} />;
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon="🕘"
        message="No revisions yet — they arrive with the first qualifying update."
      />
    );
  }

  return (
    <>
      <ul className="history-list">
        {entries.map((entry) => (
          <li key={entry.version} className="history-list__row">
            <span className="history-list__version">v{entry.version}</span>
            <span className="history-list__when">
              {formatTimestamp(entry.lastModified)}
            </span>
            <span className="history-list__fields">
              {entry.changedFields.join(", ")}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void viewVersion(entry.version)}
            >
              View
            </button>
          </li>
        ))}
      </ul>
      {snapshotError && <ApiErrorNotice error={snapshotError} />}
      {snapshot && (
        <Dialog
          title={`Revision v${snapshot.version} — ${snapshot.title}`}
          onClose={() => setSnapshot(null)}
        >
          <div className="history-snapshot">
            {snapshot.description && (
              <p className="history-snapshot__description">
                {snapshot.description}
              </p>
            )}
            <ol className="history-snapshot__steps">
              {(snapshot.steps ?? []).map((step, index) => (
                <li key={index}>
                  {typeof step === "string" ? step : step.action}
                </li>
              ))}
            </ol>
            <p className="history-snapshot__expected">
              Expected: {snapshot.expectedResult}
            </p>
            <div className="dialog__actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSnapshot(null)}
              >
                Close
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
