import { useState, useEffect } from 'react';

export interface Project {
  projectId: string;
  name: string;
}

export interface Milestone {
  milestoneId: string;
  name: string;
  status?: string;
}

export interface ContextSelectorsProps {
  selectedProjectId?: string;
  selectedMilestoneId?: string;
  onProjectChange?: (projectId: string | null) => void;
  onMilestoneChange?: (milestoneId: string | null) => void;
}

export default function ContextSelectors({
  selectedProjectId,
  selectedMilestoneId,
  onProjectChange,
  onMilestoneChange,
}: ContextSelectorsProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContext = async () => {
      try {
        const [projectsRes, milestonesRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/milestones'),
        ]);

        if (!projectsRes.ok || !milestonesRes.ok) {
          throw new Error('Failed to fetch context data');
        }

        const [projectsData, milestonesData] = await Promise.all([
          projectsRes.json(),
          milestonesRes.json(),
        ]);

        setProjects(projectsData);
        setMilestones(milestonesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchContext();
  }, []);

  if (loading) {
    return <div style={{ padding: '12px', color: '#6c757d' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: '12px', color: '#dc3545' }}>Error: {error}</div>;
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: '16px',
        padding: '12px 16px',
        borderBottom: '1px solid #dee2e6',
        background: '#f8f9fa',
      }}
    >
      <div style={{ flex: 1 }}>
        <label
          htmlFor="project-select"
          style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#495057' }}
        >
          Project
        </label>
        <select
          id="project-select"
          value={selectedProjectId || ''}
          onChange={(e) => onProjectChange?.(e.target.value || null)}
          style={{
            width: '100%',
            padding: '6px 12px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontSize: '14px',
            background: '#ffffff',
          }}
        >
          <option value="">All Projects</option>
          {projects.map((project) => (
            <option key={project.projectId} value={project.projectId}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ flex: 1 }}>
        <label
          htmlFor="milestone-select"
          style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#495057' }}
        >
          Milestone
        </label>
        <select
          id="milestone-select"
          value={selectedMilestoneId || ''}
          onChange={(e) => onMilestoneChange?.(e.target.value || null)}
          style={{
            width: '100%',
            padding: '6px 12px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontSize: '14px',
            background: '#ffffff',
          }}
        >
          <option value="">All Milestones</option>
          {milestones.map((milestone) => (
            <option key={milestone.milestoneId} value={milestone.milestoneId}>
              {milestone.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
