import { useState } from 'react';
import { Project } from '../api/client';

export interface TreeNode {
  id: string;
  name: string;
  type: 'project' | 'suite' | 'case';
  children?: TreeNode[];
  count?: number;
}

export interface FolderHierarchyTreeProps {
  projects: Project[];
  onNodeSelect: (nodeId: string, type: 'project' | 'suite' | 'case') => void;
  selectedNodeId?: string;
}

function buildTreeNodes(projects: Project[]): TreeNode[] {
  return projects.map((project) => ({
    id: project.projectId,
    name: project.name,
    type: 'project' as const,
    count: project.testSuites?.length || 0,
    children: (project.testSuites || []).map((suite) => ({
      id: suite.suiteId,
      name: suite.name,
      type: 'suite' as const,
      count: suite.testCases?.length || 0,
      children: (suite.testCases || []).map((testCase) => ({
        id: testCase.testCaseId,
        name: testCase.title,
        type: 'case' as const,
      })),
    })),
  }));
}

interface TreeNodeItemProps {
  node: TreeNode;
  level: number;
  onToggle: (id: string) => void;
  onSelect: (id: string, type: 'project' | 'suite' | 'case') => void;
  expandedNodes: Set<string>;
  selectedNodeId?: string;
}

function TreeNodeItem({ node, level, onToggle, onSelect, expandedNodes, selectedNodeId }: TreeNodeItemProps) {
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const hasChildren = node.children && node.children.length > 0;

  const getIcon = () => {
    if (node.type === 'project') {
      return isExpanded ? '📂' : '';
    }
    if (node.type === 'suite') {
      return isExpanded ? '📂' : '📁';
    }
    return '📄';
  };

  return (
    <div>
      <div
        className={`tree-node ${isSelected ? 'selected' : ''}`}
        style={{
          paddingLeft: `${level * 24 + 8}px`,
          paddingRight: '8px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          background: isSelected ? '#e7f5ff' : 'transparent',
          borderLeft: isSelected ? '3px solid #0066cc' : '3px solid transparent',
          transition: 'background 150ms ease',
        }}
        onClick={() => {
          onSelect(node.id, node.type);
          if (hasChildren) {
            onToggle(node.id);
          }
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            (e.currentTarget as HTMLDivElement).style.background = '#f1f3f5';
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
        {hasChildren && (
          <span style={{ marginRight: '4px', fontSize: '12px', color: '#6c757d' }}>
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
        <span style={{ marginRight: '8px' }}>{getIcon()}</span>
        <span style={{ flex: 1, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>
        {node.count !== undefined && (
          <span style={{ fontSize: '12px', color: '#6c757d', marginLeft: '8px' }}>
            ({node.count})
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

export default function FolderHierarchyTree({ projects, onNodeSelect, selectedNodeId }: FolderHierarchyTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const treeNodes = buildTreeNodes(projects);

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

  const handleSelect = (id: string, type: 'project' | 'suite' | 'case') => {
    onNodeSelect(id, type);
  };

  if (projects.length === 0) {
    return (
      <div style={{ padding: '16px', color: '#6c757d', fontSize: '14px' }}>
        No projects found. Create a project to get started.
      </div>
    );
  }

  return (
    <div role="tree" aria-label="Test case hierarchy" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
      {treeNodes.map((node) => (
        <TreeNodeItem
          key={node.id}
          node={node}
          level={0}
          onToggle={handleToggle}
          onSelect={handleSelect}
          expandedNodes={expandedNodes}
          selectedNodeId={selectedNodeId}
        />
      ))}
    </div>
  );
}
