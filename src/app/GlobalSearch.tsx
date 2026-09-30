import { useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "../api/generated/index.js";
import { apiFetch } from "../api/client.js";
import { useAuth } from "./AuthProvider.js";
import { useProjectContext } from "./ProjectContext.js";

interface SearchHit {
  key: string;
  type: "project" | "suite" | "case" | "run" | "milestone" | "configuration";
  name: string;
  id: string;
  projectId: string;
}

interface GlobalSearchProps {
  onPick: (hit: SearchHit) => void;
}

/**
 * One input for the whole hierarchy. Project documents carry the suites and
 * cases — the names worth matching on — and the per-project id listings carry
 * runs, milestones and configurations, whose stored keys hold their readable
 * names. One read per project, cached until projects change, so a keystroke
 * after the first costs no requests.
 */
export function GlobalSearch({ onPick }: GlobalSearchProps) {
  const { client } = useAuth();
  const { projectsVersion } = useProjectContext();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<SearchHit[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) return;
    let cancelled = false;

    const build = async () => {
      const projectIds = await apiFetch(() => client.projects.listProjects({}));
      const hits: SearchHit[] = [];
      for (const projectId of projectIds) {
        const project: Project = await apiFetch(() =>
          client.projects.getProject({ id: projectId }),
        );
        hits.push({
          key: `project:${projectId}`,
          type: "project",
          name: project.name ?? projectId,
          id: projectId,
          projectId,
        });
        for (const suite of project.testSuites ?? []) {
          hits.push({
            key: `suite:${projectId}:${suite.suiteId}`,
            type: "suite",
            name: suite.name,
            id: suite.suiteId,
            projectId,
          });
          for (const testCase of suite.testCases ?? []) {
            hits.push({
              key: `case:${projectId}:${suite.suiteId}:${testCase.testCaseId}`,
              type: "case",
              name: testCase.title,
              id: testCase.testCaseId,
              projectId,
            });
          }
        }
        for (const testCase of project.testCases ?? []) {
          hits.push({
            key: `case:${projectId}:\u0000:${testCase.testCaseId}`,
            type: "case",
            name: testCase.title,
            id: testCase.testCaseId,
            projectId,
          });
        }
        const groups = [
          {
            type: "run" as const,
            list: () =>
              apiFetch(() =>
                client.projects.listProjectTestRuns({ id: projectId }),
              ),
          },
          {
            type: "milestone" as const,
            list: () =>
              apiFetch(() =>
                client.projects.listProjectMilestones({ id: projectId }),
              ),
          },
          {
            type: "configuration" as const,
            list: () =>
              apiFetch(() =>
                client.projects.listProjectConfigurations({ id: projectId }),
              ),
          },
        ];
        for (const group of groups) {
          for (const id of await group.list()) {
            hits.push({
              key: `${group.type}:${projectId}:${id}`,
              type: group.type,
              name: id,
              id,
              projectId,
            });
          }
        }
      }
      return hits;
    };

    if (index === null) {
      setStatus("loading");
      build()
        .then((hits) => {
          if (cancelled) return;
          setIndex(hits);
          setStatus("ready");
        })
        .catch(() => {
          if (!cancelled) setStatus("error");
        });
    }

    return () => {
      cancelled = true;
    };
  }, [client, index, projectsVersion, query]);

  // A projects change invalidates the cached index; the next query rebuilds it.
  useEffect(() => {
    setIndex(null);
    setStatus("idle");
  }, [projectsVersion]);

  useEffect(() => {
    const dismiss = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) {
        setQuery("");
      }
    };
    document.addEventListener("mousedown", dismiss);
    return () => document.removeEventListener("mousedown", dismiss);
  }, []);

  const needle = query.trim().toLowerCase();
  const hits = useMemo(() => {
    if (needle.length < 2 || !index) return [];
    return index
      .filter(
        (hit) =>
          hit.name.toLowerCase().includes(needle) ||
          hit.id.toLowerCase().includes(needle),
      )
      .slice(0, 20);
  }, [index, needle]);

  return (
    <div className="global-search" ref={boxRef}>
      <input
        type="search"
        className="global-search__input"
        placeholder="Search everything…"
        aria-label="Global search"
        role="searchbox"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setQuery("");
        }}
      />
      {needle.length >= 2 && (
        <div className="global-search__results">
          {status === "loading" && (
            <p className="global-search__note" role="status">
              Searching…
            </p>
          )}
          {status === "error" && (
            <p className="global-search__note" role="status">
              Search failed. Try again.
            </p>
          )}
          {status === "ready" && hits.length === 0 && (
            <p className="global-search__note" role="status">
              No matches for “{query}”
            </p>
          )}
          {hits.length > 0 && (
            <ul className="global-search__list" aria-label="Search results">
              {hits.map((hit) => (
                <li key={hit.key}>
                  <button
                    type="button"
                    className="global-search__hit"
                    aria-label={`${hit.type} ${hit.name} (${hit.id})`}
                    onClick={() => {
                      setQuery("");
                      onPick(hit);
                    }}
                  >
                    <span className="global-search__type">{hit.type}</span>
                    <span className="global-search__name">{hit.name}</span>
                    <span className="global-search__id">{hit.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
