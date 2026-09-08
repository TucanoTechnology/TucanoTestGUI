import { useState } from 'react';

export type QuickCreateType = 'project' | 'suite' | 'case' | 'run';

export interface QuickCreateToolbarProps {
  onCreate: (type: QuickCreateType) => void;
  disabled?: boolean;
}

const CREATE_OPTIONS: { type: QuickCreateType; label: string; icon: string }[] = [
  { type: 'project', label: 'Project', icon: '📁' },
  { type: 'suite', label: 'Test Suite', icon: '📋' },
  { type: 'case', label: 'Test Case', icon: '📝' },
  { type: 'run', label: 'Test Run', icon: '▶️' },
];

export default function QuickCreateToolbar({ onCreate, disabled = false }: QuickCreateToolbarProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        style={{
          padding: '8px 16px',
          background: '#0066cc',
          color: '#ffffff',
          border: 'none',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          opacity: disabled ? 0.6 : 1,
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span>＋</span>
        <span>Quick Create</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            background: '#ffffff',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: '200px',
            zIndex: 1000,
          }}
        >
          {CREATE_OPTIONS.map((option) => (
            <button
              key={option.type}
              type="button"
              role="menuitem"
              onClick={() => {
                onCreate(option.type);
                setIsOpen(false);
              }}
              disabled={disabled}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '10px 16px',
                border: 'none',
                background: 'transparent',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (!disabled) {
                  (e.currentTarget as HTMLButtonElement).style.background = '#f8f9fa';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              <span aria-hidden="true">{option.icon}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
