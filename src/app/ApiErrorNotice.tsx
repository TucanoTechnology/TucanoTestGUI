import type { ApiErrorInfo } from "../api/errors.js";

export function ApiErrorNotice({ error }: { error: ApiErrorInfo }) {
  return (
    <div className="error-display" role="alert">
      {error.code && <span className="error-display__code">{error.code}</span>}
      <span>{error.message}</span>
    </div>
  );
}
