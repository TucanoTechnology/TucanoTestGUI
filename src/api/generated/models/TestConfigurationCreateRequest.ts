/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * A test configuration to create. `name` is required; `configId` is derived from it when omitted. Unknown fields are rejected.
 */
export type TestConfigurationCreateRequest = {
  /**
   * Optional identifier; derived from `name` as `<name>.json` when omitted. A supplied value that is not a single path segment ending in `.json` is rejected.
   */
  configId?: string;
  name: string;
  browser?: string;
  os?: string;
  device?: string;
  resolution?: string;
};

