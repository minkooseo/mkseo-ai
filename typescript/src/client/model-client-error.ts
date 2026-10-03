export type ModelClientErrorCode =
  | "configuration"
  | "schema"
  | "transport"
  | "http"
  | "unsupported-capability"
  | "protocol"
  | "output"
  | "truncation"
  | "internal";

export interface FailureDetails {
  /** Failure category; e.g. 'transport'. */
  readonly code: ModelClientErrorCode;
  /** Number of network requests started; e.g. 2. */
  readonly attempts: number;
  /** Last HTTP status when available; e.g. 503. */
  readonly status: number | null;
  /** Original failure; e.g. a fetch TypeError. */
  readonly cause: unknown;
}

export class ModelClientError extends Error {
  readonly code: ModelClientErrorCode;
  readonly attempts: number;
  readonly status: number | null;

  constructor(message: string, details: FailureDetails) {
    super(message, { cause: details.cause });
    this.name = "ModelClientError";
    this.code = details.code;
    this.attempts = details.attempts;
    this.status = details.status;
  }
}
