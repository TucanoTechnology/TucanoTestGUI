import {
  useCallback,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";

interface FileDropZoneProps {
  /**
   * Called once per accepted drop with every file the browser listed, in
   * order. What the component does with them — upload, import, one at a time
   * or in sequence — is the same thing the wrapped picker's own change path
   * does; a drop is never a second code path, only a second way in.
   */
  onFiles: (files: File[]) => void;
  /** A locked section refuses drops exactly as it disables its picker. */
  disabled?: boolean;
  hint?: string;
  children: ReactNode;
}

/** A drop is only a file drop when the drag says so: text selections and
 *  dragged links carry no `Files` type and are ignored, not announced. */
function carriesFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

/**
 * The drag-and-drop half of the upload UX (#186, #187): wraps a picker and
 * feeds dropped files to the caller's existing path.
 *
 * The guards are the ones the browser makes necessary. `dragenter` and
 * `dragleave` fire for every descendant element, so a naive leave handler
 * flickers the active state off while the pointer is still inside the zone —
 * the counter below pairs them and only clears at depth zero. The active
 * state is a border and a tint, and both are theme tokens, so the zone is
 * legible in whatever palette the page wears.
 */
export function FileDropZone({
  onFiles,
  disabled = false,
  hint = "Drag and drop a file here, or choose one above.",
  children,
}: FileDropZoneProps) {
  const depth = useRef(0);
  const [active, setActive] = useState(false);

  const onDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (disabled || !carriesFiles(event)) return;
      event.preventDefault();
      depth.current += 1;
      setActive(true);
    },
    [disabled],
  );

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (disabled || !carriesFiles(event)) return;
    // Only a preventDefault on dragover makes the browser allow the drop.
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  };

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (disabled || !carriesFiles(event)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setActive(false);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (disabled || !carriesFiles(event)) return;
    event.preventDefault();
    depth.current = 0;
    setActive(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length > 0) onFiles(files);
  };

  return (
    <div
      className={
        active ? "file-dropzone file-dropzone--active" : "file-dropzone"
      }
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}
      <p className="file-dropzone__hint">{hint}</p>
    </div>
  );
}
