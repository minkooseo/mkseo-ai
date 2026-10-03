import { ModelClientError } from "../client/model-client-error.ts";
import {
  failure,
  requestCompletion,
  type RequestContext,
} from "../client/transport.ts";

export interface AttemptContext {
  /** Number of network requests started; e.g. 2. */
  attempts: number;
  /** Most recent HTTP status, or null before a response arrives. */
  status: number | null;
  /** Server-requested minimum retry delay; e.g. 1000 milliseconds. */
  retryAfterMs: number;
}

export async function generateWithRetry<T>(
  request: RequestContext,
  maxRetries: number,
  parse: (text: string, context: AttemptContext) => T,
): Promise<T> {
  if (!Number.isSafeInteger(maxRetries) || maxRetries < 0) {
    throw new ModelClientError("Retry limit must be non-negative", {
      code: "configuration",
      attempts: 0,
      status: null,
      cause: null,
    });
  }
  const context: AttemptContext = {
    attempts: 0,
    status: null,
    retryAfterMs: 0,
  };
  for (;;) {
    try {
      const text = await requestCompletion(request, context);
      return parse(text, context);
    } catch (cause) {
      const error =
        cause instanceof ModelClientError
          ? cause
          : failure(
              "internal",
              "Unexpected generation failure",
              cause,
              context,
            );
      if (!isRetryable(error) || context.attempts > maxRetries) throw error;
      await backoff(context);
    }
  }
}

function isRetryable(error: ModelClientError): boolean {
  return (
    error.code === "transport" ||
    error.code === "output" ||
    (error.code === "http" &&
      error.status !== null &&
      [408, 429, 500, 502, 503, 504].includes(error.status))
  );
}

async function backoff(context: AttemptContext): Promise<void> {
  const ceiling = Math.min(250 * 2 ** (context.attempts - 1), 2000);
  let remaining = Math.max(Math.random() * ceiling, context.retryAfterMs);
  // Long Retry-After values exceed the native timer's signed 32-bit limit.
  while (remaining > 0) {
    const chunk = Math.min(remaining, 2_147_483_647);
    await new Promise<void>((resolve) => setTimeout(resolve, chunk));
    remaining -= chunk;
  }
}
