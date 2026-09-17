/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * The result of an attachment upload: the name the file is stored under, the name the client supplied, and the byte size the API recorded. All four fields are always present.
 */
export type UploadResponse = {
  /**
   * Human-readable outcome, e.g. `File uploaded successfully`.
   */
  message: string;
  /**
   * Name the attachment is stored under; use it with the attachment read and delete routes.
   */
  filename: string;
  /**
   * Name the client supplied in the multipart part.
   */
  originalName: string;
  /**
   * Size of the stored file in bytes.
   */
  size: number;
};

