import { useEffect, useId, useRef, useState } from 'react';
import { ApiRequestError, Project, TucanoApiClient } from '../../api/client';
import DetailPreviewPanel, {
  type PreviewField,
  type PreviewLinkList,
  type PreviewState,
} from '../../components/DetailPreviewPanel';

/**
 * Projects module (issue #70): the entity-module pattern the other modules follow.
 *
 * The shell owns the filtered identifier list and the shared live region; the
 * module resolves those identifiers into Project entities, renders the loading,
 * empty and error states, and performs every mutation through TucanoApiClient.
 * No view fetches on its own and no server-side workaround lives here.
 */

export interface ProjectsModuleProps {
  client: TucanoApiClient;
  /** Filtered identifiers from the shell; each one resolves to a Project. */
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

export default function ProjectsModule({
  client,
  identifiers,
  createRequest,
  onStatus,
  onChanged,
}: ProjectsModuleProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [detailState, setDetailState] = useState<DetailState>('loading');
  const [detailFailure, setDetailFailure] = useState<Failure | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newProjectId, setNewProjectId] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');

  const [editing, setEditing] = useState<Project | null>(null);
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
        const details = await Promise.all(identifiers.map((id) => client.getProject(id)));
        if (cancelled) return;
        // An entity the API did not identify cannot be addressed by its actions.
        setProjects(details.filter((project) => Boolean(project?.projectId)));
        setDetailState('ready');
      } catch (error) {
        if (cancelled) return;
        setProjects([]);
        setDetailState('error');
        const failure = toFailure(error, 'Could not reach the Tucano Test API.');
        setDetailFailure(failure);
        onStatus(`Could not load project details: ${failure.message}`, 'error');
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
    setNewProjectId('');
    setNewProjectName('');
    setNewProjectDescription('');
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const rawId = newProjectId.trim() || `PROJ-${Date.now()}`;
    const projectId = rawId.endsWith('.json') ? rawId : `${rawId}.json`;

    try {
      await client.createProject({
        projectId,
        name: newProjectName,
        description: newProjectDescription || undefined,
        testSuites: [],
      });
      closeCreateForm();
      await onChanged?.();
      onStatus(`Project ${projectId} created successfully.`);
    } catch (error) {
      const failure = toFailure(error, 'The API refused the request.');
      onStatus(`Could not create project: ${failure.message}`, 'error');
    }
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;

    try {
      await client.updateProject(editing.projectId, editing);
      setEditing(null);
      await onChanged?.();
      onStatus(`Project ${editing.projectId} updated successfully.`);
    } catch (error) {
      const failure = toFailure(error, 'The API refused the request.');
      onStatus(`Could not update project: ${failure.message}`, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await client.deleteProject(id);
      setPendingDelete(null);
      await onChanged?.();
      onStatus(`Project ${id} deleted.`);
    } catch (error) {
      const failure = toFailure(error, 'The API refused the request.');
      onStatus(`Could not delete project: ${failure.message}`, 'error');
    }
  };

  // The preview renders the entity the list already holds; no extra request.
  const preview = previewId
    ? (projects.find((project) => project.projectId === previewId) ?? null)
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
        { label: 'Project ID', value: preview.projectId },
        { label: 'Name', value: preview.name || '—' },
        { label: 'Description', value: preview.description || 'No description provided.' },
      ]
    : [];

  const previewLinks: PreviewLinkList[] = preview
    ? [
        {
          heading: 'Linked test suites',
          entries: preview.testSuites.map((suite) => `${suite.name} (${suite.suiteId})`),
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
    setPendingDelete(preview.projectId);
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
        <section className="panel-column is-divided" aria-label="Projects">
          <div className="tree-scroll">
            {detailState === 'loading' && (
              <p className="module-state">Fetching project details…</p>
            )}

            {detailState === 'error' && detailFailure && (
              <div className="module-error">
                <p>Could not load project details: {detailFailure.message}</p>
                <p className="module-error-code">Error code: {detailFailure.code}</p>
              </div>
            )}

            {detailState === 'ready' && identifiers.length === 0 && (
              <p className="module-state">No projects to show.</p>
            )}

            {detailState === 'ready' && projects.length > 0 && (
              <div className="view-grid-cards">
                {projects.map((project) => (
                  <div key={project.projectId} className="entity-card">
                    <div>
                      <h3 className="entity-card-title">🏢 {project.name || project.projectId}</h3>
                      <p className="entity-card-meta">{project.projectId}</p>
                      {project.description && (
                        <p className="entity-card-description">{project.description}</p>
                      )}
                      {project.testSuites?.length ? (
                        <p className="entity-card-meta">{project.testSuites.length} test suites</p>
                      ) : null}
                    </div>

                    <div>
                      <div className="entity-card-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          aria-pressed={previewId === project.projectId}
                          aria-label={`Details for ${project.projectId}`}
                          onClick={() => {
                            setPendingDelete(null);
                            setPreviewId(project.projectId);
                          }}
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          aria-label={`Edit ${project.projectId}`}
                          onClick={() => {
                            setPendingDelete(null);
                            setShowCreate(false);
                            setEditing(project);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-danger"
                          aria-label={`Delete ${project.projectId}`}
                          onClick={() => setPendingDelete(project.projectId)}
                        >
                          Delete
                        </button>
                      </div>

                      {pendingDelete === project.projectId && (
                        <div
                          className="delete-confirm"
                          role="group"
                          aria-label={`Confirm deletion of ${project.projectId}`}
                        >
                          <p>
                            Delete {project.projectId}? This cannot be undone.
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
                              onClick={() => void handleDelete(project.projectId)}
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
          label="Project details preview"
          heading={preview ? `Project ${preview.projectId}` : 'No project selected'}
          state={previewState}
          fields={previewFields}
          linkLists={previewLinks}
          emptyHint="Select a project and choose Details to preview it here."
          onClose={() => setPreviewId(null)}
          onEdit={preview ? editPreviewed : undefined}
          onDelete={preview ? deletePreviewed : undefined}
        />
      </div>

      {showCreate && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={`${fieldId}-create-title`}>
          <div className="modal-content">
            <div className="modal-header">
              <h3 id={`${fieldId}-create-title`}>Create New Project</h3>
              <button type="button" className="btn-secondary" onClick={closeCreateForm}>
                Cancel
              </button>
            </div>
            <form className="form-grid" onSubmit={handleCreate}>
              <div className="form-group">
                <label htmlFor={`${fieldId}-create-id`}>Project ID</label>
                <input
                  id={`${fieldId}-create-id`}
                  type="text"
                  required
                  value={newProjectId}
                  onChange={(event) => setNewProjectId(event.target.value)}
                  placeholder="e.g. PROJ-001"
                />
              </div>
              <div className="form-group">
                <label htmlFor={`${fieldId}-create-name`}>Project Name</label>
                <input
                  id={`${fieldId}-create-name`}
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  placeholder="Project Name"
                />
              </div>
              <div className="form-group">
                <label htmlFor={`${fieldId}-create-description`}>Description</label>
                <textarea
                  id={`${fieldId}-create-description`}
                  value={newProjectDescription}
                  onChange={(event) => setNewProjectDescription(event.target.value)}
                  placeholder="Project details..."
                />
              </div>
              <button type="submit">Save Project</button>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={`${fieldId}-edit-title`}>
          <div className="modal-content">
            <div className="modal-header">
              <h3 id={`${fieldId}-edit-title`}>Edit Project: {editing.projectId}</h3>
              <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
            <form className="form-grid" onSubmit={handleUpdate}>
              <div className="form-group">
                <label htmlFor={`${fieldId}-edit-name`}>Project Name</label>
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
              <button type="submit">Update Project</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
