import { useEffect, useState } from "react";
import type { TestSuite } from "../../api/generated/index.js";
import { apiFetch } from "../../api/client.js";
import { useAuth } from "../../app/AuthProvider.js";
import { useProjectContext } from "../../app/ProjectContext.js";

export function SuiteDetail({
  suiteId,
  projectId,
}: {
  suiteId: string;
  projectId?: string;
}) {
  const { client } = useAuth();
  const { setSelection } = useProjectContext();
  const [suite, setSuite] = useState<TestSuite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch(() => client.testSuites.getTestSuite({ id: suiteId }))
      .then((data) => {
        setSuite(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        const message =
          (err as { body?: { error?: { message?: string } } })?.body?.error
            ?.message ?? "Failed to load suite";
        setError(message);
        setLoading(false);
      });
  }, [client, suiteId]);

  if (loading) {
    return (
      <div className="loading" role="status">
        <div className="loading__spinner" />
        <span className="sr-only">Loading suite…</span>
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

  if (!suite) return null;

  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <h2 className="detail-panel__title">{suite.name}</h2>
        <p className="detail-panel__subtitle">Suite ID: {suite.suiteId}</p>
      </div>

      {suite.description && (
        <div className="detail-field">
          <div className="detail-field__label">Description</div>
          <div className="detail-field__value">{suite.description}</div>
        </div>
      )}

      {suite.tags && suite.tags.length > 0 && (
        <div className="detail-field">
          <div className="detail-field__label">Tags</div>
          <div className="tag-list">
            {suite.tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {suite.testCases && suite.testCases.length > 0 && (
        <div className="detail-field">
          <div className="detail-field__label">
            Test Cases ({suite.testCases.length})
          </div>
          <ul className="entity-list">
            {suite.testCases.map((tc) => (
              <li key={tc.testCaseId}>
                <button
                  className="entity-list__item"
                  onClick={() =>
                    setSelection({
                      type: "case",
                      id: tc.testCaseId,
                      projectId,
                    })
                  }
                >
                  <span className="entity-list__name">{tc.title}</span>
                  {tc.priority && (
                    <span className="entity-list__meta">{tc.priority}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
