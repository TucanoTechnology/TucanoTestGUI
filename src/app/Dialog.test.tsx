import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog.js";

function TwoButtonDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Delete case" onClose={onClose}>
      <button type="button">Cancel</button>
      <button type="button">Delete</button>
    </Dialog>
  );
}

/**
 * The shape the bug was reported in: unlinking the last defect of a run result
 * removes the button that was activated, and with it the element holding focus.
 */
function ResultEditor({ onClose }: { onClose: () => void }) {
  const [defects, setDefects] = useState(["DEF-1"]);
  return (
    <Dialog title="Edit result" onClose={onClose}>
      <button type="button">Cancel</button>
      {defects.map((defect) => (
        <button key={defect} type="button" onClick={() => setDefects([])}>
          Unlink {defect}
        </button>
      ))}
    </Dialog>
  );
}

function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open result
      </button>
      {open && (
        <ResultEditor
          onClose={() => {
            setOpen(false);
            onClose();
          }}
        />
      )}
    </div>
  );
}

/** Opens the dialog the way a keyboard user does: the opener holds focus. */
function openResultEditor(onClose: () => void) {
  render(<Harness onClose={onClose} />);
  const opener = screen.getByRole("button", { name: "Open result" });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

/** Unlinks the last defect, removing the button that was activated. */
function unlinkLastDefect() {
  const unlink = screen.getByRole("button", { name: "Unlink DEF-1" });
  unlink.focus();
  fireEvent.click(unlink);
  return waitFor(() =>
    expect(screen.queryByRole("button", { name: "Unlink DEF-1" })).toBeNull(),
  );
}

describe("Dialog", () => {
  it("closes on Escape while focus is inside, returning focus to the opener", async () => {
    const onClose = vi.fn();
    const opener = openResultEditor(onClose);

    fireEvent.keyDown(screen.getByRole("button", { name: "Cancel" }), {
      key: "Escape",
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("keeps Tab inside the dialog by wrapping at both edges", () => {
    render(<TwoButtonDialog onClose={() => {}} />);
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const remove = screen.getByRole("button", { name: "Delete" });

    cancel.focus();
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(remove).toHaveFocus();

    fireEvent.keyDown(remove, { key: "Tab" });
    expect(cancel).toHaveFocus();
  });

  it("closes on Escape and returns focus to the opener after an action unmounted the focused control", async () => {
    const onClose = vi.fn();
    const opener = openResultEditor(onClose);
    await unlinkLastDefect();

    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("keeps Tab inside after an action unmounted the focused control", async () => {
    openResultEditor(() => {});
    await unlinkLastDefect();
    const dialog = screen.getByRole("dialog");

    fireEvent.keyDown(document.body, { key: "Tab" });

    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it("re-anchors focus inside the dialog when the focused control goes away", async () => {
    const opener = openResultEditor(() => {});

    await unlinkLastDefect();

    const dialog = screen.getByRole("dialog");
    await waitFor(() =>
      expect(dialog).toContainElement(document.activeElement as HTMLElement),
    );
    expect(opener).not.toHaveFocus();
  });

  it("has no accessibility violations while open", async () => {
    const { baseElement } = render(<TwoButtonDialog onClose={() => {}} />);

    const { default: axe } = await import("axe-core");
    const results = await axe.run(baseElement, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
