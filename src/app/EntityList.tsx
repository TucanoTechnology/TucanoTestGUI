import { useEffect, useState } from "react";
import { apiFetch } from "../api/client.js";
import { useAuth } from "./AuthProvider.js";
import { useProjectContext, type EntityType } from "./ProjectContext.js";

interface EntityItem {
  id: string;
  name: string;
  meta?: string;
}

export function EntityList({ entityType }: { entityType: EntityType }) {
  const { client } = useAuth();
  const { selectedProjectId, selection, setSelection, projectsVersion } =
    useProjectContext();
  const [items, setItems] = useState<EntityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchItems = async (): Promise<EntityItem[]> => {
      switch (entityType) {
        case "project": {
          const ids = await apiFetch(() => client.projects.listProjects({}));
          return Promise.all(
            ids.map(async (id) => {
              const p = await apiFetch(() =>
                client.projects.getProject({ id }),
              );
              return { id: p.projectId, name: p.name, meta: p.description };
            }),
          );
        }
        case "suite": {
          if (!selectedProjectId) return [];
          const ids = await apiFetch(() =>
            client.projects.listProjectTestSuites({ id: selectedProjectId }),
          );
          return Promise.all(
            ids.map(async (id) => {
              const s = await apiFetch(() =>
                client.testSuites.getTestSuite({ id }),
              );
              return { id: s.suiteId, name: s.name, meta: s.description };
            }),
          );
        }
        case "case": {
          if (!selectedProjectId) return [];
          const ids = await apiFetch(() =>
            client.projects.listProjectTestCases({ id: selectedProjectId }),
          );
          return Promise.all(
            ids.map(async (id) => {
              const c = await apiFetch(() =>
                client.testCases.getTestCase({ id }),
              );
              return { id: c.testCaseId, name: c.title, meta: c.priority };
            }),
          );
        }
        case "run": {
          if (!selectedProjectId) return [];
          const ids = await apiFetch(() =>
            client.projects.listProjectTestRuns({ id: selectedProjectId }),
          );
          return Promise.all(
            ids.map(async (id) => {
              const r = await apiFetch(() =>
                client.testRuns.getTestRun({ id }),
              );
              return {
                id: r.testRunId,
                name: r.name ?? r.testRunId,
                meta: r.timestamp,
              };
            }),
          );
        }
        case "milestone": {
          if (!selectedProjectId) return [];
          const ids = await apiFetch(() =>
            client.projects.listProjectMilestones({ id: selectedProjectId }),
          );
          return Promise.all(
            ids.map(async (id) => {
              const m = await apiFetch(() =>
                client.milestones.getMilestone({ id }),
              );
              return { id: m.milestoneId, name: m.name, meta: m.status };
            }),
          );
        }
        case "configuration": {
          if (!selectedProjectId) return [];
          const ids = await apiFetch(() =>
            client.projects.listProjectConfigurations({
              id: selectedProjectId,
            }),
          );
          return Promise.all(
            ids.map(async (id) => {
              const c = await apiFetch(() =>
                client.configurations.getConfiguration({ id }),
              );
              return {
                id: c.configId,
                name: c.name,
                meta: [c.browser, c.os].filter(Boolean).join(", "),
              };
            }),
          );
        }
        default:
          return [];
      }
    };

    fetchItems()
      .then((data) => {
        if (!cancelled) {
          setItems(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message =
            (err as { body?: { error?: { message?: string } } })?.body?.error
              ?.message ?? "Failed to load items";
          setError(message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, entityType, selectedProjectId, projectsVersion]);

  if (entityType !== "project" && !selectedProjectId) {
    return (
      <div className="empty-state">
        <p className="empty-state__message">
          Select a project from the explorer to view {entityType}s
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading" role="status">
        <div className="loading__spinner" />
        <span className="sr-only">Loading {entityType}s…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-display" role="alert">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state__message">No {entityType}s found</p>
      </div>
    );
  }

  return (
    <ul className="entity-list" aria-label={`${entityType} list`}>
      {items.map((item) => {
        const isActive = selection?.id === item.id;
        return (
          <li key={item.id}>
            <button
              className={`entity-list__item ${isActive ? "entity-list__item--active" : ""}`}
              onClick={() =>
                setSelection({
                  type: entityType,
                  id: item.id,
                  projectId: selectedProjectId ?? undefined,
                })
              }
              aria-current={isActive ? "true" : undefined}
            >
              <span className="entity-list__name">{item.name}</span>
              {item.meta && (
                <span className="entity-list__meta">{item.meta}</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
