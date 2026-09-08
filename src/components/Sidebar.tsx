import SidebarLogo from './SidebarLogo';
import SidebarNav, { NavigationItem } from './SidebarNav';

export interface SidebarProps {
  navigationItems: NavigationItem[];
  activeItem: string;
  onNavigate: (id: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({
  navigationItems,
  activeItem,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  return (
    <aside
      className={`sidebar ${collapsed ? 'collapsed' : ''}`}
      style={{
        width: collapsed ? '64px' : '240px',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        background: '#1e293b',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 200ms ease',
        overflow: 'hidden',
        zIndex: 100,
      }}
      aria-label="Application Sidebar"
    >
      <SidebarLogo />
      <SidebarNav items={navigationItems} activeItem={activeItem} onSelect={onNavigate} />
      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            height: '44px',
            border: 'none',
            borderTop: '1px solid #334155',
            background: 'transparent',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8';
          }}
        >
          {collapsed ? '→' : '←'}
        </button>
      )}
    </aside>
  );
}
