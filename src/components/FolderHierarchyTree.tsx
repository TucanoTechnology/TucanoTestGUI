import { useState, useMemo } from 'react';
import { Project, TestSuite, TestCase } from '../api/client';

export interface TreeNode {
  id: string;
  name: string;
  type: 'all' | 'project' | 'suite' | 'case';
  children?: TreeNode[];
  count?: number;
}

export interface FolderHierarchyTreeProps {
  projects: Project[];
  standaloneSuites?: TestSuite[];
  standaloneCases?: TestCase[];
  onNodeSelect: (nodeId: string, type: 'all' | 'project' | 'suite' | 'case') => void;
  selectedNodeId?: string;
  onCreateNew?: (type: 'suite' | 'case' | 'project') => void;
}

interface TreeNodeItemProps {
  node: TreeNode;
  level: number;
  onToggle: (id: string) => void;
  onSelect: (id: string, type: 'all' | 'project' | 'suite' | 'case') => void;
  expandedNodes: Set<string>;
  selectedNodeId?: string;
}

function TreeNodeItem({ node, level, onToggle, onSelect, expandedNodes, selectedNodeId }: TreeNodeItemProps) {
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const hasChildren = Boolean(node.children && node.children.length > 0);

  const getIcon = () => {
    if (node.type === 'all') return '🗂️';
    if (node.type === 'project') return isExpanded ? '📂' : '📁';
    if (node.type === 'suite') return isExpanded ? '📂' : '📁';
    return '📄';
  };

  return (
    <div>
      <div
        className={`tree-node ${isSelected ? 'selected' : ''}`}
        style={{
          paddingLeft: `${level * 16 + 8}px`,
          paddingRight: '12px',
          height: '34px',
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          background: isSelected ? 'rgba(15, 118, 110, 0.12)' : 'transparent',
          borderLeft: isSelected ? '3px solid #0f766e' : '3px solid transparent',
          color: isSelected ? '#0f766e' : '#1e293b',
          fontWeight: isSelected ? 600 : 400,
          borderRadius: '4px',
          margin: '1px 4px',
          transition: 'background 120ms ease, color 120ms ease',
        }}
        onClick={() => {
          onSelect(node.id, node.type);
          if (hasChildren) {
            onToggle(node.id);
          }
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            (e.currentTarget as HTMLDivElement).style.background = '#f1f5f9';
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            (e.currentTarget as HTMLDivElement).style.background = 'transparent';
          }
        }}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={isSelected}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(node.id, node.type);
            if (hasChildren) {
              onToggle(node.id);
            }
          }
        }}
      >
        <span
          style={{
            width: '18px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            color: '#64748b',
            cursor: hasChildren ? 'pointer' : 'default',
          }}
          onClick={(e) => {
            if (hasChildren) {
              e.stopPropagation();
              onToggle(node.id);
            }
          }}
        >
          {hasChildren ? (isExpanded ? '▼' : '▶') : ''}
        </span>
        <span style={{ marginRight: '8px', fontSize: '15px' }}>{getIcon()}</span>
        <span
          style={{
            flex: 1,
            fontSize: '13.5px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={node.name}
        >
          {node.name}
        </span>
        {node.count !== undefined && (
          <span
            style={{
              fontSize: '11px',
              color: isSelected ? '#0f766e' : '#64748b',
              fontWeight: 500,
              marginLeft: '6px',
              padding: '1px 6px',
              borderRadius: '999px',
              background: isSelected ? 'rgba(15, 118, 110, 0.15)' : '#f1f5f9',
            }}
          >
            | {node.count}
          </span>
        )}
      </div>
      {isExpanded && hasChildren && (
        <div role="group">
          {node.children!.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              level={level + 1}
              onToggle={onToggle}
              onSelect={onSelect}
              expandedNodes={expandedNodes}
              selectedNodeId={selectedNodeId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FolderHierarchyTree({
  projects,
  standaloneSuites = [],
  standaloneCases = [],
  onNodeSelect,
  selectedNodeId,
  onCreateNew,
}: FolderHierarchyTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [folderFilter, setFolderFilter] = useState('');
  const [showNewMenu, setShowNewMenu] = useState(false);

  // Calculate total cases count
  const totalCount = useMemo(() => {
    const caseIds = new Set<string>();
    projects.forEach((p) => {
      p.testSuites?.forEach((s) => {
        s.testCases?.forEach((c) => caseIds.add(c.testCaseId));
      });
    });
    standaloneSuites.forEach((s) => s.testCases?.forEach((c) => caseIds.add(c.testCaseId)));
    standaloneCases.forEach((c) => caseIds.add(c.testCaseId));
    return caseIds.size;
  }, [projects, standaloneSuites, standaloneCases]);

  const treeNodes: TreeNode[] = useMemo(() => {
    // Collect suites from projects
    const nodes: TreeNode[] = [];

    // Combine projects and standalone suites
    projects.forEach((project) => {
      const suiteNodes: TreeNode[] = (project.testSuites || []).map((suite) => ({
        id: suite.suiteId,
        name: (suite.name || suite.suiteId || '').replace(/\.json$/, ''),
        type: 'suite' as const,
        count: suite.testCases?.length || 0,
        children: (suite.testCases || []).map((tc) => ({
          id: tc.testCaseId,
          name: tc.title || tc.testCaseId || '',
          type: 'case' as const,
        })),
      }));

      nodes.push({
        id: project.projectId,
        name: (project.name || project.projectId || '').replace(/\.json$/, ''),
        type: 'project' as const,
        count: suiteNodes.reduce((acc, s) => acc + (s.count || 0), 0),
        children: suiteNodes,
      });
    });

    // If there are standalone suites not under a project
    const projectSuiteIds = new Set(
      projects.flatMap((p) => (p.testSuites || []).map((s) => s.suiteId))
    );
    standaloneSuites.forEach((suite) => {
      if (!projectSuiteIds.has(suite.suiteId)) {
        nodes.push({
          id: suite.suiteId,
          name: (suite.name || suite.suiteId || '').replace(/\.json$/, ''),
          type: 'suite' as const,
          count: suite.testCases?.length || 0,
        });
      }
    });

    return nodes;
  }, [projects, standaloneSuites]);

  // Filter tree nodes if search is typed
  const filteredNodes = useMemo(() => {
    if (!folderFilter.trim()) return treeNodes;
    const needle = folderFilter.toLowerCase();
    return treeNodes.filter((node) => {
      const matchSelf = node.name.toLowerCase().includes(needle);
      const matchChild = node.children?.some((c) => c.name.toLowerCase().includes(needle));
      return matchSelf || matchChild;
    });
  }, [treeNodes, folderFilter]);

  const handleToggle = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#ffffff',
        borderRight: '1px solid #e2e8f0',
      }}
    >
      {/* Pane 1 Header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
          Test case folders
        </h2>
        <div style={{ position: 'relative', display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setShowNewMenu(!showNewMenu)}
            aria-expanded={showNewMenu}
            aria-haspopup="true"
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              fontWeight: 600,
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              color: '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>+ New</span>
            <span style={{ fontSize: '9px' }}>▼</span>
          </button>

          {showNewMenu && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                padding: '4px',
                zIndex: 50,
                minWidth: '150px',
              }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onCreateNew?.('suite');
                  setShowNewMenu(false);
                }}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  color: '#1e293b',
                }}
              >
                📁 New Folder / Suite
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onCreateNew?.('case');
                  setShowNewMenu(false);
                }}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  color: '#1e293b',
                }}
              >
                📄 New Test Case
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onCreateNew?.('project');
                  setShowNewMenu(false);
                }}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  color: '#1e293b',
                }}
              >
                🏢 New Project
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search Input for Folders */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }}>
        <input
          type="search"
          placeholder="Filter folders..."
          value={folderFilter}
          onChange={(e) => setFolderFilter(e.target.value)}
          aria-label="Filter folders"
          style={{
            width: '100%',
            padding: '6px 10px',
            fontSize: '12.5px',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            background: '#f8fafc',
            color: '#0f172a',
            outline: 'none',
          }}
        />
      </div>

      {/* Folder Tree Scrollable List */}
      <div
        role="tree"
        aria-label="Test case folder hierarchy"
        style={{ flex: 1, overflowY: 'auto', padding: '6px 4px' }}
      >
        {/* "All test cases" root node */}
        <div
          className={`tree-node ${!selectedNodeId || selectedNodeId === 'all' ? 'selected' : ''}`}
          style={{
            paddingLeft: '10px',
            paddingRight: '12px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            background: !selectedNodeId || selectedNodeId === 'all' ? 'rgba(15, 118, 110, 0.12)' : 'transparent',
            borderLeft: !selectedNodeId || selectedNodeId === 'all' ? '3px solid #0f766e' : '3px solid transparent',
            color: !selectedNodeId || selectedNodeId === 'all' ? '#0f766e' : '#1e293b',
            fontWeight: !selectedNodeId || selectedNodeId === 'all' ? 700 : 500,
            borderRadius: '4px',
            margin: '1px 4px 4px 4px',
          }}
          onClick={() => onNodeSelect('all', 'all')}
          role="treeitem"
          aria-selected={!selectedNodeId || selectedNodeId === 'all'}
          tabIndex={0}
        >
          <span style={{ marginRight: '8px', fontSize: '15px' }}>🗂️</span>
          <span style={{ flex: 1, fontSize: '13.5px' }}>All test cases</span>
          <span
            style={{
              fontSize: '11px',
              color: !selectedNodeId || selectedNodeId === 'all' ? '#0f766e' : '#64748b',
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: '999px',
              background: !selectedNodeId || selectedNodeId === 'all' ? 'rgba(15, 118, 110, 0.15)' : '#f1f5f9',
            }}
          >
            | {totalCount}
          </span>
        </div>

        {/* Root unassigned item */}
        <div
          className="tree-node"
          style={{
            paddingLeft: '10px',
            paddingRight: '12px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            color: '#64748b',
            fontSize: '13px',
            borderRadius: '4px',
            margin: '1px 4px 8px 4px',
          }}
          onClick={() => onNodeSelect('unassigned', 'all')}
          role="treeitem"
          tabIndex={0}
        >
          <span style={{ marginRight: '8px', fontSize: '14px', opacity: 0.7 }}>📁</span>
          <span style={{ flex: 1 }}>Test cases in no folder</span>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>| 0</span>
        </div>

        {/* Render Folder Nodes */}
        {filteredNodes.map((node) => (
          <TreeNodeItem
            key={node.id}
            node={node}
            level={0}
            onToggle={handleToggle}
            onSelect={onNodeSelect}
            expandedNodes={expandedNodes}
            selectedNodeId={selectedNodeId}
          />
        ))}

        {filteredNodes.length === 0 && (
          <div style={{ padding: '16px', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>
            No matching folders.
          </div>
        )}
      </div>
    </div>
  );
}
