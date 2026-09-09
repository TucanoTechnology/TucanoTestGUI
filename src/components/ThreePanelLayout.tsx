import { useState, useMemo } from 'react';
import FolderHierarchyTree from './FolderHierarchyTree';
import TestCaseTable, { TestCaseGroup } from './TestCaseTable';
import DetailView, { DetailItemType } from './DetailView';
import { Project, TestCase, TestSuite, TucanoApiClient } from '../api/client';
import { TestCaseStatus } from './StatusBadge';

export interface ThreePanelLayoutProps {
  client?: TucanoApiClient;
  projects: Project[];
  suites?: TestSuite[];
  allCases?: TestCase[];
  onProjectSelect?: (projectId: string) => void;
  onSuiteSelect?: (suiteId: string) => void;
  onCaseSelect?: (caseId: string) => void;
  onStatusChange?: (caseId: string, status: TestCaseStatus) => void;
  onCreateCase?: () => void;
  onQuickCreate?: () => void;
  onCreateSuite?: () => void;
  onCreateProject?: () => void;
  onCreateTestRun?: () => void;
  onDataRefreshNeeded?: () => void;
}

export default function ThreePanelLayout({
  client,
  projects,
  suites = [],
  allCases = [],
  onProjectSelect,
  onSuiteSelect,
  onCaseSelect,
  onStatusChange,
  onCreateCase,
  onQuickCreate,
  onCreateSuite,
  onCreateProject,
  onCreateTestRun,
  onDataRefreshNeeded,
}: ThreePanelLayoutProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [selectedFolderType, setSelectedFolderType] = useState<'all' | 'project' | 'suite' | 'case'>('all');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<DetailItemType>('case');

  // Collect all unique test cases across projects, standalone suites, and allCases list
  const consolidatedCases = useMemo(() => {
    const caseMap = new Map<string, TestCase>();

    // 1. From projects -> suites -> cases
    projects.forEach((p) => {
      p.testSuites?.forEach((s) => {
        s.testCases?.forEach((c) => {
          if (!caseMap.has(c.testCaseId)) caseMap.set(c.testCaseId, c);
        });
      });
    });

    // 2. From standalone suites
    suites.forEach((s) => {
      s.testCases?.forEach((c) => {
        if (!caseMap.has(c.testCaseId)) caseMap.set(c.testCaseId, c);
      });
    });

    // 3. From allCases list
    allCases.forEach((c) => {
      if (!caseMap.has(c.testCaseId)) caseMap.set(c.testCaseId, c);
    });

    return Array.from(caseMap.values());
  }, [projects, suites, allCases]);

  // Filter test cases based on selected folder / suite / project
  const displayedCases = useMemo(() => {
    if (selectedFolderId === 'all' || selectedFolderType === 'all') {
      return consolidatedCases;
    }

    if (selectedFolderType === 'project') {
      const targetProj = projects.find((p) => p.projectId === selectedFolderId);
      if (!targetProj) return consolidatedCases;
      const projCases: TestCase[] = [];
      targetProj.testSuites?.forEach((s) => {
        s.testCases?.forEach((c) => projCases.push(c));
      });
      return projCases;
    }

    if (selectedFolderType === 'suite') {
      // Find suite in projects or standalone suites
      for (const p of projects) {
        const found = p.testSuites?.find((s) => s.suiteId === selectedFolderId);
        if (found && found.testCases) return found.testCases;
      }
      const standalone = suites.find((s) => s.suiteId === selectedFolderId);
      if (standalone && standalone.testCases) return standalone.testCases;
      return [];
    }

    if (selectedFolderType === 'case') {
      const target = consolidatedCases.find((c) => c.testCaseId === selectedFolderId);
      return target ? [target] : [];
    }

    return consolidatedCases;
  }, [selectedFolderId, selectedFolderType, projects, suites, consolidatedCases]);

  // Construct groups for table display
  const tableGroups: TestCaseGroup[] = useMemo(() => {
    if (selectedFolderType === 'suite') {
      // If a single suite is selected, single group
      const suiteName = selectedFolderId.replace(/\.json$/, '');
      return [
        {
          groupId: selectedFolderId,
          groupName: suiteName,
          cases: displayedCases,
        },
      ];
    }

    // Otherwise group cases by suites
    const groups: TestCaseGroup[] = [];
    const groupedCaseIds = new Set<string>();

    projects.forEach((p) => {
      p.testSuites?.forEach((s) => {
        const sCases = (s.testCases || []).filter((c) =>
          displayedCases.some((dc) => dc.testCaseId === c.testCaseId)
        );
        if (sCases.length > 0) {
          sCases.forEach((c) => groupedCaseIds.add(c.testCaseId));
          groups.push({
            groupId: s.suiteId,
            groupName: s.name.replace(/\.json$/, ''),
            cases: sCases,
          });
        }
      });
    });

    suites.forEach((s) => {
      if (!groups.some((g) => g.groupId === s.suiteId)) {
        const sCases = (s.testCases || []).filter((c) =>
          displayedCases.some((dc) => dc.testCaseId === c.testCaseId)
        );
        if (sCases.length > 0) {
          sCases.forEach((c) => groupedCaseIds.add(c.testCaseId));
          groups.push({
            groupId: s.suiteId,
            groupName: s.name.replace(/\.json$/, ''),
            cases: sCases,
          });
        }
      }
    });

    // Any remaining cases in no suite
    const ungrouped = displayedCases.filter((c) => !groupedCaseIds.has(c.testCaseId));
    if (ungrouped.length > 0) {
      groups.push({
        groupId: 'general',
        groupName: 'General Cases',
        cases: ungrouped,
      });
    }

    return groups.length > 0
      ? groups
      : [
          {
            groupId: 'all',
            groupName: 'All Test Cases',
            cases: displayedCases,
          },
        ];
  }, [selectedFolderType, selectedFolderId, displayedCases, projects, suites]);

  // Keep selected item within bounds
  const currentCaseIndex = useMemo(() => {
    if (!selectedItemId) return -1;
    return displayedCases.findIndex((c) => c.testCaseId === selectedItemId);
  }, [selectedItemId, displayedCases]);

  const hasPrev = currentCaseIndex > 0;
  const hasNext = currentCaseIndex >= 0 && currentCaseIndex < displayedCases.length - 1;

  const handlePrev = () => {
    if (hasPrev) {
      const prevCase = displayedCases[currentCaseIndex - 1];
      if (prevCase) {
        setSelectedItemId(prevCase.testCaseId);
        setSelectedItemType('case');
      }
    }
  };

  const handleNext = () => {
    if (hasNext) {
      const nextCase = displayedCases[currentCaseIndex + 1];
      if (nextCase) {
        setSelectedItemId(nextCase.testCaseId);
        setSelectedItemType('case');
      }
    }
  };

  const handlePassAndNext = () => {
    if (selectedItemId) {
      onStatusChange?.(selectedItemId, 'Passed');
      if (hasNext) {
        handleNext();
      }
    }
  };

  const handleFolderSelect = (nodeId: string, type: 'all' | 'project' | 'suite' | 'case') => {
    setSelectedFolderId(nodeId);
    setSelectedFolderType(type);

    if (type === 'project') onProjectSelect?.(nodeId);
    if (type === 'suite') onSuiteSelect?.(nodeId);
    if (type === 'case') {
      setSelectedItemId(nodeId);
      setSelectedItemType('case');
      onCaseSelect?.(nodeId);
    }
  };

  const handleCaseRowClick = (testCase: TestCase) => {
    setSelectedItemId(testCase.testCaseId);
    setSelectedItemType('case');
    onCaseSelect?.(testCase.testCaseId);
  };

  const handleCloseDetail = () => {
    setSelectedItemId(null);
  };

  const handleCreateNew = (type: 'suite' | 'case' | 'project') => {
    if (type === 'suite') onCreateSuite?.();
    if (type === 'case') onCreateCase?.();
    if (type === 'project') onCreateProject?.();
  };

  // Compute breadcrumb path for selected item
  const detailBreadcrumb = useMemo(() => {
    if (!selectedItemId) return '';
    let path = 'All Test Cases';
    for (const p of projects) {
      for (const s of p.testSuites || []) {
        if (s.testCases?.some((c) => c.testCaseId === selectedItemId)) {
          return `${p.name.replace(/\.json$/, '')} / ${s.name.replace(/\.json$/, '')}`;
        }
      }
    }
    for (const s of suites) {
      if (s.testCases?.some((c) => c.testCaseId === selectedItemId)) {
        return `${s.name.replace(/\.json$/, '')}`;
      }
    }
    return path;
  }, [selectedItemId, projects, suites]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: selectedItemId ? '270px 1fr 430px' : '270px 1fr',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        background: '#ffffff',
      }}
    >
      {/* Pane 1 - Folder Hierarchy Tree */}
      <div style={{ height: '100%', overflow: 'hidden' }}>
        <FolderHierarchyTree
          projects={projects}
          standaloneSuites={suites}
          standaloneCases={allCases}
          onNodeSelect={handleFolderSelect}
          selectedNodeId={selectedFolderId}
          onCreateNew={handleCreateNew}
        />
      </div>

      {/* Pane 2 - Test Case Table View */}
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
          selectedCaseId={selectedItemId}
          onRowClick={handleCaseRowClick}
          onStatusChange={onStatusChange}
          onCreateCase={onCreateCase}
          onCreateSuite={onCreateSuite}
          onQuickCreate={onQuickCreate}
          onCreateTestRun={onCreateTestRun}
        />
      </div>

      {/* Pane 3 - Detail & Result Panel */}
      {selectedItemId && (
        <div style={{ height: '100%', overflow: 'hidden' }}>
          <DetailView
            itemId={selectedItemId}
            itemType={selectedItemType}
            client={client}
            breadcrumb={detailBreadcrumb}
            onClose={handleCloseDetail}
            onPrev={handlePrev}
            onNext={handleNext}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPassAndNext={handlePassAndNext}
            onStatusChange={(st) => onStatusChange?.(selectedItemId, st)}
            onItemUpdated={onDataRefreshNeeded}
            onItemDeleted={() => {
              setSelectedItemId(null);
              onDataRefreshNeeded?.();
            }}
          />
        </div>
      )}
    </div>
  );
}
