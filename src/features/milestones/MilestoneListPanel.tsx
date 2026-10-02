import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client.js";
import { readApiError, type ApiErrorInfo } from "../../api/errors.js";
import { useAuth } from "../../app/AuthProvider.js";
import { EmptyState } from "../../components/StateViews.js";
import { Dialog } from "../../app/Dialog.js";
import { EntityForm, type EntityFormValues } from "../../app/EntityForm.js";
import { TargetIcon } from "../../components/Icon.js";

interface MilestoneListPanelProps {
  projectId: string;
  selectedMilestoneId: string | null;
  onSelectMilestone: (milestoneId: string) => void;
}

export function MilestoneListPanel({
  projectId,
  selectedMilestoneId,
  onSelectMilestone,
}: MilestoneListPanelProps) {
  const { client } = useAuth();
  const [milestones, setMilestones] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [creating, setCreating] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<ApiErrorInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch(() => client.projects.listProjectMilestones({ id: projectId }))
      .then((listed) => {
        if (!cancelled) {
          setMilestones(listed as unknown as string[]);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(readApiError(err, "Failed to load milestones"));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, projectId]);

  const createMilestone = async (values: EntityFormValues) => {
    setCreateBusy(true);
    setCreateError(null);
    try {
      const created = await apiFetch(() =>
        client.projects.addProjectMilestone({
          id: projectId,
          requestBody: { name: values.name },
        }),
      );
      setMilestones([...milestones, created.id]);
      setCreating(false);
      onSelectMilestone(created.id);
    } catch (err: unknown) {
      setCreateError(readApiError(err, "Failed to create milestone"));
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <div className="suite-tree">
      <div className="suite-tree__header">
        <h2 className="suite-tree__title">Milestones</h2>
        <button
          type="button"
          className="btn btn-icon"
          title="New milestone"
          aria-label="New milestone"
          onClick={() => setCreating(true)}
        >
          +
        </button>
      </div>

      {creating && (
        <Dialog title="New milestone" onClose={() => setCreating(false)}>
          <EntityForm
            submitLabel="Create milestone"
            derivedIdLabel="milestone"
            busy={createBusy}
            error={createError}
            onSubmit={createMilestone}
            onCancel={() => setCreating(false)}
          />
        </Dialog>
      )}

      {loading ? (
        <div className="loading" role="status">
          <div className="loading__spinner" />
          <span className="sr-only">Loading milestones…</span>
        </div>
      ) : error ? (
        <p className="suite-tree__error">{error.message}</p>
      ) : milestones.length === 0 ? (
        <EmptyState icon={<TargetIcon />} message="No milestones yet" />
      ) : (
        <div className="suite-tree__nodes" role="tree">
          {milestones.map((milestoneId) => (
            <button
              key={milestoneId}
              type="button"
              className={`suite-tree__node ${
                selectedMilestoneId === milestoneId
                  ? "suite-tree__node--active"
                  : ""
              }`}
              onClick={() => onSelectMilestone(milestoneId)}
              role="treeitem"
            >
              <span className="suite-tree__icon" aria-hidden="true">
                <TargetIcon />
              </span>
              <span className="suite-tree__label">{milestoneId}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
