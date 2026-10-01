/**
 * Per-row breadcrumb showing the project (and suite when applicable).
 * Extends the case-list__breadcrumb pattern from a single banner at the top
 * of one list into a per-row element reused across all four modules (#195).
 */
export function RowBreadcrumb({
  projectName,
  suiteName,
}: {
  projectName: string;
  suiteName?: string;
}) {
  return (
    <span className="row-breadcrumb" aria-label={`${projectName}${suiteName ? ` / ${suiteName}` : ""}`}>
      <span className="row-breadcrumb__crumb">{projectName}</span>
      {suiteName && (
        <>
          <span className="row-breadcrumb__sep" aria-hidden="true">
            /
          </span>
          <span className="row-breadcrumb__crumb row-breadcrumb__crumb--current">
            {suiteName}
          </span>
        </>
      )}
    </span>
  );
}
