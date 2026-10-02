import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client.js";
import { readApiError, type ApiErrorInfo } from "../../api/errors.js";
import { useAuth } from "../../app/AuthProvider.js";
import { EmptyState } from "../../components/StateViews.js";
import { Dialog } from "../../app/Dialog.js";
import { EntityForm, type EntityFormValues } from "../../app/EntityForm.js";
import { SettingsIcon } from "../../components/Icon.js";

interface ConfigurationListPanelProps {
  projectId: string;
  selectedConfigId: string | null;
  onSelectConfiguration: (configId: string) => void;
}

export function ConfigurationListPanel({
  projectId,
  selectedConfigId,
  onSelectConfiguration,
}: ConfigurationListPanelProps) {
  const { client } = useAuth();
  const [configurations, setConfigurations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [creating, setCreating] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<ApiErrorInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch(() =>
      client.projects.listProjectConfigurations({ id: projectId }),
    )
      .then((listed) => {
        if (!cancelled) {
          setConfigurations(listed as unknown as string[]);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(readApiError(err, "Failed to load configurations"));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, projectId]);

  const createConfiguration = async (values: EntityFormValues) => {
    setCreateBusy(true);
    setCreateError(null);
    try {
      const created = await apiFetch(() =>
        client.projects.addProjectConfiguration({
          id: projectId,
          requestBody: { name: values.name },
        }),
      );
      setConfigurations([...configurations, created.id]);
      setCreating(false);
      onSelectConfiguration(created.id);
    } catch (err: unknown) {
      setCreateError(readApiError(err, "Failed to create configuration"));
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <div className="suite-tree">
      <div className="suite-tree__header">
        <h2 className="suite-tree__title">Configurations</h2>
        <button
          type="button"
          className="btn btn-icon"
          title="New configuration"
          aria-label="New configuration"
          onClick={() => setCreating(true)}
        >
          +
        </button>
      </div>

      {creating && (
        <Dialog title="New configuration" onClose={() => setCreating(false)}>
          <EntityForm
            submitLabel="Create configuration"
            derivedIdLabel="configuration"
            busy={createBusy}
            error={createError}
            onSubmit={createConfiguration}
            onCancel={() => setCreating(false)}
          />
        </Dialog>
      )}

      {loading ? (
        <div className="loading" role="status">
          <div className="loading__spinner" />
          <span className="sr-only">Loading configurations…</span>
        </div>
      ) : error ? (
        <p className="suite-tree__error">{error.message}</p>
      ) : configurations.length === 0 ? (
        <EmptyState icon={<SettingsIcon />} message="No configurations yet" />
      ) : (
        <div className="suite-tree__nodes" role="tree">
          {configurations.map((configId) => (
            <button
              key={configId}
              type="button"
              className={`suite-tree__node ${
                selectedConfigId === configId
                  ? "suite-tree__node--active"
                  : ""
              }`}
              onClick={() => onSelectConfiguration(configId)}
              role="treeitem"
            >
              <span className="suite-tree__icon" aria-hidden="true">
                <SettingsIcon />
              </span>
              <span className="suite-tree__label">{configId}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
