import React, { useId, useState, useMemo } from 'react';
import {
  TestCase,
  TestRun,
  TestResultStatus,
  TEST_RESULT_STATUSES,
  resultStatus,
} from '../api/client';
import StatusBadge, { STATUS_CONFIG } from './StatusBadge';

export interface TestCaseGroup {
  groupId: string;
  groupName: string;
  cases: TestCase[];
}

export interface TestCaseTableProps {
  cases: TestCase[];
  groups?: TestCaseGroup[];
  selectedCaseId?: string | null;
  /** Checked rows. Pass this to let the owner drive the selection (bulk actions). */
  selectedIds?: readonly string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  /**
   * Runs the LAST RESULT column reads from. Every run the shell has loaded is
   * offered so the reader can pick which execution to display; omit the prop
   * to hide the control entirely.
   */
  runs?: readonly TestRun[];
  activeRunId?: string | null;
  onRunChange?: (testRunId: string) => void;
  /** Records a result against the active run — statuses are never stored on the case. */
  onRecordResult?: (testCaseId: string, status: TestResultStatus) => void;
  onRowClick?: (testCase: TestCase) => void;
  onEditCase?: (testCase: TestCase) => void;
  onDeleteCase?: (testCase: TestCase) => void;
  /** Rendered directly under the toolbar, above the table. */
  bulkActions?: React.ReactNode;
  onCreateCase?: () => void;
  onQuickCreate?: () => void;
  onCreateSuite?: () => void;
  onCreateTestRun?: () => void;
}

type SortColumn = 'id' | 'title' | 'priority';
type SortDirection = 'asc' | 'desc';

/** Columns in the table, so the group row can span them all. */
const COLUMN_COUNT = 7;

export default function TestCaseTable({
  cases,
  groups,
  selectedCaseId,
  selectedIds,
  onSelectionChange,
  runs,
  activeRunId,
  onRunChange,
  onRecordResult,
  onRowClick,
  onEditCase,
  onDeleteCase,
  bulkActions,
  onCreateCase,
  onQuickCreate,
  onCreateSuite,
  onCreateTestRun,
}: TestCaseTableProps) {
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<SortColumn>('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const runSelectId = useId();

  const selectedSet = useMemo(
    () => (selectedIds ? new Set(selectedIds) : internalSelectedIds),
    [selectedIds, internalSelectedIds]
  );

  const activeRun = useMemo(
    () => runs?.find((run) => run.testRunId === activeRunId) ?? null,
    [runs, activeRunId]
  );

  const applySelection = (next: Set<string>) => {
    if (selectedIds === undefined) {
      setInternalSelectedIds(next);
    }
    onSelectionChange?.(Array.from(next));
  };

  // Filter cases by keyword search
  const filteredCases = useMemo(() => {
    if (!searchKeyword.trim()) return cases;
    const q = searchKeyword.toLowerCase();
    return cases.filter(
      (c) =>
        c.testCaseId.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        (c.priority && c.priority.toLowerCase().includes(q)) ||
        (c.severity && c.severity.toLowerCase().includes(q))
    );
  }, [cases, searchKeyword]);

  const allSelected =
    filteredCases.length > 0 && filteredCases.every((c) => selectedSet.has(c.testCaseId));

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
              (c.priority && c.priority.toLowerCase().includes(q)) ||
              (c.severity && c.severity.toLowerCase().includes(q))
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
    if (allSelected) {
      applySelection(new Set());
    } else {
      applySelection(new Set(filteredCases.map((c) => c.testCaseId)));
    }
  };

  const handleSelectRow = (id: string, e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    const newSelected = new Set(selectedSet);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    applySelection(newSelected);
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
          {runs !== undefined &&
            (runs.length === 0 ? (
              <span className="table-run-hint">No test runs yet — create one to record results.</span>
            ) : (
              <div className="table-run-select">
                <label htmlFor={runSelectId}>Results run</label>
                <select
                  id={runSelectId}
                  value={activeRunId ?? ''}
                  onChange={(event) => onRunChange?.(event.target.value)}
                >
                  {runs.map((run) => (
                    <option key={run.testRunId} value={run.testRunId}>
                      {run.testRunId}
                    </option>
                  ))}
                </select>
              </div>
            ))}

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

      {bulkActions}

      {/* Table Content */}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr className="data-table-head-row">
              <th className="is-narrow">
                <input
                  type="checkbox"
                  checked={allSelected}
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
                PRIORITY {sortColumn === 'priority' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th>SEVERITY</th>
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
                      <td colSpan={COLUMN_COUNT} className="group-row-cell">
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
                      const isSelected = selectedSet.has(testCase.testCaseId);
                      const isActive = selectedCaseId === testCase.testCaseId;
                      const rowClassName = `case-row${isActive ? ' is-active' : isSelected ? ' is-selected' : ''}`;
                      const recorded = resultStatus(activeRun, testCase.testCaseId);

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

                          {/* Priority */}
                          <td className="data-table-cell">
                            <span className="case-priority">{testCase.priority || 'Medium'}</span>
                          </td>

                          {/* Severity */}
                          <td className="data-table-cell">
                            <span className="case-severity">{testCase.severity || 'Major'}</span>
                          </td>

                          {/* Last result, read from the active run */}
                          <td className="data-table-cell" onClick={(e) => e.stopPropagation()}>
                            <div className="case-result">
                              {recorded ? (
                                <StatusBadge status={recorded} size="small" />
                              ) : (
                                <span className="case-result-empty">
                                  {activeRun ? 'No result yet' : 'No run selected'}
                                </span>
                              )}
                              <select
                                className="case-result-select"
                                value=""
                                aria-label={`Record result for ${testCase.title}`}
                                disabled={!activeRun || !onRecordResult}
                                title={activeRun ? undefined : 'Select a run first'}
                                onChange={(event) => {
                                  const next = event.target.value as TestResultStatus;
                                  if (next) onRecordResult?.(testCase.testCaseId, next);
                                }}
                              >
                                <option value="">Record…</option>
                                {TEST_RESULT_STATUSES.map((status) => (
                                  <option key={status} value={status}>
                                    {STATUS_CONFIG[status].label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>

                          {/* Row Actions */}
                          <td className="data-table-cell is-actions">
                            <div style={{ display: 'flex', gap: '2px', justifyContent: 'flex-end' }}>
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

                              {onEditCase && (
                                <button
                                  type="button"
                                  className="row-actions-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditCase(testCase);
                                  }}
                                  aria-label={`Edit ${testCase.testCaseId}`}
                                >
                                  ✎
                                </button>
                              )}

                              {onDeleteCase && (
                                <button
                                  type="button"
                                  className="row-actions-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteCase(testCase);
                                  }}
                                  aria-label={`Delete ${testCase.testCaseId}`}
                                >
                                  🗑
                                </button>
                              )}
                            </div>
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
