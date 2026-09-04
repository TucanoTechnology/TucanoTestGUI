import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ApiRequestError,
  Project,
  TestCase,
  TestRun,
  TestSuite,
  TucanoApiClient,
} from './api/client';

type Tab = 'projects' | 'suites' | 'cases' | 'runs';
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

  // Form modal visibility flags
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showSuiteModal, setShowSuiteModal] = useState(false);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

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

  // Attachment upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const statusRef = useRef<HTMLParagraphElement>(null);

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
      setMessage(`Project ${newProject.projectId} created successfully.`);
      setShowProjectModal(false);
      setProjectIdInput('');
      setProjectNameInput('');
      setProjectDescInput('');
      void loadIdentifiers('projects', filter);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to create project.');
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await api.deleteProject(id);
      setMessage(`Project ${id} deleted.`);
      void loadIdentifiers('projects', filter);
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
      setMessage(`Test suite ${newSuite.suiteId} created successfully.`);
      setShowSuiteModal(false);
      setSuiteIdInput('');
      setSuiteNameInput('');
      setSuiteDescInput('');
      void loadIdentifiers('suites', filter);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to create test suite.');
    }
  };

  const handleDeleteSuite = async (id: string) => {
    try {
      await api.deleteTestSuite(id);
      setMessage(`Test suite ${id} deleted.`);
      void loadIdentifiers('suites', filter);
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
      setMessage(`Test case ${newCase.testCaseId} created successfully.`);
      setShowCaseModal(false);
      setCaseIdInput('');
      setCaseTitleInput('');
      setCaseDescInput('');
      setCaseExpectedInput('');
      setCasePriorityInput('Medium');
      setCaseExploratoryInput(false);
      setCaseStepsInput(['']);
      void loadIdentifiers('cases', filter);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to create test case.');
    }
  };

  const handleDeleteCase = async (id: string) => {
    try {
      await api.deleteTestCase(id);
      setMessage(`Test case ${id} deleted.`);
      void loadIdentifiers('cases', filter);
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
      setMessage(`Test run ${newRun.testRunId} created successfully.`);
      setShowRunModal(false);
      setRunIdInput('');
      void loadIdentifiers('runs', filter);
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : 'Failed to create test run.');
    }
  };

  const handleDeleteRun = async (id: string) => {
    try {
      await api.deleteTestRun(id);
      setMessage(`Test run ${id} deleted.`);
      void loadIdentifiers('runs', filter);
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

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>

      <header>
        <h1 className="app-title">Tucano Test</h1>
        <nav aria-label="Main Navigation">
          <ul className="nav-tabs">
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
          </ul>
        </nav>
      </header>

      <main id="main" tabIndex={-1}>
        <div className="page-header">
          <h2>
            {activeTab === 'projects' && 'Projects'}
            {activeTab === 'suites' && 'Test suites'}
            {activeTab === 'cases' && 'Test cases'}
            {activeTab === 'runs' && 'Test runs'}
          </h2>
          <div>
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
          </div>
        </div>

        <form className="search-form" onSubmit={handleSearchSubmit}>
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

        <p aria-live="polite" ref={statusRef} className={`status-message ${state === 'error' ? 'error' : ''}`}>
          {message}
        </p>

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
            </div>
          </div>
        )}
      </main>

      <footer>
        <p>Data is served by the Tucano Test API.</p>
      </footer>
    </>
  );
}
