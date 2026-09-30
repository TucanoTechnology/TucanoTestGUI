import type { MilestoneProgress } from "../api/generated/index.js";

/**
 * The five result buckets as a single stacked bar. A mini bar carries only
 * the proportions; the detail view pairs it with the counts. A bucket is a
 * share of `totalCases`, and an inconsistent payload (the API's own counting
 * is tracked in TucanoTestAPI#286) is clipped rather than overflowing.
 */
export function ProgressBar({
  progress,
  withCounts = false,
}: {
  progress: MilestoneProgress;
  withCounts?: boolean;
}) {
  const buckets = [
    { key: "passed", value: progress.passed ?? 0, label: "Passed" },
    { key: "failed", value: progress.failed ?? 0, label: "Failed" },
    { key: "blocked", value: progress.blocked ?? 0, label: "Blocked" },
    { key: "untested", value: progress.untested ?? 0, label: "Untested" },
    { key: "retest", value: progress.retest ?? 0, label: "Retest" },
  ];
  const total = Math.max(
    progress.totalCases ?? 0,
    buckets.reduce((sum, bucket) => sum + bucket.value, 0),
  );

  return (
    <div className="progress-bar-wrap">
      <div
        className="progress-bar"
        role="img"
        aria-label={buckets
          .map((bucket) => `${bucket.label}: ${bucket.value}`)
          .join(", ")}
      >
        {buckets.map((bucket) =>
          bucket.value > 0 && total > 0 ? (
            <span
              key={bucket.key}
              className={`progress-bar__segment progress-bar__segment--${bucket.key}`}
              style={{ width: `${(bucket.value / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      {withCounts && (
        <div className="progress-bar__legend">
          {buckets.map((bucket) => (
            <span key={bucket.key} className="progress-bar__legend-item">
              <span
                aria-hidden="true"
                className={`progress-bar__swatch progress-bar__swatch--${bucket.key}`}
              />
              {bucket.label}: {bucket.value}
            </span>
          ))}
          <span className="progress-bar__legend-item">
            {progress.passPercentage ?? 0}% passed
          </span>
        </div>
      )}
    </div>
  );
}
