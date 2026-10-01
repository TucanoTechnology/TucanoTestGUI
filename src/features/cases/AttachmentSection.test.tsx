import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AttachmentSection } from "./AttachmentSection";

const attachment = {
  filename: "1-proof.png",
  originalName: "proof.png",
  mimeType: "image/png",
  size: 5,
};

function transfer(files: File[]) {
  return { files, types: ["Files"], dropEffect: "" };
}

describe("AttachmentSection drag and drop (#187)", () => {
  it("uploads a dropped file through the picker's own path", async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    render(
      <AttachmentSection
        scope="the case"
        attachments={[attachment]}
        onUpload={onUpload}
        onDelete={vi.fn()}
      />,
    );

    const zone = document.querySelector(".file-dropzone")!;
    fireEvent.drop(zone, {
      dataTransfer: transfer([new File(["bytes"], "shot.png")]),
    });

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledWith(
        expect.objectContaining({ name: "shot.png" }),
      );
    });
  });

  it("walks a multi-file drop sequentially and never cancels on one file", async () => {
    const order: string[] = [];
    const onUpload = vi
      .fn()
      .mockImplementationOnce(async (file: File) => {
        order.push(file.name);
        throw new Error("first refused");
      })
      .mockImplementationOnce(async (file: File) => {
        order.push(file.name);
      });
    render(
      <AttachmentSection
        scope="the case"
        attachments={[]}
        onUpload={onUpload}
        onDelete={vi.fn()}
      />,
    );

    const zone = document.querySelector(".file-dropzone")!;
    fireEvent.drop(zone, {
      dataTransfer: transfer([
        new File(["a"], "a.png"),
        new File(["b"], "b.png"),
      ]),
    });

    // The first upload fails; the second still runs, and the failure is the
    // section's shared error notice, not a silent drop.
    await waitFor(() => expect(order).toEqual(["a.png", "b.png"]));
    // The section unlocks when the walk is over: the picker is enabled again.
    await waitFor(() => {
      expect(
        document.querySelector<HTMLInputElement>("input[type=file]"),
      ).toBeEnabled();
    });
  });

  it("refuses a drop while an upload is locked by the caller", async () => {
    const onUpload = vi.fn();
    render(
      <AttachmentSection
        scope="the case"
        attachments={[]}
        busy
        onUpload={onUpload}
        onDelete={vi.fn()}
      />,
    );

    const zone = document.querySelector(".file-dropzone")!;
    fireEvent.drop(zone, {
      dataTransfer: transfer([new File(["a"], "a.png")]),
    });
    expect(onUpload).not.toHaveBeenCalled();
  });
});
