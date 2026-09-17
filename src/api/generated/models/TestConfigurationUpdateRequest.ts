/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * A partial test configuration update: the fields supplied replace the stored field and every other stored field is kept. Unknown fields are rejected.
 */
export type TestConfigurationUpdateRequest = {
  configId?: string;
  name?: string;
  browser?: string;
  os?: string;
  device?: string;
  resolution?: string;
};

