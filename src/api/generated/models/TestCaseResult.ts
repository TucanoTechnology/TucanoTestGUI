/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Attachment } from './Attachment';
import type { DefectLink } from './DefectLink';
export type TestCaseResult = {
  testCaseId: string;
  status: 'Passed' | 'Failed' | 'Blocked' | 'Untested' | 'Retest';
  /**
   * Unix seconds rendered as a string, as written by this API; a client-supplied value is stored verbatim, so the field is not necessarily an ISO-8601 date.
   */
  timestamp: string;
  notes?: string;
  /**
   * How long the case took, in milliseconds, when the client supplied one; absent otherwise. The summary report sums these into `totalDurationMs`.
   */
  durationMs?: number;
  attachments?: Array<Attachment>;
  /**
   * Legacy in-result storage: links written by a deployment before the case-owned move (#460) surface here unchanged and survive re-recordings, but the API writes no link into a result any more — the case document is the store, surfaced by the defect routes.
   */
  defectLinks?: Array<DefectLink>;
};

