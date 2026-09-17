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

  const activate = () => {
    onSelect(node.id, node.type);
    if (hasChildren) {
      onToggle(node.id);
    }
  };

  return (
    <div>
      <div
        className={`tree-node ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={activate}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={isSelected}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            activate();
          }
        }}
      >
        <span
          className="tree-node-expander"
          onClick={(e) => {
            if (hasChildren) {
              e.stopPropagation();
              onToggle(node.id);
            }
          }}
        >
          {hasChildren ? (isExpanded ? '▼' : '▶') : ''}
        </span>
        <span className="tree-node-icon">{getIcon()}</span>
        <span className="tree-node-label" title={node.name}>
          {node.name}
        </span>
        {node.count !== undefined && <span className="tree-node-count">| {node.count}</span>}
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

  const isAllSelected = !selectedNodeId || selectedNodeId === 'all';

  return (
    <div className="panel-column is-divided">
      {/* Pane 1 Header */}
      <div className="panel-header">
        <h2>Test case folders</h2>
        <div className="menu-anchor">
          <button
            type="button"
            className="menu-button"
            onClick={() => setShowNewMenu(!showNewMenu)}
            aria-expanded={showNewMenu}
            aria-haspopup="true"
          >
            <span>+ New</span>
            <span className="menu-caret">▼</span>
          </button>

          {showNewMenu && (
            <div role="menu" className="menu-list">
              <button
                type="button"
                role="menuitem"
                className="menu-item"
                onClick={() => {
                  onCreateNew?.('suite');
                  setShowNewMenu(false);
                }}
              >
                📁 New Folder / Suite
              </button>
              <button
                type="button"
                role="menuitem"
                className="menu-item"
                onClick={() => {
                  onCreateNew?.('case');
                  setShowNewMenu(false);
                }}
              >
                📄 New Test Case
              </button>
              <button
                type="button"
                role="menuitem"
                className="menu-item"
                onClick={() => {
                  onCreateNew?.('project');
                  setShowNewMenu(false);
                }}
              >
                🏢 New Project
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search Input for Folders */}
      <div className="panel-search">
        <input
          type="search"
          placeholder="Filter folders..."
          value={folderFilter}
          onChange={(e) => setFolderFilter(e.target.value)}
          aria-label="Filter folders"
        />
      </div>

      {/* Folder Tree Scrollable List */}
      <div className="tree-scroll" role="tree" aria-label="Test case folder hierarchy">
        {/* "All test cases" root node */}
        <div
          className={`tree-node ${isAllSelected ? 'selected' : ''}`}
          style={{ paddingLeft: '10px' }}
          onClick={() => onNodeSelect('all', 'all')}
          role="treeitem"
          aria-selected={isAllSelected}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNodeSelect('all', 'all');
            }
          }}
        >
          <span className="tree-node-icon">🗂️</span>
          <span className="tree-node-label">All test cases</span>
          <span className="tree-node-count">| {totalCount}</span>
        </div>

        {/* Root unassigned item */}
        <div
          className="tree-node tree-node-muted"
          style={{ paddingLeft: '10px' }}
          onClick={() => onNodeSelect('unassigned', 'all')}
          role="treeitem"
          aria-selected={selectedNodeId === 'unassigned'}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNodeSelect('unassigned', 'all');
            }
          }}
        >
          <span className="tree-node-icon">📁</span>
          <span className="tree-node-label">Test cases in no folder</span>
          <span className="tree-node-count is-plain">| 0</span>
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

        {filteredNodes.length === 0 && <div className="tree-empty">No matching folders.</div>}
      </div>
    </div>
  );
}
