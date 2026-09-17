import { useEffect, useState } from "react";
import type { Project } from "../../api/generated/index.js";
import { apiFetch } from "../../api/client.js";
import { useAuth } from "../../app/AuthProvider.js";
import { useProjectContext } from "../../app/ProjectContext.js";

export function ProjectDetail({ projectId }: { projectId: string }) {
  const { client } = useAuth();
  const { setSelection } = useProjectContext();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch(() => client.projects.getProject({ id: projectId }))
      .then((data) => {
        setProject(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        const message =
          (err as { body?: { error?: { message?: string } } })?.body?.error
            ?.message ?? "Failed to load project";
        setError(message);
        setLoading(false);
      });
  }, [client, projectId]);

  if (loading) {
    return (
      <div className="loading" role="status">
        <div className="loading__spinner" />
        <span className="sr-only">Loading project…</span>
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

  if (!project) return null;

  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <h2 className="detail-panel__title">{project.name}</h2>
        <p className="detail-panel__subtitle">
          Project ID: {project.projectId}
        </p>
      </div>

      {project.description && (
        <div className="detail-field">
          <div className="detail-field__label">Description</div>
          <div className="detail-field__value">{project.description}</div>
        </div>
      )}

      {project.tags && project.tags.length > 0 && (
        <div className="detail-field">
          <div className="detail-field__label">Tags</div>
          <div className="tag-list">
            {project.tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {project.testSuites && project.testSuites.length > 0 && (
        <div className="detail-field">
          <div className="detail-field__label">
            Test Suites ({project.testSuites.length})
          </div>
          <ul className="entity-list">
            {project.testSuites.map((suite) => (
              <li key={suite.suiteId}>
                <button
                  className="entity-list__item"
                  onClick={() =>
                    setSelection({
                      type: "suite",
                      id: suite.suiteId,
                      projectId,
                    })
                  }
                >
                  <span className="entity-list__name">{suite.name}</span>
                  {suite.testCases && (
                    <span className="entity-list__meta">
                      {suite.testCases.length} cases
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
