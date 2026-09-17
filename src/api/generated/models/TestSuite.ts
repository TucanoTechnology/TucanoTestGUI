/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TestCase } from './TestCase';
/**
 * A test suite document. The stored marker keeps `testCases` empty; reads fill it with the cases the suite folder holds.
 */
export type TestSuite = {
  suiteId: string;
  name: string;
  description?: string;
  testCases?: Array<TestCase>;
  tags?: Array<string>;
};

