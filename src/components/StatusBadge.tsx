import { useState } from 'react';

// API-driven status taxonomy - must match API validation in src/api.rs
export const VALID_STATUSES = ['Passed', 'Failed', 'Blocked', 'Untested', 'Retest'] as const;
export type TestCaseStatus = (typeof VALID_STATUSES)[number];

export interface StatusConfig {
  label: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
  icon: string;
}

// Status configuration - colors aligned with WCAG 2.1 AA contrast requirements
export const STATUS_CONFIG: Record<TestCaseStatus, StatusConfig> = {
  Passed: {
    label: 'Passed',
    color: '#14532d',
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
    icon: '✓',
  },
  Failed: {
    label: 'Failed',
    color: '#7f1d1d',
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    icon: '✗',
  },
  Blocked: {
    label: 'Blocked',
    color: '#78350f',
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    icon: '⚠',
  },
  Untested: {
    label: 'Untested',
    color: '#334155',
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    icon: '○',
  },
  Retest: {
    label: 'Retest',
    color: '#713f12',
    backgroundColor: '#fef9c3',
    borderColor: '#fde047',
    icon: '↻',
  },
};

export interface StatusBadgeProps {
  status: TestCaseStatus | string;
  size?: 'small' | 'medium' | 'large';
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
  const normalizedStatus: TestCaseStatus =
    VALID_STATUSES.includes(status as TestCaseStatus)
      ? (status as TestCaseStatus)
      : 'Untested';

  const config = STATUS_CONFIG[normalizedStatus] || STATUS_CONFIG.Untested;

  const sizeStyles = {
    small: { padding: '2px 8px', fontSize: '11px', height: '22px' },
    medium: { padding: '4px 10px', fontSize: '12px', height: '26px' },
    large: { padding: '6px 14px', fontSize: '14px', height: '32px' },
  };

  if (!interactive) {
    return (
      <span
        role="status"
        aria-label={`Status: ${config.label}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: sizeStyles[size].padding,
          fontSize: sizeStyles[size].fontSize,
          fontWeight: 600,
          color: config.color,
          backgroundColor: config.backgroundColor,
          border: `1px solid ${config.borderColor}`,
          borderRadius: '9999px',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
      >
        {showIcon && <span aria-hidden="true" style={{ fontWeight: 700 }}>{config.icon}</span>}
        <span>{config.label}</span>
      </span>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsDropdownOpen((prev) => !prev);
        }}
        aria-haspopup="listbox"
        aria-expanded={isDropdownOpen}
        aria-label={`Current status ${config.label}. Click to change status.`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: sizeStyles[size].padding,
          fontSize: sizeStyles[size].fontSize,
          fontWeight: 600,
          color: config.color,
          backgroundColor: config.backgroundColor,
          border: `1px solid ${config.borderColor}`,
          borderRadius: '9999px',
          cursor: 'pointer',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          transition: 'transform 100ms ease, box-shadow 100ms ease',
        }}
      >
        {showIcon && <span aria-hidden="true" style={{ fontWeight: 700 }}>{config.icon}</span>}
        <span>{config.label}</span>
        <span aria-hidden="true" style={{ fontSize: '9px', opacity: 0.7, marginLeft: '2px' }}>▼</span>
      </button>

      {isDropdownOpen && (
        <div
          role="listbox"
          aria-label="Select test status"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)',
            zIndex: 999,
            minWidth: '130px',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
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
                onClick={() => {
                  onStatusChange?.(st);
                  setIsDropdownOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  border: 'none',
                  borderRadius: '6px',
                  background: isCurrent ? itemConfig.backgroundColor : 'transparent',
                  color: itemConfig.color,
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <span aria-hidden="true" style={{ width: '12px', textAlign: 'center' }}>
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
