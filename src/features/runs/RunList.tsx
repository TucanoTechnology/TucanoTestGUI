import { useEffect, useMemo, useState } from "react";
import type { TestConfiguration, TestRun } from "../../api/generated/index.js";
import { apiFetch } from "../../api/client.js";
import { readApiError, type ApiErrorInfo } from "../../api/errors.js";
import { useAuth } from "../../app/AuthProvider.js";
import { useProjectContext } from "../../app/ProjectContext.js";
import { Dialog } from "../../app/Dialog.js";
import { formatTimestamp } from "../../app/format.js";
import { parseTags } from "../../app/tags.js";
import { RunForm, type RunFormValues } from "./RunForm.js";
import {
  buildRunCreateRequest,
  buildRunSelectionOptions,
  type RunSelectionOptions,
} from "./runSelection.js";
import { PlayIcon } from "../../components/Icon.js";
import { EmptyState, ErrorState, LoadingSkeleton } from "../../components/StateViews.js";

interface RunRow {
  /** The listing key: a run document need not carry a `testRunId`. */
  id: string;
  name: string;
  run: TestRun;
}

interface RunListProps {
  projectId: string;
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
}

const STATUS_SUMMARY: { status: string; label: string }[] = [
  { status: "Passed", label: "passed" },
  { status: "Failed", label: "failed" },
  { status: "Blocked", label: "blocked" },
  { status: "Retest", label: "retest" },
  { status: "Untested", label: "untested" },
];

function statusCounts(run: TestRun): Map<string, number> {
  const counts = new Map<string, number>();
  const recorded = new Set(
    (run.results ?? []).map((result) => result.testCaseId),
  );
  for (const result of run.results ?? []) {
    counts.set(result.status, (counts.get(result.status) ?? 0) + 1);
  }
  const untested = (run.testCases ?? []).filter(
    (testCase) => !recorded.has(testCase.testCaseId),
  ).length;
  if (untested > 0) counts.set("Untested", (counts.get("Untested") ?? 0) + untested);
  return counts;
}

export function RunList({ projectId, selectedRunId, onSelectRun }: RunListProps) {
  const { client } = useAuth();
  const { refreshProjects, announce } = useProjectContext();
  const [rows, setRows] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [search, setSearch] = useState("");
  const [configurationFilter, setConfigurationFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  const [creating, setCreating] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<ApiErrorInfo | null>(null);
  const [runOptions, setRunOptions] = useState<RunSelectionOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<ApiErrorInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch(() => client.projects.listProjectTestRuns({ id: projectId }))
      .then(async (ids) => {
        const loaded = await Promise.all(
          ids.map(async (id) => {
            const run = await apiFetch(() => client.testRuns.getTestRun({ id }));
            return { id, name: run.name ?? id, run };
          }),
        );
        if (!cancelled) {
          setRows(loaded);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(readApiError(err, "Failed to load test runs"));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, projectId, reloadToken]);

  // The cases and suites a run can cover are only read once the form is asked
  // for, so a plain list of runs costs one request per run it lists.
  useEffect(() => {
    if (!creating) return;
    let cancelled = false;
    setOptionsLoading(true);
    setOptionsError(null);

    const loadOptions = async () => {
      const project = await apiFetch(() =>
        client.projects.getProject({ id: projectId }),
      );
      const configIds = await apiFetch(() =>
        client.projects.listProjectConfigurations({ id: projectId }),
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
  }, [client, creating, projectId]);

  const createRun = async (values: RunFormValues) => {
    if (!runOptions) return;
    setCreateBusy(true);
    setCreateError(null);
    try {
      const created = await apiFetch(() =>
        client.projects.addProjectTestRun({
          id: projectId,
          requestBody: buildRunCreateRequest(values, runOptions),
        }),
      );
      setCreating(false);
      refreshProjects();
      announce(created.message);
      onSelectRun(created.id);
      setReloadToken((token) => token + 1);
    } catch (err: unknown) {
      setCreateError(readApiError(err, "Failed to create test run"));
    } finally {
      setCreateBusy(false);
    }
  };

  const configurationOptions = useMemo(() => {
    const byId = new Map<string, TestConfiguration>();
    for (const row of rows) {
      for (const config of row.run.configurations ?? []) {
        if (config.configId) byId.set(config.configId, config);
      }
    }
    return [...byId.values()];
  }, [rows]);

  const visible = rows.filter((row) => {
    const needle = search.trim().toLowerCase();
    if (
      needle &&
      !row.name.toLowerCase().includes(needle) &&
      !row.id.toLowerCase().includes(needle)
    ) {
      return false;
    }
    if (configurationFilter) {
      const match = (row.run.configurations ?? []).some(
        (config) => config.configId === configurationFilter,
      );
      if (!match) return false;
    }
    const tags = parseTags(tagFilter);
    if (tags.length > 0) {
      const runTags = row.run.tags ?? [];
      if (!tags.every((tag) => runTags.includes(tag))) return false;
    }
    return true;
  });

  if (loading) {
    return <LoadingSkeleton rows={6} columns={5} />;
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
              setRunOptions(null);
              setCreating(true);
            }}
          >
            + New Run
          </button>
          <label className="run-list__filter">
            <span className="sr-only">Filter by configuration</span>
            <select
              className="run-list__select"
              value={configurationFilter}
              onChange={(event) =>
                setConfigurationFilter(event.target.value)
              }
            >
              <option value="">All configurations</option>
              {configurationOptions.map((config) => (
                <option key={config.configId} value={config.configId}>
                  {config.name}
                </option>
              ))}
            </select>
          </label>
          <input
            type="text"
            className="case-list__search"
            placeholder="Filter by tags…"
            aria-label="Filter runs by tags"
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
          />
        </div>
        <div className="case-list__actions-secondary">
          <input
            type="search"
            className="case-list__search"
            placeholder="Search runs…"
            aria-label="Search runs"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<PlayIcon />}
          message={rows.length === 0 ? "No test runs yet" : "No runs match the filters"}
          action={
            rows.length === 0 ? (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setCreateError(null);
                  setRunOptions(null);
                  setCreating(true);
                }}
              >
                + New Run
              </button>
            ) : undefined
          }
        />
      ) : (
        <table className="case-table run-table" aria-label="Test runs">
          <thead>
            <tr>
              <th className="case-table__th">ID</th>
              <th className="case-table__th">Name</th>
              <th className="case-table__th">Created</th>
              <th className="case-table__th">Status Summary</th>
              <th className="case-table__th">Configuration</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const counts = statusCounts(row.run);
              return (
                <tr
                  key={row.id}
                  className={`case-table__row ${
                    selectedRunId === row.id ? "case-table__row--selected" : ""
                  }`}
                  onClick={() => onSelectRun(row.id)}
                >
                  <td className="case-table__td case-table__td--id">
                    <span className="case-table__id">{row.id}</span>
                  </td>
                  <td className="case-table__td">{row.name}</td>
                  <td className="case-table__td case-table__td--date">
                    {formatTimestamp(row.run.timestamp)}
                  </td>
                  <td className="case-table__td run-table__badges">
                    {STATUS_SUMMARY.map(({ status, label }) => {
                      const count = counts.get(status) ?? 0;
                      if (count === 0) return null;
                      return (
                        <span
                          key={status}
                          className={`status-badge status-badge--${label}`}
                        >
                          {count} {label}
                        </span>
                      );
                    })}
                  </td>
                  <td className="case-table__td">
                    {row.run.configurations?.[0]?.name ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {creating && (
        <Dialog title="New run" onClose={() => setCreating(false)}>
          {optionsLoading ? (
            <LoadingSkeleton rows={3} columns={1} />
          ) : optionsError ? (
            <ErrorState code={optionsError.code} message={optionsError.message} />
          ) : runOptions ? (
            <RunForm
              submitLabel="Create run"
              suiteOptions={runOptions.suites}
              caseOptions={runOptions.cases}
              configurationOptions={runOptions.configurations}
              busy={createBusy}
              error={createError}
              onSubmit={createRun}
              onCancel={() => setCreating(false)}
            />
          ) : null}
        </Dialog>
      )}
    </div>
  );
}
