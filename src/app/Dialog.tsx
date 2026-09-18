import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Modal dialog: portalled to `body`, labelled by its title, traps Tab,
 * closes on Escape and restores focus to the element that opened it.
 *
 * Escape and Tab are answered from a listener on `document`, not from React's
 * `onKeyDown` on the panel, because an action inside the dialog can unmount the
 * control that held focus — unlinking a run result's last defect does — and the
 * keystroke then arrives from `body`, outside the subtree the panel renders.
 * The observer below is what keeps that short-lived gap from lasting: it moves
 * focus back inside, so the panel really is the only reachable part of the page
 * while `aria-modal` claims it is.
 */
export function Dialog({ title, onClose, children }: DialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  // The listener is installed once, so it reads the close callback through a
  // ref rather than closing over the first render's `onClose`.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;

    const focusableInside = () =>
      Array.from(node?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);

    const focusInside = (fromEnd = false) => {
      const focusable = focusableInside();
      const target = fromEnd ? focusable.at(-1) : focusable.at(0);
      if (target) target.focus();
      else node?.focus();
    };

    focusInside();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!node) return;
      // Nesting opens a dialog inside a dialog, and each of them listens on
      // `document`: only the topmost one answers, as the innermost used to.
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
      if (dialogs.at(-1) !== node) return;

      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = focusableInside();
      const first = focusable.at(0);
      const last = focusable.at(-1);
      if (!first || !last) return;

      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
        return;
      }
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (!node.contains(active)) {
        event.preventDefault();
        focusInside(event.shiftKey);
      }
    };

    const observer = new MutationObserver(() => {
      if (!node || !node.isConnected) return;
      if (node.contains(document.activeElement)) return;
      focusInside();
    });
    if (node) observer.observe(node, { childList: true, subtree: true });

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", handleKeyDown);
      if (opener) opener.focus();
    };
  }, []);

  return createPortal(
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId} className="dialog__title">
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
