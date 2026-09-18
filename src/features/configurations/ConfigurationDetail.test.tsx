import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AuthProvider } from "../../app/AuthProvider.js";
import {
  errorEnvelope,
  jsonResponse,
  mockApi,
  resetTestApi,
} from "../../test-utils.js";
import { ConfigurationDetail } from "./ConfigurationDetail.js";

const CONFIG = {
  configId: "chrome-desktop",
  name: "Chrome on desktop",
  browser: "Chrome 140",
  os: "Windows 11",
  device: "Desktop",
  resolution: "1920x1080",
};

function renderDetail(configId = "chrome-desktop") {
  return render(
    <AuthProvider>
      <nav aria-label="Configuration detail probe">
        <ConfigurationDetail configId={configId} projectId="checkout" />
      </nav>
    </AuthProvider>,
  );
}

afterEach(() => {
  resetTestApi();
});

describe("ConfigurationDetail", () => {
  it("renders the configuration document", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/configurations/chrome-desktop" && method === "GET") {
        return jsonResponse(200, CONFIG);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const { baseElement } = renderDetail();

    await screen.findByRole("heading", { name: "Chrome on desktop" });
    expect(screen.getByText("Config ID: chrome-desktop")).toBeInTheDocument();
    expect(screen.getByText("Chrome 140")).toBeInTheDocument();
    expect(screen.getByText("Windows 11")).toBeInTheDocument();
    expect(screen.getByText("Desktop")).toBeInTheDocument();
    expect(screen.getByText("1920x1080")).toBeInTheDocument();

    expect(requests.map((request) => request.url)).toEqual([
      "/api/configurations/chrome-desktop",
    ]);

    const { default: axe } = await import("axe-core");
    const results = await axe.run(baseElement, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("omits the optional fields a configuration does not carry", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/configurations/chrome-desktop" && method === "GET") {
        return jsonResponse(200, {
          configId: "chrome-desktop",
          name: "Chrome on desktop",
        });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderDetail();

    await screen.findByRole("heading", { name: "Chrome on desktop" });
    expect(screen.queryByText("Browser")).not.toBeInTheDocument();
    expect(screen.queryByText("Operating System")).not.toBeInTheDocument();
    expect(screen.queryByText("Device")).not.toBeInTheDocument();
    expect(screen.queryByText("Resolution")).not.toBeInTheDocument();
  });

  it("shows a loading status while the request is in flight", () => {
    mockApi(() => new Promise<Response>(() => {}));

    renderDetail();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("shows the API error envelope", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/configurations/chrome-desktop" && method === "GET") {
        return errorEnvelope(404, "not_found", "no such configuration");
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderDetail();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("not_found");
    expect(alert).toHaveTextContent("no such configuration");
  });
});
