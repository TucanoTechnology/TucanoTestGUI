/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * The result of a create, duplicate or composition create-or-place operation: a human-readable `message` and the identifier the API assigned to the new resource.
 */
export type CreateResponse = {
  /**
   * Human-readable outcome, e.g. `Resource created`.
   */
  message: string;
  /**
   * Identifier the API assigned to the new resource; it is the value the collection and member routes accept.
   */
  id: string;
};

