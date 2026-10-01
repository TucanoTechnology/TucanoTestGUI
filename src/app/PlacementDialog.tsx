import { useEffect, useState } from "react";
import { apiFetch } from "../api/client.js";
import { readApiError, type ApiErrorInfo } from "../api/errors.js";
import { useAuth } from "./AuthProvider.js";
import { useProjectContext } from "./ProjectContext.js";
import { ApiErrorNotice } from "./ApiErrorNotice.js";
import { Dialog } from "./Dialog.js";

export interface PlacementTarget {
  /** What is being relocated: the case or suite identifier, as stored. */
  kind: "case" | "suite";
  resourceId: string;
  /** Human label for the dialog title: the resource is named, not typed. */
  label: string;
}

/**
 * Move or copy a case or suite through the composition routes (#181).
 *
 * The body shape is the API's own: an existing identifier plus a mode,
 * posted to the destination collection. Nothing here needs to know where
 * the resource came from — `move` is resolved server-side against the
 * stored home, which is also why the dialog states the consequence rather
 * than trying to preview it: a copy leaves the original in place, a move
 * relocates it. Destination options follow the routes that exist: a case
 * goes to a project's suites or its direct scope; a suite goes to a
 * project, because a suite is a project's child and has no second parent
 * to be filed under.
 */
export function PlacementDialog({
  target,
  onClose,
}: {
  target: PlacementTarget;
  onClose: () => void;
}) {
  const { client } = useAuth();
  const { selectedProjectId, refreshProjects, announce } = useProjectContext();
  const [projects, setProjects] = useState<string[]>([]);
  const [suites, setSuites] = useState<string[]>([]);
  const [projectId, setProjectId] = useState(selectedProjectId ?? "");
  const [suiteId, setSuiteId] = useState("");
  const [mode, setMode] = useState<"copy" | "move">("copy");
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [busy, setBusy] = useState(false);

  // The reachable projects for a destination — the same listing the shell's
  // switcher reads, so the dialog never invents its own view of access.
  useEffect(() => {
    let cancelled = false;
    apiFetch(() => client.projects.listProjects({}))
      .then((listed) => {
        // The global listing answers with stored identifiers.
        if (!cancelled) setProjects(listed);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  // Suites only matter for a case's destination, and only of the chosen
  // project: the listing is read when that choice is made.
  useEffect(() => {
    if (target.kind !== "case" || !projectId) {
      setSuites([]);
      return;
    }
    let cancelled = false;
    setSuiteId("");
    apiFetch(() => client.projects.listProjectTestSuites({ id: projectId }))
      .then((listed) => {
        if (!cancelled) setSuites(listed as unknown as string[]);
      })
      .catch(() => {
        if (!cancelled) setSuites([]);
      });
    // (seen probe active in tests)
    return () => {
      cancelled = true;
    };
  }, [client, target.kind, projectId]);

  const submit = async () => {
    if (!projectId) return;
    setBusy(true);
    setError(null);
    try {
      if (target.kind === "case") {
        const requestBody = { testCaseId: target.resourceId, mode };
        await apiFetch(() =>
          suiteId
            ? client.testSuites.addTestSuiteCase({ id: suiteId, requestBody })
            : client.projects.addProjectTestCase({
                id: projectId,
                requestBody,
              }),
        );
      } else {
        await apiFetch(() =>
          client.projects.addProjectTestSuite({
            id: projectId,
            requestBody: { suiteId: target.resourceId, mode },
          }),
        );
      }
      announce(
        `${target.resourceId} ${
          mode === "move" ? "moved to" : "copied to"
        } ${suiteId || projectId}.`,
      );
      refreshProjects();
      onClose();
    } catch (err: unknown) {
      setError(readApiError(err, "Failed to place the resource"));
    } finally {
      setBusy(false);
    }
  };

  const destinationLabel =
    target.kind === "case" ? "Destination suite" : "Destination project";

  return (
    <Dialog title={`Move or copy ${target.label}`} onClose={onClose}>
      <form
        className="result-form"
        aria-label="Placement form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {error && <ApiErrorNotice error={error} />}

        <fieldset className="form-field">
          <legend>Action</legend>
          <label>
            <input
              type="radio"
              name="placement-mode"
              checked={mode === "copy"}
              onChange={() => setMode("copy")}
            />{" "}
            Copy — leave the original in place
          </label>
          <label>
            <input
              type="radio"
              name="placement-mode"
              checked={mode === "move"}
              onChange={() => setMode("move")}
            />{" "}
            Move — relocate it (its history travels; the old home loses it)
          </label>
        </fieldset>

        <div className="form-field">
          <label htmlFor="placement-project">Destination project</label>
          <select
            id="placement-project"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="">Choose a project…</option>
            {projects.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>

        {target.kind === "case" && (
          <div className="form-field">
            <label htmlFor="placement-suite">{destinationLabel}</label>
            <select
              id="placement-suite"
              value={suiteId}
              onChange={(event) => setSuiteId(event.target.value)}
            >
              <option value="">Directly in project</option>
              {suites.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="dialog__actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || !projectId}
          >
            {busy
              ? "Placing…"
              : mode === "move"
                ? "Move here"
                : "Copy here"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
