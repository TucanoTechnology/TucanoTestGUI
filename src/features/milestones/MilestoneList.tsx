import { useEffect, useState } from "react";
import type { Milestone, MilestoneProgress } from "../../api/generated/index.js";
import { apiFetch } from "../../api/client.js";
import { readApiError, type ApiErrorInfo } from "../../api/errors.js";
import { useAuth } from "../../app/AuthProvider.js";
import { useProjectContext } from "../../app/ProjectContext.js";
import { Dialog } from "../../app/Dialog.js";
import {
  MilestoneForm,
  type MilestoneFormValues,
} from "./MilestoneForm.js";
import {
  buildMilestoneCreateRequest,
  buildMilestoneSelectionOptions,
  type MilestoneSelectionOptions,
} from "./milestoneSelection.js";
import { TargetIcon } from "../../components/Icon.js";
import { EmptyState, ErrorState, LoadingSkeleton } from "../../components/StateViews.js";
import { ProgressBar } from "../../components/ProgressBar.js";

interface MilestoneRow {
  /** The listing key: a rename never moves it. */
  id: string;
  milestone: Milestone;
  /** Null when the progress route failed; the row then carries no bar. */
  progress: MilestoneProgress | null;
}

interface MilestoneListProps {
  projectId: string;
  selectedMilestoneId: string | null;
  onSelectMilestone: (id: string) => void;
}

/**
 * Milestones, their progress, and the suites/runs the create form offers all
 * come from the project: the progress route is one cheap request per
 * milestone, and a failure there only removes the bar.
 */
export function MilestoneList({
  projectId,
  selectedMilestoneId,
  onSelectMilestone,
}: MilestoneListProps) {
  const { client } = useAuth();
  const { refreshProjects, announce } = useProjectContext();
  const [rows, setRows] = useState<MilestoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [search, setSearch] = useState("");

  const [creating, setCreating] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<ApiErrorInfo | null>(null);
  const [options, setOptions] = useState<MilestoneSelectionOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<ApiErrorInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch(() => client.projects.listProjectMilestones({ id: projectId }))
      .then(async (ids) => {
        const loaded = await Promise.all(
          ids.map(async (id) => {
            const milestone = await apiFetch(() =>
              client.milestones.getMilestone({ id }),
            );
            let progress: MilestoneProgress | null = null;
            try {
              progress = await apiFetch(() =>
                client.milestones.getMilestoneProgress({ id }),
              );
            } catch {
              // A milestone whose run set cannot be counted shows no bar.
            }
            return { id, milestone, progress };
          }),
        );
        if (!cancelled) {
          setRows(loaded);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(readApiError(err, "Failed to load milestones"));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, projectId, reloadToken]);

  useEffect(() => {
    if (!creating) return;
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
  }, [client, creating, projectId]);

  const createMilestone = async (values: MilestoneFormValues) => {
    setCreateBusy(true);
    setCreateError(null);
    try {
      const created = await apiFetch(() =>
        client.projects.addProjectMilestone({
          id: projectId,
          requestBody: buildMilestoneCreateRequest(values),
        }),
      );
      setCreating(false);
      refreshProjects();
      announce(created.message);
      onSelectMilestone(created.id);
      setReloadToken((token) => token + 1);
    } catch (err: unknown) {
      setCreateError(readApiError(err, "Failed to create milestone"));
    } finally {
      setCreateBusy(false);
    }
  };

  const needle = search.trim().toLowerCase();
  const visible = needle
    ? rows.filter(
        (row) =>
          row.id.toLowerCase().includes(needle) ||
          row.milestone.name.toLowerCase().includes(needle),
      )
    : rows;

  if (loading) {
    return <LoadingSkeleton rows={5} columns={4} />;
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

  return (
    <div className="case-list">
      <div className="case-list__actions">
        <div className="case-list__actions-primary">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setCreateError(null);
              setOptions(null);
              setCreating(true);
            }}
          >
            + New Milestone
          </button>
        </div>
        <div className="case-list__actions-secondary">
          <input
            type="search"
            className="case-list__search"
            placeholder="Search milestones…"
            aria-label="Search milestones"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<TargetIcon />}
          message={rows.length === 0 ? "No milestones yet" : "No milestones match the search"}
          action={
            rows.length === 0 ? (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setCreateError(null);
                  setOptions(null);
                  setCreating(true);
                }}
              >
                + New Milestone
              </button>
            ) : undefined
          }
        />
      ) : (
        <table className="case-table milestone-table" aria-label="Milestones">
          <thead>
            <tr>
              <th className="case-table__th">ID</th>
              <th className="case-table__th">Name</th>
              <th className="case-table__th">Status</th>
              <th className="case-table__th">Progress</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.id}
                className={`case-table__row ${
                  selectedMilestoneId === row.id
                    ? "case-table__row--selected"
                    : ""
                }`}
                onClick={() => onSelectMilestone(row.id)}
              >
                <td className="case-table__td case-table__td--id">
                  <span className="case-table__id">{row.id}</span>
                </td>
                <td className="case-table__td">{row.milestone.name}</td>
                <td className="case-table__td">{row.milestone.status ?? "—"}</td>
                <td className="case-table__td">
                  {row.progress ? (
                    <ProgressBar progress={row.progress} />
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && (
        <Dialog title="New milestone" onClose={() => setCreating(false)}>
          {optionsLoading ? (
            <LoadingSkeleton rows={3} columns={1} />
          ) : optionsError ? (
            <ErrorState code={optionsError.code} message={optionsError.message} />
          ) : options ? (
            <MilestoneForm
              submitLabel="Create milestone"
              idField
              suiteOptions={options.suites}
              runOptions={options.runs}
              busy={createBusy}
              error={createError}
              onSubmit={createMilestone}
              onCancel={() => setCreating(false)}
            />
          ) : null}
        </Dialog>
      )}
    </div>
  );
}
