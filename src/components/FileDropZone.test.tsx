import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileDropZone } from "./FileDropZone";

/** The `dataTransfer` the browser would carry for a real drag. */
function transfer(files: File[] = [], types: string[] = ["Files"]) {
  return { files, types, dropEffect: "" };
}

const aFile = new File(["bytes"], "proof.png", { type: "image/png" });

describe("FileDropZone (#186, #187)", () => {
  it("hands the dropped files to the caller", () => {
    const onFiles = vi.fn();
    render(
      <FileDropZone onFiles={onFiles}>
        <button type="button">picker</button>
      </FileDropZone>,
    );
    const zone = screen.getByText("picker").closest(".file-dropzone")!;

    fireEvent.drop(zone, { dataTransfer: transfer([aFile]) });
    expect(onFiles).toHaveBeenCalledWith([aFile]);
  });

  it("ignores a drag that carries no files", () => {
    const onFiles = vi.fn();
    render(
      <FileDropZone onFiles={onFiles}>
        <button type="button">picker</button>
      </FileDropZone>,
    );
    const zone = screen.getByText("picker").closest(".file-dropzone")!;

    fireEvent.dragOver(zone, { dataTransfer: transfer([], ["text/plain"]) });
    fireEvent.drop(zone, { dataTransfer: transfer([], ["text/plain"]) });
    expect(onFiles).not.toHaveBeenCalled();
    expect(zone.className).not.toContain("file-dropzone--active");
  });

  it("keeps the active state through nested enter/leave pairs", () => {
    render(
      <FileDropZone onFiles={vi.fn()}>
        <button type="button">picker</button>
      </FileDropZone>,
    );
    const inner = screen.getByRole("button", { name: "picker" });
    const zone = inner.closest(".file-dropzone")!;

    // The browser's real sequence over a child: enter the zone, enter the
    // child, and a LEAVE for the zone fires while the pointer is still
    // inside — a naive handler flickers off here. The counter keeps it on.
    fireEvent.dragEnter(zone, { dataTransfer: transfer() });
    fireEvent.dragEnter(inner, { dataTransfer: transfer() });
    fireEvent.dragLeave(zone, { dataTransfer: transfer() });
    expect(zone.className).toContain("file-dropzone--active");

    // Leaving the child for good returns to depth zero: now it clears.
    fireEvent.dragLeave(inner, { dataTransfer: transfer() });
    expect(zone.className).not.toContain("file-dropzone--active");
  });

  it("refuses drops while locked and still offers its hint", () => {
    const onFiles = vi.fn();
    render(
      <FileDropZone onFiles={onFiles} disabled>
        <button type="button">picker</button>
      </FileDropZone>,
    );
    const zone = screen.getByText("picker").closest(".file-dropzone")!;
    fireEvent.drop(zone, { dataTransfer: transfer([aFile]) });
    expect(onFiles).not.toHaveBeenCalled();
    expect(
      screen.getByText("Drag and drop a file here, or choose one above."),
    ).toBeInTheDocument();
  });
});
