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
      errors: {
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
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
      errors: {
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
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
      errors: {
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * Request counters
   * What the deployment has served since the process started, in the Prometheus text exposition format (`text/plain; version=0.0.4`): one counter per HTTP method, matched route and response status class, plus a counter for requests no route answered. The counters belong to the process that renders them — a deployment with several replicas scrapes each — and no label names a caller, a project or an identifier, so a series never carries stored content. It is unguarded for the same reason `/health` is: the caller that has to ask how the process is doing is often the one that cannot authenticate.
   * @returns string Counters in the Prometheus text exposition format
   * @throws ApiError
   */
  public getMetrics(): CancelablePromise<string> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/metrics',
      errors: {
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
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
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
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
      errors: {
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
}
