/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TestSuite } from './TestSuite';
/**
 * A project to create. `name` is required; `projectId` is derived from it when omitted. Unknown fields are rejected.
 */
export type ProjectCreateRequest = {
  /**
   * Optional identifier; derived from `name` as `<name>.json` when omitted. A supplied value that is not a single path segment ending in `.json` is rejected.
   */
  projectId?: string;
  name: string;
  description?: string;
  /**
   * Accepted for compatibility and discarded: suite membership is stored in the project folder, not in the document.
   */
  testSuites?: Array<TestSuite>;
  tags?: Array<string>;
};

