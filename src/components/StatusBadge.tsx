import { useState } from 'react';

/**
 * Status taxonomy for test case results.
 *
 * The API owns this vocabulary — `TestCaseResult.status` in api/openapi.json is
 * the single source of truth (TucanoTestAPI validates it server-side). The list
 * below exists so the GUI can render the union exhaustively, and
 * src/components/StatusBadge.test.tsx fails if the two ever drift apart.
 */
export const VALID_STATUSES = ['Passed', 'Failed', 'Blocked', 'Untested', 'Retest'] as const;
export type TestCaseStatus = (typeof VALID_STATUSES)[number];

export interface StatusConfig {
  label: string;
  /** Badge variant from styles.css; every entry is contrast-checked by src/styles.test.ts. */
  className: string;
  icon: string;
}

export const STATUS_CONFIG: Record<TestCaseStatus, StatusConfig> = {
  Passed: { label: 'Passed', className: 'badge-pass', icon: '✓' },
  Failed: { label: 'Failed', className: 'badge-fail', icon: '✗' },
  Blocked: { label: 'Blocked', className: 'badge-blocked', icon: '⚠' },
  Untested: { label: 'Untested', className: 'badge-untested', icon: '○' },
  Retest: { label: 'Retest', className: 'badge-retest', icon: '↻' },
};

export const SIZE_CLASSES = {
  small: 'badge-sm',
  medium: 'badge-md',
  large: 'badge-lg',
} as const;

export type StatusBadgeSize = keyof typeof SIZE_CLASSES;

export interface StatusBadgeProps {
  status: TestCaseStatus | string;
  size?: StatusBadgeSize;
  showIcon?: boolean;
  interactive?: boolean;
  onStatusChange?: (newStatus: TestCaseStatus) => void;
}

export default function StatusBadge({
  status,
  size = 'medium',
  showIcon = true,
  interactive = false,
  onStatusChange,
}: StatusBadgeProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const normalizedStatus: TestCaseStatus = VALID_STATUSES.includes(status as TestCaseStatus)
    ? (status as TestCaseStatus)
    : 'Untested';

  const config = STATUS_CONFIG[normalizedStatus] || STATUS_CONFIG.Untested;
  const badgeClassName = `badge ${config.className} ${SIZE_CLASSES[size]}`;

  if (!interactive) {
    return (
      <span role="status" aria-label={`Status: ${config.label}`} className={badgeClassName}>
        {showIcon && (
          <span className="badge-icon" aria-hidden="true">
            {config.icon}
          </span>
        )}
        <span>{config.label}</span>
      </span>
    );
  }

  return (
    <div className="status-select">
      <button
        type="button"
        className={`${badgeClassName} badge-interactive`}
        onClick={(e) => {
          e.stopPropagation();
          setIsDropdownOpen((prev) => !prev);
        }}
        aria-haspopup="listbox"
        aria-expanded={isDropdownOpen}
        aria-label={`Current status ${config.label}. Click to change status.`}
      >
        {showIcon && (
          <span className="badge-icon" aria-hidden="true">
            {config.icon}
          </span>
        )}
        <span>{config.label}</span>
        <span className="badge-caret" aria-hidden="true">
          ▼
        </span>
      </button>

      {isDropdownOpen && (
        <div
          role="listbox"
          aria-label="Select test status"
          className="badge-menu"
          onClick={(e) => e.stopPropagation()}
        >
          {VALID_STATUSES.map((st) => {
            const itemConfig = STATUS_CONFIG[st];
            const isCurrent = st === normalizedStatus;
            return (
              <button
                key={st}
                type="button"
                role="option"
                aria-selected={isCurrent}
                className="badge-menu-option"
                onClick={() => {
                  onStatusChange?.(st);
                  setIsDropdownOpen(false);
                }}
              >
                <span className="badge-menu-icon" aria-hidden="true">
                  {itemConfig.icon}
                </span>
                <span>{itemConfig.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
