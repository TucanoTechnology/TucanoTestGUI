import { useEffect, useState } from "react";
import type { Milestone, MilestoneProgress } from "../../api/generated/index.js";
import { apiFetch } from "../../api/client.js";
import { useAuth } from "../../app/AuthProvider.js";

export function MilestoneDetail({
  milestoneId,
  projectId,
}: {
  milestoneId: string;
  projectId?: string;
}) {
  const { client } = useAuth();
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [progress, setProgress] = useState<MilestoneProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch(() => client.milestones.getMilestone({ id: milestoneId })),
      apiFetch(() =>
        client.milestones.getMilestoneProgress({ id: milestoneId }),
      ),
    ])
      .then(([m, p]) => {
        setMilestone(m);
        setProgress(p);
        setLoading(false);
      })
      .catch((err: unknown) => {
        const message =
          (err as { body?: { error?: { message?: string } } })?.body?.error
            ?.message ?? "Failed to load milestone";
        setError(message);
        setLoading(false);
      });
  }, [client, milestoneId]);

  void projectId;

  if (loading) {
    return (
      <div className="loading" role="status">
        <div className="loading__spinner" />
        <span className="sr-only">Loading milestone…</span>
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

  if (!milestone) return null;

  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <h2 className="detail-panel__title">{milestone.name}</h2>
        <p className="detail-panel__subtitle">
          Milestone ID: {milestone.milestoneId}
        </p>
      </div>

      {milestone.description && (
        <div className="detail-field">
          <div className="detail-field__label">Description</div>
          <div className="detail-field__value">{milestone.description}</div>
        </div>
      )}

      {milestone.status && (
        <div className="detail-field">
          <div className="detail-field__label">Status</div>
          <div className="detail-field__value">{milestone.status}</div>
        </div>
      )}

      {milestone.startDate && (
        <div className="detail-field">
          <div className="detail-field__label">Start Date</div>
          <div className="detail-field__value">{milestone.startDate}</div>
        </div>
      )}

      {milestone.targetDate && (
        <div className="detail-field">
          <div className="detail-field__label">Target Date</div>
          <div className="detail-field__value">{milestone.targetDate}</div>
        </div>
      )}

      {progress && (
        <div className="detail-field">
          <div className="detail-field__label">Progress</div>
          <div className="detail-field__value">
            {progress.totalCases} total — {progress.passed} passed,{" "}
            {progress.failed} failed, {progress.blocked} blocked
          </div>
        </div>
      )}

      {milestone.testSuiteIds && milestone.testSuiteIds.length > 0 && (
        <div className="detail-field">
          <div className="detail-field__label">
            Linked Suites ({milestone.testSuiteIds.length})
          </div>
          <ul className="entity-list">
            {milestone.testSuiteIds.map((id) => (
              <li key={id} className="entity-list__item">
                <span className="entity-list__name">{id}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {milestone.testRunIds && milestone.testRunIds.length > 0 && (
        <div className="detail-field">
          <div className="detail-field__label">
            Linked Runs ({milestone.testRunIds.length})
          </div>
          <ul className="entity-list">
            {milestone.testRunIds.map((id) => (
              <li key={id} className="entity-list__item">
                <span className="entity-list__name">{id}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
