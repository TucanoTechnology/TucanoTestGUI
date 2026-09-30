import type { ReactNode } from "react";

/**
 * The three non-content states every list and detail panel shares (#133):
 * nothing to show, still loading, and failed to load. Loading is a skeleton
 * rather than a spinner so the shape of the content survives the wait, and
 * the skeleton's shimmer is dropped under `prefers-reduced-motion`.
 */

interface EmptyStateProps {
  icon: string;
  message: string;
  action?: ReactNode;
}

export function EmptyState({ icon, message, action }: EmptyStateProps) {
  return (
    <div className="state-view state-view--empty">
      <span className="state-view__icon" aria-hidden="true">
        {icon}
      </span>
      <p className="state-view__message">{message}</p>
      {action && <div className="state-view__action">{action}</div>}
    </div>
  );
}

interface LoadingSkeletonProps {
  rows: number;
  columns: number;
}

export function LoadingSkeleton({ rows, columns }: LoadingSkeletonProps) {
  return (
    <div
      className="state-view state-view--loading"
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-row">
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className="skeleton-cell" />
          ))}
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

interface ErrorStateProps {
  code: string | null;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ code, message, onRetry }: ErrorStateProps) {
  return (
    <div className="state-view state-view--error" role="alert">
      <span className="state-view__icon" aria-hidden="true">
        ⚠️
      </span>
      <p className="state-view__message">{message}</p>
      {code && <p className="state-view__code">Error code: {code}</p>}
      {onRetry && (
        <button className="btn btn-primary" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
