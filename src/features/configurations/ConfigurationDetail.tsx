import { useEffect, useState } from "react";
import type { TestConfiguration } from "../../api/generated/index.js";
import { apiFetch } from "../../api/client.js";
import { useAuth } from "../../app/AuthProvider.js";

export function ConfigurationDetail({
  configId,
  projectId: _projectId,
}: {
  configId: string;
  projectId?: string;
}) {
  const { client } = useAuth();
  const [config, setConfig] = useState<TestConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch(() =>
      client.configurations.getConfiguration({ id: configId }),
    )
      .then((data) => {
        setConfig(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        const message =
          (err as { body?: { error?: { message?: string } } })?.body?.error
            ?.message ?? "Failed to load configuration";
        setError(message);
        setLoading(false);
      });
  }, [client, configId]);

  if (loading) {
    return (
      <div className="loading" role="status">
        <div className="loading__spinner" />
        <span className="sr-only">Loading configuration…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-display" role="alert">
        {error}
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <h2 className="detail-panel__title">{config.name}</h2>
        <p className="detail-panel__subtitle">Config ID: {config.configId}</p>
      </div>

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
    </div>
  );
}
