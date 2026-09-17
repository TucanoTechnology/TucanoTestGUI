import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ApiRequestError,
  Milestone,
  MilestoneProgress,
  Project,
  TestCase,
  TestRun,
  TestSuite,
  TucanoApiClient,
} from './api/client';
import AppShell, { type Tab } from './components/AppShell';
import ProjectsModule from './features/projects/ProjectsModule';
import TestCasesModule from './features/test-cases/TestCasesModule';
import TestSuitesModule from './features/test-suites/TestSuitesModule';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

function formatTabName(tab: Tab): string {
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

function formatTabCount(tab: Tab, count: number): string {
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

  // Modals and detail states
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeSuite, setActiveSuite] = useState<TestSuite | null>(null);
  const [activeRun, setActiveRun] = useState<TestRun | null>(null);
  const [activeMilestone, setActiveMilestone] = useState<Milestone | null>(null);
  const [activeMilestoneProgress, setActiveMilestoneProgress] = useState<MilestoneProgress | null>(null);

  // Form modal visibility flags
  const [showRunModal, setShowRunModal] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Edit modal states
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);

  // Bumped to ask the Projects module to open its create form
  const [projectCreateRequest, setProjectCreateRequest] = useState(0);

  // Bumped to ask the Test Suites module to open its create form
  const [suiteCreateRequest, setSuiteCreateRequest] = useState(0);

  // Bumped to ask the Test Cases module to open its create form
  const [caseCreateRequest, setCaseCreateRequest] = useState(0);

  // Execution workspace state
  const [executingRun, setExecutingRun] = useState<TestRun | null>(null);
  const [executingCaseIndex, setExecutingCaseIndex] = useState(0);

  // Form input states
  const [runIdInput, setRunIdInput] = useState('');

  const [milestoneIdInput, setMilestoneIdInput] = useState('');
  const [milestoneNameInput, setMilestoneNameInput] = useState('');
  const [milestoneDescInput, setMilestoneDescInput] = useState('');
  const [milestoneStartDateInput, setMilestoneStartDateInput] = useState('');
  const [milestoneTargetDateInput, setMilestoneTargetDateInput] = useState('');
  const [milestoneStatusInput, setMilestoneStatusInput] = useState('Open');

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
    setExecutingRun(null);
    setShowDetailModal(false);
    // Leaving the tab ends the outstanding "open the form" request.
    setProjectCreateRequest(0);
    setSuiteCreateRequest(0);
    setCaseCreateRequest(0);
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void loadIdentifiers(activeTab, filter);
  };

  // CRUD Handlers: Project
  // Projects are owned by the Projects module. The shell keeps only the wiring:
  // the shared live region, the identifier refresh and the detail panel, so the
  // module never needs to know how the shell announces things.
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
    setShowDetailModal(false);
    setProjectCreateRequest((request) => request + 1);
  };

  // CRUD Handlers: Suite
  // Test suites are owned by the Test Suites module. The shell keeps only the
  // wiring: the shared live region, the identifier refresh and the detail panel.
  const handleSuitesChanged = useCallback(async () => {
    await loadIdentifiers('suites', filter);
    await fetchAllWorkspaceData();
  }, [loadIdentifiers, filter, fetchAllWorkspaceData]);

  const openSuiteForm = () => {
    setActiveTab('suites');
    setShowDetailModal(false);
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
    setShowDetailModal(false);
    setCaseCreateRequest((request) => request + 1);
  };

  // CRUD Handlers: Test Run
  const handleCreateRun = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const rawId = runIdInput || `RUN-${Date.now()}`;
      const id = rawId.endsWith('.json') ? rawId : `${rawId}.json`;
      const newRun: TestRun = {
        testRunId: id,
        timestamp: new Date().toISOString(),
        projects: [],
        testSuites: [],
        testCases: casesList.slice(0, 5),
      };
      await api.createTestRun(newRun);
      setShowRunModal(false);
      setRunIdInput('');
      await loadIdentifiers('runs', filter);
      await fetchAllWorkspaceData();
      setMessage(`Test run ${newRun.testRunId} created successfully.`);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to create test run.');
    }
  };

  const handleDeleteRun = async (id: string) => {
    try {
      await api.deleteTestRun(id);
      await loadIdentifiers('runs', filter);
      await fetchAllWorkspaceData();
      setMessage(`Test run ${id} deleted.`);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to delete test run.');
    }
  };

  const handleStartRun = async (id: string) => {
    try {
      const run = await api.getTestRun(id);
      setExecutingRun(run);
      setExecutingCaseIndex(0);
      setMessage(`Started executing run ${run.testRunId}.`);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Could not start test run.');
    }
  };

  const handleSetResultStatus = async (status: 'Passed' | 'Failed' | 'Blocked' | 'Untested') => {
    if (!executingRun || !executingRun.testCases || executingRun.testCases.length === 0) return;
    const currentCase = executingRun.testCases[executingCaseIndex];
    if (!currentCase) return;

    const updatedCase: TestCase = {
      ...currentCase,
      priority: status,
    };

    const updatedCases = [...executingRun.testCases];
    updatedCases[executingCaseIndex] = updatedCase;

    const updatedRun: TestRun = {
      ...executingRun,
      testCases: updatedCases,
    };

    try {
      await api.updateTestRun(updatedRun.testRunId, updatedRun);
      setExecutingRun(updatedRun);
      setMessage(`Marked ${currentCase.title} as ${status}.`);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to save test result.');
    }
  };

  // CRUD Handlers: Milestone
  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const rawId = milestoneIdInput || `M-${Date.now()}`;
      const id = rawId.endsWith('.json') ? rawId : `${rawId}.json`;
      const newMilestone: Milestone = {
        milestoneId: id,
        name: milestoneNameInput,
        description: milestoneDescInput || undefined,
        startDate: milestoneStartDateInput || undefined,
        targetDate: milestoneTargetDateInput || undefined,
        status: milestoneStatusInput || 'Open',
        testSuiteIds: [],
        testRunIds: [],
      };
      await api.createMilestone(newMilestone);
      setShowMilestoneModal(false);
      setMilestoneIdInput('');
      setMilestoneNameInput('');
      setMilestoneDescInput('');
      setMilestoneStartDateInput('');
      setMilestoneTargetDateInput('');
      setMilestoneStatusInput('Open');
      await loadIdentifiers('milestones', filter);
      await fetchAllWorkspaceData();
      setMessage(`Milestone ${newMilestone.milestoneId} created successfully.`);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to create milestone.');
    }
  };

  const handleUpdateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMilestone) return;
    try {
      await api.updateMilestone(editingMilestone.milestoneId, editingMilestone);
      const updatedId = editingMilestone.milestoneId;
      setEditingMilestone(null);
      await loadIdentifiers('milestones', filter);
      await fetchAllWorkspaceData();
      setMessage(`Milestone ${updatedId} updated successfully.`);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to update milestone.');
    }
  };

  const handleDeleteMilestone = async (id: string) => {
    try {
      await api.deleteMilestone(id);
      await loadIdentifiers('milestones', filter);
      await fetchAllWorkspaceData();
      setMessage(`Milestone ${id} deleted.`);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to delete milestone.');
    }
  };

  // Detail Modal view handlers
  // The Projects module already holds the entity it renders, so it hands it over.
  const handleViewProject = (project: Project) => {
    setActiveProject(project);
    setShowDetailModal(true);
  };

  const handleViewSuite = (suite: TestSuite) => {
    setActiveSuite(suite);
    setShowDetailModal(true);
  };

  const handleViewRun = async (id: string) => {
    try {
      const run = await api.getTestRun(id);
      setActiveRun(run);
      setShowDetailModal(true);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Could not fetch test run.');
    }
  };

  const handleViewMilestone = async (id: string) => {
    try {
      const milestone = await api.getMilestone(id);
      setActiveMilestone(milestone);
      try {
        const progress = await api.getMilestoneProgress(id);
        setActiveMilestoneProgress(progress);
      } catch {
        setActiveMilestoneProgress(null);
      }
      setShowDetailModal(true);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Could not fetch milestone.');
    }
  };

  const handleEditMilestoneClick = async (id: string) => {
    try {
      const milestone = await api.getMilestone(id);
      setEditingMilestone(milestone);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Could not fetch milestone for edit.');
    }
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
                <button type="button" onClick={() => setShowRunModal(true)}>
                  + Create test run
                </button>
              )}
              {activeTab === 'milestones' && (
                <button type="button" onClick={() => setShowMilestoneModal(true)}>
                  + Create milestone
                </button>
              )}
            </div>
          </div>

          {/* Labelled Filter Form */}
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

          {/* Screen Reader Live Announcement */}
          <p
            aria-live="polite"
            ref={statusRef}
            className={`status-bar-announcement ${state === 'error' ? 'error' : ''}`}
            style={{ margin: 0 }}
          >
            {message}
          </p>

          {/* 1. TEST CASES MODULE — folder-hierarchy execution board */}
          {activeTab === 'cases' && (
            <div className="three-panel-container">
              <TestCasesModule
                client={api}
                identifiers={identifiers}
                projects={projectsList}
                suites={suitesList}
                createRequest={caseCreateRequest}
                onStatus={handleModuleStatus}
                onChanged={handleCasesChanged}
                onCreateSuite={openSuiteForm}
                onCreateProject={openProjectForm}
                onCreateTestRun={() => setShowRunModal(true)}
              />
            </div>
          )}

          {/* 3. TEST RUNS VIEW & EXECUTION WORKSPACE */}
          {activeTab === 'runs' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {executingRun && (
                <section className="card" style={{ marginBottom: '24px', borderLeft: '4px solid #0f766e' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>Execution Workspace: {executingRun.testRunId}</h3>
                    <button type="button" className="btn-secondary" onClick={() => setExecutingRun(null)}>
                      Close Execution
                    </button>
                  </div>
                  <p style={{ fontSize: '13px', color: '#64748b' }}>
                    <strong>Timestamp:</strong> {executingRun.timestamp}
                  </p>

                  {!executingRun.testCases || executingRun.testCases.length === 0 ? (
                    <p style={{ color: '#94a3b8' }}>No test cases in this run to execute.</p>
                  ) : (
                    <div>
                      <div style={{ margin: '12px 0' }}>
                        <span className="badge badge-untested">
                          Case {executingCaseIndex + 1} of {executingRun.testCases.length}
                        </span>
                      </div>
                      {executingRun.testCases[executingCaseIndex] && (
                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <h4 style={{ margin: '0 0 8px 0', fontSize: '15px' }}>
                            {executingRun.testCases[executingCaseIndex].title} ({executingRun.testCases[executingCaseIndex].testCaseId})
                          </h4>
                          <p style={{ fontSize: '13px', margin: '4px 0' }}>
                            <strong>Expected Result:</strong> {executingRun.testCases[executingCaseIndex].expectedResult}
                          </p>
                          {executingRun.testCases[executingCaseIndex].description && (
                            <p style={{ fontSize: '13px', margin: '4px 0' }}>
                              <strong>Description:</strong> {executingRun.testCases[executingCaseIndex].description}
                            </p>
                          )}
                          {executingRun.testCases[executingCaseIndex].steps && (
                            <div style={{ marginTop: '8px' }}>
                              <strong style={{ fontSize: '13px' }}>Steps:</strong>
                              <ol style={{ fontSize: '13px', paddingLeft: '20px', margin: '4px 0' }}>
                                {executingRun.testCases[executingCaseIndex].steps?.map((step: any, idx) => (
                                  <li key={idx}>{typeof step === 'string' ? step : step.action}</li>
                                ))}
                              </ol>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                            <button type="button" style={{ background: '#15803d' }} onClick={() => void handleSetResultStatus('Passed')}>
                              Mark Passed
                            </button>
                            <button type="button" className="btn-danger" onClick={() => void handleSetResultStatus('Failed')}>
                              Mark Failed
                            </button>
                            <button type="button" style={{ background: '#b45309' }} onClick={() => void handleSetResultStatus('Blocked')}>
                              Mark Blocked
                            </button>
                            <button type="button" className="btn-secondary" onClick={() => void handleSetResultStatus('Untested')}>
                              Reset Untested
                            </button>
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={executingCaseIndex === 0}
                          onClick={() => setExecutingCaseIndex((i) => Math.max(0, i - 1))}
                        >
                          Previous Case
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={executingCaseIndex >= executingRun.testCases.length - 1}
                          onClick={() => setExecutingCaseIndex((i) => Math.min(executingRun.testCases!.length - 1, i + 1))}
                        >
                          Next Case
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Run Cards */}
              <div className="view-grid-cards">
                {identifiers.map((id) => (
                  <div key={id} className="entity-card">
                    <div>
                      <h3 className="entity-card-title">▶️ {id}</h3>
                    </div>
                    <div className="entity-card-actions">
                      <button type="button" onClick={() => void handleStartRun(id)}>
                        Execute
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => void handleViewRun(id)}>
                        Details
                      </button>
                      <button type="button" className="btn-danger" onClick={() => void handleDeleteRun(id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. MILESTONES VIEW */}
          {activeTab === 'milestones' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              <div className="view-grid-cards">
                {identifiers.map((id) => (
                  <div key={id} className="entity-card">
                    <div>
                      <h3 className="entity-card-title">🎯 {id}</h3>
                    </div>
                    <div className="entity-card-actions">
                      <button type="button" className="btn-secondary" onClick={() => void handleViewMilestone(id)}>
                        Details
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => void handleEditMilestoneClick(id)}>
                        Edit
                      </button>
                      <button type="button" className="btn-danger" onClick={() => void handleDeleteMilestone(id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. PROJECTS MODULE */}
          {activeTab === 'projects' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              <ProjectsModule
                client={api}
                identifiers={identifiers}
                createRequest={projectCreateRequest}
                onStatus={handleModuleStatus}
                onViewProject={handleViewProject}
                onChanged={handleProjectsChanged}
              />
            </div>
          )}
          {/* 6. TEST SUITES MODULE */}
          {activeTab === 'suites' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              <TestSuitesModule
                client={api}
                identifiers={identifiers}
                createRequest={suiteCreateRequest}
                onStatus={handleModuleStatus}
                onViewSuite={handleViewSuite}
                onChanged={handleSuitesChanged}
              />
            </div>
          )}
        </AppShell>

      {/* MODALS */}
      {/* Create Run Modal */}
      {showRunModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="run-modal-title">
          <div className="modal-content">
            <div className="modal-header">
              <h3 id="run-modal-title">Create New Test Run</h3>
              <button type="button" className="btn-secondary" onClick={() => setShowRunModal(false)}>
                Cancel
              </button>
            </div>
            <form className="form-grid" onSubmit={handleCreateRun}>
              <div className="form-group">
                <label htmlFor="run-id-input">Run ID (Filename)</label>
                <input
                  id="run-id-input"
                  type="text"
                  required
                  value={runIdInput}
                  onChange={(e) => setRunIdInput(e.target.value)}
                  placeholder="e.g. Run-Sprint42.json"
                />
              </div>
              <button type="submit">Save Test Run</button>
            </form>
          </div>
        </div>
      )}

      {/* Create Milestone Modal */}
      {showMilestoneModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="milestone-modal-title">
          <div className="modal-content">
            <div className="modal-header">
              <h3 id="milestone-modal-title">Create New Milestone</h3>
              <button type="button" className="btn-secondary" onClick={() => setShowMilestoneModal(false)}>
                Cancel
              </button>
            </div>
            <form className="form-grid" onSubmit={handleCreateMilestone}>
              <div className="form-group">
                <label htmlFor="milestone-id-input">Milestone ID (Filename)</label>
                <input
                  id="milestone-id-input"
                  type="text"
                  required
                  value={milestoneIdInput}
                  onChange={(e) => setMilestoneIdInput(e.target.value)}
                  placeholder="e.g. v1.0-RC1.json"
                />
              </div>
              <div className="form-group">
                <label htmlFor="milestone-name-input">Milestone Name</label>
                <input
                  id="milestone-name-input"
                  type="text"
                  required
                  value={milestoneNameInput}
                  onChange={(e) => setMilestoneNameInput(e.target.value)}
                  placeholder="e.g. Release v1.0"
                />
              </div>
              <div className="form-group">
                <label htmlFor="milestone-start-date-input">Start Date</label>
                <input
                  id="milestone-start-date-input"
                  type="date"
                  value={milestoneStartDateInput}
                  onChange={(e) => setMilestoneStartDateInput(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="milestone-target-date-input">Target Date</label>
                <input
                  id="milestone-target-date-input"
                  type="date"
                  value={milestoneTargetDateInput}
                  onChange={(e) => setMilestoneTargetDateInput(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="milestone-status-input">Status</label>
                <select
                  id="milestone-status-input"
                  value={milestoneStatusInput}
                  onChange={(e) => setMilestoneStatusInput(e.target.value)}
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="milestone-desc-input">Description</label>
                <textarea
                  id="milestone-desc-input"
                  value={milestoneDescInput}
                  onChange={(e) => setMilestoneDescInput(e.target.value)}
                  placeholder="Release goal and scope..."
                />
              </div>
              <button type="submit">Save Milestone</button>
            </form>
          </div>
        </div>
      )}

      {/* Resource Detail Modal */}
      {showDetailModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="detail-modal-title">
          <div className="modal-content">
            <div className="modal-header">
              <h3 id="detail-modal-title">Resource Details</h3>
              <button type="button" className="btn-secondary" onClick={() => setShowDetailModal(false)}>
                Close
              </button>
            </div>

            {activeTab === 'projects' && activeProject && (
              <div>
                <h4>{activeProject.name} ({activeProject.projectId})</h4>
                <p>{activeProject.description || 'No description provided.'}</p>
                <h5>Linked Test Suites ({activeProject.testSuites?.length || 0})</h5>
                <ul>
                  {(activeProject.testSuites || []).map((s) => (
                    <li key={s.suiteId}>{s.name} ({s.suiteId})</li>
                  ))}
                </ul>
              </div>
            )}

            {activeTab === 'suites' && activeSuite && (
              <div>
                <h4>{activeSuite.name} ({activeSuite.suiteId})</h4>
                <p>{activeSuite.description || 'No description provided.'}</p>
                <h5>Test Cases ({activeSuite.testCases?.length || 0})</h5>
                <ul>
                  {(activeSuite.testCases || []).map((c) => (
                    <li key={c.testCaseId}>{c.title} ({c.testCaseId})</li>
                  ))}
                </ul>
              </div>
            )}

            {activeTab === 'runs' && activeRun && (
              <div>
                <h4>Test Run: {activeRun.testRunId}</h4>
                <p><strong>Timestamp:</strong> {activeRun.timestamp}</p>
                <h5>Included Test Cases ({activeRun.testCases?.length ?? 0})</h5>
                <ul>
                  {(activeRun.testCases ?? []).map((c) => (
                    <li key={c.testCaseId}>
                      {c.title} ({c.testCaseId}) - <span className="badge">{c.priority || 'Untested'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activeTab === 'milestones' && activeMilestone && (
              <div>
                <h4>{activeMilestone.name} ({activeMilestone.milestoneId})</h4>
                <p><strong>Status:</strong> {activeMilestone.status || 'Open'}</p>
                <p><strong>Start Date:</strong> {activeMilestone.startDate || 'N/A'}</p>
                <p><strong>Target Date:</strong> {activeMilestone.targetDate || 'N/A'}</p>
                <p>{activeMilestone.description || 'No description provided.'}</p>

                {activeMilestoneProgress && (
                  <div style={{ margin: '1rem 0', background: 'var(--color-bg)', padding: '1rem', borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border)' }}>
                    <h5>Aggregated Release Progress</h5>
                    <p><strong>Pass Rate:</strong> {activeMilestoneProgress.passPercentage.toFixed(1)}%</p>
                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <span className="badge badge-pass">Passed: {activeMilestoneProgress.passed}</span>
                      <span className="badge badge-fail">Failed: {activeMilestoneProgress.failed}</span>
                      <span className="badge badge-blocked">Blocked: {activeMilestoneProgress.blocked}</span>
                      <span className="badge badge-untested">Untested: {activeMilestoneProgress.untested}</span>
                      <span className="badge badge-retest">Retest: {activeMilestoneProgress.retest}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Milestone Modal */}
      {editingMilestone && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-milestone-modal-title">
          <div className="modal-content">
            <div className="modal-header">
              <h3 id="edit-milestone-modal-title">Edit Milestone: {editingMilestone.milestoneId}</h3>
              <button type="button" className="btn-secondary" onClick={() => setEditingMilestone(null)}>
                Cancel
              </button>
            </div>
            <form className="form-grid" onSubmit={handleUpdateMilestone}>
              <div className="form-group">
                <label htmlFor="edit-milestone-name-input">Milestone Name</label>
                <input
                  id="edit-milestone-name-input"
                  type="text"
                  required
                  value={editingMilestone.name}
                  onChange={(e) => setEditingMilestone({ ...editingMilestone, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-milestone-start-date-input">Start Date</label>
                <input
                  id="edit-milestone-start-date-input"
                  type="date"
                  value={editingMilestone.startDate || ''}
                  onChange={(e) => setEditingMilestone({ ...editingMilestone, startDate: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-milestone-target-date-input">Target Date</label>
                <input
                  id="edit-milestone-target-date-input"
                  type="date"
                  value={editingMilestone.targetDate || ''}
                  onChange={(e) => setEditingMilestone({ ...editingMilestone, targetDate: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-milestone-status-input">Status</label>
                <select
                  id="edit-milestone-status-input"
                  value={editingMilestone.status || 'Open'}
                  onChange={(e) => setEditingMilestone({ ...editingMilestone, status: e.target.value })}
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="edit-milestone-desc-input">Description</label>
                <textarea
                  id="edit-milestone-desc-input"
                  value={editingMilestone.description || ''}
                  onChange={(e) => setEditingMilestone({ ...editingMilestone, description: e.target.value })}
                />
              </div>
              <button type="submit">Update Milestone</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
