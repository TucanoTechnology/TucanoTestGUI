import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  apiErrorEnvelope,
  createApiClient,
  resolveApiBaseUrl,
  type ApiErrorEnvelope,
} from '../../api/configure';
import type { Attachment } from '../../api/generated';

/**
 * Attachments (evidence) for one test case — issue #75.
 *
 * The API owns the list: nothing is cached here, and every upload or delete is
 * followed by a re-read of `GET /test_cases/{id}`, so what is rendered is what
 * the API reports. Upload and delete go through the generated client.
 *
 * Opening an attachment is a same-origin link to the API route, so the browser
 * streams the bytes itself. `downloadTestCaseAttachment` is declared `Blob`,
 * but the generated core reads an `application/octet-stream` answer with
 * `response.text()` and never calls `response.blob()` (see
 * `src/api/generated/core/request.ts`), so a download through it would corrupt
 * the evidence. Same-origin is also what nginx proxies and what the legacy
 * `getAttachmentUrl` did.
 */

/** Wording for a failure that carried no envelope (transport, or the plain-text 413). */
const API_UNREACHABLE = 'the API could not be reached.';

type PanelState = 'loading' | 'ready' | 'error';

/** Renders a byte count the API reported in the unit a tester reads. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The API route that serves one attachment, as the contract publishes it. */
export function attachmentUrl(testCaseId: string, filename: string): string {
  const base = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
  return `${base}/test_cases/${encodeURIComponent(testCaseId)}/attachments/${encodeURIComponent(filename)}`;
}

export interface AttachmentsPanelProps {
  testCaseId: string;
  /** The list last read from the API, so the owner can show its own count. */
  onAttachmentsChanged?: (attachments: Attachment[]) => void;
}

export default function AttachmentsPanel({
  testCaseId,
  onAttachmentsChanged,
}: AttachmentsPanelProps) {
  const api = useMemo(() => createApiClient(), []);
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);

  const [state, setState] = useState<PanelState>('loading');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadFailure, setLoadFailure] = useState<ApiErrorEnvelope | null>(null);
  const [actionFailure, setActionFailure] = useState<ApiErrorEnvelope | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Attachment | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string | null>(null);

  const readAttachments = useCallback(async () => {
    const testCase = await api.testCases.getTestCase({ id: testCaseId });
    return testCase.attachments ?? [];
  }, [api, testCaseId]);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setLoadFailure(null);
    setPendingDelete(null);
    setPreviewFilename(null);

    void (async () => {
      try {
        const list = await readAttachments();
        if (cancelled) return;
        setAttachments(list);
        onAttachmentsChanged?.(list);
        setState('ready');
        setAnnouncement(
          list.length === 1 ? 'Loaded 1 attachment.' : `Loaded ${list.length} attachments.`,
        );
      } catch (error) {
        if (cancelled) return;
        const envelope = apiErrorEnvelope(error);
        setAttachments([]);
        setLoadFailure(envelope);
        setState('error');
        setAnnouncement(
          `Could not load the attachments: ${envelope?.message ?? API_UNREACHABLE}`,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [readAttachments, onAttachmentsChanged]);

  useEffect(() => {
    if (pendingDelete) {
      cancelDeleteRef.current?.focus();
    }
  }, [pendingDelete]);

  /** Re-reads the case, so the list always mirrors the API. */
  const refresh = async () => {
    const list = await readAttachments();
    setAttachments(list);
    onAttachmentsChanged?.(list);
    return list;
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    setActionFailure(null);
    setAnnouncement(`Uploading ${selectedFile.name}…`);
    try {
      const uploaded = await api.testCases.uploadTestCaseAttachment({
        id: testCaseId,
        formData: { file: selectedFile },
      });
      await refresh();
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setAnnouncement(`Uploaded ${uploaded.originalName} (${formatFileSize(uploaded.size)}).`);
    } catch (error) {
      const envelope = apiErrorEnvelope(error);
      setActionFailure(envelope);
      setAnnouncement(
        `Could not upload ${selectedFile.name}: ${envelope?.message ?? API_UNREACHABLE}`,
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const { filename, originalName } = pendingDelete;

    setIsDeleting(true);
    setActionFailure(null);
    try {
      await api.testCases.deleteTestCaseAttachment({ id: testCaseId, filename });
      await refresh();
      setPendingDelete(null);
      setPreviewFilename((current) => (current === filename ? null : current));
      setAnnouncement(`Deleted ${originalName}.`);
    } catch (error) {
      const envelope = apiErrorEnvelope(error);
      setActionFailure(envelope);
      setAnnouncement(`Could not delete ${originalName}: ${envelope?.message ?? API_UNREACHABLE}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const preview = attachments.find((attachment) => attachment.filename === previewFilename) ?? null;

  return (
    <div>
      <p className="status-bar-announcement" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      {state === 'loading' && <p className="module-state">Loading attachments…</p>}

      {state === 'error' && (
        <div className="module-error">
          <p>Could not load the attachments: {loadFailure?.message ?? API_UNREACHABLE}</p>
          <p className="module-error-code">
            Error code: {loadFailure?.code ?? 'network_error'}
          </p>
        </div>
      )}

      {state === 'ready' && (
        <div>
          {actionFailure && (
            <div className="module-error">
              <p>{actionFailure.message}</p>
              <p className="module-error-code">Error code: {actionFailure.code}</p>
            </div>
          )}

          <form className="attachment-upload" onSubmit={handleUpload}>
            <label htmlFor={fileInputId}>Attach a file</label>
            <input
              id={fileInputId}
              ref={fileInputRef}
              type="file"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />
            <button type="submit" className="btn" disabled={!selectedFile || isUploading}>
              {isUploading ? 'Uploading…' : 'Upload attachment'}
            </button>
          </form>

          {preview && (
            <figure className="attachment-preview">
              <figcaption className="attachment-name">Preview: {preview.originalName}</figcaption>
              {preview.mimeType.startsWith('image/') ? (
                <img
                  className="attachment-image"
                  src={attachmentUrl(testCaseId, preview.filename)}
                  alt={`Attachment preview: ${preview.originalName}`}
                />
              ) : (
                <p className="module-state">
                  {preview.mimeType} has no inline preview. Save it to open it.
                </p>
              )}
              <a
                className="btn-secondary"
                href={attachmentUrl(testCaseId, preview.filename)}
                download={preview.originalName}
                aria-label={`Save ${preview.originalName}`}
              >
                Save
              </a>
            </figure>
          )}

          {attachments.length === 0 ? (
            <p className="module-state">No attachments on this test case yet.</p>
          ) : (
            <ul className="attachment-list">
              {attachments.map((attachment) => {
                const isPreviewing = previewFilename === attachment.filename;
                return (
                  <li key={attachment.filename}>
                    <div className="attachment-item">
                      <div>
                        <span className="attachment-name">{attachment.originalName}</span>
                        <span className="attachment-meta">
                          <span>{formatFileSize(attachment.size)}</span>
                          <span>{attachment.mimeType}</span>
                          {attachment.uploadedAt && (
                            <time dateTime={attachment.uploadedAt}>{attachment.uploadedAt}</time>
                          )}
                        </span>
                      </div>
                      <div className="attachment-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          aria-expanded={isPreviewing}
                          aria-label={`Preview ${attachment.originalName}`}
                          onClick={() =>
                            setPreviewFilename(isPreviewing ? null : attachment.filename)
                          }
                        >
                          Preview
                        </button>
                        <a
                          className="btn-secondary"
                          href={attachmentUrl(testCaseId, attachment.filename)}
                          download={attachment.originalName}
                          aria-label={`Save ${attachment.originalName}`}
                        >
                          Save
                        </a>
                        <button
                          type="button"
                          className="btn-danger"
                          aria-label={`Delete ${attachment.originalName}`}
                          onClick={() => setPendingDelete(attachment)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {pendingDelete?.filename === attachment.filename && (
                      <div className="delete-confirm" role="group">
                        <p>Delete {attachment.originalName}? This cannot be undone.</p>
                        <div>
                          <button
                            type="button"
                            className="btn-secondary"
                            ref={cancelDeleteRef}
                            onClick={() => setPendingDelete(null)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn-danger"
                            disabled={isDeleting}
                            onClick={() => void handleConfirmDelete()}
                          >
                            Confirm delete
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
