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

interface ProjectContextValue {
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  selection: Selection | null;
  setSelection: (selection: Selection | null) => void;
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

  const setSelectedProjectId = useCallback((id: string | null) => {
    setSelectedProjectIdState(id);
    if (id) {
      sessionStorage.setItem("selectedProjectId", id);
    } else {
      sessionStorage.removeItem("selectedProjectId");
    }
  }, []);

  const value = useMemo(
    () => ({
      selectedProjectId,
      setSelectedProjectId,
      selection,
      setSelection,
    }),
    [selectedProjectId, setSelectedProjectId, selection],
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}
