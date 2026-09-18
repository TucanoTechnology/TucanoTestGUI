import { useEffect, useState } from "react";
import type { Project, TestSuite } from "../../api/generated/index.js";
import { apiFetch } from "../../api/client.js";
import { readApiError, type ApiErrorInfo } from "../../api/errors.js";
import { useAuth } from "../../app/AuthProvider.js";
import { ApiErrorNotice } from "../../app/ApiErrorNotice.js";

/**
 * Selection sentinel for the "Directly in project" node: the cases the project
 * holds itself rather than through a suite.
 */
export const DIRECT_SUITE_ID = "__direct__";

interface SuiteTreeProps {
  projectId: string;
  selectedSuiteId: string | null;
  onSelectSuite: (suiteId: string | null) => void;
}

function countSuiteCases(suite: TestSuite): number {
  return (suite.testCases ?? []).length;
}

function countProjectCases(project: Project): number {
  const direct = (project.testCases ?? []).length;
  return (project.testSuites ?? []).reduce(
    (total, suite) => total + countSuiteCases(suite),
    direct,
  );
}

interface SuiteTreeNodeProps {
  suite: TestSuite;
  expanded: boolean;
  selected: boolean;
  onToggle: (suiteId: string) => void;
  onSelect: (suiteId: string) => void;
}

function SuiteTreeNode({
  suite,
  expanded,
  selected,
  onToggle,
  onSelect,
}: SuiteTreeNodeProps) {
  const cases = suite.testCases ?? [];
  const hasCases = cases.length > 0;

  return (
    <li role="treeitem" aria-expanded={hasCases ? expanded : undefined}>
      <button
        type="button"
        className={`suite-tree__node ${selected ? "suite-tree__node--active" : ""}`}
        onClick={() => {
          if (hasCases) {
            onToggle(suite.suiteId);
          }
          onSelect(suite.suiteId);
        }}
      >
        <span className="suite-tree__icon" aria-hidden="true">
          {hasCases ? (expanded ? "▾" : "▸") : "📁"}
        </span>
        <span className="suite-tree__label">{suite.name}</span>
        <span className="suite-tree__count">{cases.length}</span>
      </button>

      {hasCases && expanded && (
        <ul role="group">
          {cases.map((testCase) => (
            <li key={testCase.testCaseId} role="treeitem">
              <span className="suite-tree__node suite-tree__node--leaf">
                <span className="suite-tree__icon" aria-hidden="true">
                  📄
                </span>
                <span className="suite-tree__label">{testCase.title}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * The active project's suites as a tree, with the two virtual nodes the case
 * list filters on ("All test cases" and "Directly in project") pinned to the
 * top. The suite document has no parent field, so the tree is one level deep:
 * expanding a suite reveals the cases it holds.
 */
export function SuiteTree({
  projectId,
  selectedSuiteId,
  onSelectSuite,
}: SuiteTreeProps) {
  const { client } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [filter, setFilter] = useState("");
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch(() => client.projects.getProject({ id: projectId }))
      .then((data) => {
        if (!cancelled) {
          setProject(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(readApiError(err, "Failed to load suites"));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client, projectId]);

  // A filter and the rows it was set against belong to the project they were
  // chosen on, not to the next one the switcher lands on.
  useEffect(() => {
    setFilter("");
    setExpandedSuites(new Set());
  }, [projectId]);

  const toggleSuite = (suiteId: string) => {
    setExpandedSuites((prev) => {
      const next = new Set(prev);
      if (next.has(suiteId)) {
        next.delete(suiteId);
      } else {
        next.add(suiteId);
      }
      return next;
    });
  };

  const directCaseCount = (project?.testCases ?? []).length;
  const totalCaseCount = project ? countProjectCases(project) : 0;
  const needle = filter.trim().toLowerCase();
  const filteredSuites = (project?.testSuites ?? []).filter((suite) =>
    needle === "" ? true : suite.name.toLowerCase().includes(needle),
  );

  return (
    <div className="suite-tree">
      <div className="suite-tree__header">
        <h2 className="suite-tree__title">Suites</h2>
        <button
          type="button"
          className="btn btn-icon"
          title="New suite"
          aria-label="New suite"
          disabled
        >
          +
        </button>
      </div>

      <div className="suite-tree__search">
        <input
          type="search"
          className="suite-tree__search-input"
          placeholder="Filter suites…"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          aria-label="Filter suites"
        />
      </div>

      {loading ? (
        <div className="loading" role="status">
          <span className="sr-only">Loading suites…</span>
        </div>
      ) : error ? (
        <ApiErrorNotice error={error} />
      ) : (
        <ul className="suite-tree__list" role="tree">
          <li role="treeitem">
            <button
              type="button"
              className={`suite-tree__node suite-tree__node--pinned ${
                selectedSuiteId === null ? "suite-tree__node--active" : ""
              }`}
              onClick={() => onSelectSuite(null)}
            >
              <span className="suite-tree__icon" aria-hidden="true">
                📁
              </span>
              <span className="suite-tree__label">All test cases</span>
              <span className="suite-tree__count">{totalCaseCount}</span>
            </button>
          </li>

          <li role="treeitem">
            <button
              type="button"
              className={`suite-tree__node suite-tree__node--pinned ${
                selectedSuiteId === DIRECT_SUITE_ID
                  ? "suite-tree__node--active"
                  : ""
              }`}
              onClick={() => onSelectSuite(DIRECT_SUITE_ID)}
            >
              <span className="suite-tree__icon" aria-hidden="true">
                📄
              </span>
              <span className="suite-tree__label">Directly in project</span>
              <span className="suite-tree__count">{directCaseCount}</span>
            </button>
          </li>

          {filteredSuites.map((suite) => (
            <SuiteTreeNode
              key={suite.suiteId}
              suite={suite}
              expanded={expandedSuites.has(suite.suiteId)}
              selected={selectedSuiteId === suite.suiteId}
              onToggle={toggleSuite}
              onSelect={onSelectSuite}
            />
          ))}

          {filteredSuites.length === 0 && (
            <li className="suite-tree__empty" role="treeitem">
              {needle === ""
                ? "No suites in this project"
                : `No suites match “${filter.trim()}”`}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
