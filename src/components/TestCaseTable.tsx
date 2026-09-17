import React, { useState, useMemo } from 'react';
import { TestCase } from '../api/client';
import StatusBadge, { TestCaseStatus } from './StatusBadge';

export interface TestCaseGroup {
  groupId: string;
  groupName: string;
  cases: TestCase[];
}

export interface TestCaseTableProps {
  cases: TestCase[];
  groups?: TestCaseGroup[];
  selectedCaseId?: string | null;
  onSelectionChange?: (selectedIds: string[]) => void;
  onStatusChange?: (id: string, status: TestCaseStatus) => void;
  onRowClick?: (testCase: TestCase) => void;
  onCreateCase?: () => void;
  onQuickCreate?: () => void;
  onCreateSuite?: () => void;
  onCreateTestRun?: () => void;
}

type SortColumn = 'id' | 'title' | 'priority' | 'status';
type SortDirection = 'asc' | 'desc';

export default function TestCaseTable({
  cases,
  groups,
  selectedCaseId,
  onSelectionChange,
  onStatusChange,
  onRowClick,
  onCreateCase,
  onQuickCreate,
  onCreateSuite,
  onCreateTestRun,
}: TestCaseTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<SortColumn>('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Filter cases by keyword search
  const filteredCases = useMemo(() => {
    if (!searchKeyword.trim()) return cases;
    const q = searchKeyword.toLowerCase();
    return cases.filter(
      (c) =>
        c.testCaseId.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        (c.priority && c.priority.toLowerCase().includes(q))
    );
  }, [cases, searchKeyword]);

  // Derive groups if provided or construct single/multiple groups
  const renderedGroups: TestCaseGroup[] = useMemo(() => {
    if (groups && groups.length > 0) {
      if (!searchKeyword.trim()) return groups;
      const q = searchKeyword.toLowerCase();
      return groups
        .map((g) => ({
          ...g,
          cases: g.cases.filter(
            (c) =>
              c.testCaseId.toLowerCase().includes(q) ||
              c.title.toLowerCase().includes(q) ||
              (c.priority && c.priority.toLowerCase().includes(q))
          ),
        }))
        .filter((g) => g.cases.length > 0);
    }
    return [
      {
        groupId: 'all',
        groupName: 'All Test Cases',
        cases: filteredCases,
      },
    ];
  }, [groups, filteredCases, searchKeyword]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredCases.length && filteredCases.length > 0) {
      setSelectedIds(new Set());
      onSelectionChange?.([]);
    } else {
      const newSelected = new Set(filteredCases.map((c) => c.testCaseId));
      setSelectedIds(newSelected);
      onSelectionChange?.(Array.from(newSelected));
    }
  };

  const handleSelectRow = (id: string, e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
    onSelectionChange?.(Array.from(newSelected));
  };

  return (
    <div className="panel-column">
      {/* Table Toolbar */}
      <div className="table-toolbar">
        <div className="table-toolbar-group">
          {onCreateCase && (
            <button type="button" onClick={onCreateCase}>
              <span>+ Create test case</span>
            </button>
          )}

          {onCreateSuite && (
            <button type="button" className="btn-outline" onClick={onCreateSuite}>
              <span>+ Add test suite</span>
            </button>
          )}

          {onQuickCreate && (
            <button type="button" className="btn-quiet" onClick={onQuickCreate}>
              <span>⚡ Quick create</span>
            </button>
          )}
        </div>

        <div className="table-toolbar-group">
          {onCreateTestRun && (
            <button type="button" className="btn-info" onClick={onCreateTestRun}>
              <span>🚀 Create test run</span>
            </button>
          )}

          <div className="table-search">
            <input
              type="search"
              placeholder="Filter by keyword"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              aria-label="Filter by keyword"
            />
            <span className="table-search-icon" aria-hidden="true">
              🔍
            </span>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr className="data-table-head-row">
              <th className="is-narrow">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filteredCases.length && filteredCases.length > 0}
                  onChange={handleSelectAll}
                  aria-label="Select all test cases"
                />
              </th>
              <th className="is-sortable" onClick={() => handleSort('id')}>
                ID {sortColumn === 'id' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th className="is-sortable" onClick={() => handleSort('title')}>
                TITLE {sortColumn === 'title' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th className="is-sortable" onClick={() => handleSort('priority')}>
                OWNER / PRIORITY {sortColumn === 'priority' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th>LAST RESULT</th>
              <th className="is-actions">⚙️</th>
            </tr>
          </thead>
          <tbody>
            {renderedGroups.map((group) => {
              const isCollapsed = collapsedGroups.has(group.groupId);
              const groupCases = group.cases;

              return (
                <React.Fragment key={group.groupId}>
                  {/* Group Header Row if more than 1 group or named */}
                  {group.groupName && (
                    <tr className="group-row" onClick={() => toggleGroupCollapse(group.groupId)}>
                      <td colSpan={6} className="group-row-cell">
                        <div className="group-row-content">
                          <span className="group-row-caret">{isCollapsed ? '▶' : '▼'}</span>
                          <span className="group-row-icon">📁</span>
                          <span className="group-row-title">{group.groupName}</span>
                          <span className="group-row-count">| {groupCases.length}</span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Test Case Rows within group */}
                  {!isCollapsed &&
                    groupCases.map((testCase) => {
                      const isSelected = selectedIds.has(testCase.testCaseId);
                      const isActive = selectedCaseId === testCase.testCaseId;
                      const statusVal = (testCase.priority === 'Passed' || testCase.priority === 'Failed' || testCase.priority === 'Blocked' || testCase.priority === 'Retest')
                        ? testCase.priority
                        : 'Untested';
                      const rowClassName = `case-row${isActive ? ' is-active' : isSelected ? ' is-selected' : ''}`;

                      return (
                        <tr
                          key={testCase.testCaseId}
                          className={rowClassName}
                          onClick={() => onRowClick?.(testCase)}
                        >
                          {/* Drag handle & Checkbox */}
                          <td className="data-table-cell is-narrow" onClick={(e) => e.stopPropagation()}>
                            <div className="case-select">
                              <span className="drag-handle" aria-hidden="true">
                                ⋮⋮
                              </span>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => handleSelectRow(testCase.testCaseId, e)}
                                aria-label={`Select ${testCase.title}`}
                              />
                            </div>
                          </td>

                          {/* ID */}
                          <td className="data-table-cell is-id">{testCase.testCaseId}</td>

                          {/* Title */}
                          <td className="data-table-cell">
                            <div className="case-title">
                              <span className="case-title-icon" aria-hidden="true">
                                📄
                              </span>
                              <span className="case-title-text">{testCase.title}</span>
                            </div>
                          </td>

                          {/* Owner / Priority */}
                          <td className="data-table-cell">
                            <span className="case-priority">{testCase.priority || 'Medium'}</span>
                          </td>

                          {/* Last Result Status Pill */}
                          <td className="data-table-cell">
                            <StatusBadge
                              status={statusVal}
                              size="small"
                              interactive={Boolean(onStatusChange)}
                              onStatusChange={(newStatus) => onStatusChange?.(testCase.testCaseId, newStatus)}
                            />
                          </td>

                          {/* Row Actions */}
                          <td className="data-table-cell is-actions">
                            <button
                              type="button"
                              className="row-actions-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRowClick?.(testCase);
                              }}
                              aria-label={`Actions for ${testCase.title}`}
                            >
                              ···
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {filteredCases.length === 0 && (
          <div className="empty-state">
            <p className="empty-state-title">No test cases found.</p>
            <p className="empty-state-hint">
              Create a new test case or adjust your folder selection and search filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
