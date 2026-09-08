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

// Status configuration - colors aligned with WCAG AA contrast requirements
export const STATUS_CONFIG: Record<TestCaseStatus, StatusConfig> = {
  Passed: {
    label: 'Passed',
    color: '#155724',
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
    icon: '✓',
  },
  Failed: {
    label: 'Failed',
    color: '#721c24',
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    icon: '✗',
  },
  Blocked: {
    label: 'Blocked',
    color: '#856404',
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    icon: '⚠',
  },
  Untested: {
    label: 'Untested',
    color: '#6c757d',
    backgroundColor: '#e9ecef',
    borderColor: '#dee2e6',
    icon: '○',
  },
  Retest: {
    label: 'Retest',
    color: '#004085',
    backgroundColor: '#cce5ff',
    borderColor: '#b8daff',
    icon: '',
  },
};

export interface StatusBadgeProps {
  status: TestCaseStatus;
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
}

export default function StatusBadge({
  status,
  size = 'medium',
  showIcon = true,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.Untested;

  const sizeStyles = {
    small: { padding: '2px 8px', fontSize: '12px' },
    medium: { padding: '4px 12px', fontSize: '14px' },
    large: { padding: '6px 16px', fontSize: '16px' },
  };

  return (
    <span
      role="status"
      aria-label={`Status: ${config.label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: sizeStyles[size].padding,
        fontSize: sizeStyles[size].fontSize,
        fontWeight: 600,
        color: config.color,
        backgroundColor: config.backgroundColor,
        border: `1px solid ${config.borderColor}`,
        borderRadius: '12px',
        lineHeight: 1,
      }}
    >
      {showIcon && <span aria-hidden="true">{config.icon}</span>}
      <span>{config.label}</span>
    </span>
  );
}
