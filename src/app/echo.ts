import type { MessageResponse, TestCaseResult } from "../api/generated/index.js";

/**
 * The stored-document echo the write routes carry (TucanoTestAPI#459).
 *
 * A document `PUT` answers `{message, document}` and a result record answers
 * `{message, result}`. When either is present the caller paints it straight
 * back and skips the re-read that used to be the only way to learn the
 * server-managed fields; when it is absent — a deployment older than the
 * echo — the caller falls back to reading, so the GUI works against both.
 */
export function echoedDocument<T>(response: MessageResponse): T | null {
  return response.document === undefined
    ? null
    : (response.document as unknown as T);
}

export function echoedResult(
  response: MessageResponse,
): TestCaseResult | null {
  return response.result ?? null;
}
