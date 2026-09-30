/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TestCase } from './TestCase';
/**
 * A partial test suite update: the fields supplied replace the stored field and every other stored field is kept. Unknown fields are rejected.
 */
export type TestSuiteUpdateRequest = {
  /**
   * Optional. A value that restates the addressed identifier or the stored one is accepted; an unusable value is `invalid_id` and a usable value naming another document is `invalid_request`, because an identifier is immutable — rename by deleting and recreating the document.
   */
  suiteId?: string;
  name?: string;
  description?: string;
  /**
   * Accepted for compatibility and discarded: case membership is stored in the suite folder, not in the document.
   */
  testCases?: Array<TestCase>;
  tags?: Array<string>;
};

