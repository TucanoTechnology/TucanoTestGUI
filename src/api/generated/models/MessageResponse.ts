/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TestCaseResult } from './TestCaseResult';
/**
 * The result of an update, delete, record, link or unlink operation: a human-readable `message` plus, on the routes where a write changes fields the request cannot predict, the stored outcome. `PUT` on a document route carries `document`, the document exactly as stored — for a test case that is where the new `version` and `lastModified` arrive. `POST /test_runs/{id}/results` and its replace sibling carry `result`, the merged result as stored. Every other message response carries only `message`.
 */
export type MessageResponse = {
  /**
   * Human-readable outcome, e.g. `Resource updated`.
   */
  message: string;
  /**
   * The stored document after the write; present only on document `PUT` responses. Fields follow the addressed document's schema.
   */
  document?: Record<string, any>;
  /**
   * The result as stored after the record or replace; present on those two responses.
   */
  result?: TestCaseResult;
};

