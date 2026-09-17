import { FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ApiRequestError, Project, TestCase, TestSuite, TucanoApiClient } from '../../api/client';
import DetailView from '../../components/DetailView';
import FolderHierarchyTree from '../../components/FolderHierarchyTree';
import { STATUS_CONFIG, TestCaseStatus } from '../../components/StatusBadge';
import TestCaseTable, { TestCaseGroup } from '../../components/TestCaseTable';
import BulkActionToolbar from './BulkActionToolbar';

/**
 * Test cases module (issue #72): the folder-hierarchy execution board. The shell
 * owns the filtered identifier list and the shared live region; the module
 * resolves those identifiers into TestCase entities, projects them through the
 * folder tree, renders the loading, empty and error states, and performs every
 * mutation through TucanoApiClient.
 *
 * Folder membership comes from the suite structures the shell already loaded —
 * the API owns those relationships, so the board never guesses where a case
 * lives. Cases that appear in no suite stay reachable through the unfiled node.
 */

export interface TestCasesModuleProps {
  client: TucanoApiClient;
  identifiers: readonly string[];
  projects: Project[];
  suites: TestSuite[];
  createRequest?: number;
  onStatus: (message: string, state?: 'info' | 'error') => void;
  onChanged?: () => void | Promise<void>;
  onCreateSuite?: () => void;
  onCreateProject?: () => void;
  onCreateTestRun?: () => void;
}

type DetailState = 'loading' | 'ready' | 'error';

interface Failure {
  code: string;
  message: string;
}

function toFailure(error: unknown, fallback: string): Failure {
  if (error instanceof ApiRequestError) {
    return { code: error.code, message: error.message };
  }
  return { code: 'network_error', message: fallback };
}

const UNASSIGNED_FOLDER = 'unassigned';

function stripExtension(name: string): string {
  return name.replace(/\.json$/, '');
}

function caseWord(count: number): string {
  return count === 1 ? 'test case' : 'test cases';
}

export default function TestCasesModule({
  client,
  identifiers,
  projects,
  suites,
  createRequest = 0,
  onStatus,
  onChanged,
  onCreateSuite,
  onCreateProject,
  onCreateTestRun,
}: TestCasesModuleProps) {
  const [cases, setCases] = useState<TestCase[]>([]);
  const [detailState, setDetailState] = useState<DetailState>('loading');
  const [detailFailure, setDetailFailure] = useState<Failure | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newCaseId, setNewCaseId] = useState('');
  const [newCaseTitle, setNewCaseTitle] = useState('');
  const [newCaseDescription, setNewCaseDescription] = useState('');
  const [newCaseExpected, setNewCaseExpected] = useState('');
  const [newCasePriority, setNewCasePriority] = useState('Medium');
  const [newCaseExploratory, setNewCaseExploratory] = useState(false);
  const [newCaseSteps, setNewCaseSteps] = useState<string[]>(['']);

  const [editing, setEditing] = useState<TestCase | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [bulkSelection, setBulkSelection] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const [folderId, setFolderId] = useState<string>('all');
  const [folderType, setFolderType] = useState<'all' | 'project' | 'suite' | 'case'>('all');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const fieldId = useId();
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    setDetailState('loading');
    setDetailFailure(null);

    Promise.all(identifiers.map((id) => client.getTestCase(id)))
      .then((details) => {
        if (cancelled) return;
        setCases(details.filter((testCase) => Boolean(testCase?.testCaseId)));
        setDetailState('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const failure = toFailure(error, 'Could not reach the Tucano Test API.');
        setCases([]);
        setDetailState('error');
        setDetailFailure(failure);
        onStatus(`Could not load case details: ${failure.message}`, 'error');
      });

    return () => {
      cancelled = true;
    };
  }, [client, identifiers, onStatus]);

  useEffect(() => {
    if (createRequest > 0) {
      setEditing(null);
      setPendingDelete(null);
      setShowCreate(true);
    }
  }, [createRequest]);

  useEffect(() => {
    if (pendingDelete) {
      cancelDeleteRef.current?.focus();
    }
  }, [pendingDelete]);

  useEffect(() => {
    setBulkSelection((previous) => {
      if (previous.size === 0) return previous;
      const next = new Set(
        Array.from(previous).filter((id) => cases.some((testCase) => testCase.testCaseId === id))
      );
      return next.size === previous.size ? previous : next;
    });
  }, [cases]);

  // Where each case lives, derived from the structures the API returned.
  const membership = useMemo(() => {
    const suitesByCase = new Map<string, string[]>();
    const casesBySuite = new Map<string, Set<string>>();
    const casesByProject = new Map<string, Set<string>>();

    const indexSuite = (suite: TestSuite, projectId?: string) => {
      const suiteCases = casesBySuite.get(suite.suiteId) ?? new Set<string>();
      suite.testCases?.forEach((testCase) => {
        suiteCases.add(testCase.testCaseId);
        const owners = suitesByCase.get(testCase.testCaseId) ?? [];
        if (!owners.includes(suite.suiteId)) owners.push(suite.suiteId);
        suitesByCase.set(testCase.testCaseId, owners);
      });
      casesBySuite.set(suite.suiteId, suiteCases);

      if (projectId) {
        const projectCases = casesByProject.get(projectId) ?? new Set<string>();
        suiteCases.forEach((caseId) => projectCases.add(caseId));
        casesByProject.set(projectId, projectCases);
      }
    };

    projects.forEach((project) => {
      project.testSuites?.forEach((suite) => indexSuite(suite, project.projectId));
    });
    suites.forEach((suite) => indexSuite(suite));

    return { suitesByCase, casesBySuite, casesByProject };
  }, [projects, suites]);

  const displayedCases = useMemo(() => {
    if (folderId === UNASSIGNED_FOLDER) {
      return cases.filter((testCase) => !membership.suitesByCase.has(testCase.testCaseId));
    }
    if (folderType === 'project') {
      const owned = membership.casesByProject.get(folderId);
      return owned ? cases.filter((testCase) => owned.has(testCase.testCaseId)) : [];
    }
    if (folderType === 'suite') {
      const owned = membership.casesBySuite.get(folderId);
      return owned ? cases.filter((testCase) => owned.has(testCase.testCaseId)) : [];
    }
    if (folderType === 'case') {
      return cases.filter((testCase) => testCase.testCaseId === folderId);
    }
    return cases;
  }, [cases, folderId, folderType, membership]);

  const tableGroups = useMemo<TestCaseGroup[]>(() => {
    const singleGroup = (groupId: string, groupName: string): TestCaseGroup[] =>
      displayedCases.length > 0 ? [{ groupId, groupName, cases: displayedCases }] : [];

    if (folderId === UNASSIGNED_FOLDER) {
      return singleGroup(UNASSIGNED_FOLDER, 'Test cases in no folder');
    }
    if (folderType === 'project') {
      const project = projects.find((candidate) => candidate.projectId === folderId);
      return singleGroup(folderId, stripExtension(project?.name ?? folderId));
    }
    if (folderType === 'suite') {
      const suite =
        suites.find((candidate) => candidate.suiteId === folderId) ??
        projects
          .flatMap((project) => project.testSuites ?? [])
          .find((candidate) => candidate.suiteId === folderId);
      return singleGroup(folderId, stripExtension(suite?.name ?? folderId));
    }
    if (folderType === 'case') {
      const testCase = cases.find((candidate) => candidate.testCaseId === folderId);
      return singleGroup(folderId, testCase?.title ?? folderId);
    }

    const groups: TestCaseGroup[] = [];
    const grouped = new Set<string>();
    const addSuiteGroup = (suite: TestSuite) => {
      if (groups.some((group) => group.groupId === suite.suiteId)) return;
      const suiteCases = displayedCases.filter((testCase) =>
        membership.casesBySuite.get(suite.suiteId)?.has(testCase.testCaseId)
      );
      if (suiteCases.length === 0) return;
      suiteCases.forEach((testCase) => grouped.add(testCase.testCaseId));
      groups.push({
        groupId: suite.suiteId,
        groupName: stripExtension(suite.name),
        cases: suiteCases,
      });
    };

    projects.forEach((project) => project.testSuites?.forEach(addSuiteGroup));
    suites.forEach(addSuiteGroup);

    const unfiled = displayedCases.filter((testCase) => !grouped.has(testCase.testCaseId));
    if (unfiled.length > 0) {
      groups.push({ groupId: 'general', groupName: 'General Cases', cases: unfiled });
    }

    return groups;
  }, [cases, displayedCases, folderId, folderType, membership, projects, suites]);

  const currentIndex = useMemo(
    () => displayedCases.findIndex((testCase) => testCase.testCaseId === selectedCaseId),
    [displayedCases, selectedCaseId]
  );
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < displayedCases.length - 1;

  const detailBreadcrumb = useMemo(() => {
    if (!selectedCaseId) return '';
    for (const project of projects) {
      for (const suite of project.testSuites ?? []) {
        if (suite.testCases?.some((testCase) => testCase.testCaseId === selectedCaseId)) {
          return `${stripExtension(project.name)} / ${stripExtension(suite.name)}`;
        }
      }
    }
    for (const suite of suites) {
      if (suite.testCases?.some((testCase) => testCase.testCaseId === selectedCaseId)) {
        return stripExtension(suite.name);
      }
    }
    return 'All Test Cases';
  }, [projects, selectedCaseId, suites]);

  const resetCreateForm = () => {
    setNewCaseId('');
    setNewCaseTitle('');
    setNewCaseDescription('');
    setNewCaseExpected('');
    setNewCasePriority('Medium');
    setNewCaseExploratory(false);
    setNewCaseSteps(['']);
  };

  const openCreateForm = () => {
    resetCreateForm();
    setEditing(null);
    setPendingDelete(null);
    setShowCreate(true);
  };

  const closeCreateForm = () => {
    setShowCreate(false);
    resetCreateForm();
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const rawId = newCaseId || `TC-${Date.now()}`;
    const id = rawId.endsWith('.json') ? rawId : `${rawId}.json`;
    const steps = newCaseSteps.filter((step) => step.trim().length > 0);

    const testCase: TestCase = {
      testCaseId: id,
      title: newCaseTitle,
      description: newCaseDescription || undefined,
      expectedResult: newCaseExpected,
      priority: newCasePriority,
      exploratory: newCaseExploratory,
      steps: steps.length > 0 ? steps : undefined,
    };

    try {
      await client.createTestCase(testCase);
      closeCreateForm();
      await onChanged?.();
      onStatus(`Test case ${testCase.testCaseId} created successfully.`);
    } catch (error) {
      const failure = toFailure(error, 'The API refused the request.');
      onStatus(`Could not create test case: ${failure.message}`, 'error');
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;

    try {
      await client.updateTestCase(editing.testCaseId, editing);
      const updatedId = editing.testCaseId;
      setEditing(null);
      await onChanged?.();
      onStatus(`Test case ${updatedId} updated successfully.`);
    } catch (error) {
      const failure = toFailure(error, 'The API refused the request.');
      onStatus(`Could not update test case: ${failure.message}`, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    setPendingDelete(null);
    try {
      await client.deleteTestCase(id);
      setSelectedCaseId((current) => (current === id ? null : current));
      await onChanged?.();
      onStatus(`Test case ${id} deleted.`);
    } catch (error) {
      const failure = toFailure(error, 'The API refused the request.');
      onStatus(`Could not delete test case: ${failure.message}`, 'error');
    }
  };

  const applyStatus = async (id: string, status: TestCaseStatus): Promise<boolean> => {
    const current = await client.getTestCase(id);
    await client.updateTestCase(id, { ...current, priority: status });
    return true;
  };

  const handleStatusChange = async (id: string, status: TestCaseStatus) => {
    try {
      await applyStatus(id, status);
      await onChanged?.();
      onStatus(`Updated ${id} status to ${status}.`);
    } catch (error) {
      const failure = toFailure(error, 'The API refused the request.');
      onStatus(`Could not update ${id} status: ${failure.message}`, 'error');
    }
  };

  const handleBulkStatus = async (status: TestCaseStatus) => {
    const ids = Array.from(bulkSelection);
    if (ids.length === 0) return;

    setBusy(true);
    let failures = 0;
    for (const id of ids) {
      try {
        await applyStatus(id, status);
      } catch {
        failures += 1;
      }
    }
    setBusy(false);
    setBulkSelection(new Set());
    await onChanged?.();

    if (failures > 0) {
      onStatus(`Could not update ${failures} of ${ids.length} selected test cases.`, 'error');
    } else {
      onStatus(`Marked ${ids.length} ${caseWord(ids.length)} as ${STATUS_CONFIG[status].label}.`);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(bulkSelection);
    if (ids.length === 0) return;

    setBusy(true);
    let failures = 0;
    for (const id of ids) {
      try {
        await client.deleteTestCase(id);
      } catch {
        failures += 1;
      }
    }
    setBusy(false);
    setBulkSelection(new Set());
    setSelectedCaseId((current) => (current && ids.includes(current) ? null : current));
    await onChanged?.();

    if (failures > 0) {
      onStatus(`Could not delete ${failures} of ${ids.length} selected test cases.`, 'error');
    } else {
      onStatus(`Deleted ${ids.length} ${caseWord(ids.length)}.`);
    }
  };

  const handleFolderSelect = (nodeId: string, type: 'all' | 'project' | 'suite' | 'case') => {
    setFolderId(nodeId);
    setFolderType(type);
    setBulkSelection(new Set());
    if (type === 'case') {
      setSelectedCaseId(nodeId);
    }
  };

  const handleCreateNew = (type: 'suite' | 'case' | 'project') => {
    if (type === 'suite') onCreateSuite?.();
    if (type === 'case') openCreateForm();
    if (type === 'project') onCreateProject?.();
  };

  const handleNext = () => {
    if (hasNext) {
      setSelectedCaseId(displayedCases[currentIndex + 1]?.testCaseId ?? selectedCaseId);
    }
  };

  const handlePassAndNext = () => {
    if (!selectedCaseId) return;
    void handleStatusChange(selectedCaseId, 'Passed');
    handleNext();
  };

  return (
    <>
      {detailState === 'loading' && <p className="module-state">Fetching case details…</p>}

      {detailState === 'error' && detailFailure && (
        <div className="module-error">
          <p>Could not load case details: {detailFailure.message}</p>
          <p className="module-error-code">Error code: {detailFailure.code}</p>
        </div>
      )}

      {detailState === 'ready' && identifiers.length === 0 && (
        <p className="module-state">No test cases to show.</p>
      )}

      {detailState === 'ready' && identifiers.length > 0 && (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: selectedCaseId ? '270px 1fr 430px' : '270px 1fr',
          height: '100%',
          width: '100%',
          overflow: 'hidden',
          background: '#ffffff',
        }}
      >
        <div style={{ height: '100%', overflow: 'hidden' }}>
          <FolderHierarchyTree
            projects={projects}
            standaloneSuites={suites}
            standaloneCases={cases}
            onNodeSelect={handleFolderSelect}
            selectedNodeId={folderId}
            onCreateNew={handleCreateNew}
          />
        </div>

        <div
          style={{
            height: '100%',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            background: '#ffffff',
          }}
        >
          <TestCaseTable
            cases={displayedCases}
            groups={tableGroups}
            selectedCaseId={selectedCaseId}
            selectedIds={Array.from(bulkSelection)}
            onSelectionChange={(ids) => setBulkSelection(new Set(ids))}
            onStatusChange={handleStatusChange}
            onRowClick={(testCase) => setSelectedCaseId(testCase.testCaseId)}
            onEditCase={(testCase) => {
              setPendingDelete(null);
              setEditing(testCase);
            }}
            onDeleteCase={(testCase) => setPendingDelete(testCase.testCaseId)}
            bulkActions={
              <BulkActionToolbar
                selectedCount={bulkSelection.size}
                onStatusChange={handleBulkStatus}
                onDelete={handleBulkDelete}
                onClear={() => setBulkSelection(new Set())}
                busy={busy}
              />
            }
            onCreateCase={openCreateForm}
            onCreateSuite={onCreateSuite}
            onCreateTestRun={onCreateTestRun}
          />
        </div>

        {selectedCaseId && (
          <div style={{ height: '100%', overflow: 'hidden' }}>
            <DetailView
              itemId={selectedCaseId}
              itemType="case"
              client={client}
              breadcrumb={detailBreadcrumb}
              onClose={() => setSelectedCaseId(null)}
              onPrev={() => setSelectedCaseId(displayedCases[currentIndex - 1]?.testCaseId ?? selectedCaseId)}
              onNext={handleNext}
              hasPrev={hasPrev}
              hasNext={hasNext}
              onPassAndNext={handlePassAndNext}
              onStatusChange={(status) => void handleStatusChange(selectedCaseId, status)}
              onItemUpdated={onChanged}
              onItemDeleted={() => {
                setSelectedCaseId(null);
                void onChanged?.();
              }}
            />
          </div>
        )}
      </div>
      )}

      {showCreate && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${fieldId}-create-heading`}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3 id={`${fieldId}-create-heading`}>Create New Test Case</h3>
              <button type="button" className="btn-secondary" onClick={closeCreateForm}>
                Cancel
              </button>
            </div>
            <form className="form-grid" onSubmit={handleCreate}>
              <div className="form-group">
                <label htmlFor={`${fieldId}-create-id`}>Test Case ID (Filename)</label>
                <input
                  id={`${fieldId}-create-id`}
                  type="text"
                  required
                  value={newCaseId}
                  onChange={(event) => setNewCaseId(event.target.value)}
                  placeholder="e.g. TC-001.json"
                />
              </div>
              <div className="form-group">
                <label htmlFor={`${fieldId}-create-title`}>Title</label>
                <input
                  id={`${fieldId}-create-title`}
                  type="text"
                  required
                  value={newCaseTitle}
                  onChange={(event) => setNewCaseTitle(event.target.value)}
                  placeholder="e.g. Verify User Login"
                />
              </div>
              <div className="form-group">
                <label htmlFor={`${fieldId}-create-priority`}>Priority</label>
                <select
                  id={`${fieldId}-create-priority`}
                  value={newCasePriority}
                  onChange={(event) => setNewCasePriority(event.target.value)}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor={`${fieldId}-create-description`}>Description / Preconditions</label>
                <textarea
                  id={`${fieldId}-create-description`}
                  value={newCaseDescription}
                  onChange={(event) => setNewCaseDescription(event.target.value)}
                  placeholder="Preconditions or detailed description..."
                />
              </div>
              <div className="form-group">
                <label htmlFor={`${fieldId}-create-expected`}>Expected Result</label>
                <textarea
                  id={`${fieldId}-create-expected`}
                  required
                  value={newCaseExpected}
                  onChange={(event) => setNewCaseExpected(event.target.value)}
                  placeholder="Expected outcome..."
                />
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={newCaseExploratory}
                    onChange={(event) => setNewCaseExploratory(event.target.checked)}
                  />{' '}
                  Exploratory Test Case
                </label>
              </div>
              <div className="form-group">
                <label>Step-by-Step Actions</label>
                <ul className="steps-list">
                  {newCaseSteps.map((step, index) => (
                    <li key={index} className="step-item">
                      <input
                        id={`${fieldId}-step-${index}`}
                        aria-label={`Step ${index + 1}`}
                        type="text"
                        value={step}
                        onChange={(event) => {
                          const next = [...newCaseSteps];
                          next[index] = event.target.value;
                          setNewCaseSteps(next);
                        }}
                        placeholder={`Step ${index + 1}`}
                      />
                      {newCaseSteps.length > 1 && (
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() =>
                            setNewCaseSteps(newCaseSteps.filter((_, position) => position !== index))
                          }
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
                  onClick={() => setNewCaseSteps([...newCaseSteps, ''])}
                >
                  + Add Step
                </button>
              </div>
              <button type="submit">Save Test Case</button>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${fieldId}-edit-title`}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3 id={`${fieldId}-edit-title`}>Edit Test Case: {editing.testCaseId}</h3>
              <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
            <form className="form-grid" onSubmit={handleUpdate}>
              <div className="form-group">
                <label htmlFor={`${fieldId}-edit-title-input`}>Title</label>
                <input
                  id={`${fieldId}-edit-title-input`}
                  type="text"
                  required
                  value={editing.title}
                  onChange={(event) => setEditing({ ...editing, title: event.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor={`${fieldId}-edit-priority`}>Priority</label>
                <select
                  id={`${fieldId}-edit-priority`}
                  value={editing.priority ?? 'Medium'}
                  onChange={(event) => setEditing({ ...editing, priority: event.target.value })}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor={`${fieldId}-edit-description`}>Description / Preconditions</label>
                <textarea
                  id={`${fieldId}-edit-description`}
                  value={editing.description ?? ''}
                  onChange={(event) => setEditing({ ...editing, description: event.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor={`${fieldId}-edit-expected`}>Expected Result</label>
                <textarea
                  id={`${fieldId}-edit-expected`}
                  required
                  value={editing.expectedResult}
                  onChange={(event) => setEditing({ ...editing, expectedResult: event.target.value })}
                />
              </div>
              <button type="submit">Update Test Case</button>
            </form>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`Confirm deletion of ${pendingDelete}`}
        >
          <div className="modal-content">
            <div className="delete-confirm" role="group">
              <p>Delete {pendingDelete}? This cannot be undone.</p>
              <div>
                <button
                  type="button"
                  className="btn-secondary"
                  ref={cancelDeleteRef}
                  onClick={() => setPendingDelete(null)}
                >
                  Cancel
                </button>
                <button type="button" className="btn-danger" onClick={() => void handleDelete(pendingDelete)}>
                  Confirm delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
