import { useEffect, useState } from "react";
import type { Project, TestCase } from "../../api/generated/index.js";
import { apiFetch } from "../../api/client.js";
import { readApiError, type ApiErrorInfo } from "../../api/errors.js";
import { useAuth } from "../../app/AuthProvider.js";
import { ApiErrorNotice } from "../../app/ApiErrorNotice.js";

/**
 * A case identifier is unique inside its parent, not deployment-wide, so
 * `GET /test_cases/{id}` answers `409` when several parents hold the same case
 * (the seeded `TC-LOGIN-1` sits in two projects). A project document embeds
 * every case its suites carry plus the ones it owns itself, so it resolves the
 * case without the ambiguity.
 */
function findCaseInProject(
  project: Project,
  caseId: string,
): TestCase | undefined {
  const direct = (project.testCases ?? []).find(
    (testCase) => testCase.testCaseId === caseId,
  );
  if (direct) return direct;

  for (const suite of project.testSuites ?? []) {
    const inSuite = (suite.testCases ?? []).find(
      (testCase) => testCase.testCaseId === caseId,
    );
    if (inSuite) return inSuite;
  }

  return undefined;
}

export function CaseDetail({
  caseId,
  projectId,
}: {
  caseId: string;
  projectId?: string;
}) {
  const { client } = useAuth();
  const [testCase, setTestCase] = useState<TestCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const request = projectId
      ? apiFetch(() => client.projects.getProject({ id: projectId })).then(
          (project) => findCaseInProject(project, caseId),
        )
      : apiFetch(() => client.testCases.getTestCase({ id: caseId }));

    request
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setTestCase(data);
        } else {
          setError({
            code: null,
            message: `Test case ${caseId} is not part of project ${projectId}`,
          });
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(readApiError(err, "Failed to load test case"));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, caseId, projectId]);

  if (loading) {
    return (
      <div className="loading" role="status">
        <div className="loading__spinner" />
        <span className="sr-only">Loading test case…</span>
      </div>
    );
  }

  if (error) {
    return <ApiErrorNotice error={error} />;
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

      {testCase.attachments && testCase.attachments.length > 0 && (
        <div className="detail-field">
          <div className="detail-field__label">
            Attachments ({testCase.attachments.length})
          </div>
          <ul className="entity-list">
            {testCase.attachments.map((attachment) => (
              <li key={attachment.filename} className="entity-list__item">
                <span className="entity-list__name">
                  {attachment.originalName}
                </span>
                <span className="entity-list__meta">
                  {attachment.size} bytes
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
