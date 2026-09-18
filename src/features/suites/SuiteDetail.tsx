import { useEffect, useId, useState, type FormEvent } from "react";
import type {
  TestSuite,
  TestSuiteUpdateRequest,
} from "../../api/generated/index.js";
import { apiFetch } from "../../api/client.js";
import { readApiError, type ApiErrorInfo } from "../../api/errors.js";
import { useAuth } from "../../app/AuthProvider.js";
import { ApiErrorNotice } from "../../app/ApiErrorNotice.js";
import { useProjectContext } from "../../app/ProjectContext.js";
import { Dialog } from "../../app/Dialog.js";
import { EntityForm, type EntityFormValues } from "../../app/EntityForm.js";

type Mode = "view" | "edit" | "duplicate" | "delete";

/**
 * Only the fields the user changed: the API replaces the fields the body
 * carries and keeps every field it does not, so leaving one out keeps it.
 *
 * `suiteId` is never one of them. The API writes a body `suiteId` into the
 * document without moving the suite, so an edit would leave the resource
 * answering under its old identifier with a different one stored inside.
 */
function buildUpdateRequest(
  suite: TestSuite,
  values: EntityFormValues,
): TestSuiteUpdateRequest {
  const requestBody: TestSuiteUpdateRequest = {};
  const currentTags = suite.tags ?? [];

  if (values.name !== suite.name) {
    requestBody.name = values.name;
  }
  if (values.description !== (suite.description ?? "")) {
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

export function SuiteDetail({
  suiteId,
  projectId,
}: {
  suiteId: string;
  projectId?: string;
}) {
  const { client } = useAuth();
  const { setSelection, refreshProjects, announce } = useProjectContext();
  const fieldId = useId();
  const [suite, setSuite] = useState<TestSuite | null>(null);
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
    apiFetch(() => client.testSuites.getTestSuite({ id: suiteId }))
      .then((data) => {
        if (cancelled) return;
        setSuite(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(readApiError(err, "Failed to load suite"));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, suiteId, reloadToken]);

  const startAction = (next: Mode) => {
    setActionError(null);
    setMode(next);
  };

  const cancelAction = () => {
    setActionError(null);
    setMode("view");
  };

  const updateSuite = async (values: EntityFormValues) => {
    if (!suite) return;
    const requestBody = buildUpdateRequest(suite, values);
    if (Object.keys(requestBody).length === 0) {
      setMode("view");
      return;
    }

    setBusy(true);
    setActionError(null);
    try {
      const updated = await apiFetch(() =>
        client.testSuites.updateTestSuite({ id: suiteId, requestBody }),
      );
      setMode("view");
      setReloadToken((token) => token + 1);
      refreshProjects();
      announce(updated.message);
    } catch (err: unknown) {
      setActionError(readApiError(err, "Failed to update suite"));
    } finally {
      setBusy(false);
    }
  };

  const duplicateSuite = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setActionError(null);
    try {
      const trimmedId = newId.trim();
      const trimmedName = newName.trim();
      const duplicated = await apiFetch(() =>
        client.testSuites.duplicateTestSuite({
          id: suiteId,
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
      setSelection({ type: "suite", id: duplicated.id, projectId });
    } catch (err: unknown) {
      setActionError(readApiError(err, "Failed to duplicate suite"));
    } finally {
      setBusy(false);
    }
  };

  const deleteSuite = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const deleted = await apiFetch(() =>
        client.testSuites.deleteTestSuite({ id: suiteId }),
      );
      setMode("view");
      refreshProjects();
      setSelection(null);
      announce(deleted.message);
    } catch (err: unknown) {
      setActionError(readApiError(err, "Failed to delete suite"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="loading" role="status">
        <div className="loading__spinner" />
        <span className="sr-only">Loading suite…</span>
      </div>
    );
  }

  if (error) {
    return <ApiErrorNotice error={error} />;
  }

  if (!suite) return null;

  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <h2 className="detail-panel__title">{suite.name}</h2>
        <p className="detail-panel__subtitle">Suite ID: {suite.suiteId}</p>
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
        <EntityForm
          submitLabel="Save changes"
          initialValues={{
            name: suite.name,
            description: suite.description ?? "",
            tags: suite.tags ?? [],
          }}
          busy={busy}
          error={actionError}
          onSubmit={updateSuite}
          onCancel={cancelAction}
        />
      ) : (
        <>
          {suite.description && (
            <div className="detail-field">
              <div className="detail-field__label">Description</div>
              <div className="detail-field__value">{suite.description}</div>
            </div>
          )}

          {suite.tags && suite.tags.length > 0 && (
            <div className="detail-field">
              <div className="detail-field__label">Tags</div>
              <div className="tag-list">
                {suite.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {suite.testCases && suite.testCases.length > 0 && (
            <div className="detail-field">
              <div className="detail-field__label">
                Test Cases ({suite.testCases.length})
              </div>
              <ul className="entity-list">
                {suite.testCases.map((tc) => (
                  <li key={tc.testCaseId}>
                    <button
                      className="entity-list__item"
                      onClick={() =>
                        setSelection({
                          type: "case",
                          id: tc.testCaseId,
                          projectId,
                        })
                      }
                    >
                      <span className="entity-list__name">{tc.title}</span>
                      {tc.priority && (
                        <span className="entity-list__meta">{tc.priority}</span>
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
        <Dialog title="Duplicate suite" onClose={cancelAction}>
          <form
            className="entity-form"
            onSubmit={duplicateSuite}
            aria-label="Duplicate suite form"
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
                Leave blank to derive the copy&apos;s ID from the source. A new
                ID is one name ending in .json, such as checkout-flow.json.
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
                {busy ? "Duplicating…" : "Duplicate suite"}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {mode === "delete" && (
        <Dialog title="Delete suite" onClose={cancelAction}>
          <p className="dialog__body">
            Delete “{suite.name}” ({suite.suiteId})? The cases it holds go with
            it. This cannot be undone.
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
              onClick={deleteSuite}
              disabled={busy}
            >
              {busy ? "Deleting…" : "Delete suite"}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
