import { useState } from 'react';
import FolderHierarchyTree from './FolderHierarchyTree';
import TestCaseTable from './TestCaseTable';
import DetailView, { DetailItemType } from './DetailView';
import { Project, TestCase } from '../api/client';

export interface ThreePanelLayoutProps {
  projects: Project[];
  onProjectSelect?: (projectId: string) => void;
  onSuiteSelect?: (suiteId: string) => void;
  onCaseSelect?: (caseId: string) => void;
}

export default function ThreePanelLayout({
  projects,
  onProjectSelect,
  onSuiteSelect,
  onCaseSelect,
}: ThreePanelLayoutProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFolderType, setSelectedFolderType] = useState<'project' | 'suite' | 'case' | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<DetailItemType | null>(null);
  const [filteredCases, setFilteredCases] = useState<TestCase[]>([]);

  const handleFolderSelect = (nodeId: string, type: 'project' | 'suite' | 'case') => {
    setSelectedFolderId(nodeId);
    setSelectedFolderType(type);
    setSelectedItemId(null);
    setSelectedItemType(null);

    // Filter cases based on selection
    const cases: TestCase[] = [];
    projects.forEach((project) => {
      if (type === 'project' && project.projectId === nodeId) {
        project.testSuites?.forEach((suite) => {
          suite.testCases?.forEach((tc) => cases.push(tc));
        });
      } else if (type === 'suite') {
        project.testSuites?.forEach((suite) => {
          if (suite.suiteId === nodeId) {
            suite.testCases?.forEach((tc) => cases.push(tc));
          }
        });
      } else if (type === 'case' && nodeId === nodeId) {
        project.testSuites?.forEach((suite) => {
          suite.testCases?.forEach((tc) => {
            if (tc.testCaseId === nodeId) cases.push(tc);
          });
        });
      }
    });

    setFilteredCases(cases);

    if (type === 'project') onProjectSelect?.(nodeId);
    if (type === 'suite') onSuiteSelect?.(nodeId);
    if (type === 'case') onCaseSelect?.(nodeId);
  };

  const handleCaseClick = (testCase: TestCase) => {
    setSelectedItemId(testCase.testCaseId);
    setSelectedItemType('case');
  };

  const handleRowSelection = (_selectedIds: string[]) => {
    // Multi-select handling if needed
  };

  const handleCloseDetail = () => {
    setSelectedItemId(null);
    setSelectedItemType(null);
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: selectedItemId ? '280px 1fr 380px' : '280px 1fr 0',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Left Panel - Folder Tree */}
      <div
        style={{
          borderRight: '1px solid #dee2e6',
          overflow: 'auto',
          background: '#f8f9fa',
        }}
      >
        <div style={{ padding: '12px', borderBottom: '1px solid #dee2e6' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Test Cases</h3>
        </div>
        <FolderHierarchyTree
          projects={projects}
          onNodeSelect={handleFolderSelect}
          selectedNodeId={selectedFolderId || undefined}
        />
      </div>

      {/* Center Panel - List View */}
      <div style={{ overflow: 'auto', background: '#ffffff' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #dee2e6' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
            {selectedFolderType === 'project' && 'Project Cases'}
            {selectedFolderType === 'suite' && 'Suite Cases'}
            {selectedFolderType === 'case' && 'Selected Case'}
            {!selectedFolderType && 'All Cases'}
          </h3>
        </div>
        <TestCaseTable
          cases={filteredCases}
          onSelectionChange={handleRowSelection}
          onRowClick={handleCaseClick}
        />
      </div>

      {/* Right Panel - Detail View */}
      {selectedItemId && (
        <div
          style={{
            borderLeft: '1px solid #dee2e6',
            overflow: 'auto',
            background: '#ffffff',
          }}
        >
          <DetailView
            itemId={selectedItemId}
            itemType={selectedItemType!}
            onClose={handleCloseDetail}
          />
        </div>
      )}
    </div>
  );
}
