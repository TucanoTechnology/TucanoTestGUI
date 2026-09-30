import { useEffect, useMemo, useState } from "react";
import type { Project, TestCase } from "../../api/generated/index.js";
import { apiFetch } from "../../api/client.js";
import { readApiError, type ApiErrorInfo } from "../../api/errors.js";
import { useAuth } from "../../app/AuthProvider.js";
import { useProjectContext } from "../../app/ProjectContext.js";
import { Dialog } from "../../app/Dialog.js";
import { parseTags } from "../../app/tags.js";
import { formatTimestamp } from "../../app/format.js";
import {
  RESULT_STATUSES,
  buildResultRequest,
  buildResultRows,
  rerecordBlocker,
  type ResultStatus,
} from "../runs/results.js";
import { CaseForm, type CaseFormValues } from "./CaseForm.js";
import { DIRECT_SUITE_ID } from "../suites/SuiteTree.js";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "../../components/StateViews.js";

/** A row of the table: the case document and the parent that carries it. */
interface CaseRow {
  testCase: TestCase;
  /** Suite name for the breadcrumb column; absent for a project-level case. */
  parentPath: string;
  suiteId?: string;
}

interface CaseListProps {
  projectId: string;
  /** `null` = all, `DIRECT_SUITE_ID` = project-level only, else a suite id. */
  suiteFilter: string | null;
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
  /** Hands off to the runs module, which owns run creation. */
  onCreateRun: () => void;
}

/**
 * One read of the project document answers every scope: it embeds the cases
 * its suites carry plus the ones it holds itself. `GET /test_cases/{id}` on a
 * bare identifier is a 409 when several parents share one — the seeded
 * `TC-LOGIN-1` does — so the list can never be built case by case.
 */
function buildRows(project: Project): CaseRow[] {
  return [
    ...(project.testCases ?? []).map((testCase) => ({
      testCase,
      parentPath: "project root",
    })),
    ...(project.testSuites ?? []).flatMap((suite) =>
      (suite.testCases ?? []).map((testCase) => ({
        testCase,
        parentPath: suite.name,
        suiteId: suite.suiteId,
      })),
    ),
  ];
}

export function CaseList({
  projectId,
  suiteFilter,
  selectedCaseId,
  onSelectCase,
  onCreateRun,
}: CaseListProps) {
  const { client } = useAuth();
  const { projectsVersion, refreshProjects, announce } = useProjectContext();
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [projectName, setProjectName] = useState(projectId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [filter, setFilter] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkTagValue, setBulkTagValue] = useState("");
  const [bulkRunId, setBulkRunId] = useState("");
  const [bulkStatus, setBulkStatus] = useState<ResultStatus>("Passed");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [runIds, setRunIds] = useState<string[]>([]);

  const [creating, setCreating] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<ApiErrorInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setChecked(new Set());

    apiFetch(() => client.projects.getProject({ id: projectId }))
      .then((project) => {
        if (cancelled) return;
        setRows(buildRows(project));
        setProjectName(project.name ?? project.projectId);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(readApiError(err, "Failed to load test cases"));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, projectId, projectsVersion, reloadToken]);

  // The bulk status change records against a run the operator picks, and the
  // run list is one cheap request made when the toolbar first needs it.
  useEffect(() => {
    if (checked.size === 0 || runIds.length > 0) return;
    let cancelled = false;
    apiFetch(() => client.projects.listProjectTestRuns({ id: projectId }))
      .then((ids) => {
        if (!cancelled) setRunIds(ids);
      })
      .catch(() => {
        // The run picker stays empty; the tag operations do not need it.
      });
    return () => {
      cancelled = true;
    };
  }, [client, projectId, checked.size, runIds.length]);

  const scoped = useMemo(
    () =>
      rows.filter((row) =>
        suiteFilter === null
          ? true
          : suiteFilter === DIRECT_SUITE_ID
            ? row.suiteId === undefined
            : row.suiteId === suiteFilter,
      ),
    [rows, suiteFilter],
  );

  const suiteName = useMemo(() => {
    if (suiteFilter === null || suiteFilter === DIRECT_SUITE_ID) return null;
    const row = rows.find((entry) => entry.suiteId === suiteFilter);
    return row ? row.parentPath : null;
  }, [rows, suiteFilter]);

  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? scoped.filter(
        (row) =>
          row.testCase.testCaseId.toLowerCase().includes(needle) ||
          row.testCase.title.toLowerCase().includes(needle),
      )
    : scoped;

  const allChecked =
    visible.length > 0 && visible.every((row) => checked.has(row.testCase.testCaseId));

  const toggleRow = (caseId: string) => {
    setBulkResult(null);
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) next.delete(caseId);
      else next.add(caseId);
      return next;
    });
  };

  const toggleAll = () => {
    setBulkResult(null);
    setChecked(allChecked ? new Set() : new Set(visible.map((r) => r.testCase.testCaseId)));
  };

  const reload = () => setReloadToken((token) => token + 1);

  const applyBulkTags = async (mode: "add" | "remove") => {
    const tags = parseTags(bulkTagValue);
    if (tags.length === 0 || checked.size === 0) return;
    setBulkBusy(true);
    setBulkResult(null);
    let done = 0;
    const failed: string[] = [];
    for (const row of rows) {
      if (!checked.has(row.testCase.testCaseId)) continue;
      const current = row.testCase.tags ?? [];
      const nextTags =
        mode === "add"
          ? [...new Set([...current, ...tags])]
          : current.filter((tag) => !tags.includes(tag));
      try {
        await apiFetch(() =>
          client.testCases.updateTestCase({
            id: row.testCase.testCaseId,
            requestBody: { tags: nextTags },
          }),
        );
        done += 1;
      } catch {
        failed.push(row.testCase.testCaseId);
      }
    }
    setBulkBusy(false);
    setBulkTagValue("");
    refreshProjects();
    const outcome = `${mode === "add" ? "Tagged" : "Untagged"} ${done} of ${checked.size} cases`;
    setBulkResult(
      failed.length > 0
        ? `${outcome}; ${failed.length} failed (${failed.join(", ")})`
        : outcome,
    );
    announce(outcome);
  };

  const applyBulkStatus = async () => {
    if (!bulkRunId || checked.size === 0) return;
    setBulkBusy(true);
    setBulkResult(null);
    try {
      const run = await apiFetch(() =>
        client.testRuns.getTestRun({ id: bulkRunId }),
      );
      const resultRows = buildResultRows(run);
      let done = 0;
      const failed: string[] = [];
      for (const caseId of checked) {
        const row = resultRows.find((r) => r.testCaseId === caseId);
        if (!row) {
          failed.push(caseId);
          continue;
        }
        if (row.result && rerecordBlocker(row.result)) {
          failed.push(caseId);
          continue;
        }
        try {
          await apiFetch(() =>
            client.testRuns.recordTestRunResult({
              id: bulkRunId,
              requestBody: buildResultRequest(
                caseId,
                {
                  status: bulkStatus,
                  notes: row.result?.notes ?? "",
                  durationMs: row.result?.durationMs,
                },
                row.result,
              ),
            }),
          );
          done += 1;
        } catch {
          failed.push(caseId);
        }
      }
      const outcome = `Recorded ${bulkStatus} for ${done} of ${checked.size} cases in ${bulkRunId}`;
      setBulkResult(
        failed.length > 0
          ? `${outcome}; ${failed.length} skipped (${failed.join(", ")})`
          : outcome,
      );
      announce(outcome);
    } catch (err: unknown) {
      setBulkResult(
        readApiError(err, "Failed to load the run to record against").message,
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const exportCases = () => {
    const payload = visible.map((row) => row.testCase);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${projectId}-cases.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    announce(`Exported ${payload.length} cases`);
  };

  const createCase = async (values: CaseFormValues) => {
    setCreateBusy(true);
    setCreateError(null);
    try {
      const created = await apiFetch(() =>
        client.projects.addProjectTestCase({
          id: projectId,
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
      setCreating(false);
      refreshProjects();
      announce(created.message);
      onSelectCase(created.id);
    } catch (err: unknown) {
      setCreateError(readApiError(err, "Failed to create test case"));
    } finally {
      setCreateBusy(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton rows={8} columns={5} />;
  }

  if (error) {
    return (
      <ErrorState
        code={error.code}
        message={error.message}
        onRetry={reload}
      />
    );
  }

  return (
    <div className="case-list">
      <nav className="case-list__breadcrumb" aria-label="Breadcrumb">
        <span className="case-list__crumb">{projectName}</span>
        {suiteFilter !== null && suiteFilter !== DIRECT_SUITE_ID && suiteName && (
          <>
            <span className="case-list__crumb-sep" aria-hidden="true">
              /
            </span>
            <span className="case-list__crumb case-list__crumb--current">
              {suiteName}
            </span>
          </>
        )}
        {suiteFilter === DIRECT_SUITE_ID && (
          <>
            <span className="case-list__crumb-sep" aria-hidden="true">
              /
            </span>
            <span className="case-list__crumb case-list__crumb--current">
              Directly in project
            </span>
          </>
        )}
      </nav>

      <div className="case-list__actions">
        <div className="case-list__actions-primary">
          <button className="btn btn-primary" onClick={onCreateRun}>
            Create test run
          </button>
          <button
            className="btn btn-ghost"
            onClick={exportCases}
            disabled={visible.length === 0}
          >
            Export
          </button>
        </div>
        <div className="case-list__actions-secondary">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setCreateError(null);
              setCreating(true);
            }}
          >
            + Create
          </button>
          <input
            type="search"
            className="case-list__search"
            placeholder="Search cases…"
            aria-label="Search cases"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>
      </div>

      {checked.size > 0 && (
        <div className="bulk-toolbar" role="toolbar" aria-label="Bulk case operations">
          <span className="bulk-toolbar__count">{checked.size} selected</span>
          <input
            className="bulk-toolbar__tags"
            type="text"
            placeholder="tags, comma, separated"
            aria-label="Tags for bulk operations"
            value={bulkTagValue}
            onChange={(event) => setBulkTagValue(event.target.value)}
          />
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => void applyBulkTags("add")}
            disabled={bulkBusy}
          >
            Add tags
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => void applyBulkTags("remove")}
            disabled={bulkBusy}
          >
            Remove tags
          </button>
          <label className="bulk-toolbar__field">
            <span className="sr-only">Record status against run</span>
            <select
              className="bulk-toolbar__select"
              value={bulkRunId}
              onChange={(event) => setBulkRunId(event.target.value)}
              aria-label="Run to record against"
            >
              <option value="">Run…</option>
              {runIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
            <select
              className="bulk-toolbar__select"
              value={bulkStatus}
              onChange={(event) => setBulkStatus(event.target.value as ResultStatus)}
              aria-label="Status to record"
            >
              {RESULT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => void applyBulkStatus()}
              disabled={bulkBusy || bulkRunId.length === 0}
            >
              Record status
            </button>
          </label>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setChecked(new Set());
              setBulkResult(null);
            }}
          >
            Clear selection
          </button>
          {bulkBusy && (
            <span className="bulk-toolbar__status" role="status">
              Working…
            </span>
          )}
        </div>
      )}
      {bulkResult && (
        <p className="bulk-toolbar__result" role="status">
          {bulkResult}
        </p>
      )}

      {visible.length === 0 ? (
        <EmptyState
          icon="📋"
          message={
            needle.length > 0
              ? "No test cases match the search"
              : "No test cases found"
          }
          action={
            needle.length === 0 ? (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setCreateError(null);
                  setCreating(true);
                }}
              >
                + Create
              </button>
            ) : undefined
          }
        />
      ) : (
        <table className="case-table" role="grid" aria-label="Test cases">
          <thead>
            <tr>
              <th className="case-table__th case-table__th--check">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allChecked}
                  onChange={toggleAll}
                />
              </th>
              <th className="case-table__th">ID</th>
              <th className="case-table__th">Title</th>
              <th className="case-table__th">Last Results</th>
              <th className="case-table__th">Updated</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const { testCase } = row;
              return (
                <tr
                  key={`${row.suiteId ?? "direct"}/${testCase.testCaseId}`}
                  className={`case-table__row ${
                    selectedCaseId === testCase.testCaseId
                      ? "case-table__row--selected"
                      : ""
                  }`}
                  onClick={() => onSelectCase(testCase.testCaseId)}
                >
                  <td className="case-table__td">
                    <input
                      type="checkbox"
                      aria-label={`Select ${testCase.testCaseId}`}
                      checked={checked.has(testCase.testCaseId)}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => toggleRow(testCase.testCaseId)}
                    />
                  </td>
                  <td className="case-table__td case-table__td--id">
                    <span className="case-table__id">{testCase.testCaseId}</span>
                    <span className="case-table__parent">{row.parentPath}</span>
                  </td>
                  <td className="case-table__td">
                    <span className="case-table__title">
                      {testCase.title}
                      {testCase.version !== undefined && (
                        <span className="case-table__version">
                          {` (v${testCase.version})`}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="case-table__td">
                    {testCase.priority ? (
                      <span
                        className={`status-badge status-badge--priority status-badge--${testCase.priority.toLowerCase()}`}
                        title="Priority — the last recorded result is reported by the run and report views"
                      >
                        {testCase.priority}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="case-table__td case-table__td--date">
                    {formatTimestamp(testCase.lastModified)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {creating && (
        <Dialog title="New case" onClose={() => setCreating(false)}>
          <CaseForm
            submitLabel="Create case"
            busy={createBusy}
            error={createError}
            onSubmit={createCase}
            onCancel={() => setCreating(false)}
          />
        </Dialog>
      )}
    </div>
  );
}
