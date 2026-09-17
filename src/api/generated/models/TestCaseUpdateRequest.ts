/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Attachment } from './Attachment';
import type { TestStep } from './TestStep';
/**
 * A partial test case update: the fields supplied replace the stored field and every other stored field is kept. `version` and `lastModified` are managed by the API. Unknown fields are rejected.
 */
export type TestCaseUpdateRequest = {
  testCaseId?: string;
  title?: string;
  description?: string;
  preconditions?: string;
  steps?: Array<(string | TestStep)>;
  expectedResult?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';
  severity?: 'Trivial' | 'Minor' | 'Major' | 'Critical';
  testType?: string;
  exploratory?: boolean;
  attachments?: Array<Attachment>;
  tags?: Array<string>;
  /**
   * The case's current revision number; the API stamps 1 when it creates the case and increments it on every qualifying update. A client-supplied value is ignored.
   */
  version?: number;
  /**
   * When the current version was written, in ISO-8601 UTC. The API stamps it on creation and on every qualifying update; a client-supplied value is ignored.
   */
  lastModified?: string;
};

