import type { AttemptContext } from "../generation/retry.ts";
import { ModelClientError } from "./model-client-error.ts";

export interface FetchResponse {
  /** HTTP status; e.g. 200. */
  readonly status: number;
  /** Successful HTTP status flag; e.g. true for 200. */
  readonly ok: boolean;
  /** Response headers; e.g. Retry-After: 1. */
  readonly headers: { get(name: string): string | null };
  /** Byte stream, or null for an absent body. */
  readonly body: { cancel(): Promise<void> } | null;
  /** Read the response text; e.g. a completion envelope JSON string. */
  text(): Promise<string>;
}

export interface FetchRequest {
  /** Compatible completion method, always POST. */
  readonly method: "POST";
  /** Request headers; e.g. Content-Type: application/json. */
  readonly headers: Record<string, string>;
  /** Serialized completion input; e.g. a model and messages object. */
  readonly body: string;
}

export type ModelFetch = (
  url: string,
  request: FetchRequest,
) => Promise<FetchResponse>;

export interface RequestContext {
  readonly fetch: ModelFetch;
  readonly url: string;
  readonly body: string;
  readonly strict: boolean;
}

export async function requestCompletion(
  request: RequestContext,
  context: AttemptContext,
): Promise<string> {
  context.status = null;
  context.retryAfterMs = 0;
  context.attempts += 1;
  let response: FetchResponse;
  try {
    response = await request.fetch(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: request.body,
    });
  } catch (cause) {
    throw failure("transport", "Model request failed", cause, context);
  }
  context.status = response.status;
  context.retryAfterMs = retryAfter(response.headers.get("Retry-After"));
  if (request.strict && isDowngrade(response.headers.get("Warning"))) {
    // Cleanup cannot replace the explicit capability failure.
    await response.body?.cancel().catch(() => undefined);
    throw failure(
      "unsupported-capability",
      "Strict enforcement unavailable",
      response.headers.get("Warning"),
      context,
    );
  }
  let content: string;
  try {
    content = await response.text();
  } catch (cause) {
    // Releasing an errored body can also reject; retain its read failure.
    await response.body?.cancel().catch(() => undefined);
    throw failure(
      response.ok ? "transport" : "http",
      "Reading model response failed",
      cause,
      context,
    );
  }
  if (!response.ok) {
    const unsupported =
      /response_format|json_schema|structured|strict/i.test(content) &&
      /not supported|unsupported|not implemented/i.test(content);
    throw failure(
      unsupported ? "unsupported-capability" : "http",
      "Model HTTP request failed",
      content,
      context,
    );
  }
  return completionText(content, context);
}

export function failure(
  code: ModelClientError["code"],
  message: string,
  cause: unknown,
  context: AttemptContext,
): ModelClientError {
  return new ModelClientError(message, {
    code,
    cause,
    attempts: context.attempts,
    status: context.status,
  });
}

function completionText(content: string, context: AttemptContext): string {
  let body: unknown;
  try {
    body = JSON.parse(content);
  } catch (cause) {
    throw failure(
      "protocol",
      "Invalid completion response JSON",
      cause,
      context,
    );
  }
  if (!isRecord(body) || !Array.isArray(body.choices)) {
    throw failure("protocol", "Completion choices missing", body, context);
  }
  const choice: unknown = body.choices[0];
  if (!isRecord(choice)) {
    throw failure("protocol", "Completion choice missing", body, context);
  }
  if (choice.finish_reason === "length") {
    throw failure("truncation", "Model output was truncated", body, context);
  }
  if (
    choice.finish_reason !== "stop" ||
    !isRecord(choice.message) ||
    choice.message.role !== "assistant" ||
    typeof choice.message.content !== "string"
  ) {
    throw failure(
      "protocol",
      "Completion is not finished assistant text",
      body,
      context,
    );
  }
  return choice.message.content;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDowngrade(warning: string | null): boolean {
  return (
    warning !== null &&
    /strict|schema|structured/i.test(warning) &&
    /ignor|fallback|fall.back|not supported|unsupported|not enforc|downgrad/i.test(
      warning,
    )
  );
}

function retryAfter(value: string | null): number {
  if (value === null) return 0;
  const numeric = /^\d+(?:\.\d+)?$/.test(value.trim());
  const delay = numeric ? Number(value) * 1000 : Date.parse(value) - Date.now();
  return Number.isFinite(delay) && delay > 0 ? delay : 0;
}
