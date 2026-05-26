import { describe, it, expect } from "vitest";
import {
  isCursorAgentError,
  getHttpStatusCode,
  isRateLimitError,
  isRetryableError,
  formatErrorForResponse,
} from "./sdk-errors.js";

// Mock CursorAgentError class
class MockCursorAgentError extends Error {
  code: string;
  isRetryable: boolean;

  constructor(message: string, code: string, options?: { isRetryable?: boolean }) {
    super(message);
    this.name = "CursorAgentError";
    this.code = code;
    this.isRetryable = options?.isRetryable ?? false;
  }
}

describe("sdk-errors", () => {
  describe("isCursorAgentError", () => {
    it("should identify CursorAgentError by code property", () => {
      const err = new MockCursorAgentError("test message", "AUTH_ERROR", {
        isRetryable: false,
      });
      expect(isCursorAgentError(err)).toBe(true);
    });

    it("should return false for regular Error", () => {
      const err = new Error("regular error");
      expect(isCursorAgentError(err)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isCursorAgentError(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isCursorAgentError(undefined)).toBe(false);
    });

    it("should return false for objects without code property", () => {
      expect(isCursorAgentError({ message: "test" })).toBe(false);
    });
  });

  describe("getHttpStatusCode", () => {
    it("should map AUTH_ERROR to 401", () => {
      const err = new MockCursorAgentError("unauthorized", "AUTH_ERROR");
      expect(getHttpStatusCode(err)).toBe(401);
    });

    it("should map RATE_LIMIT_ERROR to 429", () => {
      const err = new MockCursorAgentError("rate limit", "RATE_LIMIT_ERROR");
      expect(getHttpStatusCode(err)).toBe(429);
    });

    it("should map TIMEOUT_ERROR to 408", () => {
      const err = new MockCursorAgentError("timeout", "TIMEOUT_ERROR");
      expect(getHttpStatusCode(err)).toBe(408);
    });

    it("should map NETWORK_ERROR to 503", () => {
      const err = new MockCursorAgentError("network error", "NETWORK_ERROR");
      expect(getHttpStatusCode(err)).toBe(503);
    });

    it("should map VALIDATION_ERROR to 400", () => {
      const err = new MockCursorAgentError("validation", "VALIDATION_ERROR");
      expect(getHttpStatusCode(err)).toBe(400);
    });

    it("should map NOT_FOUND_ERROR to 404", () => {
      const err = new MockCursorAgentError("not found", "NOT_FOUND_ERROR");
      expect(getHttpStatusCode(err)).toBe(404);
    });

    it("should map unknown error codes to 500", () => {
      const err = new MockCursorAgentError("unknown", "UNKNOWN_ERROR");
      expect(getHttpStatusCode(err)).toBe(500);
    });

    it("should return 500 for regular errors", () => {
      const err = new Error("regular error");
      expect(getHttpStatusCode(err)).toBe(500);
    });

    it("should handle error messages containing rate limit patterns", () => {
      const err = { message: "429 Too Many Requests", code: "RATE_LIMIT" };
      expect(getHttpStatusCode(err)).toBe(429);
    });

    it("should handle error messages containing 'unauthorized'", () => {
      const err = { message: "Unauthorized access denied" };
      expect(getHttpStatusCode(err)).toBe(401);
    });
  });

  describe("isRateLimitError", () => {
    it("should detect RATE_LIMIT_ERROR code", () => {
      const err = new MockCursorAgentError("429 rate limit", "RATE_LIMIT_ERROR");
      expect(isRateLimitError(err)).toBe(true);
    });

    it("should detect error message with 'rate limit'", () => {
      const err = new Error("rate limit exceeded");
      expect(isRateLimitError(err)).toBe(true);
    });

    it("should detect error message with '429'", () => {
      const err = new Error("HTTP 429: too many requests");
      expect(isRateLimitError(err)).toBe(true);
    });

    it("should detect error message with 'too many requests'", () => {
      const err = new Error("too many requests");
      expect(isRateLimitError(err)).toBe(true);
    });

    it("should return false for other errors", () => {
      const err = new Error("not a rate limit error");
      expect(isRateLimitError(err)).toBe(false);
    });

    it("should be case-insensitive", () => {
      const err = new Error("RATE LIMIT");
      expect(isRateLimitError(err)).toBe(true);
    });
  });

  describe("isRetryableError", () => {
    it("should return true for retryable errors", () => {
      const err = new MockCursorAgentError("temp error", "TEMP_ERROR", {
        isRetryable: true,
      });
      expect(isRetryableError(err)).toBe(true);
    });

    it("should return false for non-retryable errors", () => {
      const err = new MockCursorAgentError("perm error", "PERM_ERROR", {
        isRetryable: false,
      });
      expect(isRetryableError(err)).toBe(false);
    });

    it("should return false for regular errors", () => {
      const err = new Error("regular error");
      expect(isRetryableError(err)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isRetryableError(null)).toBe(false);
    });
  });

  describe("formatErrorForResponse", () => {
    it("should format CursorAgentError", () => {
      const sdkErr = new MockCursorAgentError("test message", "TEST_CODE", {
        isRetryable: false,
      });

      const formatted = formatErrorForResponse(sdkErr);

      expect(formatted).toEqual({
        message: "test message",
        type: "api_error",
        code: "TEST_CODE",
      });
    });

    it("should format regular Error", () => {
      const plainErr = new Error("plain error");

      const formatted = formatErrorForResponse(plainErr);

      expect(formatted).toEqual({
        message: "plain error",
        type: "api_error",
      });
    });

    it("should handle Error without code property", () => {
      const err = { message: "some error", name: "Error" };

      const formatted = formatErrorForResponse(err);

      expect(formatted).toEqual({
        message: "some error",
        type: "api_error",
      });
    });

    it("should handle error with type property", () => {
      const err = { message: "error", type: "validation_error" };

      const formatted = formatErrorForResponse(err);

      expect(formatted).toEqual({
        message: "error",
        type: "validation_error",
      });
    });

    it("should handle null error", () => {
      const formatted = formatErrorForResponse(null);

      expect(formatted).toEqual({
        message: "Unknown error",
        type: "api_error",
      });
    });

    it("should handle undefined error", () => {
      const formatted = formatErrorForResponse(undefined);

      expect(formatted).toEqual({
        message: "Unknown error",
        type: "api_error",
      });
    });

    it("should preserve existing type from CursorAgentError", () => {
      const err = new MockCursorAgentError("msg", "CODE");
      (err as any).type = "custom_error_type";

      const formatted = formatErrorForResponse(err);

      expect(formatted.type).toBe("custom_error_type");
    });
  });
});