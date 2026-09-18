import { describe, expect, it } from "vitest";
import type { TestConfiguration } from "../../api/generated/index.js";
import type { ConfigurationFormValues } from "./ConfigurationForm.js";
import {
  buildConfigurationCreateRequest,
  buildConfigurationUpdateRequest,
} from "./configurationRequests.js";

const CONFIG: TestConfiguration = {
  configId: "chrome-desktop.json",
  name: "Chrome on desktop",
  browser: "Chrome 140",
  os: "Windows 11",
  device: "Desktop",
  resolution: "1920x1080",
};

/** The form as it opens on `CONFIG`, so an untouched field reads unchanged. */
const STORED_VALUES: ConfigurationFormValues = {
  name: "Chrome on desktop",
  browser: "Chrome 140",
  os: "Windows 11",
  device: "Desktop",
  resolution: "1920x1080",
};

/** The create form as it opens: nothing typed. */
const EMPTY_VALUES: ConfigurationFormValues = {
  name: "",
  browser: "",
  os: "",
  device: "",
  resolution: "",
};

function values(overrides: Partial<ConfigurationFormValues> = {}) {
  return { ...STORED_VALUES, ...overrides };
}

function createValues(overrides: Partial<ConfigurationFormValues> = {}) {
  return { ...EMPTY_VALUES, ...overrides };
}

describe("buildConfigurationCreateRequest", () => {
  it("sends the name and every field that was filled in", () => {
    const request = buildConfigurationCreateRequest(
      createValues({
        name: "Firefox on mobile",
        browser: "Firefox 141",
        os: "Android 16",
        device: "Phone",
        resolution: "1080x2400",
      }),
    );

    expect(JSON.parse(JSON.stringify(request))).toEqual({
      name: "Firefox on mobile",
      browser: "Firefox 141",
      os: "Android 16",
      device: "Phone",
      resolution: "1080x2400",
    });
  });

  it("omits every blank optional instead of sending an empty string", () => {
    const request = buildConfigurationCreateRequest(
      createValues({ name: "Ad hoc" }),
    );

    // The API rejects an unknown field and stores a supplied empty string, so
    // only the fields that were set survive the wire.
    expect(JSON.parse(JSON.stringify(request))).toEqual({ name: "Ad hoc" });
  });

  it("never sends an identifier, which would not name the resource", () => {
    const request = buildConfigurationCreateRequest(
      createValues({ name: "Ad hoc" }),
    );

    expect("configId" in request).toBe(false);
  });
});

describe("buildConfigurationUpdateRequest", () => {
  it("sends nothing when no field changed", () => {
    expect(buildConfigurationUpdateRequest(CONFIG, values())).toEqual({});
  });

  it("sends only the fields that differ", () => {
    expect(
      buildConfigurationUpdateRequest(CONFIG, values({ browser: "Chrome 141" })),
    ).toEqual({ browser: "Chrome 141" });
    expect(
      buildConfigurationUpdateRequest(CONFIG, values({ resolution: "2560x1440" })),
    ).toEqual({ resolution: "2560x1440" });
  });

  it("clears a field the user emptied with an empty string", () => {
    expect(
      buildConfigurationUpdateRequest(
        CONFIG,
        values({ browser: "", os: "", device: "", resolution: "" }),
      ),
    ).toEqual({ browser: "", os: "", device: "", resolution: "" });
  });

  it("treats a field the document does not carry as empty", () => {
    const config: TestConfiguration = { configId: "bare", name: "Bare" };

    expect(
      buildConfigurationUpdateRequest(
        config,
        createValues({ name: "Bare" }),
      ),
    ).toEqual({});
  });

  it("never sends the identifier, which would not move the configuration", () => {
    const config: TestConfiguration = {
      ...CONFIG,
      configId: "another.json",
    };
    const request = buildConfigurationUpdateRequest(
      CONFIG,
      createValues({
        name: "Chrome on desktop",
        browser: "Chrome 140",
        os: "Windows 11",
        device: "Desktop",
        resolution: "1920x1080",
      }),
    );

    // Even a document id that differs from the stored one changes nothing: the
    // builder compares only the fields the form owns.
    expect(request).toEqual({});
    expect("configId" in buildConfigurationUpdateRequest(config, values())).toBe(
      false,
    );
  });
});
