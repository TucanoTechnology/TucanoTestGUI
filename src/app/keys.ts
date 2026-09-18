/**
 * A project, suite, run or configuration key is its name with `.json` appended,
 * and the API refuses a bare one with an opaque `invalid_request`. Ids typed by
 * hand are completed here so the friendly path cannot produce that refusal.
 */
export function toJsonKey(value: string): string {
  return value.endsWith(".json") ? value : `${value}.json`;
}
