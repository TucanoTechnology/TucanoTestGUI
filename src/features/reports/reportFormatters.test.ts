import { describe, expect, it } from "vitest";
import { formatDurationMs, formatPercentage } from "./reportFormatters.js";

describe("formatDurationMs", () => {
  it("keeps a sub-second duration in milliseconds", () => {
    expect(formatDurationMs(0)).toBe("0 ms");
    expect(formatDurationMs(420)).toBe("420 ms");
    expect(formatDurationMs(999)).toBe("999 ms");
  });

  it("reads a duration under a minute in seconds to one decimal place", () => {
    expect(formatDurationMs(1000)).toBe("1.0 s");
    expect(formatDurationMs(2000)).toBe("2.0 s");
    expect(formatDurationMs(59_400)).toBe("59.4 s");
  });

  it("splits minutes and seconds once the duration passes a minute", () => {
    expect(formatDurationMs(60_000)).toBe("1 min");
    expect(formatDurationMs(90_000)).toBe("1 min 30 s");
    expect(formatDurationMs(125_000)).toBe("2 min 5 s");
  });

  it("reads a duration that rounds up to a whole minute as that minute", () => {
    expect(formatDurationMs(59_980)).toBe("1 min");
    expect(formatDurationMs(119_800)).toBe("2 min");
  });

  it("reads a duration it cannot use as zero", () => {
    expect(formatDurationMs(-1)).toBe("0 ms");
    expect(formatDurationMs(Number.NaN)).toBe("0 ms");
    expect(formatDurationMs(Number.POSITIVE_INFINITY)).toBe("0 ms");
  });
});

describe("formatPercentage", () => {
  it("reads a percentage to one decimal place", () => {
    expect(formatPercentage(33.33333333333333)).toBe("33.3%");
    expect(formatPercentage(0)).toBe("0.0%");
    expect(formatPercentage(100)).toBe("100.0%");
  });

  it("reads a percentage it cannot use as zero", () => {
    expect(formatPercentage(Number.NaN)).toBe("0.0%");
    expect(formatPercentage(Number.NEGATIVE_INFINITY)).toBe("0.0%");
  });
});
