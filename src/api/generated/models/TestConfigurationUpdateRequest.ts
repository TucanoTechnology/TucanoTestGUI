/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * A partial test configuration update: the fields supplied replace the stored field and every other stored field is kept. Unknown fields are rejected.
 */
export type TestConfigurationUpdateRequest = {
  /**
   * Optional. A value that restates the addressed identifier or the stored one is accepted; an unusable value is `invalid_id` and a usable value naming another document is `invalid_request`, because an identifier is immutable — rename by deleting and recreating the document.
   */
  configId?: string;
  name?: string;
  browser?: string;
  os?: string;
  device?: string;
  resolution?: string;
};

