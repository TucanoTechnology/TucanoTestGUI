/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Metadata of a file attached to a test case. The `mimeType` is descriptive: a download is always answered as `application/octet-stream`.
 */
export type Attachment = {
  /**
   * Name the file is stored under, `<suffix>-<original name>`; use it with the attachment read and delete routes. Never longer than the 255 bytes one stored component may hold: an upload whose original name would push it past that is refused with `invalid_request`.
   */
  filename: string;
  /**
   * Name the client supplied in the multipart part.
   */
  originalName: string;
  /**
   * Media type the API recorded from the stored file name. Descriptive metadata: it never becomes the response content type of a download.
   */
  mimeType: string;
  /**
   * Size of the stored file in bytes.
   */
  size: number;
  /**
   * ISO-8601 UTC instant the API recorded the upload at, e.g. `2026-09-18T19:04:05Z`. Written by the case upload route; not carried by `StepAttachment`.
   */
  uploadedAt?: string;
};

