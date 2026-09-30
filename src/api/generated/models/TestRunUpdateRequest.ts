/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Project } from './Project';
import type { TestCase } from './TestCase';
import type { TestCaseResult } from './TestCaseResult';
import type { TestConfiguration } from './TestConfiguration';
import type { TestSuite } from './TestSuite';
/**
 * A partial run update: the fields supplied replace the stored field and every other stored field is kept. Unknown fields are rejected.
 */
export type TestRunUpdateRequest = {
  /**
   * Optional. A value that restates the addressed identifier or the stored one is accepted; an unusable value is `invalid_id` and a usable value naming another document is `invalid_request`, because an identifier is immutable — rename by deleting and recreating the document.
   */
  testRunId?: string;
  /**
   * Unix seconds rendered as a string, as written by this API; a client-supplied value is stored verbatim, so the field is not necessarily an ISO-8601 date.
   */
  timestamp?: string;
  name?: string;
  /**
   * The projects this run covers. An update replaces the whole array, so the role is checked against the projects it will carry rather than the ones it drops: creating or updating needs `editor` in every project named, and reading needs `viewer` in every project the stored array carries. A listing keeps only the runs whose projects the caller can reach and that name at least one, so a run that names none is readable by any authenticated caller yet appears in no listing. A run may carry at most 512 of these references; a longer array is refused with `400 invalid_request`.
   */
  projects?: Array<Project>;
  /**
   * A document may list at most 512 of these references; a longer array is refused with `400 invalid_request`.
   */
  testSuites?: Array<TestSuite>;
  /**
   * A document may list at most 512 of these references; a longer array is refused with `400 invalid_request`.
   */
  testCases?: Array<TestCase>;
  results?: Array<TestCaseResult>;
  tags?: Array<string>;
  configurations?: Array<TestConfiguration>;
  /**
   * The revision of each case the run pinned when the case was added or its result recorded, keyed by the case identifier (`testCaseId`). The run never re-reads a case, so a later qualifying edit leaves these values unchanged; the first capture wins, and a case that carries no `version` of its own is pinned as `1`.
   */
  caseVersions?: Record<string, number>;
};

