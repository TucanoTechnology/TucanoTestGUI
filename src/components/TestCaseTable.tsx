import { useState } from 'react';
import { TestCase } from '../api/client';

export interface TestCaseTableProps {
  cases: TestCase[];
  onSelectionChange: (selectedIds: string[]) => void;
  onStatusChange?: (id: string, status: string) => void;
  onRowClick?: (testCase: TestCase) => void;
}

type SortColumn = 'id' | 'title' | 'priority' | 'status' | 'modified';
type SortDirection = 'asc' | 'desc';

export default function TestCaseTable({ cases, onSelectionChange, onRowClick }: TestCaseTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<SortColumn>('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'Passed': return '#22c55e';
      case 'Failed': return '#ef4444';
      case 'Blocked': return '#f97316';
      case 'Retest': return '#eab308';
      case 'Untested': return '#9ca3af';
      default: return '#9ca3af';
    }
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedCases = [...cases].sort((a, b) => {
    let aVal = '';
    let bVal = '';
    if (sortColumn === 'id') {
      aVal = a.testCaseId;
      bVal = b.testCaseId;
    } else if (sortColumn === 'title') {
      aVal = a.title;
      bVal = b.title;
    } else if (sortColumn === 'priority') {
      aVal = a.priority || 'Medium';
      bVal = b.priority || 'Medium';
    } else if (sortColumn === 'status') {
      aVal = a.priority || 'Untested';
      bVal = b.priority || 'Untested';
    }
    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const paginatedCases = sortedCases.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(cases.length / pageSize);

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedCases.length) {
      setSelectedIds(new Set());
      onSelectionChange([]);
    } else {
      const newSelected = new Set(paginatedCases.map((c) => c.testCaseId));
      setSelectedIds(newSelected);
      onSelectionChange(Array.from(newSelected));
    }
  };

  const handleSelectRow = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
    onSelectionChange(Array.from(newSelected));
  };

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
            <th style={{ padding: '12px 16px', textAlign: 'left', width: '40px' }}>
              <input
                type="checkbox"
                checked={selectedIds.size === paginatedCases.length && paginatedCases.length > 0}
                onChange={handleSelectAll}
                aria-label="Select all test cases"
              />
            </th>
            <th
              style={{ padding: '12px 16px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => handleSort('id')}
              aria-sort={sortColumn === 'id' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              ID {sortColumn === 'id' && (sortDirection === 'asc' ? '▲' : '▼')}
            </th>
            <th
              style={{ padding: '12px 16px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => handleSort('title')}
              aria-sort={sortColumn === 'title' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              Title {sortColumn === 'title' && (sortDirection === 'asc' ? '▲' : '▼')}
            </th>
            <th
              style={{ padding: '12px 16px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => handleSort('priority')}
              aria-sort={sortColumn === 'priority' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              Priority {sortColumn === 'priority' && (sortDirection === 'asc' ? '▲' : '▼')}
            </th>
            <th
              style={{ padding: '12px 16px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => handleSort('status')}
              aria-sort={sortColumn === 'status' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              Status {sortColumn === 'status' && (sortDirection === 'asc' ? '▲' : '▼')}
            </th>
          </tr>
        </thead>
        <tbody>
          {paginatedCases.map((testCase) => (
            <tr
              key={testCase.testCaseId}
              style={{
                borderBottom: '1px solid #dee2e6',
                background: selectedIds.has(testCase.testCaseId) ? '#e7f5ff' : 'transparent',
                cursor: onRowClick ? 'pointer' : 'default',
              }}
              onClick={() => onRowClick?.(testCase)}
              onMouseEnter={(e) => {
                if (!selectedIds.has(testCase.testCaseId)) {
                  (e.currentTarget as HTMLTableRowElement).style.background = '#f1f3f5';
                }
              }}
              onMouseLeave={(e) => {
                if (!selectedIds.has(testCase.testCaseId)) {
                  (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                }
              }}
            >
              <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(testCase.testCaseId)}
                  onChange={() => handleSelectRow(testCase.testCaseId)}
                  aria-label={`Select ${testCase.title}`}
                />
              </td>
              <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '13px' }}>
                {testCase.testCaseId}
              </td>
              <td style={{ padding: '12px 16px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {testCase.title}
              </td>
              <td style={{ padding: '12px 16px' }}>
                {testCase.priority || 'Medium'}
              </td>
              <td style={{ padding: '12px 16px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: getStatusColor(testCase.priority),
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
                  {testCase.priority || 'Untested'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderTop: '1px solid #dee2e6' }}>
          <div style={{ fontSize: '14px', color: '#6c757d' }}>
            Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, cases.length)} of {cases.length} entries
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '14px' }}>
              Page size:
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{ marginLeft: '8px', padding: '4px 8px' }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              style={{ padding: '6px 12px' }}
            >
              Previous
            </button>
            <span style={{ fontSize: '14px' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              style={{ padding: '6px 12px' }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
