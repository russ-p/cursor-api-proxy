import { describe, it, expect } from "vitest";
import { CursorAgentError } from "@cursor/sdk";
import {
  isCursorAgentError,
  getHttpStatusCode,
  isRateLimitError,
  isRetryableError,
  formatErrorForResponse,
} from "./sdk-errors.js";

describe("sdk-errors", () => {
  describe("isCursorAgentError", () => {
    it("should identify CursorAgentError instances", () => {
      const err = new CursorAgentError("test message", { code: "AUTH_ERROR" });
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
    it("should map unauthorized messages to 401", () => {
      const err = new CursorAgentError("unauthorized", { code: "AUTH_ERROR" });
      expect(getHttpStatusCode(err)).toBe(401);
    });

    it("should map rate limit messages to 429", () => {
      const err = new CursorAgentError("rate limit exceeded", {
        code: "RATE_LIMIT_ERROR",
      });
      expect(getHttpStatusCode(err)).toBe(429);
    });

    it("should map timeout messages to 408", () => {
      const err = new CursorAgentError("request timed out", {
        code: "TIMEOUT_ERROR",
      });
      expect(getHttpStatusCode(err)).toBe(408);
    });

    it("should map forbidden messages to 403", () => {
      const err = new CursorAgentError("forbidden", { code: "FORBIDDEN" });
      expect(getHttpStatusCode(err)).toBe(403);
    });

    it("should map not found messages to 404", () => {
      const err = new CursorAgentError("resource not found", {
        code: "NOT_FOUND_ERROR",
      });
      expect(getHttpStatusCode(err)).toBe(404);
    });

    it("should map unknown CursorAgentError messages to 500", () => {
      const err = new CursorAgentError("network error", {
        code: "NETWORK_ERROR",
      });
      expect(getHttpStatusCode(err)).toBe(500);
    });

    it("should return 500 for regular errors", () => {
      const err = new Error("regular error");
      expect(getHttpStatusCode(err)).toBe(500);
    });

    it("should return 500 for plain objects even with rate limit text", () => {
      const err = { message: "429 Too Many Requests", code: "RATE_LIMIT" };
      expect(getHttpStatusCode(err)).toBe(500);
    });
  });

  describe("isRateLimitError", () => {
    it("should detect rate limit messages on CursorAgentError", () => {
      const err = new CursorAgentError("429 rate limit", {
        code: "RATE_LIMIT_ERROR",
      });
      expect(isRateLimitError(err)).toBe(true);
    });

    it("should detect too many requests messages on CursorAgentError", () => {
      const err = new CursorAgentError("too many requests", {
        code: "RATE_LIMIT_ERROR",
      });
      expect(isRateLimitError(err)).toBe(true);
    });

    it("should return false for regular errors", () => {
      const err = new Error("rate limit exceeded");
      expect(isRateLimitError(err)).toBe(false);
    });

    it("should return false for other CursorAgentError messages", () => {
      const err = new CursorAgentError("configuration error", {
        code: "OTHER",
      });
      expect(isRateLimitError(err)).toBe(false);
    });
  });

  describe("isRetryableError", () => {
    it("should return true for retryable errors", () => {
      const err = new CursorAgentError("temp error", {
        code: "TEMP_ERROR",
        isRetryable: true,
      });
      expect(isRetryableError(err)).toBe(true);
    });

    it("should return false for non-retryable errors", () => {
      const err = new CursorAgentError("perm error", {
        code: "PERM_ERROR",
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
      const sdkErr = new CursorAgentError("test message", {
        code: "TEST_CODE",
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

    it("should treat plain objects as unknown errors", () => {
      const formatted = formatErrorForResponse({
        message: "some error",
        type: "validation_error",
      });

      expect(formatted).toEqual({
        message: "Unknown error",
        type: "api_error",
      });
    });
  });
});
