export interface ApiErrorInfo {
  code: string | null;
  message: string;
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

/**
 * Read the API error envelope (`{ error: { code, message } }`) an `ApiError`
 * carries in its `body`. Falls back to a plain-text body (the router's 413 is
 * never an envelope) and then to the caller's message.
 */
export function readApiError(error: unknown, fallback: string): ApiErrorInfo {
  const body = (error as { body?: unknown } | null)?.body;

  if (body && typeof body === "object") {
    const envelope = body as ErrorEnvelope;
    const message = envelope.error?.message;
    if (typeof message === "string" && message.length > 0) {
      return { code: envelope.error?.code ?? null, message };
    }
  }

  if (typeof body === "string" && body.trim().length > 0) {
    return { code: null, message: body };
  }

  return { code: null, message: fallback };
}
