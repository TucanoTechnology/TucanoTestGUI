import { useEffect, useState } from "react";
import type { TestCase } from "../../api/generated/index.js";
import { apiFetch } from "../../api/client.js";
import { useAuth } from "../../app/AuthProvider.js";

export function CaseDetail({
  caseId,
  projectId: _projectId,
}: {
  caseId: string;
  projectId?: string;
}) {
  const { client } = useAuth();
  const [testCase, setTestCase] = useState<TestCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch(() => client.testCases.getTestCase({ id: caseId }))
      .then((data) => {
        setTestCase(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        const message =
          (err as { body?: { error?: { message?: string } } })?.body?.error
            ?.message ?? "Failed to load test case";
        setError(message);
        setLoading(false);
      });
  }, [client, caseId]);

  if (loading) {
    return (
      <div className="loading" role="status">
        <div className="loading__spinner" />
        <span className="sr-only">Loading test case…</span>
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

  if (!testCase) return null;

  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <h2 className="detail-panel__title">{testCase.title}</h2>
        <p className="detail-panel__subtitle">
          Case ID: {testCase.testCaseId}
        </p>
      </div>

      {testCase.description && (
        <div className="detail-field">
          <div className="detail-field__label">Description</div>
          <div className="detail-field__value">{testCase.description}</div>
        </div>
      )}

      {testCase.preconditions && (
        <div className="detail-field">
          <div className="detail-field__label">Preconditions</div>
          <div className="detail-field__value">{testCase.preconditions}</div>
        </div>
      )}

      {testCase.priority && (
        <div className="detail-field">
          <div className="detail-field__label">Priority</div>
          <span
            className={`badge ${
              testCase.priority === "High" || testCase.priority === "Critical"
                ? "badge-fail"
                : testCase.priority === "Medium"
                  ? "badge-priority-medium"
                  : "badge-priority-low"
            }`}
          >
            {testCase.priority}
          </span>
        </div>
      )}

      {testCase.severity && (
        <div className="detail-field">
          <div className="detail-field__label">Severity</div>
          <div className="detail-field__value">{testCase.severity}</div>
        </div>
      )}

      {testCase.tags && testCase.tags.length > 0 && (
        <div className="detail-field">
          <div className="detail-field__label">Tags</div>
          <div className="tag-list">
            {testCase.tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {testCase.steps && testCase.steps.length > 0 && (
        <div className="detail-field">
          <div className="detail-field__label">
            Steps ({testCase.steps.length})
          </div>
          <ol className="steps-list">
            {testCase.steps.map((step, i) => {
              const stepObj =
                typeof step === "string" ? { action: step } : step;
              return (
                <li key={i} className="steps-list__item">
                  <div className="steps-list__action">{stepObj.action}</div>
                  {stepObj.expectedResult && (
                    <div className="steps-list__expected">
                      → {stepObj.expectedResult}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {testCase.expectedResult && (
        <div className="detail-field">
          <div className="detail-field__label">Expected Result</div>
          <div className="detail-field__value">{testCase.expectedResult}</div>
        </div>
      )}
    </div>
  );
}
