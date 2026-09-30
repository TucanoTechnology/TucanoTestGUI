/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * A test configuration to create. `name` is required; `configId` is derived from it, so the identifier always names the document it is stored in. Unknown fields are rejected.
 */
export type TestConfigurationCreateRequest = {
  /**
   * Accepted for wire compatibility and ignored: the identifier is always derived from `name` as `<name>.json`, so it agrees with the key the configuration is listed under. A supplied value is neither validated nor stored.
   */
  configId?: string;
  name: string;
  browser?: string;
  os?: string;
  device?: string;
  resolution?: string;
};

