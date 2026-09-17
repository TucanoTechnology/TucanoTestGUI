/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ReadyResponse } from '../models/ReadyResponse';
import type { StorageDiagnostics } from '../models/StorageDiagnostics';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class ServiceService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}
  /**
   * Health check
   * Liveness: `200` for as long as the process is serving, whatever the state of the store behind it. A store that cannot take writes is `/ready`'s `503`, not a failed liveness probe — restarting a container cannot repair a volume.
   * @returns string Service is healthy
   * @throws ApiError
   */
  public getHealth(): CancelablePromise<string> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/health',
      responseHeader: 'X-Request-Id',
    });
  }
  /**
   * OpenAPI document
   * @returns string OpenAPI JSON
   * @throws ApiError
   */
  public getOpenApiDocument(): CancelablePromise<string> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/openapi.json',
      responseHeader: 'X-Request-Id',
    });
  }
  /**
   * Swagger UI
   * @returns string Interactive API documentation
   * @throws ApiError
   */
  public getApiDocs(): CancelablePromise<string> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api-docs',
      responseHeader: 'X-Request-Id',
    });
  }
  /**
   * Readiness check
   * Whether the store behind the process can take writes: the data directory exists, a scratch file can be created and removed in it, and the advisory lock writes serialise on can be taken. A lock another replica holds right now is not a failing check — the store is busy, not broken — so readiness stays `200` while `/diagnostics` reports `lockHeld`. Answers `503` with the error envelope when any check fails, naming the failing check and no path.
   * @returns ReadyResponse The store is ready
   * @throws ApiError
   */
  public getReady(): CancelablePromise<ReadyResponse> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/ready',
      errors: {
        503: `\`not_ready\`: the store behind a live process cannot take writes — the data directory is missing, is not writable, or its advisory lock cannot be taken. The message names which of the three failed and never a path, a raw filesystem error or any stored content. Only \`GET /ready\` answers this; \`GET /diagnostics\` reports the same probe as \`200\`.`,
      },
    });
  }
  /**
   * Storage diagnostics
   * The readiness checks reported individually, so a deployment that answers `503` says which one failed, plus whether the lock is held at this moment and the newest write the store can see. Always `200`, even when the store is not ready: that state is the report, not an error. The data directory is deliberately never named, and no filesystem error and no stored content is quoted, per the storage-security rule that keeps deployment layout and raw errors out of responses.
   * @returns StorageDiagnostics Storage probe
   * @throws ApiError
   */
  public getDiagnostics(): CancelablePromise<StorageDiagnostics> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/diagnostics',
    });
  }
}
