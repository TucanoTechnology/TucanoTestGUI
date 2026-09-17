import { useEffect, useId, useRef, useState } from 'react';
import { ApiRequestError, TestCase, TestRun, TestSuite, TucanoApiClient } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';

/**
 * Test runs module (issue #73): the execution board.
 *
 * The shell owns the filtered identifier list, the shared live region and the
 * detail panel; the module resolves those identifiers into TestRun entities,
 * renders the loading, empty and error states, executes a run case by case and
 * persists every recorded result through TucanoApiClient. Run membership is
 * taken from the test suites the shell already fetched, so picking a suite is a
 * local selection rather than another round trip.
 */

/**
 * Run-scoped result mapping.
 *
 * TestRun carries no result field yet, so a recorded result rides on the case's
 * priority exactly as the shell did before this lift. Issue #65 decouples case
 * status from priority; when it lands, these exports are the only place that
 * has to change, and the tests below pin the mapping down.
 */
export const RESULT_STATUSES = ['Passed', 'Failed', 'Blocked', 'Untested'] as const;
export type RunResultStatus = (typeof RESULT_STATUSES)[number];

export function resultFromCase(testCase: TestCase): RunResultStatus {
  const recorded = testCase.priority;
  return RESULT_STATUSES.includes(recorded as RunResultStatus)
    ? (recorded as RunResultStatus)
    : 'Untested';
}

export function applyResult(testCase: TestCase, status: RunResultStatus): TestCase {
  return { ...testCase, priority: status };
}

export interface TestRunsModuleProps {
  client: TucanoApiClient;
  /** Filtered identifiers from the shell; each one resolves to a TestRun. */
  identifiers: readonly string[];
  /** Suites the shell already loaded; a run is seeded from one of them. */
  suites?: readonly TestSuite[];
  /** Bumped by a shell affordance to open the create form. */
  createRequest?: number;
  onStatus: (message: string, state?: 'info' | 'error') => void;
  onViewRun?: (run: TestRun) => void;
  /** Awaited so the shell finishes refreshing before the module announces. */
  onChanged?: () => void | Promise<void>;
}

type DetailState = 'loading' | 'ready' | 'error';

interface Failure {
  code: string;
  message: string;
}

function toFailure(error: unknown, fallback: string): Failure {
  if (error instanceof ApiRequestError) {
    return { code: error.code, message: error.message };
  }
  return { code: 'network_error', message: fallback };
}

function caseWord(count: number): string {
  return count === 1 ? '1 case' : `${count} cases`;
}

/** Steps are strings in the API contract; older runs stored `{ action }`. */
type RunStep = string | { action?: string };

function stepText(step: RunStep): string {
  return typeof step === 'string' ? step : step.action ?? '';
}

/** `datetime-local` speaks local wall-clock time; the API stores ISO-8601. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

export default function TestRunsModule({
  client,
  identifiers,
  suites = [],
  createRequest,
  onStatus,
  onViewRun,
  onChanged,
}: TestRunsModuleProps) {
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [detailState, setDetailState] = useState<DetailState>('loading');
  const [detailFailure, setDetailFailure] = useState<Failure | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newRunId, setNewRunId] = useState('');
  const [newRunSuiteId, setNewRunSuiteId] = useState('');

  const [editing, setEditing] = useState<TestRun | null>(null);
  const [editSuiteId, setEditSuiteId] = useState('');
  const [editTimestamp, setEditTimestamp] = useState('');

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const [executing, setExecuting] = useState<TestRun | null>(null);
  const [executingIndex, setExecutingIndex] = useState(0);
  const [savingResult, setSavingResult] = useState(false);

  const fieldId = useId();
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);

  // The shell's filtered identifiers are the source of truth for what to show.
  useEffect(() => {
    let cancelled = false;
    setDetailState('loading');
    setDetailFailure(null);

    const load = async () => {
      try {
        const details = await Promise.all(identifiers.map((id) => client.getTestRun(id)));
        if (cancelled) return;
        // An entity the API did not identify cannot be addressed by its actions.
        setRuns(details.filter((run) => Boolean(run?.testRunId)));
        setDetailState('ready');
      } catch (error) {
        if (cancelled) return;
        setRuns([]);
        setDetailState('error');
        const failure = toFailure(error, 'Could not reach the Tucano Test API.');
        setDetailFailure(failure);
        onStatus(`Could not load test run details: ${failure.message}`, 'error');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [client, identifiers, onStatus]);

  useEffect(() => {
    if (!createRequest) return;
    setEditing(null);
    setPendingDelete(null);
    setNewRunId('');
    setNewRunSuiteId('');
    setShowCreate(true);
  }, [createRequest]);

  // Keyboard and screen reader users land on the safe choice of the confirmation.
  useEffect(() => {
    if (pendingDelete) cancelDeleteRef.current?.focus();
  }, [pendingDelete]);

  const closeCreateForm = () => {
    setShowCreate(false);
    setNewRunId('');
    setNewRunSuiteId('');
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const rawId = newRunId.trim() || `RUN-${Date.now()}`;
    const testRunId = rawId.endsWith('.json') ? rawId : `${rawId}.json`;
    const suite = suites.find((candidate) => candidate.suiteId === newRunSuiteId);

    try {
      await client.createTestRun({
        testRunId,
        timestamp: new Date().toISOString(),
        projects: [],
        testSuites: [],
        testCases: suite?.testCases ?? [],
      });
      closeCreateForm();
      await onChanged?.();
      onStatus(`Test run ${testRunId} created successfully.`);
    } catch (error) {
      const failure = toFailure(error, 'The API refused the request.');
      onStatus(`Could not create test run: ${failure.message}`, 'error');
    }
  };

  const openEditForm = (run: TestRun) => {
    setShowCreate(false);
    setPendingDelete(null);
    setEditSuiteId('');
    setEditTimestamp(toLocalInput(run.timestamp));
    setEditing(run);
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;

    const suite = suites.find((candidate) => candidate.suiteId === editSuiteId);
    const updated: TestRun = {
      ...editing,
      testRunId: editing.testRunId,
      timestamp: editTimestamp ? fromLocalInput(editTimestamp) : editing.timestamp,
      // Leaving the suite unselected keeps the run's current case selection.
      testCases: suite ? suite.testCases ?? [] : editing.testCases,
    };

    try {
      await client.updateTestRun(updated.testRunId, updated);
      setEditing(null);
      setEditSuiteId('');
      setEditTimestamp('');
      await onChanged?.();
      onStatus(`Test run ${updated.testRunId} updated successfully.`);
    } catch (error) {
      const failure = toFailure(error, 'The API refused the request.');
      onStatus(`Could not update test run: ${failure.message}`, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await client.deleteTestRun(id);
      setPendingDelete(null);
      if (executing?.testRunId === id) {
        setExecuting(null);
        setExecutingIndex(0);
      }
      await onChanged?.();
      onStatus(`Test run ${id} deleted.`);
    } catch (error) {
      const failure = toFailure(error, 'The API refused the request.');
      onStatus(`Could not delete test run: ${failure.message}`, 'error');
    }
  };

  const handleExecute = async (id: string) => {
    try {
      const run = await client.getTestRun(id);
      setExecuting(run);
      setExecutingIndex(0);
      onStatus(`Started executing run ${run.testRunId}.`);
    } catch (error) {
      const failure = toFailure(error, 'Could not reach the Tucano Test API.');
      onStatus(`Could not start test run: ${failure.message}`, 'error');
    }
  };

  const handleCloseExecution = () => {
    setExecuting(null);
    setExecutingIndex(0);
  };

  const handleSetResult = async (status: RunResultStatus) => {
    const cases = executing?.testCases ?? [];
    const currentCase = cases[executingIndex];
    if (!executing || !currentCase || savingResult) return;

    const updatedRun: TestRun = {
      ...executing,
      testCases: cases.map((testCase, index) =>
        index === executingIndex ? applyResult(testCase, status) : testCase,
      ),
    };

    setSavingResult(true);
    try {
      await client.updateTestRun(updatedRun.testRunId, updatedRun);
      setExecuting(updatedRun);
      onStatus(`Marked ${currentCase.title} as ${status}.`);
    } catch (error) {
      const failure = toFailure(error, 'The API refused the request.');
      onStatus(`Could not save the result: ${failure.message}`, 'error');
    } finally {
      setSavingResult(false);
    }
  };

  const executingCases = executing?.testCases ?? [];
  const currentCase = executingCases[executingIndex];
  const results = RESULT_STATUSES.map((status) => ({
    status,
    count: executingCases.filter((testCase) => resultFromCase(testCase) === status).length,
  }));

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '330px 1fr',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        background: '#ffffff',
      }}
    >
      <section className="panel-column is-divided" aria-label="Test runs">
        <div className="panel-header">
          <h2>Test runs</h2>
          <div className="menu-anchor">
            <button
              type="button"
              className="menu-button"
              onClick={() => {
                setEditing(null);
                setPendingDelete(null);
                setNewRunId('');
                setNewRunSuiteId('');
                setShowCreate(true);
              }}
            >
              + New
            </button>
          </div>
        </div>

        <div className="tree-scroll">
          {detailState === 'loading' && <p className="module-state">Fetching run details…</p>}

          {detailState === 'error' && detailFailure && (
            <div className="module-error">
              <p>Could not load test run details: {detailFailure.message}</p>
              <p className="module-error-code">Error code: {detailFailure.code}</p>
            </div>
          )}

          {detailState === 'ready' && identifiers.length === 0 && (
            <p className="module-state">No test runs to show.</p>
          )}

          {detailState === 'ready' && runs.length > 0 && (
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {runs.map((run) => {
                const cases = run.testCases ?? [];
                const passed = cases.filter((testCase) => resultFromCase(testCase) === 'Passed').length;
                const failed = cases.filter((testCase) => resultFromCase(testCase) === 'Failed').length;

                return (
                  <li key={run.testRunId}>
                    <div className="entity-card">
                      <div>
                        <h3 className="entity-card-title">▶️ {run.testRunId}</h3>
                        <p className="entity-card-meta">{run.timestamp}</p>
                        <p className="entity-card-meta">
                          {caseWord(cases.length)} — {passed} passed, {failed} failed
                        </p>
                      </div>

                      <div>
                        <div className="entity-card-actions">
                          <button
                            type="button"
                            aria-label={`Execute ${run.testRunId}`}
                            onClick={() => void handleExecute(run.testRunId)}
                          >
                            Execute
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            aria-label={`Details for ${run.testRunId}`}
                            onClick={() => onViewRun?.(run)}
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            aria-label={`Edit ${run.testRunId}`}
                            onClick={() => openEditForm(run)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-danger"
                            aria-label={`Delete ${run.testRunId}`}
                            onClick={() => setPendingDelete(run.testRunId)}
                          >
                            Delete
                          </button>
                        </div>

                        {pendingDelete === run.testRunId && (
                          <div
                            className="delete-confirm"
                            role="group"
                            aria-label={`Confirm deletion of ${run.testRunId}`}
                          >
                            <p>Delete {run.testRunId}? This cannot be undone.</p>
                            <div>
                              <button
                                type="button"
                                className="btn-secondary"
                                ref={cancelDeleteRef}
                                onClick={() => setPendingDelete(null)}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="btn-danger"
                                onClick={() => void handleDelete(run.testRunId)}
                              >
                                Confirm delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="panel-column" aria-label="Execution board">
        {!executing && (
          <p className="module-state">
            Select a run and choose Execute to record results. Any case already marked keeps its
            recorded result.
          </p>
        )}

        {executing && (
          <section className="card" style={{ margin: '16px', borderLeft: '4px solid #0f766e' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>Execution Workspace: {executing.testRunId}</h3>
                <button type="button" className="btn-secondary" onClick={handleCloseExecution}>
                  Close Execution
                </button>
              </div>
              <p style={{ fontSize: '13px', color: '#64748b' }}>
                <strong>Timestamp:</strong> {executing.timestamp}
              </p>

              {executingCases.length === 0 ? (
                <p style={{ color: '#64748b' }}>No test cases in this run to execute.</p>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '12px 0', flexWrap: 'wrap' }}>
                    <span className="badge badge-untested">
                      Case {executingIndex + 1} of {executingCases.length}
                    </span>
                    <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                      {results
                        .map(({ status, count }) => `${count} ${status.toLowerCase()}`)
                        .join(' · ')}
                    </span>
                  </div>

                  {/* Recorded results are announced as the execution moves on. */}
                  <p aria-live="polite" style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#475569' }}>
                    {currentCase
                      ? `Case ${executingIndex + 1} of ${executingCases.length}: ${currentCase.title} is ${resultFromCase(currentCase)}.`
                      : `Case ${executingIndex + 1} of ${executingCases.length}.`}
                  </p>

                  {currentCase && (
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '15px' }}>
                          {currentCase.title} ({currentCase.testCaseId})
                        </h4>
                        <StatusBadge status={resultFromCase(currentCase)} size="small" />
                      </div>
                      <p style={{ fontSize: '13px', margin: '4px 0' }}>
                        <strong>Expected Result:</strong> {currentCase.expectedResult}
                      </p>
                      {currentCase.description && (
                        <p style={{ fontSize: '13px', margin: '4px 0' }}>
                          <strong>Description:</strong> {currentCase.description}
                        </p>
                      )}
                      {currentCase.steps && (
                        <div style={{ marginTop: '8px' }}>
                          <strong style={{ fontSize: '13px' }}>Steps:</strong>
                          <ol className="steps-list">
                            {currentCase.steps.map((step, index) => (
                              <li key={index} className="step-item">
                                {stepText(step)}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                        {RESULT_STATUSES.map((status) => (
                          <button
                            key={status}
                            type="button"
                            className={status === 'Failed' ? 'btn-danger' : status === 'Untested' ? 'btn-secondary' : undefined}
                            style={status === 'Passed' ? { background: '#15803d' } : status === 'Blocked' ? { background: '#b45309' } : undefined}
                            disabled={savingResult}
                            onClick={() => void handleSetResult(status)}
                          >
                            {status === 'Untested' ? 'Reset Untested' : `Mark ${status}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={executingIndex === 0}
                      onClick={() => setExecutingIndex((index) => Math.max(0, index - 1))}
                    >
                      Previous Case
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={executingIndex >= executingCases.length - 1}
                      onClick={() =>
                        setExecutingIndex((index) => Math.min(executingCases.length - 1, index + 1))
                      }
                    >
                      Next Case
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </section>

      {showCreate && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={`${fieldId}-create-title`}>
          <div className="modal-content">
            <div className="modal-header">
              <h3 id={`${fieldId}-create-title`}>Create New Test Run</h3>
              <button type="button" className="btn-secondary" onClick={closeCreateForm}>
                Cancel
              </button>
            </div>
            <form className="form-grid" onSubmit={handleCreate}>
              <div className="form-group">
                <label htmlFor={`${fieldId}-create-id`}>Run ID (Filename)</label>
                <input
                  id={`${fieldId}-create-id`}
                  type="text"
                  required
                  value={newRunId}
                  onChange={(event) => setNewRunId(event.target.value)}
                  placeholder="e.g. Run-Sprint42.json"
                />
              </div>
              <div className="form-group">
                <label htmlFor={`${fieldId}-create-suite`}>Test suite (case selection)</label>
                <select
                  id={`${fieldId}-create-suite`}
                  value={newRunSuiteId}
                  onChange={(event) => setNewRunSuiteId(event.target.value)}
                >
                  <option value="">No suite — start with an empty run</option>
                  {suites.map((suite) => (
                    <option key={suite.suiteId} value={suite.suiteId}>
                      {suite.name || suite.suiteId} ({suite.testCases?.length ?? 0} test cases)
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit">Save Test Run</button>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={`${fieldId}-edit-title`}>
          <div className="modal-content">
            <div className="modal-header">
              <h3 id={`${fieldId}-edit-title`}>Edit Test Run: {editing.testRunId}</h3>
              <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
            <form className="form-grid" onSubmit={handleUpdate}>
              <div className="form-group">
                <label htmlFor={`${fieldId}-edit-timestamp`}>Run timestamp</label>
                <input
                  id={`${fieldId}-edit-timestamp`}
                  type="datetime-local"
                  value={editTimestamp}
                  onChange={(event) => setEditTimestamp(event.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor={`${fieldId}-edit-suite`}>Test suite (case selection)</label>
                <select
                  id={`${fieldId}-edit-suite`}
                  value={editSuiteId}
                  onChange={(event) => setEditSuiteId(event.target.value)}
                >
                  <option value="">
                    Keep the current {caseWord(editing.testCases?.length ?? 0)}
                  </option>
                  {suites.map((suite) => (
                    <option key={suite.suiteId} value={suite.suiteId}>
                      Replace with {suite.name || suite.suiteId} ({suite.testCases?.length ?? 0} test cases)
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit">Update Test Run</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
