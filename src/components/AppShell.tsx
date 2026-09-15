import { useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import type { Project } from '../api/client';

export type Tab = 'projects' | 'suites' | 'cases' | 'runs' | 'milestones';

interface NavDestination {
  tab: Tab;
  label: string;
  icon: string;
}

const NAV_DESTINATIONS: NavDestination[] = [
  { tab: 'projects', label: 'Projects', icon: '🏢' },
  { tab: 'suites', label: 'Test Suites', icon: '🧪' },
  { tab: 'cases', label: 'Tests', icon: '📋' },
  { tab: 'runs', label: 'Test runs', icon: '▶️' },
  { tab: 'milestones', label: 'Milestones', icon: '🎯' },
];

const RELEASES = ['v1.0', 'v1.1', 'main'];
const ENVIRONMENTS = ['Staging', 'Production', 'Development'];

interface AppShellProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  projects: Project[];
  currentProject: string;
  onProjectChange: (projectId: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onRefresh: () => void;
  counts?: Partial<Record<Tab, number>>;
  children: ReactNode;
}

export default function AppShell({
  activeTab,
  onTabChange,
  projects,
  currentProject,
  onProjectChange,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  onRefresh,
  counts,
  children,
}: AppShellProps) {
  const [release, setRelease] = useState('v1.0');
  const [environment, setEnvironment] = useState('Staging');

  const railRef = useRef<HTMLElement>(null);

  const handleRailKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const buttons = Array.from(
      railRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [],
    );
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (currentIndex === -1) return;

    let nextIndex: number;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % buttons.length;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = buttons.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    buttons[nextIndex]?.focus();
  };

  return (
    <div className="app-container">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>

      {/* Top Application Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="brand-logo" aria-label="Tucano Test">
            <span className="brand-icon" aria-hidden="true">🦜</span>
            <span className="brand-title">Tucano Test</span>
          </div>

          {/* Project Switcher */}
          <select
            className="header-select"
            aria-label="Current project"
            value={currentProject}
            onChange={(e) => onProjectChange(e.target.value)}
          >
            <option key="all" value="all">All Projects</option>
            {projects
              .filter((p) => Boolean(p.projectId))
              .map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.name || p.projectId}
                </option>
              ))}
          </select>
        </div>

        <div className="header-right">
          <select
            className="header-select"
            aria-label="Release"
            value={release}
            onChange={(e) => setRelease(e.target.value)}
          >
            {RELEASES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <select
            className="header-select"
            aria-label="Environment"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
          >
            {ENVIRONMENTS.map((env) => (
              <option key={env} value={env}>
                {env}
              </option>
            ))}
          </select>

          <form
            className="header-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              onSearchSubmit();
            }}
          >
            <input
              type="search"
              aria-label="Search"
              placeholder="Search…"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </form>

          <button type="button" className="header-refresh-btn" onClick={onRefresh}>
            ↻ Refresh
          </button>

          <div className="avatar-badge" title="User: Alex (QA Lead)">
            A
          </div>
        </div>
      </header>

      {/* Master Body Layout */}
      <div className="app-body">
        {/* Left Icon Rail Navigation */}
        <nav
          className="icon-rail"
          aria-label="Main Navigation"
          ref={railRef}
          onKeyDown={handleRailKeyDown}
        >
          {NAV_DESTINATIONS.map((dest) => {
            const isActive = activeTab === dest.tab;
            const count = counts?.[dest.tab];
            return (
              <button
                key={dest.tab}
                type="button"
                className={`rail-btn ${isActive ? 'active' : ''}`}
                onClick={() => onTabChange(dest.tab)}
                tabIndex={isActive ? 0 : -1}
                aria-label={dest.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="rail-icon" aria-hidden="true">{dest.icon}</span>
                <span className="rail-label">{dest.label}</span>
                {count !== undefined && count > 0 && (
                  <span className="rail-badge">{count}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Central Workspace Canvas */}
        <main id="main" tabIndex={-1} className="workspace-canvas">
          {children}
        </main>
      </div>
    </div>
  );
}
