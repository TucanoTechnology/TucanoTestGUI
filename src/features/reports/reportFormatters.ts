/**
 * The summary report carries counts as bare numbers — milliseconds and a
 * percentage — so the view formats them for reading rather than showing them
 * as they arrive.
 */

/** A duration in the largest unit that keeps it to one decimal place. */
export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0 ms";
  if (ms < 1000) return `${Math.round(ms)} ms`;

  // Rounded to the decimal place it is shown at before the unit is chosen, so
  // a duration that rounds up to a whole minute reads as one.
  const seconds = Math.round(ms / 100) / 10;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;

  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds - minutes * 60);
  // Rounding the remainder up can carry a full minute, which reads as the next
  // one rather than as `1 min 60 s`.
  if (remainder === 60) return `${minutes + 1} min`;
  return remainder === 0 ? `${minutes} min` : `${minutes} min ${remainder} s`;
}

/** A pass rate the API reports as a percentage, to one decimal place. */
export function formatPercentage(value: number): string {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(1)}%`;
}
