/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Name of a stored attachment file, `<suffix>-<original name>` — the `filename` the upload route answers and the `Attachment` metadata carries, not the `originalName` the client sent. A value that addresses no stored file is reported as `not_found`: a name that is absent, that is not a single plain path component (`.` and `..` among them), or that names a directory.
 */
export type filename = string;
