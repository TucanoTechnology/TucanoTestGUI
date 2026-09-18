import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AuthProvider } from "../../app/AuthProvider.js";
import { ProjectProvider, useProjectContext } from "../../app/ProjectContext.js";
import {
  errorEnvelope,
  jsonResponse,
  mockApi,
  resetTestApi,
  type RequestHandler,
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

function DetailProbe() {
  const { selection, announcement } = useProjectContext();
  return (
    <>
      <span data-testid="selection">
        {selection ? `${selection.type}:${selection.id}` : "none"}
      </span>
      <span data-testid="announcement">{announcement?.message ?? ""}</span>
    </>
  );
}

function renderDetail(configId = "chrome-desktop") {
  return render(
    <AuthProvider>
      <ProjectProvider>
        <nav aria-label="Configuration detail probe">
          <ConfigurationDetail configId={configId} projectId="checkout" />
          <DetailProbe />
        </nav>
      </ProjectProvider>
    </AuthProvider>,
  );
}

/** The reads a configuration detail makes. */
function detailHandler(
  overrides: Record<string, (body: unknown) => Response> = {},
): RequestHandler {
  return ({ url, method, body }) => {
    const key = `${method} ${url}`;
    const override = overrides[key];
    if (override) return override(body);
    if (key === "GET /api/configurations/chrome-desktop") {
      return jsonResponse(200, CONFIG);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };
}

afterEach(() => {
  resetTestApi();
});

describe("ConfigurationDetail", () => {
  it("renders the configuration document", async () => {
    const requests = mockApi(detailHandler());

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

  it("names a stored document identifier that does not address the configuration", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/configurations/chrome-desktop" && method === "GET") {
        return jsonResponse(200, { ...CONFIG, configId: "chrome-OTHER.json" });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderDetail();

    await screen.findByRole("heading", { name: "Chrome on desktop" });
    // The key the project lists it under is what addresses it; a document
    // identifier that differs resolves to nothing, so the panel says so.
    expect(screen.getByText("Config ID: chrome-desktop")).toBeInTheDocument();
    expect(screen.getByText(/chrome-OTHER\.json/)).toBeInTheDocument();
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

  it("sends only the changed field and reads the document again after an edit", async () => {
    const requests = mockApi(
      detailHandler({
        "PUT /api/configurations/chrome-desktop": () =>
          jsonResponse(200, { message: "Resource updated" }),
      }),
    );

    renderDetail();
    await screen.findByRole("heading", { name: "Chrome on desktop" });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const form = await screen.findByRole("form", { name: "Save changes form" });
    // The stored fields open already filled in.
    expect(within(form).getByLabelText("Browser")).toHaveValue("Chrome 140");

    fireEvent.change(within(form).getByLabelText("Browser"), {
      target: { value: "Chrome 141" },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.queryByRole("form", { name: "Save changes form" }),
      ).not.toBeInTheDocument();
    });

    const puts = requests.filter((request) => request.method === "PUT");
    expect(puts).toHaveLength(1);
    expect(puts[0]?.url).toBe("/api/configurations/chrome-desktop");
    // An unchanged field is left out, and the identifier is never sent: the API
    // stores it without moving the configuration.
    expect(puts[0]?.body).toEqual({ browser: "Chrome 141" });
    expect(await screen.findByTestId("announcement")).toHaveTextContent(
      "Resource updated",
    );
    expect(
      requests.filter(
        (request) =>
          request.method === "GET" &&
          request.url === "/api/configurations/chrome-desktop",
      ),
    ).toHaveLength(2);
  });

  it("sends nothing when an edit changes no field", async () => {
    const requests = mockApi(detailHandler());

    renderDetail();
    await screen.findByRole("heading", { name: "Chrome on desktop" });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const form = await screen.findByRole("form", { name: "Save changes form" });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.queryByRole("form", { name: "Save changes form" }),
      ).not.toBeInTheDocument();
    });
    expect(requests.filter((request) => request.method === "PUT")).toEqual([]);
  });

  it("clears a field the user emptied", async () => {
    const requests = mockApi(
      detailHandler({
        "PUT /api/configurations/chrome-desktop": () =>
          jsonResponse(200, { message: "Resource updated" }),
      }),
    );

    renderDetail();
    await screen.findByRole("heading", { name: "Chrome on desktop" });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const form = await screen.findByRole("form", { name: "Save changes form" });
    fireEvent.change(within(form).getByLabelText("Device"), {
      target: { value: "" },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        requests.filter((request) => request.method === "PUT"),
      ).toHaveLength(1);
    });
    expect(requests.filter((r) => r.method === "PUT")[0]?.body).toEqual({
      device: "",
    });
  });

  it("keeps the edit form open and shows the envelope when the update is rejected", async () => {
    mockApi(
      detailHandler({
        "PUT /api/configurations/chrome-desktop": () =>
          errorEnvelope(400, "invalid_request", "Unknown field `bogus`"),
      }),
    );

    renderDetail();
    await screen.findByRole("heading", { name: "Chrome on desktop" });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const form = await screen.findByRole("form", { name: "Save changes form" });
    fireEvent.change(within(form).getByLabelText("Name"), {
      target: { value: "Renamed" },
    });
    fireEvent.submit(form);

    const alert = await within(form).findByRole("alert");
    expect(alert).toHaveTextContent("invalid_request");
    expect(alert).toHaveTextContent("Unknown field `bogus`");
    expect(
      screen.getByRole("form", { name: "Save changes form" }),
    ).toBeInTheDocument();
  });

  it("deletes the configuration through the project that owns it after a confirmation", async () => {
    const requests = mockApi(
      detailHandler({
        "DELETE /api/projects/checkout/configurations/chrome-desktop": () =>
          jsonResponse(200, { message: "Test configuration deleted" }),
      }),
    );

    renderDetail();
    await screen.findByRole("heading", { name: "Chrome on desktop" });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Delete configuration",
    });
    // The runs keep the copy they stored, so the confirmation says so.
    expect(dialog).toHaveTextContent("The runs that link it keep the copy");
    expect(requests.filter((request) => request.method === "DELETE")).toEqual(
      [],
    );

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete configuration" }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Delete configuration" }),
      ).not.toBeInTheDocument();
    });

    const deletes = requests.filter((request) => request.method === "DELETE");
    expect(deletes).toHaveLength(1);
    expect(deletes[0]?.url).toBe(
      "/api/projects/checkout/configurations/chrome-desktop",
    );
    expect(await screen.findByTestId("announcement")).toHaveTextContent(
      "Test configuration deleted",
    );
    expect(screen.getByTestId("selection")).toHaveTextContent("none");
  });

  it("keeps the confirmation open and shows the envelope when deletion is rejected", async () => {
    mockApi(
      detailHandler({
        "DELETE /api/projects/checkout/configurations/chrome-desktop": () =>
          errorEnvelope(403, "forbidden", "insufficient role"),
      }),
    );

    renderDetail();
    await screen.findByRole("heading", { name: "Chrome on desktop" });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Delete configuration",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete configuration" }),
    );

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("forbidden");
    expect(alert).toHaveTextContent("insufficient role");
    expect(
      screen.getByRole("dialog", { name: "Delete configuration" }),
    ).toBeInTheDocument();
  });
});
