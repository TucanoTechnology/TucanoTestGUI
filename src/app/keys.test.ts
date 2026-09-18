import { describe, expect, it } from "vitest";
import { isJsonKeyName, toJsonKey } from "./keys.js";

describe("toJsonKey", () => {
  it("appends the suffix a key is expected to carry", () => {
    expect(toJsonKey("checkout")).toBe("checkout.json");
  });

  it("leaves a key that already carries the suffix alone", () => {
    expect(toJsonKey("checkout.json")).toBe("checkout.json");
  });
});

describe("isJsonKeyName", () => {
  it("accepts the names the API can turn into a single path component", () => {
    expect(isJsonKeyName("checkout")).toBe(true);
    expect(isJsonKeyName("checkout flow")).toBe(true);
    expect(isJsonKeyName("checkout.json")).toBe(true);
  });

  it("refuses an empty name, which derives no key at all", () => {
    expect(isJsonKeyName("")).toBe(false);
  });

  it("refuses a name that would derive an id with a path separator", () => {
    expect(isJsonKeyName("team/checkout")).toBe(false);
    expect(isJsonKeyName("/checkout")).toBe(false);
    expect(isJsonKeyName("checkout/")).toBe(false);
  });
});
