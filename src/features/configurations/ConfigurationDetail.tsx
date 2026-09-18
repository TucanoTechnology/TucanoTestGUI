import { useEffect, useState } from "react";
import type { TestConfiguration } from "../../api/generated/index.js";
import { apiFetch } from "../../api/client.js";
import { readApiError, type ApiErrorInfo } from "../../api/errors.js";
import { useAuth } from "../../app/AuthProvider.js";
import { ApiErrorNotice } from "../../app/ApiErrorNotice.js";
import { Dialog } from "../../app/Dialog.js";
import { useProjectContext } from "../../app/ProjectContext.js";
import {
  ConfigurationForm,
  type ConfigurationFormValues,
} from "./ConfigurationForm.js";
import { buildConfigurationUpdateRequest } from "./configurationRequests.js";

type Mode = "view" | "edit" | "delete";

export function ConfigurationDetail({
  configId,
  projectId,
}: {
  configId: string;
  projectId?: string;
}) {
  const { client } = useAuth();
  const { setSelection, refreshProjects, announce } = useProjectContext();
  const [config, setConfig] = useState<TestConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ApiErrorInfo | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch(() => client.configurations.getConfiguration({ id: configId }))
      .then((data) => {
        if (cancelled) return;
        setConfig(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(readApiError(err, "Failed to load configuration"));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, configId, reloadToken]);

  const startAction = (next: Mode) => {
    setActionError(null);
    setMode(next);
  };

  const cancelAction = () => {
    setActionError(null);
    setMode("view");
  };

  const updateConfiguration = async (values: ConfigurationFormValues) => {
    if (!config) return;
    const requestBody = buildConfigurationUpdateRequest(config, values);
    if (Object.keys(requestBody).length === 0) {
      setMode("view");
      return;
    }

    setBusy(true);
    setActionError(null);
    try {
      const updated = await apiFetch(() =>
        client.configurations.updateConfiguration({
          id: configId,
          requestBody,
        }),
      );
      setMode("view");
      setReloadToken((token) => token + 1);
      refreshProjects();
      announce(updated.message);
    } catch (err: unknown) {
      setActionError(readApiError(err, "Failed to update configuration"));
    } finally {
      setBusy(false);
    }
  };

  const deleteConfiguration = async () => {
    setBusy(true);
    setActionError(null);
    try {
      // The project-scoped route scopes the check to the project the panel
      // belongs to; the bare route is the fallback for a panel opened without
      // one.
      const deleted = projectId
        ? await apiFetch(() =>
            client.projects.removeProjectConfiguration({
              id: projectId,
              configId,
            }),
          )
        : await apiFetch(() =>
            client.configurations.deleteConfiguration({ id: configId }),
          );
      setMode("view");
      refreshProjects();
      setSelection(null);
      announce(deleted.message);
    } catch (err: unknown) {
      setActionError(readApiError(err, "Failed to delete configuration"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="loading" role="status">
        <div className="loading__spinner" />
        <span className="sr-only">Loading configuration…</span>
      </div>
    );
  }

  if (error) {
    return <ApiErrorNotice error={error} />;
  }

  if (!config) return null;

  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <h2 className="detail-panel__title">{config.name}</h2>
        <p className="detail-panel__subtitle">Config ID: {configId}</p>
        {config.configId && config.configId !== configId && (
          <p className="detail-panel__subtitle">
            The stored document carries the identifier “{config.configId}”,
            which this deployment does not resolve. The key above is what
            addresses the configuration.
          </p>
        )}
      </div>

      <div className="detail-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => startAction("edit")}
        >
          Edit
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => startAction("delete")}
        >
          Delete
        </button>
      </div>

      {mode === "edit" ? (
        <ConfigurationForm
          submitLabel="Save changes"
          initialValues={{
            name: config.name,
            browser: config.browser ?? "",
            os: config.os ?? "",
            device: config.device ?? "",
            resolution: config.resolution ?? "",
          }}
          busy={busy}
          error={actionError}
          onSubmit={updateConfiguration}
          onCancel={cancelAction}
        />
      ) : (
        <>
          {config.browser && (
            <div className="detail-field">
              <div className="detail-field__label">Browser</div>
              <div className="detail-field__value">{config.browser}</div>
            </div>
          )}

          {config.os && (
            <div className="detail-field">
              <div className="detail-field__label">Operating System</div>
              <div className="detail-field__value">{config.os}</div>
            </div>
          )}

          {config.device && (
            <div className="detail-field">
              <div className="detail-field__label">Device</div>
              <div className="detail-field__value">{config.device}</div>
            </div>
          )}

          {config.resolution && (
            <div className="detail-field">
              <div className="detail-field__label">Resolution</div>
              <div className="detail-field__value">{config.resolution}</div>
            </div>
          )}
        </>
      )}

      {mode === "delete" && (
        <Dialog title="Delete configuration" onClose={cancelAction}>
          <p className="dialog__body">
            Delete “{config.name}” ({configId})? The runs that link it keep the
            copy they stored. This cannot be undone.
          </p>

          {actionError && <ApiErrorNotice error={actionError} />}

          <div className="dialog__actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={cancelAction}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={deleteConfiguration}
              disabled={busy}
            >
              {busy ? "Deleting…" : "Delete configuration"}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
