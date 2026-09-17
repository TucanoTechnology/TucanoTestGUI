/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CompositionRequest } from '../models/CompositionRequest';
import type { CompositionResponse } from '../models/CompositionResponse';
import type { CreateResponse } from '../models/CreateResponse';
import type { DuplicateRequest } from '../models/DuplicateRequest';
import type { MessageResponse } from '../models/MessageResponse';
import type { TestSuite } from '../models/TestSuite';
import type { TestSuiteUpdateRequest } from '../models/TestSuiteUpdateRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class TestSuitesService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}
  /**
   * Read a test suite with the cases it holds assembled
   * @returns TestSuite Test suite document
   * @throws ApiError
   */
  public getTestSuite({
    id,
  }: {
    id: string,
  }): CancelablePromise<TestSuite> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/test_suites/{id}',
      path: {
        'id': id,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\`. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
      },
    });
  }
  /**
   * Update a test suite
   * @returns MessageResponse Updated
   * @throws ApiError
   */
  public updateTestSuite({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: TestSuiteUpdateRequest,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'PUT',
      url: '/test_suites/{id}',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `\`invalid_id\` for an identifier in the path or the body that is not a single \`.json\` component, or \`invalid_request\` for a rejected body.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        413: `Every request is capped at 50 MiB by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
      },
    });
  }
  /**
   * Delete a test suite and the cases it holds
   * @returns MessageResponse Deleted
   * @throws ApiError
   */
  public deleteTestSuite({
    id,
  }: {
    id: string,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/test_suites/{id}',
      path: {
        'id': id,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\`. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
      },
    });
  }
  /**
   * Duplicate test suite
   * An unusable path identifier answers `invalid_id` here, where the project, run, milestone and case duplicate routes answer `invalid_request`. Unknown fields in the body are ignored.
   * @returns CreateResponse Duplicated
   * @throws ApiError
   */
  public duplicateTestSuite({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: DuplicateRequest,
  }): CancelablePromise<CreateResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/test_suites/{id}/duplicate',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `\`invalid_id\` for an identifier in the path or the body that is not a single \`.json\` component, or \`invalid_request\` for a rejected body.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        413: `Every request is capped at 50 MiB by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
      },
    });
  }
  /**
   * List the test cases a suite holds
   * @returns string Test case IDs
   * @throws ApiError
   */
  public listTestSuiteCases({
    id,
  }: {
    id: string,
  }): CancelablePromise<Array<string>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/test_suites/{id}/test_cases',
      path: {
        'id': id,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\`. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
      },
    });
  }
  /**
   * Create a test case in a suite, or place an existing one
   * A body carrying a `title` creates a case in the suite and must also carry the `testCaseId` and `expectedResult` a case needs. Otherwise the body names an existing `testCaseId` to place here, and `mode` chooses copy (the default) or move.
   * @returns CompositionResponse Created, copied, or moved
   * @throws ApiError
   */
  public addTestSuiteCase({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: CompositionRequest,
  }): CancelablePromise<CompositionResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/test_suites/{id}/test_cases',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `\`invalid_id\` for an identifier in the path or the body that is not a single \`.json\` component, or \`invalid_request\` for a rejected body.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        413: `Every request is capped at 50 MiB by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
      },
    });
  }
  /**
   * Remove a test case from a suite
   * @returns MessageResponse Removed
   * @throws ApiError
   */
  public removeTestSuiteCase({
    id,
    caseId,
  }: {
    id: string,
    caseId: string,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/test_suites/{id}/test_cases/{case_id}',
      path: {
        'id': id,
        'case_id': caseId,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\`. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
      },
    });
  }
}
