import { useEffect, useId, useState, type FormEvent } from "react";
import type {
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
import { CaseForm, type CaseFormValues } from "./CaseForm.js";
import { StepsEditor } from "./StepsEditor.js";
import { AttachmentSection } from "./AttachmentSection.js";

type Mode = "view" | "edit" | "duplicate" | "delete";

/**
 * A case identifier is unique inside its parent, not deployment-wide, so
 * `GET /test_cases/{id}` answers `409` when several parents hold the same case
 * (the seeded `TC-LOGIN-1` sits in two projects). A project document embeds
 * every case its suites carry plus the ones it owns itself, so it resolves the
 * case without the ambiguity.
 */
function findCaseInProject(
  project: Project,
  caseId: string,
): TestCase | undefined {
  const direct = (project.testCases ?? []).find(
    (testCase) => testCase.testCaseId === caseId,
  );
  if (direct) return direct;

  for (const suite of project.testSuites ?? []) {
    const inSuite = (suite.testCases ?? []).find(
      (testCase) => testCase.testCaseId === caseId,
    );
    if (inSuite) return inSuite;
  }

  return undefined;
}

/**
 * Only the fields the form changed travel: the API replaces every field a
 * request carries, so a value resent unchanged would still spend a revision
 * snapshot on the case. An unchanged priority or severity is left out rather
 * than sent empty, which the field's domain has no room for.
 */
function buildUpdateRequest(
  testCase: TestCase,
  values: CaseFormValues,
): TestCaseUpdateRequest {
  const requestBody: TestCaseUpdateRequest = {};
  const currentTags = testCase.tags ?? [];

  if (values.title !== testCase.title) {
    requestBody.title = values.title;
  }
  if (values.description !== (testCase.description ?? "")) {
    requestBody.description = values.description;
  }
  if (values.preconditions !== (testCase.preconditions ?? "")) {
    requestBody.preconditions = values.preconditions;
  }
  if (values.expectedResult !== (testCase.expectedResult ?? "")) {
    requestBody.expectedResult = values.expectedResult;
  }
  if (values.priority && values.priority !== testCase.priority) {
    requestBody.priority = values.priority;
  }
  if (values.severity && values.severity !== testCase.severity) {
    requestBody.severity = values.severity;
  }
  if (
    values.tags.length !== currentTags.length ||
    values.tags.some((tag, index) => tag !== currentTags[index])
  ) {
    requestBody.tags = values.tags;
  }

  return requestBody;
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
    testCase: TestCase | null;
  } | null>(null);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ApiErrorInfo | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [newId, setNewId] = useState("");
  const [newTitle, setNewTitle] = useState("");

  // The loaded case belongs to the target it was read for: a selection change
  // shows the spinner rather than the previous case, while a re-fetch after a
  // mutation leaves the case on screen until the fresh one lands.
  const target = `${projectId ?? ""}\u0000${caseId}`;
  const testCase = snapshot?.key === target ? snapshot.testCase : null;
  const loading = snapshot?.key !== target;

  useEffect(() => {
    let cancelled = false;
    setError(null);

    const request = projectId
      ? apiFetch(() => client.projects.getProject({ id: projectId })).then(
          (project) => findCaseInProject(project, caseId),
        )
      : apiFetch(() => client.testCases.getTestCase({ id: caseId }));

    request
      .then((data) => {
        if (cancelled) return;
        setSnapshot({ key: target, testCase: data ?? null });
        if (!data) {
          setError({
            code: null,
            message: `Test case ${caseId} is not part of project ${projectId}`,
          });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSnapshot({ key: target, testCase: null });
        setError(readApiError(err, "Failed to load test case"));
      });

    return () => {
      cancelled = true;
    };
  }, [client, caseId, projectId, target, reloadToken]);

  const startAction = (next: Mode) => {
    setActionError(null);
    setMode(next);
  };

  const cancelAction = () => {
    setActionError(null);
    setMode("view");
  };

  const updateCase = async (values: CaseFormValues) => {
    if (!testCase) return;
    const requestBody = buildUpdateRequest(testCase, values);
    if (Object.keys(requestBody).length === 0) {
      setMode("view");
      return;
    }

    setBusy(true);
    setActionError(null);
    try {
      const updated = await apiFetch(() =>
        client.testCases.updateTestCase({ id: caseId, requestBody }),
      );
      setMode("view");
      setReloadToken((token) => token + 1);
      refreshProjects();
      announce(updated.message);
    } catch (err: unknown) {
      setActionError(readApiError(err, "Failed to update test case"));
    } finally {
      setBusy(false);
    }
  };

  /**
   * An update replaces the stored steps wholesale, so the editor hands over the
   * complete array and the case is read back to show what the API now holds.
   */
  const saveSteps = async (steps: TestStep[]): Promise<boolean> => {
    setBusy(true);
    setActionError(null);
    try {
      const updated = await apiFetch(() =>
        client.testCases.updateTestCase({ id: caseId, requestBody: { steps } }),
      );
      setReloadToken((token) => token + 1);
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
   * built from a document read before an upload would drop that file. The
   * error travels back to the section that started the action, which renders
   * it next to the control the operator used.
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

  /**
   * Step attachments have no download route, so their section is rendered
   * without one and offers neither a preview nor a download.
   */
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

  if (loading) {
    return (
      <div className="loading" role="status">
        <div className="loading__spinner" />
        <span className="sr-only">Loading test case…</span>
      </div>
    );
  }

  if (error) {
    return <ApiErrorNotice error={error} />;
  }

  if (!testCase) return null;

  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <h2 className="detail-panel__title">{testCase.title}</h2>
        <p className="detail-panel__subtitle">
          Case ID: {testCase.testCaseId}
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
        <CaseForm
          submitLabel="Save changes"
          caseId={testCase.testCaseId}
          initialValues={{
            title: testCase.title,
            expectedResult: testCase.expectedResult ?? "",
            description: testCase.description ?? "",
            preconditions: testCase.preconditions ?? "",
            priority: testCase.priority ?? "",
            severity: testCase.severity ?? "",
            tags: testCase.tags ?? [],
          }}
          busy={busy}
          error={actionError}
          onSubmit={updateCase}
          onCancel={cancelAction}
        />
      ) : (
        <>
          {testCase.description && (
            <div className="detail-field">
              <div className="detail-field__label">Description</div>
              <div className="detail-field__value">{testCase.description}</div>
            </div>
          )}

          {testCase.preconditions && (
            <div className="detail-field">
              <div className="detail-field__label">Preconditions</div>
              <div className="detail-field__value">
                {testCase.preconditions}
              </div>
            </div>
          )}

          {testCase.priority && (
            <div className="detail-field">
              <div className="detail-field__label">Priority</div>
              <span
                className={`badge ${
                  testCase.priority === "High" ||
                  testCase.priority === "Critical"
                    ? "badge-fail"
                    : testCase.priority === "Medium"
                      ? "badge-priority-medium"
                      : "badge-priority-low"
                }`}
              >
                {testCase.priority}
              </span>
            </div>
          )}

          {testCase.severity && (
            <div className="detail-field">
              <div className="detail-field__label">Severity</div>
              <div className="detail-field__value">{testCase.severity}</div>
            </div>
          )}

          {testCase.tags && testCase.tags.length > 0 && (
            <div className="detail-field">
              <div className="detail-field__label">Tags</div>
              <div className="tag-list">
                {testCase.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

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

          {testCase.expectedResult && (
            <div className="detail-field">
              <div className="detail-field__label">Expected Result</div>
              <div className="detail-field__value">
                {testCase.expectedResult}
              </div>
            </div>
          )}

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
        </>
      )}

      {mode === "duplicate" && (
        <Dialog title="Duplicate case" onClose={cancelAction}>
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
                onClick={cancelAction}
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
        <Dialog title="Delete case" onClose={cancelAction}>
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
              onClick={cancelAction}
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
