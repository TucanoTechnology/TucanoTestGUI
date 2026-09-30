/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { LastCaseResult } from './LastCaseResult';
/**
 * The latest recorded result per case. One entry per case that at least one in-scope run recorded a result for; a case no run has covered is absent rather than listed as `Untested`. `cases` is sorted by `testCaseId`. `projectId` is echoed back only when the report was scoped to one project, so a global report omits it.
 */
export type LastResultsReport = {
  /**
   * The project the report was scoped to; absent for a report across every reachable project
   */
  projectId?: string;
  cases: Array<LastCaseResult>;
};

