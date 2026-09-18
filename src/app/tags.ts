/**
 * The comma-separated fields the API stores as tag arrays. Blank entries and
 * repeats are dropped, so a field reads back the way it was typed instead of
 * returning entries nobody meant to write.
 */
export function parseTags(value: string): string[] {
  return [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))];
}
