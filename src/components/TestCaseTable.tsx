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

  const handleSelectRow = (id: string, e?: React.MouseEvent) => {
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#ffffff' }}>
      {/* Table Toolbar */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          background: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onCreateCase && (
            <button
              type="button"
              onClick={onCreateCase}
              style={{
                background: '#0f766e',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              }}
            >
              <span>+ Create test case</span>
            </button>
          )}

          {onCreateSuite && (
            <button
              type="button"
              onClick={onCreateSuite}
              style={{
                background: '#f8fafc',
                color: '#0f766e',
                border: '1px solid #0f766e',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>+ Add test suite</span>
            </button>
          )}

          {onQuickCreate && (
            <button
              type="button"
              onClick={onQuickCreate}
              style={{
                background: '#f8fafc',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>⚡ Quick create</span>
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {onCreateTestRun && (
            <button
              type="button"
              onClick={onCreateTestRun}
              style={{
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span>🚀 Create test run</span>
            </button>
          )}

          <div style={{ position: 'relative' }}>
            <input
              type="search"
              placeholder="Filter by keyword"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              aria-label="Filter by keyword"
              style={{
                padding: '6px 10px 6px 28px',
                fontSize: '12.5px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                background: '#f8fafc',
                width: '180px',
                outline: 'none',
              }}
            />
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '12px',
                color: '#94a3b8',
              }}
            >
              🔍
            </span>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
          <thead>
            <tr
              style={{
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                position: 'sticky',
                top: 0,
                zIndex: 10,
              }}
            >
              <th style={{ width: '36px', padding: '10px 8px 10px 14px', textAlign: 'left' }}>
                <input
                  type="checkbox"
                  checked={selectedIds.size === filteredCases.length && filteredCases.length > 0}
                  onChange={handleSelectAll}
                  aria-label="Select all test cases"
                />
              </th>
              <th
                style={{
                  width: '110px',
                  padding: '10px 12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  userSelect: 'none',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
                onClick={() => handleSort('id')}
              >
                ID {sortColumn === 'id' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th
                style={{
                  padding: '10px 12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  userSelect: 'none',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
                onClick={() => handleSort('title')}
              >
                TITLE {sortColumn === 'title' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th
                style={{
                  width: '130px',
                  padding: '10px 12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  userSelect: 'none',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
                onClick={() => handleSort('priority')}
              >
                OWNER / PRIORITY {sortColumn === 'priority' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th
                style={{
                  width: '140px',
                  padding: '10px 12px',
                  textAlign: 'left',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                LAST RESULT
              </th>
              <th style={{ width: '40px', padding: '10px 14px', textAlign: 'center', color: '#94a3b8' }}>
                ⚙️
              </th>
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
                    <tr
                      style={{
                        background: '#f8fafc',
                        borderTop: '1px solid #e2e8f0',
                        borderBottom: '1px solid #e2e8f0',
                        cursor: 'pointer',
                      }}
                      onClick={() => toggleGroupCollapse(group.groupId)}
                    >
                      <td colSpan={6} style={{ padding: '8px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '10px', color: '#64748b' }}>
                            {isCollapsed ? '▶' : '▼'}
                          </span>
                          <span style={{ fontSize: '14px' }}>📁</span>
                          <span style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
                            {group.groupName}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            | {groupCases.length}
                          </span>
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

                      return (
                        <tr
                          key={testCase.testCaseId}
                          onClick={() => onRowClick?.(testCase)}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: isActive
                              ? '#e6f4ea'
                              : isSelected
                              ? '#eff6ff'
                              : 'transparent',
                            cursor: 'pointer',
                            transition: 'background 120ms ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive && !isSelected) {
                              (e.currentTarget as HTMLTableRowElement).style.background = '#f8fafc';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive && !isSelected) {
                              (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                            }
                          }}
                        >
                          {/* Drag handle & Checkbox */}
                          <td style={{ padding: '9px 8px 9px 14px' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                aria-hidden="true"
                                style={{ color: '#cbd5e1', cursor: 'grab', fontSize: '12px' }}
                              >
                                ⋮⋮
                              </span>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => handleSelectRow(testCase.testCaseId, e as any)}
                                aria-label={`Select ${testCase.title}`}
                              />
                            </div>
                          </td>

                          {/* ID */}
                          <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: '12.5px', color: '#475569', fontWeight: 600 }}>
                            {testCase.testCaseId}
                          </td>

                          {/* Title */}
                          <td style={{ padding: '9px 12px', color: '#0f172a' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: '#94a3b8', fontSize: '13px' }}>📄</span>
                              <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {testCase.title}
                              </span>
                            </div>
                          </td>

                          {/* Owner / Priority */}
                          <td style={{ padding: '9px 12px', color: '#475569', fontSize: '12.5px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: '#f1f5f9',
                                color: '#334155',
                                fontWeight: 500,
                              }}
                            >
                              {testCase.priority || 'Medium'}
                            </span>
                          </td>

                          {/* Last Result Status Pill */}
                          <td style={{ padding: '9px 12px' }}>
                            <StatusBadge
                              status={statusVal}
                              size="small"
                              interactive={Boolean(onStatusChange)}
                              onStatusChange={(newStatus) => onStatusChange?.(testCase.testCaseId, newStatus)}
                            />
                          </td>

                          {/* Row Actions */}
                          <td style={{ padding: '9px 14px', textAlign: 'center', color: '#94a3b8' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRowClick?.(testCase);
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#64748b',
                                cursor: 'pointer',
                                fontSize: '14px',
                                padding: '2px 6px',
                                borderRadius: '4px',
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
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
            <p style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 8px 0' }}>No test cases found.</p>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
              Create a new test case or adjust your folder selection and search filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
