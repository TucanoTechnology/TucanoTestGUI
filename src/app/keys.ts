/**
 * A project, suite, run or configuration key is its name with `.json` appended,
 * and the API refuses a bare one with an opaque `invalid_request`. Ids typed by
 * hand are completed here so the friendly path cannot produce that refusal.
 */
export function toJsonKey(value: string): string {
  return value.endsWith(".json") ? value : `${value}.json`;
}

/**
 * Whether the API can derive a key from `name`: it appends `.json`, and its
 * result has to be "a single path component ending in `.json`". The derivation
 * is asked of `toJsonKey` rather than restated, so a name this answers `false`
 * for is one `invalid_id` would be answered with.
 */
export function isJsonKeyName(name: string): boolean {
  const key = toJsonKey(name);
  return key !== ".json" && !key.includes("/");
}
