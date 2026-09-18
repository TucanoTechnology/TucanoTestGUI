import { useEffect, useState } from "react";
import type { Milestone, MilestoneProgress } from "../../api/generated/index.js";
import { apiFetch } from "../../api/client.js";
import { readApiError, type ApiErrorInfo } from "../../api/errors.js";
import { useAuth } from "../../app/AuthProvider.js";
import { ApiErrorNotice } from "../../app/ApiErrorNotice.js";
import { Dialog } from "../../app/Dialog.js";
import { useProjectContext } from "../../app/ProjectContext.js";
import {
  MilestoneForm,
  type MilestoneFormValues,
} from "./MilestoneForm.js";
import {
  buildMilestoneSelectionOptions,
  buildMilestoneUpdateRequest,
  type MilestoneSelectionOptions,
} from "./milestoneSelection.js";

type Mode = "view" | "edit" | "delete";

export function MilestoneDetail({
  milestoneId,
  projectId,
}: {
  milestoneId: string;
  projectId?: string;
}) {
  const { client } = useAuth();
  const { setSelection, refreshProjects, announce } = useProjectContext();
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [progress, setProgress] = useState<MilestoneProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ApiErrorInfo | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [options, setOptions] = useState<MilestoneSelectionOptions | null>(
    null,
  );
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<ApiErrorInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch(() => client.milestones.getMilestone({ id: milestoneId })),
      apiFetch(() =>
        client.milestones.getMilestoneProgress({ id: milestoneId }),
      ),
    ])
      .then(([m, p]) => {
        if (cancelled) return;
        setMilestone(m);
        setProgress(p);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(readApiError(err, "Failed to load milestone"));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, milestoneId, reloadToken]);

  // The suites and runs a milestone can link are only read once the edit form
  // asks for them, and only while the project it belongs to is known: with no
  // project there is nothing to offer, and the form then leaves the stored
  // links alone rather than showing an empty set as the truth.
  useEffect(() => {
    if (mode !== "edit" || !projectId) return;
    let cancelled = false;
    setOptionsLoading(true);
    setOptionsError(null);

    const loadOptions = async () => {
      const project = await apiFetch(() =>
        client.projects.getProject({ id: projectId }),
      );
      const runIds = await apiFetch(() =>
        client.projects.listProjectTestRuns({ id: projectId }),
      );
      const runs = await Promise.all(
        runIds.map(async (id) => {
          const run = await apiFetch(() => client.testRuns.getTestRun({ id }));
          // The listing key is what a milestone links: a run document need not
          // carry a `testRunId`, and a rename never moves the key.
          return { id, name: run.name ?? id };
        }),
      );
      return buildMilestoneSelectionOptions(project, runs);
    };

    loadOptions()
      .then((loaded) => {
        if (cancelled) return;
        setOptions(loaded);
        setOptionsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setOptionsError(readApiError(err, "Failed to load milestone options"));
        setOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, mode, projectId]);

  const startAction = (next: Mode) => {
    setActionError(null);
    // The options are cleared before the form can open, so it never shows an
    // empty set and then swaps itself out under the user's typing.
    if (next === "edit" && projectId) {
      setOptions(null);
      setOptionsError(null);
      setOptionsLoading(true);
    }
    setMode(next);
  };

  const cancelAction = () => {
    setActionError(null);
    setMode("view");
  };

  const updateMilestone = async (values: MilestoneFormValues) => {
    if (!milestone) return;
    const requestBody = buildMilestoneUpdateRequest(milestone, values);
    if (Object.keys(requestBody).length === 0) {
      setMode("view");
      return;
    }

    setBusy(true);
    setActionError(null);
    try {
      const updated = await apiFetch(() =>
        client.milestones.updateMilestone({ id: milestoneId, requestBody }),
      );
      setMode("view");
      setReloadToken((token) => token + 1);
      refreshProjects();
      announce(updated.message);
    } catch (err: unknown) {
      setActionError(readApiError(err, "Failed to update milestone"));
    } finally {
      setBusy(false);
    }
  };

  const deleteMilestone = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const deleted = await apiFetch(() =>
        client.milestones.deleteMilestone({ id: milestoneId }),
      );
      setMode("view");
      refreshProjects();
      setSelection(null);
      announce(deleted.message);
    } catch (err: unknown) {
      setActionError(readApiError(err, "Failed to delete milestone"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="loading" role="status">
        <div className="loading__spinner" />
        <span className="sr-only">Loading milestone…</span>
      </div>
    );
  }

  if (error) {
    return <ApiErrorNotice error={error} />;
  }

  if (!milestone) return null;

  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <h2 className="detail-panel__title">{milestone.name}</h2>
        <p className="detail-panel__subtitle">
          Milestone ID: {milestone.milestoneId}
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
          className="btn btn-danger"
          onClick={() => startAction("delete")}
        >
          Delete
        </button>
      </div>

      {mode === "edit" ? (
        projectId && optionsLoading ? (
          <div className="loading" role="status">
            <div className="loading__spinner" />
            <span className="sr-only">Loading milestone options…</span>
          </div>
        ) : projectId && optionsError ? (
          <ApiErrorNotice error={optionsError} />
        ) : (
          <MilestoneForm
            submitLabel="Save changes"
            initialValues={{
              name: milestone.name,
              description: milestone.description ?? "",
              status: milestone.status ?? "",
              startDate: milestone.startDate ?? "",
              targetDate: milestone.targetDate ?? "",
              suiteIds: milestone.testSuiteIds ?? [],
              runIds: milestone.testRunIds ?? [],
            }}
            suiteOptions={options?.suites}
            runOptions={options?.runs}
            busy={busy}
            error={actionError}
            onSubmit={updateMilestone}
            onCancel={cancelAction}
          />
        )
      ) : (
        <>
          {milestone.description && (
            <div className="detail-field">
              <div className="detail-field__label">Description</div>
              <div className="detail-field__value">{milestone.description}</div>
            </div>
          )}

          {milestone.status && (
            <div className="detail-field">
              <div className="detail-field__label">Status</div>
              <div className="detail-field__value">{milestone.status}</div>
            </div>
          )}

          {milestone.startDate && (
            <div className="detail-field">
              <div className="detail-field__label">Start Date</div>
              <div className="detail-field__value">{milestone.startDate}</div>
            </div>
          )}

          {milestone.targetDate && (
            <div className="detail-field">
              <div className="detail-field__label">Target Date</div>
              <div className="detail-field__value">{milestone.targetDate}</div>
            </div>
          )}

          {progress && (
            <div className="detail-field">
              <div className="detail-field__label">Progress</div>
              <div className="detail-field__value">
                {progress.totalCases} total — {progress.passed} passed,{" "}
                {progress.failed} failed, {progress.blocked} blocked,{" "}
                {progress.untested} untested, {progress.retest} retest
              </div>
              <div className="detail-field__value">
                {progress.passPercentage}% of the total passed
              </div>
            </div>
          )}

          {milestone.testSuiteIds && milestone.testSuiteIds.length > 0 && (
            <div className="detail-field">
              <div className="detail-field__label">
                Linked Suites ({milestone.testSuiteIds.length})
              </div>
              <ul className="entity-list">
                {milestone.testSuiteIds.map((id) => (
                  <li key={id} className="entity-list__item">
                    <span className="entity-list__name">{id}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {milestone.testRunIds && milestone.testRunIds.length > 0 && (
            <div className="detail-field">
              <div className="detail-field__label">
                Linked Runs ({milestone.testRunIds.length})
              </div>
              <ul className="entity-list">
                {milestone.testRunIds.map((id) => (
                  <li key={id} className="entity-list__item">
                    <span className="entity-list__name">{id}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {mode === "delete" && (
        <Dialog title="Delete milestone" onClose={cancelAction}>
          <p className="dialog__body">
            Delete “{milestone.name}” ({milestone.milestoneId})? The suites and
            runs it links stay where they are. This cannot be undone.
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
              onClick={deleteMilestone}
              disabled={busy}
            >
              {busy ? "Deleting…" : "Delete milestone"}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
