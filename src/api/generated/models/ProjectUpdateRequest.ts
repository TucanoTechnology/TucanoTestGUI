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
   * Optional. A value that restates the addressed identifier or the stored one is accepted; an unusable value is `invalid_id` and a usable value naming another document is `invalid_request`, because an identifier is immutable — rename by deleting and recreating the document.
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

