/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TestCase } from './TestCase';
/**
 * A test suite document. The stored marker keeps `testCases` empty; reads fill it with the cases the suite folder holds, or with their wire identifiers when the read is given `?children=ids` (#415).
 */
export type TestSuite = {
  suiteId: string;
  name: string;
  description?: string;
  testCases?: Array<TestCase>;
  tags?: Array<string>;
};

