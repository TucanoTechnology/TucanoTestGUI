import { useEffect, useId, useRef, useState } from 'react';
import { ApiRequestError, TestSuite, TucanoApiClient } from '../../api/client';
import DetailPreviewPanel, {
  type PreviewField,
  type PreviewLinkList,
  type PreviewState,
} from '../../components/DetailPreviewPanel';

/**
 * Test suites module (issue #71): the entity-module pattern the other modules follow.
 *
 * The shell owns the filtered identifier list and the shared live region; the
 * module resolves those identifiers into TestSuite entities, renders the loading,
 * empty and error states, and performs every mutation through TucanoApiClient.
 * Nested test cases stay out of scope: they are edited by the cases module.
 */

export interface TestSuitesModuleProps {
  client: TucanoApiClient;
  /** Filtered identifiers from the shell; each one resolves to a TestSuite. */
  identifiers: readonly string[];
  /** Bumped by a shell affordance to open the create form. */
  createRequest?: number;
  onStatus: (message: string, state?: 'info' | 'error') => void;
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

export default function TestSuitesModule({
  client,
  identifiers,
  createRequest,
  onStatus,
  onChanged,
}: TestSuitesModuleProps) {
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [detailState, setDetailState] = useState<DetailState>('loading');
  const [detailFailure, setDetailFailure] = useState<Failure | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newSuiteId, setNewSuiteId] = useState('');
  const [newSuiteName, setNewSuiteName] = useState('');
  const [newSuiteDescription, setNewSuiteDescription] = useState('');

  const [editing, setEditing] = useState<TestSuite | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const fieldId = useId();
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);

  // The shell's filtered identifiers are the source of truth for what to show.
  useEffect(() => {
    let cancelled = false;
    setDetailState('loading');
    setDetailFailure(null);

    const load = async () => {
      try {
        const details = await Promise.all(identifiers.map((id) => client.getTestSuite(id)));
        if (cancelled) return;
        // An entity the API did not identify cannot be addressed by its actions.
        setSuites(details.filter((suite) => Boolean(suite?.suiteId)));
        setDetailState('ready');
      } catch (error) {
        if (cancelled) return;
        setSuites([]);
        setDetailState('error');
        const failure = toFailure(error, 'Could not reach the Tucano Test API.');
        setDetailFailure(failure);
        onStatus(`Could not load suite details: ${failure.message}`, 'error');
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
    setNewSuiteId('');
    setNewSuiteName('');
    setNewSuiteDescription('');
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const rawId = newSuiteId.trim() || `SUITE-${Date.now()}`;
    const suiteId = rawId.endsWith('.json') ? rawId : `${rawId}.json`;

    try {
      await client.createTestSuite({
        suiteId,
        name: newSuiteName,
        description: newSuiteDescription || undefined,
        testCases: [],
      });
      closeCreateForm();
      await onChanged?.();
      onStatus(`Test suite ${suiteId} created successfully.`);
    } catch (error) {
      const failure = toFailure(error, 'The API refused the request.');
      onStatus(`Could not create test suite: ${failure.message}`, 'error');
    }
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;

    try {
      await client.updateTestSuite(editing.suiteId, editing);
      setEditing(null);
      await onChanged?.();
      onStatus(`Test suite ${editing.suiteId} updated successfully.`);
    } catch (error) {
      const failure = toFailure(error, 'The API refused the request.');
      onStatus(`Could not update test suite: ${failure.message}`, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await client.deleteTestSuite(id);
      setPendingDelete(null);
      await onChanged?.();
      onStatus(`Test suite ${id} deleted.`);
    } catch (error) {
      const failure = toFailure(error, 'The API refused the request.');
      onStatus(`Could not delete test suite: ${failure.message}`, 'error');
    }
  };

  // The preview renders the entity the list already holds; no extra request.
  const preview = previewId
    ? (suites.find((suite) => suite.suiteId === previewId) ?? null)
    : null;

  // The list pane already reports the shared fetch failure, so the preview pane
  // stays empty rather than repeating the same envelope beside it.
  const previewState: PreviewState = preview
    ? 'ready'
    : detailState === 'loading'
      ? 'loading'
      : 'empty';

  const previewFields: PreviewField[] = preview
    ? [
        { label: 'Suite ID', value: preview.suiteId },
        { label: 'Name', value: preview.name || '—' },
        { label: 'Description', value: preview.description || 'No description provided.' },
      ]
    : [];

  const previewLinks: PreviewLinkList[] = preview
    ? [
        {
          heading: 'Test cases',
          entries: preview.testCases.map((item) => `${item.title} (${item.testCaseId})`),
        },
      ]
    : [];

  const editPreviewed = () => {
    if (!preview) return;
    setPendingDelete(null);
    setShowCreate(false);
    setEditing(preview);
  };

  // Deletion is confirmed in the list, so the preview steps aside for it.
  const deletePreviewed = () => {
    if (!preview) return;
    setPreviewId(null);
    setPendingDelete(preview.suiteId);
  };

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          height: '100%',
          width: '100%',
          overflow: 'hidden',
        }}
      >
        <section className="panel-column is-divided" aria-label="Test suites">
          <div className="tree-scroll">
            {detailState === 'loading' && (
              <p className="module-state">Fetching suite details…</p>
            )}

            {detailState === 'error' && detailFailure && (
              <div className="module-error">
                <p>Could not load suite details: {detailFailure.message}</p>
                <p className="module-error-code">Error code: {detailFailure.code}</p>
              </div>
            )}

            {detailState === 'ready' && identifiers.length === 0 && (
              <p className="module-state">No test suites to show.</p>
            )}

            {detailState === 'ready' && suites.length > 0 && (
              <div className="view-grid-cards">
                {suites.map((suite) => (
                  <div key={suite.suiteId} className="entity-card">
                    <div>
                      <h3 className="entity-card-title">📁 {suite.name || suite.suiteId}</h3>
                      <p className="entity-card-meta">{suite.suiteId}</p>
                      {suite.description && (
                        <p className="entity-card-description">{suite.description}</p>
                      )}
                      {suite.testCases?.length ? (
                        <p className="entity-card-meta">{suite.testCases.length} test cases</p>
                      ) : null}
                    </div>

                    <div>
                      <div className="entity-card-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          aria-pressed={previewId === suite.suiteId}
                          aria-label={`Details for ${suite.suiteId}`}
                          onClick={() => {
                            setPendingDelete(null);
                            setPreviewId(suite.suiteId);
                          }}
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          aria-label={`Edit ${suite.suiteId}`}
                          onClick={() => {
                            setPendingDelete(null);
                            setShowCreate(false);
                            setEditing(suite);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-danger"
                          aria-label={`Delete ${suite.suiteId}`}
                          onClick={() => setPendingDelete(suite.suiteId)}
                        >
                          Delete
                        </button>
                      </div>

                      {pendingDelete === suite.suiteId && (
                        <div
                          className="delete-confirm"
                          role="group"
                          aria-label={`Confirm deletion of ${suite.suiteId}`}
                        >
                          <p>
                            Delete {suite.suiteId}? This cannot be undone.
                          </p>
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
                              onClick={() => void handleDelete(suite.suiteId)}
                            >
                              Confirm delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <DetailPreviewPanel
          label="Test suite details preview"
          heading={preview ? `Test suite ${preview.suiteId}` : 'No test suite selected'}
          state={previewState}
          fields={previewFields}
          linkLists={previewLinks}
          emptyHint="Select a test suite and choose Details to preview it here."
          onClose={() => setPreviewId(null)}
          onEdit={preview ? editPreviewed : undefined}
          onDelete={preview ? deletePreviewed : undefined}
        />
      </div>

      {showCreate && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={`${fieldId}-create-title`}>
          <div className="modal-content">
            <div className="modal-header">
              <h3 id={`${fieldId}-create-title`}>Create New Test Suite</h3>
              <button type="button" className="btn-secondary" onClick={closeCreateForm}>
                Cancel
              </button>
            </div>
            <form className="form-grid" onSubmit={handleCreate}>
              <div className="form-group">
                <label htmlFor={`${fieldId}-create-id`}>Suite ID (Filename)</label>
                <input
                  id={`${fieldId}-create-id`}
                  type="text"
                  required
                  value={newSuiteId}
                  onChange={(event) => setNewSuiteId(event.target.value)}
                  placeholder="e.g. SmokeTest.json"
                />
              </div>
              <div className="form-group">
                <label htmlFor={`${fieldId}-create-name`}>Suite Name</label>
                <input
                  id={`${fieldId}-create-name`}
                  type="text"
                  required
                  value={newSuiteName}
                  onChange={(event) => setNewSuiteName(event.target.value)}
                  placeholder="Smoke Test Suite"
                />
              </div>
              <div className="form-group">
                <label htmlFor={`${fieldId}-create-description`}>Description</label>
                <textarea
                  id={`${fieldId}-create-description`}
                  value={newSuiteDescription}
                  onChange={(event) => setNewSuiteDescription(event.target.value)}
                  placeholder="Suite overview..."
                />
              </div>
              <button type="submit">Save Test Suite</button>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={`${fieldId}-edit-title`}>
          <div className="modal-content">
            <div className="modal-header">
              <h3 id={`${fieldId}-edit-title`}>Edit Test Suite: {editing.suiteId}</h3>
              <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
            <form className="form-grid" onSubmit={handleUpdate}>
              <div className="form-group">
                <label htmlFor={`${fieldId}-edit-name`}>Suite Name</label>
                <input
                  id={`${fieldId}-edit-name`}
                  type="text"
                  required
                  value={editing.name}
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor={`${fieldId}-edit-description`}>Description</label>
                <textarea
                  id={`${fieldId}-edit-description`}
                  value={editing.description || ''}
                  onChange={(event) => setEditing({ ...editing, description: event.target.value })}
                />
              </div>
              <button type="submit">Update Test Suite</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
