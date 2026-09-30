import { describe, expect, it } from "vitest";
import { formatTimestamp } from "./format.js";

describe("formatTimestamp", () => {
  it("reads epoch seconds, the form a stored run timestamp takes", () => {
    const formatted = formatTimestamp("1757800000");
    expect(formatted).not.toBe("1757800000");
    expect(formatted).toMatch(/\d{4}/);
  });

  it("reads epoch milliseconds", () => {
    expect(formatTimestamp("1757800000000")).toBe(formatTimestamp("1757800000"));
  });

  it("reads an ISO string, the form a case lastModified takes", () => {
    expect(formatTimestamp("2026-09-17T10:00:00Z")).not.toBe(
      "2026-09-17T10:00:00Z",
    );
  });

  it("returns an unparseable value untouched rather than Invalid Date", () => {
    expect(formatTimestamp("last night")).toBe("last night");
    expect(formatTimestamp("")).toBe("—");
    expect(formatTimestamp(undefined)).toBe("—");
  });

  it("accepts a numeric epoch as the API may store one", () => {
    expect(formatTimestamp(1757800000)).toBe(formatTimestamp("1757800000"));
  });
});
