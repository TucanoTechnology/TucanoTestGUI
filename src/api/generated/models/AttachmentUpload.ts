/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * The first multipart part is the attachment. Its part name is not inspected, so any name works, but the part must carry a filename; a part without one is reported as `missing_file`.
 */
export type AttachmentUpload = {
  /**
   * Conventional part name; the handler accepts any.
   */
  file?: Blob;
};

