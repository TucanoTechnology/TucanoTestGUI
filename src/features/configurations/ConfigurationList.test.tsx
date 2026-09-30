import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { jsonResponse, mockApi, resetTestApi } from "../../test-utils.js";
import { AuthProvider } from "../../app/AuthProvider.js";
import { ProjectProvider } from "../../app/ProjectContext.js";
import { ConfigurationList } from "./ConfigurationList.js";

// The document id differs from the listing key: the key is what addresses it.
const CONFIG = {
  configId: "chrome-linux-doc",
  name: "Chrome on Linux",
  browser: "Chrome",
  os: "Linux",
  device: "Desktop",
  resolution: "1920x1080",
};

function renderList(onSelect: (id: string) => void = () => {}) {
  return render(
    <AuthProvider>
      <ProjectProvider>
        <ConfigurationList
          projectId="checkout"
          selectedConfigId={null}
          onSelectConfiguration={onSelect}
        />
      </ProjectProvider>
    </AuthProvider>,
  );
}

function mockConfigsApi() {
  const requests = mockApi(({ url, method }) => {
    if (url === "/api/projects/checkout/configurations" && method === "GET") {
      return jsonResponse(200, ["chrome.json"]);
    }
    if (url === "/api/configurations/chrome.json" && method === "GET") {
      return jsonResponse(200, CONFIG);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  });
  return { requests };
}

afterEach(() => {
  resetTestApi();
});

describe("ConfigurationList", () => {
  it("lists the fields the spec asks for, addressed by the listing key", async () => {
    mockConfigsApi();
    renderList();

    await waitFor(() =>
      expect(screen.getAllByRole("row")).toHaveLength(2),
    );
    // The ID column shows the key the project lists it under, not the
    // document's own `configId`.
    expect(screen.getByText("chrome.json")).toBeInTheDocument();
    expect(screen.getByText("Chrome on Linux")).toBeInTheDocument();
    expect(screen.getByText("Chrome")).toBeInTheDocument();
    expect(screen.getByText("Linux")).toBeInTheDocument();
    expect(screen.getByText("Desktop")).toBeInTheDocument();
    expect(screen.getByText("1920x1080")).toBeInTheDocument();
  });

  it("selects by the listing key", async () => {
    mockConfigsApi();
    const picked: string[] = [];
    renderList((id) => picked.push(id));

    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(2));
    fireEvent.click(screen.getByText("Chrome on Linux"));
    expect(picked).toEqual(["chrome.json"]);
  });

  it("states the empty project and offers the create control", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout/configurations" && method === "GET") {
        return jsonResponse(200, []);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });
    renderList();

    expect(await screen.findByText("No configurations yet")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "+ New Configuration" }).length,
    ).toBeGreaterThan(0);
  });
});
