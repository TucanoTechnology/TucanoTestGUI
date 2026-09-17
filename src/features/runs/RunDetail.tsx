import { useEffect, useState } from "react";
import type { TestRun } from "../../api/generated/index.js";
import { apiFetch } from "../../api/client.js";
import { useAuth } from "../../app/AuthProvider.js";

export function RunDetail({ runId }: { runId: string }) {
  const { client } = useAuth();
  const [run, setRun] = useState<TestRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch(() => client.testRuns.getTestRun({ id: runId }))
      .then((data) => {
        setRun(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        const message =
          (err as { body?: { error?: { message?: string } } })?.body?.error
            ?.message ?? "Failed to load test run";
        setError(message);
        setLoading(false);
      });
  }, [client, runId]);

  if (loading) {
    return (
      <div className="loading" role="status">
        <div className="loading__spinner" />
        <span className="sr-only">Loading test run…</span>
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

  if (!run) return null;

  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <h2 className="detail-panel__title">{run.name ?? run.testRunId}</h2>
        <p className="detail-panel__subtitle">Run ID: {run.testRunId}</p>
      </div>

      {run.timestamp && (
        <div className="detail-field">
          <div className="detail-field__label">Timestamp</div>
          <div className="detail-field__value">{run.timestamp}</div>
        </div>
      )}

      {run.tags && run.tags.length > 0 && (
        <div className="detail-field">
          <div className="detail-field__label">Tags</div>
          <div className="tag-list">
            {run.tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {run.projects && run.projects.length > 0 && (
        <div className="detail-field">
          <div className="detail-field__label">
            Projects ({run.projects.length})
          </div>
          <ul className="entity-list">
            {run.projects.map((p) => (
              <li key={p.projectId} className="entity-list__item">
                <span className="entity-list__name">{p.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {run.testSuites && run.testSuites.length > 0 && (
        <div className="detail-field">
          <div className="detail-field__label">
            Suites ({run.testSuites.length})
          </div>
          <ul className="entity-list">
            {run.testSuites.map((s) => (
              <li key={s.suiteId} className="entity-list__item">
                <span className="entity-list__name">{s.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {run.results && run.results.length > 0 && (
        <div className="detail-field">
          <div className="detail-field__label">
            Results ({run.results.length})
          </div>
          <ul className="entity-list">
            {run.results.map((r, i) => (
              <li key={i} className="entity-list__item">
                <span className="entity-list__name">{r.testCaseId}</span>
                <span
                  className={`badge badge-${r.status?.toLowerCase() ?? "untested"}`}
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
