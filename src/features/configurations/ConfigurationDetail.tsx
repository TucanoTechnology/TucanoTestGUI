import { useEffect, useState } from "react";
import type { TestConfiguration } from "../../api/generated/index.js";
import { apiFetch } from "../../api/client.js";
import { readApiError, type ApiErrorInfo } from "../../api/errors.js";
import { useAuth } from "../../app/AuthProvider.js";
import { ApiErrorNotice } from "../../app/ApiErrorNotice.js";

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
  const [error, setError] = useState<ApiErrorInfo | null>(null);

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
    return <ApiErrorNotice error={error} />;
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
