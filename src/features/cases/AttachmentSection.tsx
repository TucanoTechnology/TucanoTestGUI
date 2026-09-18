import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import type { Attachment, StepAttachment } from "../../api/generated/index.js";
import { readApiError, type ApiErrorInfo } from "../../api/errors.js";
import { ApiErrorNotice } from "../../app/ApiErrorNotice.js";
import { Dialog } from "../../app/Dialog.js";

/** A case attachment and a step attachment carry the same four fields. */
export type AttachmentMeta = Attachment | StepAttachment;

export interface AttachmentSectionProps {
  /**
   * Names the surface these attachments belong to. A case detail holds one
   * section and every step holds its own, so the labels have to say which
   * attachment of which step a control acts on.
   */
  scope: string;
  attachments: AttachmentMeta[];
  busy?: boolean;
  /** Rejects with the API error, which this section renders. */
  onUpload: (file: File) => Promise<void>;
  onDelete: (filename: string) => Promise<void>;
  /**
   * Reads the stored bytes. Absent where the contract has no download route —
   * step attachments today — which leaves those rows without a preview as well.
   */
  onDownload?: (filename: string) => Promise<Blob>;
}

function describe(attachment: AttachmentMeta): string {
  return `${attachment.size} bytes · ${attachment.mimeType}`;
}

/**
 * The bytes of an attachment sit behind the bearer token, so a link cannot
 * point at them: the file is read first and handed to the browser as an object
 * URL. The URL outlives the click, so it is released on the next task.
 */
function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * The inline preview of an image attachment. The loader is read through a ref
 * so a caller that builds a fresh closure every render does not re-read the
 * file on every render.
 */
function AttachmentPreview({
  filename,
  load,
}: {
  filename: string;
  load: (filename: string) => Promise<Blob>;
}) {
  const loadRef = useRef(load);
  loadRef.current = load;
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;
    setUrl(null);
    setFailed(false);

    loadRef
      .current(filename)
      .then((blob) => {
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        setUrl(created);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [filename]);

  if (failed) {
    return <span className="attachment__preview-note">Preview unavailable</span>;
  }
  // The file name stands next to the image, so the image itself is decorative.
  return url ? (
    <img className="attachment__preview" src={url} alt="" />
  ) : (
    <span className="attachment__preview-note">Loading preview…</span>
  );
}

/**
 * The attachments of one case or one step: the stored files, a picker that adds
 * one, and a confirmation before a delete. Requests and the re-fetch that
 * follows them belong to the caller; this section owns their progress and the
 * error the API answered with.
 */
export function AttachmentSection({
  scope,
  attachments,
  busy = false,
  onUpload,
  onDelete,
  onDownload,
}: AttachmentSectionProps) {
  const fieldId = useId();
  const pickerId = `${fieldId}-picker`;
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [working, setWorking] = useState(false);
  const [deleting, setDeleting] = useState<AttachmentMeta | null>(null);

  const locked = busy || working;

  const upload = async (file: File) => {
    setWorking(true);
    setError(null);
    try {
      await onUpload(file);
    } catch (err: unknown) {
      setError(readApiError(err, "Failed to upload attachment"));
    } finally {
      setWorking(false);
    }
  };

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clearing the picker lets the same file be chosen again after a failure.
    event.target.value = "";
    if (!file) return;
    void upload(file);
  };

  const download = async (attachment: AttachmentMeta) => {
    if (!onDownload) return;
    setWorking(true);
    setError(null);
    try {
      save(await onDownload(attachment.filename), attachment.originalName);
    } catch (err: unknown) {
      setError(readApiError(err, "Failed to download attachment"));
    } finally {
      setWorking(false);
    }
  };

  const confirmDelete = async () => {
    const attachment = deleting;
    if (!attachment) return;
    setWorking(true);
    setError(null);
    try {
      await onDelete(attachment.filename);
      setDeleting(null);
    } catch (err: unknown) {
      setError(readApiError(err, "Failed to delete attachment"));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="attachment-section">
      <div className="detail-field__label">
        Attachments ({attachments.length})
      </div>

      {error && deleting === null && <ApiErrorNotice error={error} />}

      {attachments.length === 0 ? (
        <p className="attachment-section__empty">No attachments.</p>
      ) : (
        <ul className="entity-list">
          {attachments.map((attachment) => (
            <li key={attachment.filename} className="entity-list__item">
              <span className="entity-list__name">
                {attachment.originalName}
              </span>
              <span className="entity-list__meta">{describe(attachment)}</span>

              {onDownload &&
                (attachment.mimeType.startsWith("image/") ? (
                  <AttachmentPreview
                    filename={attachment.filename}
                    load={onDownload}
                  />
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => void download(attachment)}
                    disabled={locked}
                    aria-label={`Download ${attachment.originalName}`}
                  >
                    Download
                  </button>
                ))}

              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => {
                  setError(null);
                  setDeleting(attachment);
                }}
                disabled={locked}
                aria-label={`Delete ${attachment.originalName} from ${scope}`}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="form-field">
        <label htmlFor={pickerId}>Upload attachment to {scope}</label>
        <input
          id={pickerId}
          type="file"
          onChange={pick}
          disabled={locked}
        />
      </div>

      {deleting && (
        <Dialog title="Delete attachment" onClose={() => setDeleting(null)}>
          <p className="dialog__body">
            Delete “{deleting.originalName}” from {scope}? The stored file is
            removed with it. This cannot be undone.
          </p>

          {error && <ApiErrorNotice error={error} />}

          <div className="dialog__actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setDeleting(null)}
              disabled={locked}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => void confirmDelete()}
              disabled={locked}
            >
              {working ? "Deleting…" : "Delete attachment"}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
