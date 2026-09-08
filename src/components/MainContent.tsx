import React from 'react';

export interface MainContentProps {
  children: React.ReactNode;
  sidebarCollapsed?: boolean;
}

export default function MainContent({ children, sidebarCollapsed = false }: MainContentProps) {
  return (
    <main
      id="main"
      tabIndex={-1}
      style={{
        marginLeft: sidebarCollapsed ? '64px' : '240px',
        minHeight: '100vh',
        background: '#f8fafc',
        padding: '24px',
        transition: 'margin-left 200ms ease',
        overflow: 'auto',
      }}
    >
      {children}
    </main>
  );
}
