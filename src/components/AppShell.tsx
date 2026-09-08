import React, { useState } from 'react';
import Sidebar, { SidebarProps } from './Sidebar';
import MainContent from './MainContent';

export interface AppShellProps {
  children: React.ReactNode;
  navigationItems: SidebarProps['navigationItems'];
  activeView: string;
  onNavigate: (id: string) => void;
}

export default function AppShell({ children, navigationItems, activeView, onNavigate }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleToggleCollapse = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        navigationItems={navigationItems}
        activeItem={activeView}
        onNavigate={onNavigate}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />
      <MainContent sidebarCollapsed={sidebarCollapsed}>{children}</MainContent>
    </div>
  );
}
