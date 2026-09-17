import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ApiRequestError,
  Milestone,
  Project,
  TestCase,
  TestRun,
  TestSuite,
  TucanoApiClient,
} from './api/client';
import AppShell, { type Tab } from './components/AppShell';
import MilestonesModule from './features/milestones/MilestonesModule';
import ProjectsModule from './features/projects/ProjectsModule';
import ReportsModule from './features/reports/ReportsModule';
import TestCasesModule from './features/test-cases/TestCasesModule';
import TestRunsModule from './features/test-runs/TestRunsModule';
import TestSuitesModule from './features/test-suites/TestSuitesModule';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * The tabs the shell loads as a list of identifiers. Reports has no such list —
 * it reads its own endpoints and holds its own live region — so it is left out
 * of the shell's count and announcement machinery.
 */
type IdentifyTab = Exclude<Tab, 'reports'>;

function formatTabName(tab: IdentifyTab): string {
  switch (tab) {
    case 'projects':
      return 'projects';
    case 'suites':
      return 'test suites';
    case 'cases':
      return 'tests';
    case 'runs':
      return 'test runs';
    case 'milestones':
      return 'milestones';
  }
}

function formatTabCount(tab: IdentifyTab, count: number): string {
  if (count === 0) {
    return `No ${formatTabName(tab)} match the current filter.`;
  }
  if (count === 1) {
    switch (tab) {
      case 'projects':
        return '1 project found.';
      case 'suites':
        return '1 test suite found.';
      case 'cases':
        return '1 test found.';
      case 'runs':
        return '1 test run found.';
      case 'milestones':
        return '1 milestone found.';
    }
  }
  return `${count} ${formatTabName(tab)} found.`;
}

interface AppProps {
  client?: TucanoApiClient;
}

export default function App({ client }: AppProps) {
  const api = useMemo(() => client ?? new TucanoApiClient(), [client]);

  const [activeTab, setActiveTab] = useState<Tab>('suites');
  const [identifiers, setIdentifiers] = useState<string[]>([]);
  const [state, setState] = useState<LoadState>('idle');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('');
  const filterId = useId();

  // Full datasets loaded for 3-panel workspace
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [suitesList, setSuitesList] = useState<TestSuite[]>([]);
  const [casesList, setCasesList] = useState<TestCase[]>([]);
  const [runsList, setRunsList] = useState<TestRun[]>([]);
  const [milestonesList, setMilestonesList] = useState<Milestone[]>([]);

  // Selected scope
  const [currentProject, setCurrentProject] = useState<string>('all');

  // Bumped to ask the Projects module to open its create form
  const [projectCreateRequest, setProjectCreateRequest] = useState(0);

  // Bumped to ask the Test Suites module to open its create form
  const [suiteCreateRequest, setSuiteCreateRequest] = useState(0);

  // Bumped to ask the Test Cases module to open its create form
  const [caseCreateRequest, setCaseCreateRequest] = useState(0);

  // Bumped to ask the Test Runs module to open its create form
  const [runCreateRequest, setRunCreateRequest] = useState(0);

  // Bumped to ask the Milestones module to open its create form
  const [milestoneCreateRequest, setMilestoneCreateRequest] = useState(0);

  const statusRef = useRef<HTMLParagraphElement>(null);

  // Load all data across entities
  const fetchAllWorkspaceData = useCallback(async () => {
    try {
      const [pIds, sIds, cIds, rIds, mIds] = await Promise.all([
        api.listProjects({}).catch(() => []),
        api.listTestSuites({}).catch(() => []),
        api.listTestCases({}).catch(() => []),
        api.listTestRuns({}).catch(() => []),
        api.listMilestones({}).catch(() => []),
      ]);

      const [pData, sData, cData, rData, mData] = await Promise.all([
        Promise.all(pIds.map((id) => api.getProject(id).catch(() => null))),
        Promise.all(sIds.map((id) => api.getTestSuite(id).catch(() => null))),
        Promise.all(cIds.map((id) => api.getTestCase(id).catch(() => null))),
        Promise.all(rIds.map((id) => api.getTestRun(id).catch(() => null))),
        Promise.all(mIds.map((id) => api.getMilestone(id).catch(() => null))),
      ]);

      setProjectsList(pData.filter(Boolean) as Project[]);
      setSuitesList(sData.filter(Boolean) as TestSuite[]);
      setCasesList(cData.filter(Boolean) as TestCase[]);
      setRunsList(rData.filter(Boolean) as TestRun[]);
      setMilestonesList(mData.filter(Boolean) as Milestone[]);
    } catch (err) {
      console.error('Failed to preload workspace data:', err);
    }
  }, [api]);

  useEffect(() => {
    void fetchAllWorkspaceData();
  }, [fetchAllWorkspaceData]);

  const loadIdentifiers = useCallback(
    async (tab: Tab, currentFilter: string) => {
      if (tab === 'reports') return;

      setState('loading');
      setMessage(`Loading ${formatTabName(tab)}.`);
      try {
        let result: string[] = [];
        if (tab === 'projects') {
          result = await api.listProjects({ filter: currentFilter });
        } else if (tab === 'suites') {
          result = await api.listTestSuites({ filter: currentFilter });
        } else if (tab === 'cases') {
          result = await api.listTestCases({ filter: currentFilter });
        } else if (tab === 'runs') {
          result = await api.listTestRuns({ filter: currentFilter });
        } else if (tab === 'milestones') {
          result = await api.listMilestones({ filter: currentFilter });
        }
        setIdentifiers(result);
        setState('ready');
        setMessage(formatTabCount(tab, result.length));
      } catch (error) {
        setState('error');
        setMessage(
          error instanceof ApiRequestError
            ? `Could not load ${formatTabName(tab)}: ${error.message}`
            : 'Could not reach the Tucano Test API.',
        );
      }
    },
    [api],
  );

  useEffect(() => {
    void loadIdentifiers(activeTab, filter);
  }, [activeTab, loadIdentifiers]);

  const handleTabChange = (newTab: Tab) => {
    setActiveTab(newTab);
    setFilter('');
    // Leaving the tab ends the outstanding "open the form" request.
    setProjectCreateRequest(0);
    setSuiteCreateRequest(0);
    setCaseCreateRequest(0);
    setRunCreateRequest(0);
    setMilestoneCreateRequest(0);
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void loadIdentifiers(activeTab, filter);
  };

  // CRUD Handlers: Project
  // Projects are owned by the Projects module. The shell keeps only the wiring:
  // the shared live region, the identifier refresh and the create request, so
  // the module never needs to know how the shell announces things.
  const handleModuleStatus = useCallback((text: string, kind?: 'info' | 'error') => {
    // The module reports through the shell's single live region.
    setState(kind === 'error' ? 'error' : 'ready');
    setMessage(text);
  }, []);

  const handleProjectsChanged = useCallback(async () => {
    await loadIdentifiers('projects', filter);
    await fetchAllWorkspaceData();
  }, [loadIdentifiers, filter, fetchAllWorkspaceData]);

  const openProjectForm = () => {
    setActiveTab('projects');
    setProjectCreateRequest((request) => request + 1);
  };

  // CRUD Handlers: Suite
  // Test suites are owned by the Test Suites module. The shell keeps only the
  // wiring: the shared live region, the identifier refresh and the create request.
  const handleSuitesChanged = useCallback(async () => {
    await loadIdentifiers('suites', filter);
    await fetchAllWorkspaceData();
  }, [loadIdentifiers, filter, fetchAllWorkspaceData]);

  const openSuiteForm = () => {
    setActiveTab('suites');
    setSuiteCreateRequest((request) => request + 1);
  };

  // CRUD Handlers: Case
  // Test cases are owned by the Test Cases module: the folder board, the dense
  // table, the bulk actions and the detail pane all live there. The shell keeps
  // only the wiring — refresh, the shared live region and the create request.
  const handleCasesChanged = useCallback(async () => {
    await loadIdentifiers('cases', filter);
    await fetchAllWorkspaceData();
  }, [loadIdentifiers, filter, fetchAllWorkspaceData]);

  const openCaseForm = () => {
    setActiveTab('cases');
    setCaseCreateRequest((request) => request + 1);
  };

  // CRUD Handlers: Test Run
  // Test runs are owned by the Test Runs module: the run list, the execution
  // board and the result recording all live there. The shell keeps only the
  // wiring — refresh, the shared live region and the create request.
  const handleRunsChanged = useCallback(async () => {
    await loadIdentifiers('runs', filter);
    await fetchAllWorkspaceData();
  }, [loadIdentifiers, filter, fetchAllWorkspaceData]);

  const openRunForm = () => {
    setActiveTab('runs');
    setRunCreateRequest((request) => request + 1);
  };

  // CRUD Handlers: Milestone
  // Milestones are owned by the Milestones module: the milestone list and the
  // release summary live there. The shell keeps only the wiring — refresh, the
  // shared live region and the create request.
  const handleMilestonesChanged = useCallback(async () => {
    await loadIdentifiers('milestones', filter);
    await fetchAllWorkspaceData();
  }, [loadIdentifiers, filter, fetchAllWorkspaceData]);

  const openMilestoneForm = () => {
    setActiveTab('milestones');
    setMilestoneCreateRequest((request) => request + 1);
  };

  // Computed total test cases count across workspace
  const totalCaseCount = useMemo(() => {
    const ids = new Set<string>();
    projectsList.forEach((p) =>
      p.testSuites?.forEach((s) => s.testCases?.forEach((c) => ids.add(c.testCaseId)))
    );
    suitesList.forEach((s) => s.testCases?.forEach((c) => ids.add(c.testCaseId)));
    casesList.forEach((c) => ids.add(c.testCaseId));
    return Math.max(ids.size, casesList.length);
  }, [projectsList, suitesList, casesList]);

  return (
    <>
      <AppShell
        activeTab={activeTab}
        onTabChange={handleTabChange}
        projects={projectsList}
        currentProject={currentProject}
        onProjectChange={(id) => setCurrentProject(id)}
        searchValue={filter}
        onSearchChange={(value) => setFilter(value)}
        onSearchSubmit={() => {
          void loadIdentifiers(activeTab, filter);
        }}
        onRefresh={() => {
          void fetchAllWorkspaceData();
        }}
        counts={{ cases: totalCaseCount, runs: runsList.length, milestones: milestonesList.length }}
      >
        {/* Top Context & Actions Header */}
        <div className="workspace-topbar">
            <div className="workspace-title-group">
              <h2>
                {activeTab === 'cases' && 'Tests'}
                {activeTab === 'suites' && 'Test suites'}
                {activeTab === 'runs' && 'Test runs'}
                {activeTab === 'milestones' && 'Milestones & Releases'}
                {activeTab === 'projects' && 'Projects'}
                {activeTab === 'reports' && 'Reports'}
              </h2>
            </div>

            {/* Quick Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {activeTab === 'projects' && (
                <button type="button" onClick={openProjectForm}>
                  + Create project
                </button>
              )}
              {activeTab === 'suites' && (
                <button type="button" onClick={openSuiteForm}>
                  + Create test suite
                </button>
              )}
              {activeTab === 'cases' && (
                <>
                  <button type="button" className="btn-secondary" onClick={openSuiteForm}>
                    + Create test suite
                  </button>
                  <button type="button" onClick={openCaseForm}>
                    + Create test case
                  </button>
                </>
              )}
              {activeTab === 'runs' && (
                <button type="button" onClick={openRunForm}>
                  + Create test run
                </button>
              )}
              {activeTab === 'milestones' && (
                <button type="button" onClick={openMilestoneForm}>
                  + Create milestone
                </button>
              )}
            </div>
          </div>

          {/* Labelled Filter Form — Reports answers on its own filters, which the
              contract does not expose yet, so there is nothing here to filter. */}
          {activeTab !== 'reports' && (
            <form
              onSubmit={handleSearchSubmit}
              style={{
                padding: '8px 18px',
                borderBottom: '1px solid #f1f5f9',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <label htmlFor={filterId} style={{ margin: 0, fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                Filter {formatTabName(activeTab)}:
              </label>
              <input
                id={filterId}
                name="filter"
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={`Filter ${formatTabName(activeTab)}...`}
                style={{ maxWidth: '280px', padding: '5px 8px', fontSize: '12.5px' }}
              />
              <button type="submit" className="btn-secondary" style={{ padding: '5px 10px', fontSize: '12px' }}>
                Filter
              </button>
            </form>
          )}

          {/* Screen Reader Live Announcement — Reports carries its own. */}
          {activeTab !== 'reports' && (
            <p
              aria-live="polite"
              ref={statusRef}
              className={`status-bar-announcement ${state === 'error' ? 'error' : ''}`}
              style={{ margin: 0 }}
            >
              {message}
            </p>
          )}

          {/* 1. TEST CASES MODULE — folder-hierarchy execution board */}
          {activeTab === 'cases' && (
            <div className="three-panel-container">
              <TestCasesModule
                client={api}
                identifiers={identifiers}
                projects={projectsList}
                suites={suitesList}
                runs={runsList}
                createRequest={caseCreateRequest}
                onStatus={handleModuleStatus}
                onChanged={handleCasesChanged}
                onCreateSuite={openSuiteForm}
                onCreateProject={openProjectForm}
                onCreateTestRun={openRunForm}
              />
            </div>
          )}

          {/* 3. TEST RUNS MODULE — run list and execution board */}
          {activeTab === 'runs' && (
            <div className="three-panel-container">
              <TestRunsModule
                client={api}
                identifiers={identifiers}
                suites={suitesList}
                createRequest={runCreateRequest}
                onStatus={handleModuleStatus}
                onChanged={handleRunsChanged}
              />
            </div>
          )}

          {/* 4. MILESTONES MODULE — milestone list and release summary */}
          {activeTab === 'milestones' && (
            <div className="three-panel-container">
              <MilestonesModule
                client={api}
                identifiers={identifiers}
                createRequest={milestoneCreateRequest}
                onStatus={handleModuleStatus}
                onChanged={handleMilestonesChanged}
              />
            </div>
          )}

          {/* 5. PROJECTS MODULE */}
          {activeTab === 'projects' && (
            <div className="three-panel-container">
              <ProjectsModule
                client={api}
                identifiers={identifiers}
                createRequest={projectCreateRequest}
                onStatus={handleModuleStatus}
                onChanged={handleProjectsChanged}
              />
            </div>
          )}
          {/* 6. TEST SUITES MODULE */}
          {activeTab === 'suites' && (
            <div className="three-panel-container">
              <TestSuitesModule
                client={api}
                identifiers={identifiers}
                createRequest={suiteCreateRequest}
                onStatus={handleModuleStatus}
                onChanged={handleSuitesChanged}
              />
            </div>
          )}
          {/* 7. REPORTS MODULE — coverage and summary, both answered by the API */}
          {activeTab === 'reports' && (
            <div className="three-panel-container">
              <ReportsModule projectId={currentProject === 'all' ? undefined : currentProject} />
            </div>
          )}
        </AppShell>
    </>
  );
}
