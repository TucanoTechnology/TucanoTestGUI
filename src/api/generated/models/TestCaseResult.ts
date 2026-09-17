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
  defectLinks?: Array<DefectLink>;
};

