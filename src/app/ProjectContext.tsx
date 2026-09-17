import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type EntityType =
  | "project"
  | "suite"
  | "case"
  | "run"
  | "milestone"
  | "configuration";

interface Selection {
  type: EntityType;
  id: string;
  projectId?: string;
}

interface Announcement {
  id: number;
  message: string;
}

interface ProjectContextValue {
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  selection: Selection | null;
  setSelection: (selection: Selection | null) => void;
  /** Bumped after a project mutation so lists re-fetch. */
  projectsVersion: number;
  refreshProjects: () => void;
  /** Last asynchronous status change, for the app-wide live region. */
  announcement: Announcement | null;
  announce: (message: string) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useProjectContext must be used within a ProjectProvider");
  }
  return ctx;
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [selectedProjectId, setSelectedProjectIdState] = useState<string | null>(
    () => sessionStorage.getItem("selectedProjectId"),
  );
  const [selection, setSelection] = useState<Selection | null>(null);
  const [projectsVersion, setProjectsVersion] = useState(0);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  const setSelectedProjectId = useCallback((id: string | null) => {
    setSelectedProjectIdState(id);
    if (id) {
      sessionStorage.setItem("selectedProjectId", id);
    } else {
      sessionStorage.removeItem("selectedProjectId");
    }
  }, []);

  const refreshProjects = useCallback(() => {
    setProjectsVersion((v) => v + 1);
  }, []);

  const announce = useCallback((message: string) => {
    setAnnouncement((prev) => ({ id: (prev?.id ?? 0) + 1, message }));
  }, []);

  const value = useMemo(
    () => ({
      selectedProjectId,
      setSelectedProjectId,
      selection,
      setSelection,
      projectsVersion,
      refreshProjects,
      announcement,
      announce,
    }),
    [
      selectedProjectId,
      setSelectedProjectId,
      selection,
      projectsVersion,
      refreshProjects,
      announcement,
      announce,
    ],
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}
