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
 * A run to create. `name` is required; `testRunId` is derived from it when omitted and `timestamp` is stamped when omitted. Unknown fields are rejected.
 */
export type TestRunCreateRequest = {
  /**
   * Optional identifier; derived from `name` as `<name>.json` when omitted. A supplied value that is not a single path segment ending in `.json` is rejected.
   */
  testRunId?: string;
  /**
   * Optional; the API stamps the current Unix-seconds string when omitted. A supplied value is stored verbatim.
   */
  timestamp?: string;
  name: string;
  /**
   * The projects this run covers. An update replaces the whole array, so the role is checked against the projects it will carry rather than the ones it drops: creating or updating needs `editor` in every project named, and reading needs `viewer` in every project the stored array carries. A listing keeps only the runs whose projects the caller can reach and that name at least one, so a run that names none is readable by any authenticated caller yet appears in no listing.
   */
  projects?: Array<Project>;
  testSuites?: Array<TestSuite>;
  testCases?: Array<TestCase>;
  results?: Array<TestCaseResult>;
  tags?: Array<string>;
  configurations?: Array<TestConfiguration>;
  /**
   * The revision of each case the run pinned when the case was added or its result recorded, keyed by the case identifier (`testCaseId`). The run never re-reads a case, so a later qualifying edit leaves these values unchanged; the first capture wins, and a case that carries no `version` of its own is pinned as `1`.
   */
  caseVersions?: Record<string, number>;
};

