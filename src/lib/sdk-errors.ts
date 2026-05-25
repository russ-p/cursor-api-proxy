import { CursorAgentError } from "@cursor/sdk";

/**
 * Check if error is a CursorAgentError.
 */
export function isCursorAgentError(err: unknown): err is CursorAgentError {
  return err instanceof CursorAgentError;
}

/**
 * Map SDK errors to HTTP status codes.
 */
export function getHttpStatusCode(err: unknown): number {
  if (isCursorAgentError(err)) {
    const msg = err.message.toLowerCase();
    if (msg.includes("401") || msg.includes("authentication") || msg.includes("unauthorized")) {
      return 401;
    }
    if (msg.includes("403") || msg.includes("forbidden")) {
      return 403;
    }
    if (msg.includes("429") || msg.includes("rate limit") || msg.includes("too many requests")) {
      return 429;
    }
    if (msg.includes("timeout") || msg.includes("timed out")) {
      return 408;
    }
    if (msg.includes("not found")) {
      return 404;
    }
  }
  return 500;
}

/**
 * Check if error indicates rate limiting.
 */
export function isRateLimitError(err: unknown): boolean {
  return (
    isCursorAgentError(err) &&
    /\b429\b|rate.?limit|too many requests/i.test(err.message)
  );
}

/**
 * Check if error is retryable.
 */
export function isRetryableError(err: unknown): boolean {
  if (isCursorAgentError(err)) {
    return err.isRetryable ?? false;
  }
  return false;
}

/**
 * Format error for OpenAI-style response.
 */
export function formatErrorForResponse(err: unknown): {
  message: string;
  type: string;
  code?: string;
} {
  if (isCursorAgentError(err)) {
    return {
      message: err.message,
      type: "api_error",
      code: err.code,
    };
  }
  if (err instanceof Error) {
    return {
      message: err.message,
      type: "api_error",
    };
  }
  return {
    message: "Unknown error",
    type: "api_error",
  };
}