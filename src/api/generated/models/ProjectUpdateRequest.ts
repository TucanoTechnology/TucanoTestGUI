/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TestSuite } from './TestSuite';
/**
 * A partial project update: the fields supplied replace the stored field and every other stored field is kept. Unknown fields are rejected.
 */
export type ProjectUpdateRequest = {
  /**
   * Optional identifier; the stored document keeps its own when omitted.
   */
  projectId?: string;
  name?: string;
  description?: string;
  /**
   * Accepted for compatibility and discarded: suite membership is stored in the project folder, not in the document.
   */
  testSuites?: Array<TestSuite>;
  tags?: Array<string>;
};

