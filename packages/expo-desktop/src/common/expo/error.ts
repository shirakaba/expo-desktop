/**
 * A custom error class that is used to surface a `process.exit` event to a higher
 * level where it can be tracked through telemetry asynchronously, before exiting.
 */
export class ExitError extends Error {
  readonly cause: string | Error;
  readonly code: number;
  constructor(cause: string | Error, code: number) {
    super(cause instanceof Error ? cause.message : cause);
    this.cause = cause;
    this.code = code;
  }
}
