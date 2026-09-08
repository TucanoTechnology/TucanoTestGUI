import React from 'react';

export interface SidebarNavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

export default function SidebarNavItem({ icon, label, active, onClick }: SidebarNavItemProps) {
  return (
    <button
      type="button"
      className={`sidebar-nav-item ${active ? 'active' : ''}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        height: '44px',
        padding: '0 16px',
        border: 'none',
        borderLeft: active ? '3px solid #3b82f6' : '3px solid transparent',
        background: active ? '#334155' : 'transparent',
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: active ? 500 : 400,
        cursor: 'pointer',
        transition: 'background 150ms ease',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = '#334155';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '20px',
          height: '20px',
          marginRight: '12px',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
