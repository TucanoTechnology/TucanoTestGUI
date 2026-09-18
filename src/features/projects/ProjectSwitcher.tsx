import { useEffect, useState } from "react";
import type { Project } from "../../api/generated/index.js";
import { apiFetch } from "../../api/client.js";
import { readApiError, type ApiErrorInfo } from "../../api/errors.js";
import { useAuth } from "../../app/AuthProvider.js";
import { useProjectContext } from "../../app/ProjectContext.js";

/**
 * Active-project dropdown for the top bar. Selecting a project replaces the
 * current selection, so the panes below re-scope to it.
 */
export function ProjectSwitcher() {
  const { client } = useAuth();
  const {
    selectedProjectId,
    setSelectedProjectId,
    setSelection,
    projectsVersion,
  } = useProjectContext();
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    apiFetch(() => client.projects.listProjects({}))
      .then(async (ids) => {
        const docs = await Promise.all(
          ids.map((id) => apiFetch(() => client.projects.getProject({ id }))),
        );
        if (!cancelled) setProjects(docs);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(readApiError(err, "Failed to load projects"));
      });
    return () => {
      cancelled = true;
    };
  }, [client, projectsVersion]);

  const handleChange = (value: string) => {
    const id = value === "" ? null : value;
    setSelectedProjectId(id);
    setSelection(id ? { type: "project", id } : null);
  };

  return (
    <div className="topbar__project-switcher">
      <select
        className="project-switcher__select"
        aria-label="Active project"
        value={selectedProjectId ?? ""}
        onChange={(event) => handleChange(event.target.value)}
      >
        <option value="">Select a project…</option>
        {projects.map((project) => (
          <option key={project.projectId} value={project.projectId}>
            {project.name}
          </option>
        ))}
      </select>
      {error && (
        <span className="project-switcher__error" role="alert">
          {error.message}
        </span>
      )}
    </div>
  );
}
