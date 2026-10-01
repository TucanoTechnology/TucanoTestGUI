import { useId } from "react";

interface RunMembershipSectionProps {
  projectCaseIds: string[];
  projectSuiteIds: string[];
  heldCaseIds: Set<string>;
  heldSuiteIds: Set<string>;
  addCaseId: string;
  addSuiteId: string;
  onAddCaseIdChange: (id: string) => void;
  onAddSuiteIdChange: (id: string) => void;
  onAddCase: (caseId: string) => void;
  onAddSuite: (suiteId: string) => void;
  busy: boolean;
}

export function RunMembershipSection({
  projectCaseIds,
  projectSuiteIds,
  heldCaseIds,
  heldSuiteIds,
  addCaseId,
  addSuiteId,
  onAddCaseIdChange,
  onAddSuiteIdChange,
  onAddCase,
  onAddSuite,
  busy,
}: RunMembershipSectionProps) {
  const fieldId = useId();

  const openCases = projectCaseIds.filter((id) => !heldCaseIds.has(id));
  const openSuites = projectSuiteIds.filter((id) => !heldSuiteIds.has(id));

  return (
    <fieldset className="run-extend" disabled={busy}>
      <legend className="detail-field__label">Extend this run</legend>
      <div className="run-extend__row">
        <label htmlFor={`${fieldId}-add-case`}>Add case</label>
        <select
          id={`${fieldId}-add-case`}
          value={addCaseId}
          onChange={(event) => onAddCaseIdChange(event.target.value)}
        >
          <option value="">
            {openCases.length === 0 ? "Nothing left to add" : "Choose a case"}
          </option>
          {openCases.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || addCaseId === ""}
          onClick={() => {
            onAddCase(addCaseId);
            onAddCaseIdChange("");
          }}
          aria-label="Add case to the run"
        >
          Add
        </button>
      </div>
      <div className="run-extend__row">
        <label htmlFor={`${fieldId}-add-suite`}>Add suite</label>
        <select
          id={`${fieldId}-add-suite`}
          value={addSuiteId}
          onChange={(event) => onAddSuiteIdChange(event.target.value)}
        >
          <option value="">
            {openSuites.length === 0 ? "Nothing left to add" : "Choose a suite"}
          </option>
          {openSuites.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || addSuiteId === ""}
          onClick={() => {
            onAddSuite(addSuiteId);
            onAddSuiteIdChange("");
          }}
          aria-label="Add suite to the run"
        >
          Add
        </button>
      </div>
    </fieldset>
  );
}
