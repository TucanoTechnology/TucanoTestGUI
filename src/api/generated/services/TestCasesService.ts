/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AttachmentUpload } from '../models/AttachmentUpload';
import type { CaseHistoryEntry } from '../models/CaseHistoryEntry';
import type { CreateResponse } from '../models/CreateResponse';
import type { DuplicateCaseRequest } from '../models/DuplicateCaseRequest';
import type { MessageResponse } from '../models/MessageResponse';
import type { StepAttachment } from '../models/StepAttachment';
import type { TestCase } from '../models/TestCase';
import type { TestCaseUpdateRequest } from '../models/TestCaseUpdateRequest';
import type { UploadResponse } from '../models/UploadResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class TestCasesService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}
  /**
   * Read a test case
   * A bare identifier that several parents hold is a conflict; address the case through its parent-scoped route instead. Test case identifiers are addressed verbatim, so an unusable one is a `404` and never an `invalid_id`.
   * @returns TestCase Test case document
   * @throws ApiError
   */
  public getTestCase({
    id,
  }: {
    id: string,
  }): CancelablePromise<TestCase> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/test_cases/{id}',
      path: {
        'id': id,
      },
      errors: {
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
      },
    });
  }
  /**
   * Update a test case
   * Test case identifiers are addressed verbatim, so an unusable one is a `404` and never an `invalid_id`. A change to `title`, `steps`, `preconditions` or `expectedResult` records an immutable `revisions/v{version}.json` snapshot of the previous document and starts a new version; any other update leaves `version` and `lastModified` untouched. `version` and `lastModified` are always API-managed, so a value the body supplies is ignored.
   * @returns MessageResponse Updated
   * @throws ApiError
   */
  public updateTestCase({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: TestCaseUpdateRequest,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'PUT',
      url: '/test_cases/{id}',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `\`invalid_request\`: the body was rejected — an unknown or missing field, an identifier the body supplies that is not a single \`.json\` component, or a name-only payload that omits what creation needs.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        413: `Every request is capped at 50 MiB by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
      },
    });
  }
  /**
   * Delete a test case
   * A bare identifier that several parents hold is a conflict; address the case through its parent-scoped route instead. Test case identifiers are addressed verbatim, so an unusable one is a `404` and never an `invalid_id`.
   * @returns MessageResponse Deleted
   * @throws ApiError
   */
  public deleteTestCase({
    id,
  }: {
    id: string,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/test_cases/{id}',
      path: {
        'id': id,
      },
      errors: {
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
      },
    });
  }
  /**
   * Duplicate test case
   * Unknown fields in the body are ignored.
   * @returns CreateResponse Duplicated
   * @throws ApiError
   */
  public duplicateTestCase({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: DuplicateCaseRequest,
  }): CancelablePromise<CreateResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/test_cases/{id}/duplicate',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `\`invalid_request\`: the body was rejected — an unknown or missing field, an identifier the body supplies that is not a single \`.json\` component, or a name-only payload that omits what creation needs.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        413: `Every request is capped at 50 MiB by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
      },
    });
  }
  /**
   * Upload attachment
   * The first multipart part is the attachment; its part name is not inspected, but it must carry a filename. A bare identifier that several parents hold is a conflict; address the case through its parent-scoped route instead.
   * @returns UploadResponse Uploaded
   * @throws ApiError
   */
  public uploadTestCaseAttachment({
    id,
    formData,
  }: {
    id: string,
    formData: AttachmentUpload,
  }): CancelablePromise<UploadResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/test_cases/{id}/attachments',
      path: {
        'id': id,
      },
      formData: formData,
      mediaType: 'multipart/form-data',
      errors: {
        400: `The upload route's 400s. \`invalid_multipart\` when the multipart body cannot be parsed and \`missing_file\` when no part carries a filename, both as the error envelope; but the multipart extractor rejects a request that is not valid \`multipart/form-data\` before the handler runs, and that answer is plain text — \`Invalid \\\`boundary\\\` for \\\`multipart/form-data\\\` request\` — not the envelope.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        413: `Every request is capped at 50 MiB by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
      },
    });
  }
  /**
   * Download attachment
   * A bare identifier that several parents hold is a conflict; address the case through its parent-scoped route instead.
   * @returns binary File content
   * @throws ApiError
   */
  public downloadTestCaseAttachment({
    id,
    filename,
  }: {
    id: string,
    filename: string,
  }): CancelablePromise<Blob> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/test_cases/{id}/attachments/{filename}',
      path: {
        'id': id,
        'filename': filename,
      },
      errors: {
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
      },
    });
  }
  /**
   * Delete attachment
   * A bare identifier that several parents hold is a conflict; address the case through its parent-scoped route instead.
   * @returns MessageResponse Deleted
   * @throws ApiError
   */
  public deleteTestCaseAttachment({
    id,
    filename,
  }: {
    id: string,
    filename: string,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/test_cases/{id}/attachments/{filename}',
      path: {
        'id': id,
        'filename': filename,
      },
      errors: {
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
      },
    });
  }
  /**
   * List step attachments
   * Returns the metadata recorded for the addressed structured step, an empty array when it carries none. The index walks the case's `steps` array, where a plain string step has no attachments. A bare identifier that several parents hold is a conflict, and a case addressed by an unusable identifier answers `404`, never `400`.
   * @returns StepAttachment Step attachment metadata
   * @throws ApiError
   */
  public listStepAttachments({
    id,
    stepIndex,
  }: {
    id: string,
    /**
     * A value that is not a non-negative integer is reported as `invalid_request`.
     */
    stepIndex: number,
  }): CancelablePromise<Array<StepAttachment>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/test_cases/{id}/steps/{step_index}/attachments',
      path: {
        'id': id,
        'step_index': stepIndex,
      },
      errors: {
        400: `\`invalid_request\`: the step index is not a non-negative integer, is beyond the end of the case's \`steps\` array, or names a plain string step rather than a structured one.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
      },
    });
  }
  /**
   * Upload step attachment
   * The first multipart part is the attachment; its part name is not inspected, but it must carry a filename. The metadata is appended to the addressed structured step. A bare identifier that several parents hold is a conflict, and a case addressed by an unusable identifier answers `404`, never `400`.
   * @returns UploadResponse Uploaded
   * @throws ApiError
   */
  public uploadStepAttachment({
    id,
    stepIndex,
    formData,
  }: {
    id: string,
    /**
     * A value that is not a non-negative integer is reported as `invalid_request`.
     */
    stepIndex: number,
    formData: AttachmentUpload,
  }): CancelablePromise<UploadResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/test_cases/{id}/steps/{step_index}/attachments',
      path: {
        'id': id,
        'step_index': stepIndex,
      },
      formData: formData,
      mediaType: 'multipart/form-data',
      errors: {
        400: `The step upload route's 400s. \`invalid_request\` when the step index is unusable, \`invalid_multipart\` when the multipart body cannot be parsed and \`missing_file\` when no part carries a filename, all as the error envelope; but the multipart extractor rejects a request that is not valid \`multipart/form-data\` before the handler runs, and that answer is plain text.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        413: `Every request is capped at 50 MiB by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
      },
    });
  }
  /**
   * Delete step attachment
   * Removes the file and its metadata. An unattached filename answers `404`. A bare identifier that several parents hold is a conflict, and a case addressed by an unusable identifier answers `404`, never `400`.
   * @returns MessageResponse Deleted
   * @throws ApiError
   */
  public deleteStepAttachment({
    id,
    stepIndex,
    filename,
  }: {
    id: string,
    /**
     * A value that is not a non-negative integer is reported as `invalid_request`.
     */
    stepIndex: number,
    filename: string,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/test_cases/{id}/steps/{step_index}/attachments/{filename}',
      path: {
        'id': id,
        'step_index': stepIndex,
        'filename': filename,
      },
      errors: {
        400: `\`invalid_request\`: the step index is not a non-negative integer, is beyond the end of the case's \`steps\` array, or names a plain string step rather than a structured one.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
      },
    });
  }
  /**
   * List test-case revisions
   * The case's recorded snapshots, oldest first. The current live version is not a snapshot and is not listed, and a case that has never had a qualifying update lists as an empty array. The case is resolved before anything else, so an unknown case is a `404`. A bare identifier that several parents hold is a conflict; test case identifiers are addressed verbatim, so an unusable one is a `404` and never an `invalid_id`.
   * @returns CaseHistoryEntry Revision history
   * @throws ApiError
   */
  public listTestCaseHistory({
    id,
  }: {
    id: string,
  }): CancelablePromise<Array<CaseHistoryEntry>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/test_cases/{id}/history',
      path: {
        'id': id,
      },
      errors: {
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
      },
    });
  }
  /**
   * Read a test-case revision
   * Returns the immutable snapshot recorded at `version`. A version the case never recorded answers `404`, and so does the current live version, which is read through `GET /test_cases/{id}`. The case is resolved before the version is parsed, so an unknown case answers `404` even when the version is unusable. A bare identifier that several parents hold is a conflict; test case identifiers are addressed verbatim, so an unusable one is a `404` and never an `invalid_id`.
   * @returns TestCase Revision snapshot
   * @throws ApiError
   */
  public getTestCaseVersion({
    id,
    version,
  }: {
    id: string,
    /**
     * A value that is not a positive integer is reported as `invalid_request`.
     */
    version: number,
  }): CancelablePromise<TestCase> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/test_cases/{id}/history/{version}',
      path: {
        'id': id,
        'version': version,
      },
      errors: {
        400: `\`invalid_request\`: the revision number is not a positive integer.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
      },
    });
  }
}
