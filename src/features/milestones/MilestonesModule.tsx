import { useEffect, useId, useRef, useState } from 'react';
import {
  ApiRequestError,
  Milestone,
  MilestoneProgress,
  TucanoApiClient,
} from '../../api/client';

/**
 * Milestones module (issue #74): release milestones and their aggregated progress.
 *
 * The shell owns the filtered identifier list and the shared live region; the
 * module resolves those identifiers into Milestone entities, renders the
 * loading, empty and error states, performs every mutation through
 * TucanoApiClient and asks the API for the release summary. The pass rate is
 * never computed here — `getMilestoneProgress` is the only source for it.
 */

/** The statuses the create and edit forms offer. */
export const MILESTONE_STATUSES = ['Open', 'In Progress', 'Completed'] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

/** The API reports the aggregate; the module only formats it for display. */
export function passRateLabel(progress: MilestoneProgress): string {
  return `${progress.passPercentage.toFixed(1)}%`;
}

/** A percentage outside 0–100 cannot be painted, so the fill is bounded. */
export function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export interface MilestonesModuleProps {
  client: TucanoApiClient;
  /** Filtered identifiers from the shell; each one resolves to a Milestone. */
  identifiers: readonly string[];
  /** Bumped by a shell affordance to open the create form. */
  createRequest?: number;
  onStatus: (message: string, state?: 'info' | 'error') => void;
  /** Awaited so the shell finishes refreshing before the module announces. */
  onChanged?: () => void | Promise<void>;
}

type DetailState = 'loading' | 'ready' | 'error';
type ProgressState = 'loading' | 'ready' | 'error';

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

/** Linked suites and runs are read-only at MVP: the milestone only lists them. */
function LinkedIds({ heading, ids }: { heading: string; ids: readonly string[] }) {
  if (ids.length === 0) return null;

  return (
    <div style={{ marginTop: '16px' }}>
      <h4 style={{ margin: '0 0 4px 0', fontSize: '13.5px' }}>
        {heading} ({ids.length})
      </h4>
      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#475569' }}>
        {ids.map((id) => (
          <li key={id}>{id}</li>
        ))}
      </ul>
    </div>
  );
}

export default function MilestonesModule({
  client,
  identifiers,
  createRequest,
  onStatus,
  onChanged,
}: MilestonesModuleProps) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [detailState, setDetailState] = useState<DetailState>('loading');
  const [detailFailure, setDetailFailure] = useState<Failure | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newMilestoneId, setNewMilestoneId] = useState('');
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [newMilestoneDescription, setNewMilestoneDescription] = useState('');
  const [newMilestoneStartDate, setNewMilestoneStartDate] = useState('');
  const [newMilestoneTargetDate, setNewMilestoneTargetDate] = useState('');
  const [newMilestoneStatus, setNewMilestoneStatus] = useState<string>('Open');

  const [editing, setEditing] = useState<Milestone | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const [selected, setSelected] = useState<Milestone | null>(null);
  const [progress, setProgress] = useState<MilestoneProgress | null>(null);
  const [progressState, setProgressState] = useState<ProgressState>('loading');
  const [progressFailure, setProgressFailure] = useState<Failure | null>(null);

  const fieldId = useId();
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  // A slow answer for a milestone the tester has already left must not win.
  const progressRequestRef = useRef(0);

  // The shell's filtered identifiers are the source of truth for what to show.
  useEffect(() => {
    let cancelled = false;
    setDetailState('loading');
    setDetailFailure(null);

    const load = async () => {
      try {
        const details = await Promise.all(identifiers.map((id) => client.getMilestone(id)));
        if (cancelled) return;
        // An entity the API did not identify cannot be addressed by its actions.
        setMilestones(details.filter((milestone) => Boolean(milestone?.milestoneId)));
        setDetailState('ready');
      } catch (error) {
        if (cancelled) return;
        setMilestones([]);
        setDetailState('error');
        const failure = toFailure(error, 'Could not reach the Tucano Test API.');
        setDetailFailure(failure);
        onStatus(`Could not load milestone details: ${failure.message}`, 'error');
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
    setShowCreate(true);
  }, [createRequest]);

  // Keyboard and screen reader users land on the safe choice of the confirmation.
  useEffect(() => {
    if (pendingDelete) cancelDeleteRef.current?.focus();
  }, [pendingDelete]);

  const closeCreateForm = () => {
    setShowCreate(false);
    setNewMilestoneId('');
    setNewMilestoneName('');
    setNewMilestoneDescription('');
    setNewMilestoneStartDate('');
    setNewMilestoneTargetDate('');
    setNewMilestoneStatus('Open');
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const rawId = newMilestoneId.trim() || `M-${Date.now()}`;
    const milestoneId = rawId.endsWith('.json') ? rawId : `${rawId}.json`;

    try {
      await client.createMilestone({
        milestoneId,
        name: newMilestoneName,
        description: newMilestoneDescription || undefined,
        startDate: newMilestoneStartDate || undefined,
        targetDate: newMilestoneTargetDate || undefined,
        status: newMilestoneStatus,
        testSuiteIds: [],
        testRunIds: [],
      });
      closeCreateForm();
      await onChanged?.();
      onStatus(`Milestone ${milestoneId} created successfully.`);
    } catch (error) {
      const failure = toFailure(error, 'The API refused the request.');
      onStatus(`Could not create milestone: ${failure.message}`, 'error');
    }
  };

  const openEditForm = (milestone: Milestone) => {
    setShowCreate(false);
    setPendingDelete(null);
    setEditing(milestone);
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;

    const updated: Milestone = { ...editing, milestoneId: editing.milestoneId };

    try {
      await client.updateMilestone(updated.milestoneId, updated);
      setEditing(null);
      // The open summary must not keep rendering the details that just changed.
      if (selected?.milestoneId === updated.milestoneId) setSelected(updated);
      await onChanged?.();
      onStatus(`Milestone ${updated.milestoneId} updated successfully.`);
    } catch (error) {
      const failure = toFailure(error, 'The API refused the request.');
      onStatus(`Could not update milestone: ${failure.message}`, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await client.deleteMilestone(id);
      setPendingDelete(null);
      if (selected?.milestoneId === id) {
        setSelected(null);
        setProgress(null);
      }
      await onChanged?.();
      onStatus(`Milestone ${id} deleted.`);
    } catch (error) {
      const failure = toFailure(error, 'The API refused the request.');
      onStatus(`Could not delete milestone: ${failure.message}`, 'error');
    }
  };

  const openProgress = async (milestone: Milestone) => {
    const request = progressRequestRef.current + 1;
    progressRequestRef.current = request;

    setSelected(milestone);
    setProgress(null);
    setProgressFailure(null);
    setProgressState('loading');

    try {
      const summary = await client.getMilestoneProgress(milestone.milestoneId);
      if (progressRequestRef.current !== request) return;
      setProgress(summary);
      setProgressState('ready');
      onStatus(`Showing progress for ${milestone.milestoneId}.`);
    } catch (error) {
      if (progressRequestRef.current !== request) return;
      const failure = toFailure(error, 'Could not reach the Tucano Test API.');
      setProgressState('error');
      setProgressFailure(failure);
      onStatus(`Could not load milestone progress: ${failure.message}`, 'error');
    }
  };

  const closeProgress = () => {
    progressRequestRef.current += 1;
    setSelected(null);
    setProgress(null);
  };

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
      <section className="panel-column is-divided" aria-label="Milestones">
        <div className="panel-header">
          <h2>Milestones</h2>
          <div className="menu-anchor">
            <button
              type="button"
              className="menu-button"
              onClick={() => {
                setEditing(null);
                setPendingDelete(null);
                setNewMilestoneId('');
                setNewMilestoneName('');
                setNewMilestoneDescription('');
                setNewMilestoneStartDate('');
                setNewMilestoneTargetDate('');
                setNewMilestoneStatus('Open');
                setShowCreate(true);
              }}
            >
              + New
            </button>
          </div>
        </div>

        <div className="tree-scroll">
          {detailState === 'loading' && (
            <p className="module-state">Fetching milestone details…</p>
          )}

          {detailState === 'error' && detailFailure && (
            <div className="module-error">
              <p>Could not load milestone details: {detailFailure.message}</p>
              <p className="module-error-code">Error code: {detailFailure.code}</p>
            </div>
          )}

          {detailState === 'ready' && identifiers.length === 0 && (
            <p className="module-state">No milestones to show.</p>
          )}

          {detailState === 'ready' && milestones.length > 0 && (
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
              {milestones.map((milestone) => (
                <li key={milestone.milestoneId}>
                  <div className="entity-card">
                    <div>
                      <h3 className="entity-card-title">🎯 {milestone.name || milestone.milestoneId}</h3>
                      <p className="entity-card-meta">{milestone.milestoneId}</p>
                      <p className="entity-card-meta">Status: {milestone.status || 'Open'}</p>
                      {(milestone.startDate || milestone.targetDate) && (
                        <p className="entity-card-meta">
                          {milestone.startDate || 'Not scheduled'} → {milestone.targetDate || 'no target'}
                        </p>
                      )}
                      <p className="entity-card-meta">
                        {milestone.testSuiteIds?.length ?? 0} linked suites,{' '}
                        {milestone.testRunIds?.length ?? 0} linked runs
                      </p>
                      {milestone.description && (
                        <p className="entity-card-description">{milestone.description}</p>
                      )}
                    </div>

                    <div>
                      <div className="entity-card-actions">
                        <button
                          type="button"
                          aria-label={`Progress for ${milestone.milestoneId}`}
                          aria-pressed={selected?.milestoneId === milestone.milestoneId}
                          onClick={() => void openProgress(milestone)}
                        >
                          Progress
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          aria-label={`Edit ${milestone.milestoneId}`}
                          onClick={() => openEditForm(milestone)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-danger"
                          aria-label={`Delete ${milestone.milestoneId}`}
                          onClick={() => setPendingDelete(milestone.milestoneId)}
                        >
                          Delete
                        </button>
                      </div>

                      {pendingDelete === milestone.milestoneId && (
                        <div
                          className="delete-confirm"
                          role="group"
                          aria-label={`Confirm deletion of ${milestone.milestoneId}`}
                        >
                          <p>Delete {milestone.milestoneId}? This cannot be undone.</p>
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
                              onClick={() => void handleDelete(milestone.milestoneId)}
                            >
                              Confirm delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="panel-column" aria-label="Milestone progress">
        {!selected && (
          <p className="module-state">
            Select a milestone and choose Progress to see its release summary.
          </p>
        )}

        {selected && progressState === 'loading' && (
          <p className="module-state">Fetching milestone progress…</p>
        )}

        {selected && progressState === 'error' && progressFailure && (
          <div className="module-error">
            <p>Could not load milestone progress: {progressFailure.message}</p>
            <p className="module-error-code">Error code: {progressFailure.code}</p>
          </div>
        )}

        {selected && progressState === 'ready' && progress && (
          <section className="card" style={{ margin: '16px', borderLeft: '4px solid #0f766e' }}>
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '16px' }}>
                  Milestone Progress: {selected.milestoneId}
                </h3>
                <button type="button" className="btn-secondary" onClick={closeProgress}>
                  Close progress
                </button>
              </div>

              <p style={{ fontSize: '13px', color: '#475569', margin: '8px 0 0 0' }}>
                <strong>Name:</strong> {selected.name || selected.milestoneId}
              </p>
              <p style={{ fontSize: '13px', color: '#475569', margin: '4px 0 0 0' }}>
                <strong>Status:</strong> {selected.status || 'Open'}
              </p>
              <p style={{ fontSize: '13px', color: '#475569', margin: '4px 0 0 0' }}>
                <strong>Start date:</strong> {selected.startDate || 'Not set'}
              </p>
              <p style={{ fontSize: '13px', color: '#475569', margin: '4px 0 0 0' }}>
                <strong>Target date:</strong> {selected.targetDate || 'Not set'}
              </p>
              {selected.description && (
                <p style={{ fontSize: '13px', color: '#475569', margin: '8px 0 0 0' }}>
                  {selected.description}
                </p>
              )}

              {/* The aggregate is announced as a sentence, not conveyed by the fill. */}
              <p
                aria-live="polite"
                style={{ margin: '12px 0 0 0', fontSize: '13px', color: '#475569' }}
              >
                Pass rate for {selected.milestoneId}: {passRateLabel(progress)} over{' '}
                {progress.totalCases} cases.
              </p>

              <div
                className="progress-container"
                role="progressbar"
                aria-label={`Pass rate for ${selected.milestoneId}`}
                aria-valuenow={clampPercentage(progress.passPercentage)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="progress-bar"
                  style={{ width: `${clampPercentage(progress.passPercentage)}%` }}
                />
              </div>

              <ul
                style={{
                  listStyle: 'none',
                  margin: '12px 0 0 0',
                  padding: 0,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                <li>
                  <span className="badge badge-untested">Total cases: {progress.totalCases}</span>
                </li>
                <li>
                  <span className="badge badge-pass">Passed: {progress.passed}</span>
                </li>
                <li>
                  <span className="badge badge-fail">Failed: {progress.failed}</span>
                </li>
                <li>
                  <span className="badge badge-blocked">Blocked: {progress.blocked}</span>
                </li>
                <li>
                  <span className="badge badge-untested">Untested: {progress.untested}</span>
                </li>
                <li>
                  <span className="badge badge-retest">Retest: {progress.retest}</span>
                </li>
              </ul>

              <LinkedIds heading="Linked test suites" ids={selected.testSuiteIds ?? []} />
              <LinkedIds heading="Linked test runs" ids={selected.testRunIds ?? []} />
            </div>
          </section>
        )}
      </section>

      {showCreate && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${fieldId}-create-title`}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3 id={`${fieldId}-create-title`}>Create New Milestone</h3>
              <button type="button" className="btn-secondary" onClick={closeCreateForm}>
                Cancel
              </button>
            </div>
            <form className="form-grid" onSubmit={handleCreate}>
              <div className="form-group">
                <label htmlFor={`${fieldId}-create-id`}>Milestone ID (Filename)</label>
                <input
                  id={`${fieldId}-create-id`}
                  type="text"
                  required
                  value={newMilestoneId}
                  onChange={(event) => setNewMilestoneId(event.target.value)}
                  placeholder="e.g. v1.0-RC1.json"
                />
              </div>
              <div className="form-group">
                <label htmlFor={`${fieldId}-create-name`}>Milestone Name</label>
                <input
                  id={`${fieldId}-create-name`}
                  type="text"
                  required
                  value={newMilestoneName}
                  onChange={(event) => setNewMilestoneName(event.target.value)}
                  placeholder="e.g. Release v1.0"
                />
              </div>
              <div className="form-group">
                <label htmlFor={`${fieldId}-create-start-date`}>Start Date</label>
                <input
                  id={`${fieldId}-create-start-date`}
                  type="date"
                  value={newMilestoneStartDate}
                  onChange={(event) => setNewMilestoneStartDate(event.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor={`${fieldId}-create-target-date`}>Target Date</label>
                <input
                  id={`${fieldId}-create-target-date`}
                  type="date"
                  value={newMilestoneTargetDate}
                  onChange={(event) => setNewMilestoneTargetDate(event.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor={`${fieldId}-create-status`}>Status</label>
                <select
                  id={`${fieldId}-create-status`}
                  value={newMilestoneStatus}
                  onChange={(event) => setNewMilestoneStatus(event.target.value)}
                >
                  {MILESTONE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor={`${fieldId}-create-description`}>Description</label>
                <textarea
                  id={`${fieldId}-create-description`}
                  value={newMilestoneDescription}
                  onChange={(event) => setNewMilestoneDescription(event.target.value)}
                  placeholder="Release goal and scope..."
                />
              </div>
              <button type="submit">Save Milestone</button>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${fieldId}-edit-title`}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3 id={`${fieldId}-edit-title`}>Edit Milestone: {editing.milestoneId}</h3>
              <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
            <form className="form-grid" onSubmit={handleUpdate}>
              <div className="form-group">
                <label htmlFor={`${fieldId}-edit-name`}>Milestone Name</label>
                <input
                  id={`${fieldId}-edit-name`}
                  type="text"
                  required
                  value={editing.name}
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor={`${fieldId}-edit-start-date`}>Start Date</label>
                <input
                  id={`${fieldId}-edit-start-date`}
                  type="date"
                  value={editing.startDate || ''}
                  onChange={(event) => setEditing({ ...editing, startDate: event.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor={`${fieldId}-edit-target-date`}>Target Date</label>
                <input
                  id={`${fieldId}-edit-target-date`}
                  type="date"
                  value={editing.targetDate || ''}
                  onChange={(event) => setEditing({ ...editing, targetDate: event.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor={`${fieldId}-edit-status`}>Status</label>
                <select
                  id={`${fieldId}-edit-status`}
                  value={editing.status || 'Open'}
                  onChange={(event) => setEditing({ ...editing, status: event.target.value })}
                >
                  {MILESTONE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor={`${fieldId}-edit-description`}>Description</label>
                <textarea
                  id={`${fieldId}-edit-description`}
                  value={editing.description || ''}
                  onChange={(event) => setEditing({ ...editing, description: event.target.value })}
                />
              </div>
              <button type="submit">Update Milestone</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
