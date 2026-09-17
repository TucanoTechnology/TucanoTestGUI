/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CoverageReport } from '../models/CoverageReport';
import type { SummaryReport } from '../models/SummaryReport';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class ReportsService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}
  /**
   * Get the coverage report
   * Counts the cases the tree holds, per suite and in total. A case may live directly in a project as well as inside a suite, so `totalCases` includes those and can exceed the sum of the per-suite `caseCount`.
   * @returns CoverageReport Case counts per suite and in total
   * @throws ApiError
   */
  public getCoverageReport({
    projectId,
  }: {
    /**
     * Restricts the report to one project, identified as `<folder>.json`. Omitted, the report covers every project and no `projectId` is echoed back.
     */
    projectId?: string,
  }): CancelablePromise<CoverageReport> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/reports/coverage',
      query: {
        'projectId': projectId,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\`. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
      },
    });
  }
  /**
   * Get the summary report
   * How the results recorded across the runs in scope split by status, with their pass rate and total duration. Every filter is optional and the ones supplied combine. `total` counts every recorded result, so it exceeds the four named buckets when a run records `Retest` or an unrecognised status.
   * @returns SummaryReport How the results in scope split by status, with their pass rate and total duration
   * @throws ApiError
   */
  public getSummaryReport({
    projectId,
    milestoneId,
    configurationId,
    from,
    to,
  }: {
    /**
     * Restricts the report to runs that embed the project, identified as `<folder>.json`.
     */
    projectId?: string,
    /**
     * Restricts the report to the runs the milestone references, identified as `<folder>.json`.
     */
    milestoneId?: string,
    /**
     * Restricts the report to runs that reference the configuration, identified as `<folder>.json`.
     */
    configurationId?: string,
    /**
     * Inclusive lower bound on a run's own timestamp, as `YYYY-MM-DD` or an ISO-8601 value. A run whose timestamp cannot be read as a date is left out when this is set.
     */
    from?: string,
    /**
     * Inclusive upper bound on a run's own timestamp, as `YYYY-MM-DD` or an ISO-8601 value. A run whose timestamp cannot be read as a date is left out when this is set.
     */
    to?: string,
  }): CancelablePromise<SummaryReport> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/reports/summary',
      query: {
        'projectId': projectId,
        'milestoneId': milestoneId,
        'configurationId': configurationId,
        'from': from,
        'to': to,
      },
      errors: {
        400: `\`invalid_id\` for an identifier in the path or the body that is not a single \`.json\` component, or \`invalid_request\` for a rejected body.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
      },
    });
  }
}
