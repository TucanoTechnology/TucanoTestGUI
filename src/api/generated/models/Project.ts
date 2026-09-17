/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TestCase } from './TestCase';
import type { TestSuite } from './TestSuite';
/**
 * A project document. Reads replace `testSuites` with the suites the project holds (each carrying its cases) and add `testCases` for the cases held directly — a response-only field, omitted when the project owns no case directly.
 */
export type Project = {
  projectId: string;
  name: string;
  description?: string;
  testSuites?: Array<TestSuite>;
  testCases?: Array<TestCase>;
  tags?: Array<string>;
};

