import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client.js";
import { readApiError, type ApiErrorInfo } from "../../api/errors.js";
import { useAuth } from "../../app/AuthProvider.js";
import { EmptyState } from "../../components/StateViews.js";
import { Dialog } from "../../app/Dialog.js";
import { EntityForm, type EntityFormValues } from "../../app/EntityForm.js";
import { PlayIcon } from "../../components/Icon.js";

interface RunListPanelProps {
  projectId: string;
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
}

export function RunListPanel({
  projectId,
  selectedRunId,
  onSelectRun,
}: RunListPanelProps) {
  const { client } = useAuth();
  const [runs, setRuns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [creating, setCreating] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<ApiErrorInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch(() => client.projects.listProjectTestRuns({ id: projectId }))
      .then((listed) => {
        if (!cancelled) {
          setRuns(listed as unknown as string[]);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(readApiError(err, "Failed to load runs"));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, projectId]);

  const createRun = async (values: EntityFormValues) => {
    setCreateBusy(true);
    setCreateError(null);
    try {
      const created = await apiFetch(() =>
        client.projects.addProjectTestRun({
          id: projectId,
          requestBody: { name: values.name },
        }),
      );
      setRuns([...runs, created.id]);
      setCreating(false);
      onSelectRun(created.id);
    } catch (err: unknown) {
      setCreateError(readApiError(err, "Failed to create run"));
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <div className="suite-tree">
      <div className="suite-tree__header">
        <h2 className="suite-tree__title">Runs</h2>
        <button
          type="button"
          className="btn btn-icon"
          title="New run"
          aria-label="New run"
          onClick={() => setCreating(true)}
        >
          +
        </button>
      </div>

      {creating && (
        <Dialog title="New run" onClose={() => setCreating(false)}>
          <EntityForm
            submitLabel="Create run"
            derivedIdLabel="run"
            busy={createBusy}
            error={createError}
            onSubmit={createRun}
            onCancel={() => setCreating(false)}
          />
        </Dialog>
      )}

      {loading ? (
        <div className="loading" role="status">
          <div className="loading__spinner" />
          <span className="sr-only">Loading runs…</span>
        </div>
      ) : error ? (
        <p className="suite-tree__error">{error.message}</p>
      ) : runs.length === 0 ? (
        <EmptyState icon={<PlayIcon />} message="No runs yet" />
      ) : (
        <div className="suite-tree__nodes" role="tree">
          {runs.map((runId) => (
            <button
              key={runId}
              type="button"
              className={`suite-tree__node ${
                selectedRunId === runId ? "suite-tree__node--active" : ""
              }`}
              onClick={() => onSelectRun(runId)}
              role="treeitem"
            >
              <span className="suite-tree__icon" aria-hidden="true">
                <PlayIcon />
              </span>
              <span className="suite-tree__label">{runId}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
