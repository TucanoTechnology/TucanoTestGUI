/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type DuplicateRequest = {
  /**
   * Identifier for the copy; derived from the source when omitted. A supplied value must be a single path segment ending in `.json`; an unusable one is `invalid_id`.
   */
  newId?: string;
  /**
   * Name for the copy; the source name is kept when omitted
   */
  newName?: string;
};

