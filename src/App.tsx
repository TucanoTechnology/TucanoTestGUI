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
import ThreePanelLayout from './components/ThreePanelLayout';

type Tab = 'projects' | 'suites' | 'cases' | 'runs' | 'milestones';
type LoadState = 'idle' | 'loading' | 'ready' | 'error';

function formatTabName(tab: Tab): string {
  switch (tab) {
    case 'projects':
      return 'projects';
    case 'suites':
      return 'test suites';
    case 'cases':
      return 'test cases';
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
        return '1 test case found.';
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

  // Modals and detail states
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeSuite, setActiveSuite] = useState<TestSuite | null>(null);
  const [activeCase, setActiveCase] = useState<TestCase | null>(null);
  const [activeRun, setActiveRun] = useState<TestRun | null>(null);
  const [activeMilestone, setActiveMilestone] = useState<Milestone | null>(null);
  const [activeMilestoneProgress, setActiveMilestoneProgress] = useState<MilestoneProgress | null>(null);

  // Form modal visibility flags
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showSuiteModal, setShowSuiteModal] = useState(false);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Edit modal states
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingSuite, setEditingSuite] = useState<TestSuite | null>(null);
  const [editingCase, setEditingCase] = useState<TestCase | null>(null);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);

  // Collapsible Planes state
  const [planeProjectsCollapsed, setPlaneProjectsCollapsed] = useState(false);
  const [planeSuitesCollapsed, setPlaneSuitesCollapsed] = useState(false);
  const [planeCasesCollapsed, setPlaneCasesCollapsed] = useState(false);

  // Hierarchy Selection State
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);

  // Execution workspace state
  const [executingRun, setExecutingRun] = useState<TestRun | null>(null);
  const [executingCaseIndex, setExecutingCaseIndex] = useState(0);

  // Form input states
  const [projectIdInput, setProjectIdInput] = useState('');
  const [projectNameInput, setProjectNameInput] = useState('');
  const [projectDescInput, setProjectDescInput] = useState('');

  const [suiteIdInput, setSuiteIdInput] = useState('');
  const [suiteNameInput, setSuiteNameInput] = useState('');
  const [suiteDescInput, setSuiteDescInput] = useState('');

  const [caseIdInput, setCaseIdInput] = useState('');
  const [caseTitleInput, setCaseTitleInput] = useState('');
  const [caseDescInput, setCaseDescInput] = useState('');
  const [caseExpectedInput, setCaseExpectedInput] = useState('');
  const [casePriorityInput, setCasePriorityInput] = useState('Medium');
  const [caseExploratoryInput, setCaseExploratoryInput] = useState(false);
  const [caseStepsInput, setCaseStepsInput] = useState<string[]>(['']);

  const [runIdInput, setRunIdInput] = useState('');

  const [milestoneIdInput, setMilestoneIdInput] = useState('');
  const [milestoneNameInput, setMilestoneNameInput] = useState('');
  const [milestoneDescInput, setMilestoneDescInput] = useState('');
  const [milestoneStartDateInput, setMilestoneStartDateInput] = useState('');
  const [milestoneTargetDateInput, setMilestoneTargetDateInput] = useState('');
  const [milestoneStatusInput, setMilestoneStatusInput] = useState('Open');

  // Attachment upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Three-panel layout state
  const [useThreePanelView, setUseThreePanelView] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

  const statusRef = useRef<HTMLParagraphElement>(null);

  // Fetch projects for three-panel view
  useEffect(() => {
    if (useThreePanelView) {
      api.listProjects({}).then((ids) => {
        Promise.all(ids.map((id) => api.getProject(id)))
          .then(setProjects)
          .catch(console.error);
      }).catch(console.error);
    }
  }, [useThreePanelView, api]);

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
    void loadIdentifiers(activeTab, '');
  }, [activeTab, loadIdentifiers]);

  // Tab switching handler
  const handleTabChange = (newTab: Tab) => {
    setActiveTab(newTab);
    setFilter('');
    setExecutingRun(null);
    setShowDetailModal(false);
  };

  // Search filter submit
  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void loadIdentifiers(activeTab, filter);
  };

  // Handlers for Project CRUD
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const rawId = projectIdInput || `PROJ-${Date.now()}`;
      const id = rawId.endsWith('.json') ? rawId : `${rawId}.json`;
      const newProject: Project = {
        projectId: id,
        name: projectNameInput,
        description: projectDescInput || undefined,
        testSuites: [],
      };
      await api.createProject(newProject);
      setShowProjectModal(false);
      setProjectIdInput('');
      setProjectNameInput('');
      setProjectDescInput('');
      await loadIdentifiers('projects', filter);
      setMessage(`Project ${newProject.projectId} created successfully.`);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to create project.');
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    try {
      await api.updateProject(editingProject.projectId, editingProject);
      const updatedId = editingProject.projectId;
      setEditingProject(null);
      await loadIdentifiers('projects', filter);
      setMessage(`Project ${updatedId} updated successfully.`);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to update project.');
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await api.deleteProject(id);
      if (selectedProjectId === id) setSelectedProjectId(null);
      await loadIdentifiers('projects', filter);
      setMessage(`Project ${id} deleted.`);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to delete project.');
    }
  };

  // Handlers for Test Suite CRUD
  const handleCreateSuite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const rawId = suiteIdInput || `SUITE-${Date.now()}`;
      const id = rawId.endsWith('.json') ? rawId : `${rawId}.json`;
      const newSuite: TestSuite = {
        suiteId: id,
        name: suiteNameInput,
        description: suiteDescInput || undefined,
        testCases: [],
      };
      await api.createTestSuite(newSuite);
      setShowSuiteModal(false);
      setSuiteIdInput('');
      setSuiteNameInput('');
      setSuiteDescInput('');
      await loadIdentifiers('suites', filter);
      setMessage(`Test suite ${newSuite.suiteId} created successfully.`);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to create test suite.');
    }
  };

  const handleUpdateSuite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSuite) return;
    try {
      await api.updateTestSuite(editingSuite.suiteId, editingSuite);
      const updatedId = editingSuite.suiteId;
      setEditingSuite(null);
      await loadIdentifiers('suites', filter);
      setMessage(`Test suite ${updatedId} updated successfully.`);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to update test suite.');
    }
  };

  const handleDeleteSuite = async (id: string) => {
    try {
      await api.deleteTestSuite(id);
      if (selectedSuiteId === id) setSelectedSuiteId(null);
      await loadIdentifiers('suites', filter);
      setMessage(`Test suite ${id} deleted.`);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to delete test suite.');
    }
  };

  // Handlers for Test Case CRUD
  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const rawId = caseIdInput || `TC-${Date.now()}`;
      const id = rawId.endsWith('.json') ? rawId : `${rawId}.json`;
      const filteredSteps = caseStepsInput.filter((s) => s.trim().length > 0);
      const newCase: TestCase = {
        testCaseId: id,
        title: caseTitleInput,
        description: caseDescInput || undefined,
        expectedResult: caseExpectedInput,
        priority: casePriorityInput,
        exploratory: caseExploratoryInput,
        steps: filteredSteps.length > 0 ? filteredSteps : undefined,
      };
      await api.createTestCase(newCase);
      setShowCaseModal(false);
      setCaseIdInput('');
      setCaseTitleInput('');
      setCaseDescInput('');
      setCaseExpectedInput('');
      setCasePriorityInput('Medium');
      setCaseExploratoryInput(false);
      setCaseStepsInput(['']);
      await loadIdentifiers('cases', filter);
      setMessage(`Test case ${newCase.testCaseId} created successfully.`);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to create test case.');
    }
  };

  const handleUpdateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCase) return;
    try {
      await api.updateTestCase(editingCase.testCaseId, editingCase);
      const updatedId = editingCase.testCaseId;
      setEditingCase(null);
      await loadIdentifiers('cases', filter);
      setMessage(`Test case ${updatedId} updated successfully.`);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to update test case.');
    }
  };

  const handleDeleteCase = async (id: string) => {
    try {
      await api.deleteTestCase(id);
      await loadIdentifiers('cases', filter);
      setMessage(`Test case ${id} deleted.`);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to delete test case.');
    }
  };

  // Attachment Upload Handler
  const handleUploadAttachment = async () => {
    if (!activeCase || !selectedFile) return;
    try {
      const attachment = await api.uploadAttachment(activeCase.testCaseId, selectedFile);
      const updatedAttachments = [...(activeCase.attachments ?? []), attachment];
      const updatedCase: TestCase = { ...activeCase, attachments: updatedAttachments };
      await api.updateTestCase(activeCase.testCaseId, updatedCase);
      setActiveCase(updatedCase);
      setSelectedFile(null);
      setMessage(`Attachment ${attachment.originalName} uploaded successfully.`);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to upload attachment.');
    }
  };

  const handleDeleteAttachment = async (filename: string) => {
    if (!activeCase) return;
    try {
      await api.deleteAttachment(activeCase.testCaseId, filename);
      const updatedAttachments = (activeCase.attachments ?? []).filter((a) => a.filename !== filename);
      const updatedCase: TestCase = { ...activeCase, attachments: updatedAttachments };
      await api.updateTestCase(activeCase.testCaseId, updatedCase);
      setActiveCase(updatedCase);
      setMessage(`Attachment deleted.`);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to delete attachment.');
    }
  };

  // Handlers for Test Run CRUD & Execution
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
        testCases: [],
      };
      await api.createTestRun(newRun);
      setShowRunModal(false);
      setRunIdInput('');
      await loadIdentifiers('runs', filter);
      setMessage(`Test run ${newRun.testRunId} created successfully.`);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to create test run.');
    }
  };

  const handleDeleteRun = async (id: string) => {
    try {
      await api.deleteTestRun(id);
      await loadIdentifiers('runs', filter);
      setMessage(`Test run ${id} deleted.`);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to delete test run.');
    }
  };

  // Handlers for Milestone CRUD
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
      setMessage(`Milestone ${updatedId} updated successfully.`);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to update milestone.');
    }
  };

  const handleDeleteMilestone = async (id: string) => {
    try {
      await api.deleteMilestone(id);
      await loadIdentifiers('milestones', filter);
      setMessage(`Milestone ${id} deleted.`);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to delete milestone.');
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

  // View detail fetches
  const handleViewProject = async (id: string) => {
    try {
      const proj = await api.getProject(id);
      setActiveProject(proj);
      setShowDetailModal(true);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Could not fetch project.');
    }
  };

  const handleViewSuite = async (id: string) => {
    try {
      const suite = await api.getTestSuite(id);
      setActiveSuite(suite);
      setShowDetailModal(true);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Could not fetch test suite.');
    }
  };

  const handleViewCase = async (id: string) => {
    try {
      const c = await api.getTestCase(id);
      setActiveCase(c);
      setShowDetailModal(true);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Could not fetch test case.');
    }
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

  const handleEditProjectClick = async (id: string) => {
    try {
      const proj = await api.getProject(id);
      setEditingProject(proj);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Could not fetch project for edit.');
    }
  };

  const handleEditSuiteClick = async (id: string) => {
    try {
      const suite = await api.getTestSuite(id);
      setEditingSuite(suite);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Could not fetch test suite for edit.');
    }
  };

  const handleEditCaseClick = async (id: string) => {
    try {
      const c = await api.getTestCase(id);
      setEditingCase(c);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Could not fetch test case for edit.');
    }
  };

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>

      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-mark" aria-hidden="true">T</div>
          <div>
            <div className="eyebrow">QA Workspace</div>
            <h1 className="app-title">Tucano Test</h1>
          </div>
        </div>

        <div className="topbar-context" aria-label="Current project context">
          <span className="context-pill">Project: All projects</span>
          <span className="context-pill">Release: vNext</span>
          <span className="context-pill">Environment: Staging</span>
        </div>

        <div className="topbar-actions">
          <button type="button" className="btn-secondary">
            Refresh
          </button>
          <button type="button">Quick create</button>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        <div className="app-shell">
          <aside className="app-sidebar" aria-label="Sidebar navigation">
            <div className="sidebar-section">
              <p className="sidebar-label">Workspace</p>
              <nav aria-label="Main Navigation">
                <ul className="nav-tabs sidebar-nav">
                  <li>
                    <button
                      className={`nav-tab-button ${activeTab === 'projects' ? 'active' : ''}`}
                      onClick={() => handleTabChange('projects')}
                      type="button"
                    >
                      Projects
                    </button>
                  </li>
                  <li>
                    <button
                      className={`nav-tab-button ${activeTab === 'suites' ? 'active' : ''}`}
                      onClick={() => handleTabChange('suites')}
                      type="button"
                    >
                      Test suites
                    </button>
                  </li>
                  <li>
                    <button
                      className={`nav-tab-button ${activeTab === 'cases' ? 'active' : ''}`}
                      onClick={() => handleTabChange('cases')}
                      type="button"
                    >
                      Test cases
                    </button>
                  </li>
                  <li>
                    <button
                      className={`nav-tab-button ${activeTab === 'runs' ? 'active' : ''}`}
                      onClick={() => handleTabChange('runs')}
                      type="button"
                    >
                      Test runs
                    </button>
                  </li>
                  <li>
                    <button
                      className={`nav-tab-button ${activeTab === 'milestones' ? 'active' : ''}`}
                      onClick={() => handleTabChange('milestones')}
                      type="button"
                    >
                      Milestones
                    </button>
                  </li>
                </ul>
              </nav>
            </div>

            <div className="sidebar-section">
              <p className="sidebar-label">Shortcuts</p>
              <ul className="shortcut-list">
                <li>Dashboard</li>
                <li>Reviews</li>
                <li>Reports</li>
                <li>Settings</li>
              </ul>
            </div>
          </aside>

          <div className="workspace-main">
            <div className="page-header">
              <h2>
                {activeTab === 'projects' && 'Projects'}
                {activeTab === 'suites' && 'Test suites'}
                {activeTab === 'cases' && 'Test cases'}
                {activeTab === 'runs' && 'Test runs'}
                {activeTab === 'milestones' && 'Milestones & Releases'}
              </h2>
              <div>
                {activeTab === 'cases' && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setUseThreePanelView(!useThreePanelView)}
                    style={{ marginRight: '0.5rem' }}
                  >
                    {useThreePanelView ? ' Standard View' : '◨ Three-Panel View'}
                  </button>
                )}
                {activeTab === 'projects' && (
                  <button type="button" onClick={() => setShowProjectModal(true)}>
                    + Create project
                  </button>
                )}
                {activeTab === 'suites' && (
                  <button type="button" onClick={() => setShowSuiteModal(true)}>
                    + Create test suite
                  </button>
                )}
                {activeTab === 'cases' && (
                  <button type="button" onClick={() => setShowCaseModal(true)}>
                    + Create test case
                  </button>
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

            <form className="search-form workspace-search" onSubmit={handleSearchSubmit}>
              <div className="form-group">
                <label htmlFor={filterId}>Filter {formatTabName(activeTab)}</label>
                <input
                  id={filterId}
                  name="filter"
                  type="search"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={`Search ${formatTabName(activeTab)}...`}
                />
              </div>
              <button type="submit">Apply filter</button>
            </form>

        {/* Three-Panel Layout for Cases */}
        {activeTab === 'cases' && useThreePanelView && (
          <div style={{ height: 'calc(100vh - 250px)', marginTop: '1rem' }}>
            <ThreePanelLayout
              projects={projects}
              onProjectSelect={(id) => console.log('Project selected:', id)}
              onSuiteSelect={(id) => console.log('Suite selected:', id)}
              onCaseSelect={(id) => console.log('Case selected:', id)}
            />
          </div>
        )}

        <p aria-live="polite" ref={statusRef} className={`status-message ${state === 'error' ? 'error' : ''}`}>
          {message}
        </p>

        {/* Visual Hierarchy Breadcrumb Trail */}
        <nav aria-label="Hierarchy Breadcrumb" className="breadcrumb-trail">
          <span className="breadcrumb-item">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setSelectedProjectId(null);
                setSelectedSuiteId(null);
              }}
            >
              All Projects
            </button>
          </span>
          {selectedProjectId && (
            <span className="breadcrumb-item">
              &gt;{' '}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedSuiteId(null)}
              >
                {selectedProjectId}
              </button>
            </span>
          )}
          {selectedSuiteId && (
            <span className="breadcrumb-item">
              &gt; <button type="button" className="btn-secondary">{selectedSuiteId}</button>
            </span>
          )}
        </nav>

        {/* Visual Hierarchy Collapsible Horizontal Planes */}
        <section aria-label="Visual Hierarchy Workspace" className="hierarchy-grid">
          {/* Projects Plane */}
          <div className={`plane ${planeProjectsCollapsed ? 'collapsed' : ''}`}>
            <div className="plane-header">
              <h3 className="plane-title">Projects</h3>
              <div className="plane-actions">
                <button
                  type="button"
                  aria-expanded={!planeProjectsCollapsed}
                  className="btn-secondary"
                  onClick={() => setPlaneProjectsCollapsed((c) => !c)}
                >
                  {planeProjectsCollapsed ? 'Expand' : 'Collapse'}
                </button>
                <button type="button" onClick={() => setShowProjectModal(true)}>
                  + New
                </button>
              </div>
            </div>
            <div className="plane-body">
              {activeTab === 'projects' && state === 'ready' && identifiers.length === 0 ? (
                <p>No projects found.</p>
              ) : (
                <ul className="plane-list" aria-label="Projects Hierarchy List">
                  {(activeTab === 'projects' ? identifiers : []).map((id) => (
                    <li
                      key={id}
                      className={`plane-item ${selectedProjectId === id ? 'selected' : ''}`}
                      onClick={() => setSelectedProjectId(id)}
                    >
                      <div className="plane-item-header">
                        <span className="plane-item-title">{id}</span>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleViewProject(id);
                            }}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleEditProjectClick(id);
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Test Suites Plane */}
          <div className={`plane ${planeSuitesCollapsed ? 'collapsed' : ''}`}>
            <div className="plane-header">
              <h3 className="plane-title">Test Suites</h3>
              <div className="plane-actions">
                <button
                  type="button"
                  aria-expanded={!planeSuitesCollapsed}
                  className="btn-secondary"
                  onClick={() => setPlaneSuitesCollapsed((c) => !c)}
                >
                  {planeSuitesCollapsed ? 'Expand' : 'Collapse'}
                </button>
                <button type="button" onClick={() => setShowSuiteModal(true)}>
                  + New
                </button>
              </div>
            </div>
            <div className="plane-body">
              {activeTab === 'suites' && state === 'ready' && identifiers.length === 0 ? (
                <p>No test suites found.</p>
              ) : (
                <ul className="plane-list" aria-label="Test Suites Hierarchy List">
                  {(activeTab === 'suites' ? identifiers : []).map((id) => (
                    <li
                      key={id}
                      className={`plane-item ${selectedSuiteId === id ? 'selected' : ''}`}
                      onClick={() => setSelectedSuiteId(id)}
                    >
                      <div className="plane-item-header">
                        <span className="plane-item-title">{id}</span>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleViewSuite(id);
                            }}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleEditSuiteClick(id);
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Test Cases Plane */}
          <div className={`plane ${planeCasesCollapsed ? 'collapsed' : ''}`}>
            <div className="plane-header">
              <h3 className="plane-title">Test Cases</h3>
              <div className="plane-actions">
                <button
                  type="button"
                  aria-expanded={!planeCasesCollapsed}
                  className="btn-secondary"
                  onClick={() => setPlaneCasesCollapsed((c) => !c)}
                >
                  {planeCasesCollapsed ? 'Expand' : 'Collapse'}
                </button>
                <button type="button" onClick={() => setShowCaseModal(true)}>
                  + New
                </button>
              </div>
            </div>
            <div className="plane-body">
              {activeTab === 'cases' && state === 'ready' && identifiers.length === 0 ? (
                <p>No test cases found.</p>
              ) : (
                <ul className="plane-list" aria-label="Test Cases Hierarchy List">
                  {(activeTab === 'cases' ? identifiers : []).map((id) => (
                    <li
                      key={id}
                      className="plane-item"
                      onClick={() => void handleViewCase(id)}
                    >
                      <div className="plane-item-header">
                        <span className="plane-item-title">{id}</span>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleViewCase(id);
                            }}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleEditCaseClick(id);
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Execution Workspace when running a test run */}
        {activeTab === 'runs' && executingRun && (
          <section className="card" style={{ marginBottom: '2rem', borderLeft: '4px solid var(--colour-accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Execution Workspace: {executingRun.testRunId}</h3>
              <button type="button" className="btn-secondary" onClick={() => setExecutingRun(null)}>
                Close Execution
              </button>
            </div>
            <p><strong>Timestamp:</strong> {executingRun.timestamp}</p>

            {(!executingRun.testCases || executingRun.testCases.length === 0) ? (
              <p>No test cases in this run to execute.</p>
            ) : (
              <div>
                <div style={{ margin: '1rem 0' }}>
                  <span className="badge badge-untested">
                    Case {executingCaseIndex + 1} of {executingRun.testCases.length}
                  </span>
                </div>
                {executingRun.testCases[executingCaseIndex] && (
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid var(--colour-border)' }}>
                    <h4>{executingRun.testCases[executingCaseIndex].title} ({executingRun.testCases[executingCaseIndex].testCaseId})</h4>
                    <p><strong>Expected Result:</strong> {executingRun.testCases[executingCaseIndex].expectedResult}</p>
                    {executingRun.testCases[executingCaseIndex].description && (
                      <p><strong>Description:</strong> {executingRun.testCases[executingCaseIndex].description}</p>
                    )}
                    {executingRun.testCases[executingCaseIndex].steps && (
                      <div>
                        <strong>Steps:</strong>
                        <ol>
                          {executingRun.testCases[executingCaseIndex].steps?.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                      <button type="button" className="btn" style={{ background: 'var(--status-pass-text)' }} onClick={() => void handleSetResultStatus('Passed')}>
                        Mark Passed
                      </button>
                      <button type="button" className="btn-danger" onClick={() => void handleSetResultStatus('Failed')}>
                        Mark Failed
                      </button>
                      <button type="button" className="btn" style={{ background: 'var(--status-blocked-text)' }} onClick={() => void handleSetResultStatus('Blocked')}>
                        Mark Blocked
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => void handleSetResultStatus('Untested')}>
                        Reset Untested
                      </button>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
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

        {/* Resource List Cards */}
        {state === 'ready' && (
          <ul className="grid-cards" aria-label={`${activeTab.replace('_', ' ')} list`}>
            {identifiers.map((id) => (
              <li key={id} className="card">
                <div>
                  <h3 className="card-title">{id}</h3>
                </div>
                <div className="card-actions">
                  {activeTab === 'projects' && (
                    <>
                      <button type="button" className="btn-secondary" onClick={() => void handleViewProject(id)}>
                        Details
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => void handleEditProjectClick(id)}>
                        Edit
                      </button>
                      <button type="button" className="btn-danger" onClick={() => void handleDeleteProject(id)}>
                        Delete
                      </button>
                    </>
                  )}
                  {activeTab === 'suites' && (
                    <>
                      <button type="button" className="btn-secondary" onClick={() => void handleViewSuite(id)}>
                        Details
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => void handleEditSuiteClick(id)}>
                        Edit
                      </button>
                      <button type="button" className="btn-danger" onClick={() => void handleDeleteSuite(id)}>
                        Delete
                      </button>
                    </>
                  )}
                  {activeTab === 'cases' && (
                    <>
                      <button type="button" className="btn-secondary" onClick={() => void handleViewCase(id)}>
                        Details
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => void handleEditCaseClick(id)}>
                        Edit
                      </button>
                      <button type="button" className="btn-danger" onClick={() => void handleDeleteCase(id)}>
                        Delete
                      </button>
                    </>
                  )}
                  {activeTab === 'runs' && (
                    <>
                      <button type="button" onClick={() => void handleStartRun(id)}>
                        Execute
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => void handleViewRun(id)}>
                        Details
                      </button>
                      <button type="button" className="btn-danger" onClick={() => void handleDeleteRun(id)}>
                        Delete
                      </button>
                    </>
                  )}
                  {activeTab === 'milestones' && (
                    <>
                      <button type="button" className="btn-secondary" onClick={() => void handleViewMilestone(id)}>
                        Details
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => void handleEditMilestoneClick(id)}>
                        Edit
                      </button>
                      <button type="button" className="btn-danger" onClick={() => void handleDeleteMilestone(id)}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Modal for Project Creation */}
        {showProjectModal && (
          <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="proj-modal-title">
            <div className="modal-content">
              <div className="modal-header">
                <h3 id="proj-modal-title">Create New Project</h3>
                <button type="button" className="btn-secondary" onClick={() => setShowProjectModal(false)}>
                  Cancel
                </button>
              </div>
              <form className="form-grid" onSubmit={handleCreateProject}>
                <div className="form-group">
                  <label htmlFor="proj-id-input">Project ID</label>
                  <input
                    id="proj-id-input"
                    type="text"
                    required
                    value={projectIdInput}
                    onChange={(e) => setProjectIdInput(e.target.value)}
                    placeholder="e.g. PROJ-001"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="proj-name-input">Project Name</label>
                  <input
                    id="proj-name-input"
                    type="text"
                    required
                    value={projectNameInput}
                    onChange={(e) => setProjectNameInput(e.target.value)}
                    placeholder="Project Name"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="proj-desc-input">Description</label>
                  <textarea
                    id="proj-desc-input"
                    value={projectDescInput}
                    onChange={(e) => setProjectDescInput(e.target.value)}
                    placeholder="Project details..."
                  />
                </div>
                <button type="submit">Save Project</button>
              </form>
            </div>
          </div>
        )}

        {/* Modal for Test Suite Creation */}
        {showSuiteModal && (
          <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="suite-modal-title">
            <div className="modal-content">
              <div className="modal-header">
                <h3 id="suite-modal-title">Create New Test Suite</h3>
                <button type="button" className="btn-secondary" onClick={() => setShowSuiteModal(false)}>
                  Cancel
                </button>
              </div>
              <form className="form-grid" onSubmit={handleCreateSuite}>
                <div className="form-group">
                  <label htmlFor="suite-id-input">Suite ID (Filename)</label>
                  <input
                    id="suite-id-input"
                    type="text"
                    required
                    value={suiteIdInput}
                    onChange={(e) => setSuiteIdInput(e.target.value)}
                    placeholder="e.g. SmokeTest.json"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="suite-name-input">Suite Name</label>
                  <input
                    id="suite-name-input"
                    type="text"
                    required
                    value={suiteNameInput}
                    onChange={(e) => setSuiteNameInput(e.target.value)}
                    placeholder="Smoke Test Suite"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="suite-desc-input">Description</label>
                  <textarea
                    id="suite-desc-input"
                    value={suiteDescInput}
                    onChange={(e) => setSuiteDescInput(e.target.value)}
                    placeholder="Suite overview..."
                  />
                </div>
                <button type="submit">Save Test Suite</button>
              </form>
            </div>
          </div>
        )}

        {/* Modal for Test Case Creation */}
        {showCaseModal && (
          <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="case-modal-title">
            <div className="modal-content">
              <div className="modal-header">
                <h3 id="case-modal-title">Create New Test Case</h3>
                <button type="button" className="btn-secondary" onClick={() => setShowCaseModal(false)}>
                  Cancel
                </button>
              </div>
              <form className="form-grid" onSubmit={handleCreateCase}>
                <div className="form-group">
                  <label htmlFor="case-id-input">Test Case ID (Filename)</label>
                  <input
                    id="case-id-input"
                    type="text"
                    required
                    value={caseIdInput}
                    onChange={(e) => setCaseIdInput(e.target.value)}
                    placeholder="e.g. TC-001.json"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="case-title-input">Title</label>
                  <input
                    id="case-title-input"
                    type="text"
                    required
                    value={caseTitleInput}
                    onChange={(e) => setCaseTitleInput(e.target.value)}
                    placeholder="e.g. Verify User Login"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="case-priority-input">Priority</label>
                  <select
                    id="case-priority-input"
                    value={casePriorityInput}
                    onChange={(e) => setCasePriorityInput(e.target.value)}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="case-desc-input">Description / Preconditions</label>
                  <textarea
                    id="case-desc-input"
                    value={caseDescInput}
                    onChange={(e) => setCaseDescInput(e.target.value)}
                    placeholder="Preconditions or detailed description..."
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="case-expected-input">Expected Result</label>
                  <textarea
                    id="case-expected-input"
                    required
                    value={caseExpectedInput}
                    onChange={(e) => setCaseExpectedInput(e.target.value)}
                    placeholder="Expected outcome..."
                  />
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={caseExploratoryInput}
                      onChange={(e) => setCaseExploratoryInput(e.target.checked)}
                    />{' '}
                    Exploratory Test Case
                  </label>
                </div>
                <div className="form-group">
                  <label>Step-by-Step Actions</label>
                  <ul className="steps-list">
                    {caseStepsInput.map((step, idx) => (
                      <li key={idx} className="step-item">
                        <input
                          id={`step-input-${idx}`}
                          aria-label={`Step ${idx + 1}`}
                          type="text"
                          value={step}
                          onChange={(e) => {
                            const newSteps = [...caseStepsInput];
                            newSteps[idx] = e.target.value;
                            setCaseStepsInput(newSteps);
                          }}
                          placeholder={`Step ${idx + 1}`}
                        />
                        {caseStepsInput.length > 1 && (
                          <button
                            type="button"
                            className="btn-danger"
                            onClick={() => setCaseStepsInput(caseStepsInput.filter((_, i) => i !== idx))}
                          >
                            Remove
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ marginTop: '0.5rem' }}
                    onClick={() => setCaseStepsInput([...caseStepsInput, ''])}
                  >
                    + Add Step
                  </button>
                </div>
                <button type="submit">Save Test Case</button>
              </form>
            </div>
          </div>
        )}

        {/* Modal for Test Run Creation */}
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

        {/* Modal for Milestone Creation */}
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

        {/* Modal for Resource Details */}
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
                  <h5>Linked Test Suites ({activeProject.testSuites.length})</h5>
                  <ul>
                    {activeProject.testSuites.map((s) => (
                      <li key={s.suiteId}>{s.name} ({s.suiteId})</li>
                    ))}
                  </ul>
                </div>
              )}

              {activeTab === 'suites' && activeSuite && (
                <div>
                  <h4>{activeSuite.name} ({activeSuite.suiteId})</h4>
                  <p>{activeSuite.description || 'No description provided.'}</p>
                  <h5>Test Cases ({activeSuite.testCases.length})</h5>
                  <ul>
                    {activeSuite.testCases.map((c) => (
                      <li key={c.testCaseId}>{c.title} ({c.testCaseId})</li>
                    ))}
                  </ul>
                </div>
              )}

              {activeTab === 'cases' && activeCase && (
                <div>
                  <h4>{activeCase.title} ({activeCase.testCaseId})</h4>
                  <p><strong>Priority:</strong> {activeCase.priority || 'Medium'}</p>
                  <p><strong>Expected Result:</strong> {activeCase.expectedResult}</p>
                  {activeCase.description && <p><strong>Description:</strong> {activeCase.description}</p>}
                  {activeCase.steps && activeCase.steps.length > 0 && (
                    <div>
                      <strong>Steps:</strong>
                      <ol>
                        {activeCase.steps.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <hr style={{ margin: '1rem 0', borderColor: 'var(--colour-border)' }} />

                  <h5>Attachments ({activeCase.attachments?.length ?? 0})</h5>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label htmlFor="file-upload-input">Upload Evidence / Screenshot</label>
                    <input
                      id="file-upload-input"
                      type="file"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                    />
                    <button
                      type="button"
                      disabled={!selectedFile}
                      onClick={() => void handleUploadAttachment()}
                      style={{ marginTop: '0.5rem' }}
                    >
                      Upload File
                    </button>
                  </div>

                  <ul className="attachment-list">
                    {(activeCase.attachments ?? []).map((att) => (
                      <li key={att.filename} className="attachment-item">
                        <div>
                          <strong>{att.originalName}</strong> ({Math.round(att.size / 1024)} KB)
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <a
                            className="btn btn-secondary"
                            href={api.getAttachmentUrl(activeCase.testCaseId, att.filename)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Download
                          </a>
                          <button
                            type="button"
                            className="btn-danger"
                            onClick={() => void handleDeleteAttachment(att.filename)}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
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
                    <div style={{ margin: '1rem 0', background: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid var(--colour-border)' }}>
                      <h5>Aggregated Release Progress</h5>
                      <p><strong>Pass Rate:</strong> {activeMilestoneProgress.passPercentage.toFixed(1)}%</p>
                      <div className="progress-bar-container" style={{ display: 'flex', height: '1.25rem', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--colour-border)', margin: '0.5rem 0' }}>
                        <div style={{ width: `${activeMilestoneProgress.totalCases > 0 ? (activeMilestoneProgress.passed / activeMilestoneProgress.totalCases) * 100 : 0}%`, background: 'var(--status-pass-border)' }} title={`Passed: ${activeMilestoneProgress.passed}`} />
                        <div style={{ width: `${activeMilestoneProgress.totalCases > 0 ? (activeMilestoneProgress.failed / activeMilestoneProgress.totalCases) * 100 : 0}%`, background: 'var(--status-fail-border)' }} title={`Failed: ${activeMilestoneProgress.failed}`} />
                        <div style={{ width: `${activeMilestoneProgress.totalCases > 0 ? (activeMilestoneProgress.blocked / activeMilestoneProgress.totalCases) * 100 : 0}%`, background: 'var(--status-blocked-border)' }} title={`Blocked: ${activeMilestoneProgress.blocked}`} />
                        <div style={{ width: `${activeMilestoneProgress.totalCases > 0 ? (activeMilestoneProgress.untested / activeMilestoneProgress.totalCases) * 100 : 0}%`, background: 'var(--status-untested-border)' }} title={`Untested: ${activeMilestoneProgress.untested}`} />
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-pass">Passed: {activeMilestoneProgress.passed}</span>
                        <span className="badge badge-fail">Failed: {activeMilestoneProgress.failed}</span>
                        <span className="badge badge-blocked">Blocked: {activeMilestoneProgress.blocked}</span>
                        <span className="badge badge-untested">Untested: {activeMilestoneProgress.untested}</span>
                      </div>
                    </div>
                  )}

                  <h5>Linked Test Runs ({activeMilestone.testRunIds?.length ?? 0})</h5>
                  <ul>
                    {(activeMilestone.testRunIds ?? []).map((runId) => (
                      <li key={runId}>{runId}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal for Project Editing */}
        {editingProject && (
          <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-proj-modal-title">
            <div className="modal-content">
              <div className="modal-header">
                <h3 id="edit-proj-modal-title">Edit Project: {editingProject.projectId}</h3>
                <button type="button" className="btn-secondary" onClick={() => setEditingProject(null)}>
                  Cancel
                </button>
              </div>
              <form className="form-grid" onSubmit={handleUpdateProject}>
                <div className="form-group">
                  <label htmlFor="edit-proj-name-input">Project Name</label>
                  <input
                    id="edit-proj-name-input"
                    type="text"
                    required
                    value={editingProject.name}
                    onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-proj-desc-input">Description</label>
                  <textarea
                    id="edit-proj-desc-input"
                    value={editingProject.description || ''}
                    onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                  />
                </div>
                <button type="submit">Update Project</button>
              </form>
            </div>
          </div>
        )}

        {/* Modal for Test Suite Editing */}
        {editingSuite && (
          <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-suite-modal-title">
            <div className="modal-content">
              <div className="modal-header">
                <h3 id="edit-suite-modal-title">Edit Test Suite: {editingSuite.suiteId}</h3>
                <button type="button" className="btn-secondary" onClick={() => setEditingSuite(null)}>
                  Cancel
                </button>
              </div>
              <form className="form-grid" onSubmit={handleUpdateSuite}>
                <div className="form-group">
                  <label htmlFor="edit-suite-name-input">Suite Name</label>
                  <input
                    id="edit-suite-name-input"
                    type="text"
                    required
                    value={editingSuite.name}
                    onChange={(e) => setEditingSuite({ ...editingSuite, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-suite-desc-input">Description</label>
                  <textarea
                    id="edit-suite-desc-input"
                    value={editingSuite.description || ''}
                    onChange={(e) => setEditingSuite({ ...editingSuite, description: e.target.value })}
                  />
                </div>
                <button type="submit">Update Test Suite</button>
              </form>
            </div>
          </div>
        )}

        {/* Modal for Test Case Editing */}
        {editingCase && (
          <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-case-modal-title">
            <div className="modal-content">
              <div className="modal-header">
                <h3 id="edit-case-modal-title">Edit Test Case: {editingCase.testCaseId}</h3>
                <button type="button" className="btn-secondary" onClick={() => setEditingCase(null)}>
                  Cancel
                </button>
              </div>
              <form className="form-grid" onSubmit={handleUpdateCase}>
                <div className="form-group">
                  <label htmlFor="edit-case-title-input">Title</label>
                  <input
                    id="edit-case-title-input"
                    type="text"
                    required
                    value={editingCase.title}
                    onChange={(e) => setEditingCase({ ...editingCase, title: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-case-priority-input">Priority</label>
                  <select
                    id="edit-case-priority-input"
                    value={editingCase.priority || 'Medium'}
                    onChange={(e) => setEditingCase({ ...editingCase, priority: e.target.value })}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="edit-case-desc-input">Description / Preconditions</label>
                  <textarea
                    id="edit-case-desc-input"
                    value={editingCase.description || ''}
                    onChange={(e) => setEditingCase({ ...editingCase, description: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-case-expected-input">Expected Result</label>
                  <textarea
                    id="edit-case-expected-input"
                    required
                    value={editingCase.expectedResult}
                    onChange={(e) => setEditingCase({ ...editingCase, expectedResult: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={editingCase.exploratory || false}
                      onChange={(e) => setEditingCase({ ...editingCase, exploratory: e.target.checked })}
                    />{' '}
                    Exploratory Test Case
                  </label>
                </div>
                <button type="submit">Update Test Case</button>
              </form>
            </div>
          </div>
        )}

        {/* Modal for Milestone Editing */}
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
          </div>
        </div>
      </main>

      <footer>
        <p>Data is served by the Tucano Test API.</p>
      </footer>
    </>
  );
}
