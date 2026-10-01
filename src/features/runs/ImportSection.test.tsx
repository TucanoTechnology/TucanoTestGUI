import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImportSection } from "./ImportSection";

const SUMMARY = {
  imported: 2,
  skipped: 1,
  errors: 0,
  duplicates: 1,
  summary: { passed: 2, failed: 0, blocked: 0 },
};

function transfer(files: File[]) {
  return { files, types: ["Files"], dropEffect: "" };
}

describe("ImportSection drag and drop (#186)", () => {
  it("drops a JSON report into the same import path the picker uses", async () => {
    const onImport = vi.fn().mockResolvedValue(SUMMARY);
    render(<ImportSection onImport={onImport} />);

    const zones = document.querySelectorAll(".file-dropzone");
    expect(zones).toHaveLength(2); // json first, junit second

    fireEvent.drop(zones[0]!, {
      dataTransfer: transfer([
        new File(
          ['[{"testCaseId":"TC-1","status":"Passed"}]'],
          "results.json",
          { type: "application/json" },
        ),
      ]),
    });

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith({
        format: "json",
        body: [{ testCaseId: "TC-1", status: "Passed" }],
      });
    });
    expect(
      await screen.findByText(/Imported from results\.json/),
    ).toBeInTheDocument();
  });

  it("routes a drop on the JUnit zone to the JUnit format", async () => {
    const onImport = vi.fn().mockResolvedValue(SUMMARY);
    render(<ImportSection onImport={onImport} />);

    const zones = document.querySelectorAll(".file-dropzone");
    fireEvent.drop(zones[1]!, {
      dataTransfer: transfer([
        new File(["<testsuites/>"], "ci.xml", { type: "application/xml" }),
      ]),
    });

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith({
        format: "junit",
        body: "<testsuites/>",
      });
    });
  });

  it("renders the file's own validation error, dropped or not", async () => {
    const onImport = vi.fn();
    render(<ImportSection onImport={onImport} />);

    const zones = document.querySelectorAll(".file-dropzone");
    fireEvent.drop(zones[0]!, {
      dataTransfer: transfer([new File(["not json"], "broken.json")]),
    });

    expect(
      await screen.findByText("The file is not valid JSON."),
    ).toBeInTheDocument();
    expect(onImport).not.toHaveBeenCalled();
  });

  it("refuses drops while locked", async () => {
    const onImport = vi.fn();
    render(<ImportSection onImport={onImport} busy />);

    const zones = document.querySelectorAll(".file-dropzone");
    fireEvent.drop(zones[0]!, {
      dataTransfer: transfer([new File(["[]"], "ok.json")]),
    });
    expect(onImport).not.toHaveBeenCalled();
  });
});
