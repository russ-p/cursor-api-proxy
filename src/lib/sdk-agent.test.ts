import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the SDK at the top level before imports
vi.mock("@cursor/sdk", () => ({
  Agent: {
    create: vi.fn(),
  },
  Cursor: {
    models: {
      list: vi.fn(),
    },
  },
  CursorAgentError: class extends Error {
    code: string;
    isRetryable: boolean;

    constructor(message: string, options?: { code?: string; isRetryable?: boolean }) {
      super(message);
      this.name = "CursorAgentError";
      this.code = options?.code ?? "UNKNOWN";
      this.isRetryable = options?.isRetryable ?? false;
    }
  },
}));

import { Agent } from "@cursor/sdk";
import { CursorAgentError } from "@cursor/sdk";
import { CursorSdkAgent } from "./sdk-agent.js";

describe("CursorSdkAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should create agent on first execution", async () => {
    const mockRun = {
      stream: vi.fn().mockImplementation(async function* () {
        yield { type: "text", text: "test response" };
      }),
      wait: vi.fn().mockResolvedValue({
        id: "run-123",
        status: "completed",
        result: "test response",
      }),
      cancel: vi.fn(),
      supports: vi.fn(),
    };

    const mockAgent = {
      send: vi.fn().mockResolvedValue(mockRun),
      [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(Agent.create).mockResolvedValue(mockAgent as any);

    const agent = new CursorSdkAgent({
      apiKey: "test-key",
      model: "auto",
      cwd: "/tmp",
    });

    const result = await agent.execute("test prompt");

    expect(Agent.create).toHaveBeenCalled();
    expect(mockAgent.send).toHaveBeenCalledWith("test prompt");
    expect(mockRun.wait).toHaveBeenCalled();
    expect(result.text).toBe("test response");

    await agent.dispose();
  });

  it("should stream chunks via callback", async () => {
    const chunks = [
      { type: "text", text: "Hello" },
      { type: "text", text: " " },
      { type: "text", text: "world" },
      { type: "text", text: "!" },
    ];

    const mockRun = {
      stream: vi.fn().mockImplementation(async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      }),
      wait: vi.fn().mockResolvedValue({
        id: "run-123",
        status: "completed",
        result: "Hello world!",
      }),
      cancel: vi.fn(),
      supports: vi.fn(),
    };

    const mockAgent = {
      send: vi.fn().mockResolvedValue(mockRun),
      [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(Agent.create).mockResolvedValue(mockAgent as any);

    const agent = new CursorSdkAgent({
      apiKey: "test-key",
      model: "auto",
      cwd: "/tmp",
    });

    const receivedChunks: string[] = [];
    const result = await agent.execute("test prompt", (chunk) => {
      receivedChunks.push(chunk);
    });

    expect(receivedChunks).toEqual(["Hello", " ", "world", "!"]);
    expect(result.text).toBe("Hello world!");

    await agent.dispose();
  });

  it("should dispose properly", async () => {
    const mockRun = {
      stream: vi.fn().mockImplementation(async function* () {
        yield { type: "text", text: "test" };
      }),
      wait: vi.fn().mockResolvedValue({
        id: "run-123",
        status: "completed",
        result: "test",
      }),
      cancel: vi.fn(),
      supports: vi.fn(),
    };

    const mockAgent = {
      send: vi.fn().mockResolvedValue(mockRun),
      [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(Agent.create).mockResolvedValue(mockAgent as any);

    const agent = new CursorSdkAgent({
      apiKey: "test-key",
      model: "auto",
      cwd: "/tmp",
    });

    await agent.dispose();

    expect(mockAgent[Symbol.asyncDispose]).toHaveBeenCalled();
  });

  it("should throw after disposal", async () => {
    const agent = new CursorSdkAgent({
      apiKey: "test-key",
      model: "auto",
      cwd: "/tmp",
    });

    await agent.dispose();

    await expect(agent.execute("test")).rejects.toThrow("Agent has been disposed");
  });

  it("should abort on signal", async () => {
    const mockRun = {
      stream: vi.fn().mockImplementation(async function* () {
        yield { type: "text", text: "test" };
      }),
      wait: vi.fn().mockResolvedValue({
        id: "run-123",
        status: "completed",
        result: "test",
      }),
      cancel: vi.fn(),
      supports: vi.fn(),
    };

    const mockAgent = {
      send: vi.fn().mockResolvedValue(mockRun),
      [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(Agent.create).mockResolvedValue(mockAgent as any);

    const abortController = new AbortController();
    abortController.abort();

    const agent = new CursorSdkAgent({
      apiKey: "test-key",
      model: "auto",
      cwd: "/tmp",
      signal: abortController.signal,
    });

    await expect(agent.execute("test prompt")).rejects.toThrow("abort");
    expect(mockRun.cancel).toHaveBeenCalled();

    await agent.dispose();
  });

  it("should require non-empty API key", () => {
    expect(() => {
      new CursorSdkAgent({
        apiKey: "",
        model: "auto",
        cwd: "/tmp",
      });
    }).toThrow("API key is required");
  });

  it("should require non-empty model", () => {
    expect(() => {
      new CursorSdkAgent({
        apiKey: "test-key",
        model: "",
        cwd: "/tmp",
      });
    }).toThrow("Model is required");
  });

  it("should handle SDK errors", async () => {
    const sdkError = new CursorAgentError("SDK error", {
      code: "AUTH_ERROR",
      isRetryable: false,
    });

    const mockRun = {
      stream: vi.fn().mockImplementation(async function* () {
        yield { type: "text", text: "test" };
      }),
      wait: vi.fn().mockRejectedValue(sdkError),
      cancel: vi.fn(),
      supports: vi.fn(),
    };

    const mockAgent = {
      send: vi.fn().mockResolvedValue(mockRun),
      [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(Agent.create).mockResolvedValue(mockAgent as any);

    const agent = new CursorSdkAgent({
      apiKey: "test-key",
      model: "auto",
      cwd: "/tmp",
    });

    await expect(agent.execute("test prompt")).rejects.toThrow("SDK error");

    await agent.dispose();
  });

  it("should reuse agent instance for multiple executions", async () => {
    const mockRun = {
      stream: vi.fn().mockImplementation(async function* () {
        yield { type: "text", text: "response" };
      }),
      wait: vi.fn().mockResolvedValue({
        id: "run-123",
        status: "completed",
        result: "response",
      }),
      cancel: vi.fn(),
      supports: vi.fn(),
    };

    const mockAgent = {
      send: vi.fn().mockResolvedValue(mockRun),
      [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(Agent.create).mockResolvedValue(mockAgent as any);

    const agent = new CursorSdkAgent({
      apiKey: "test-key",
      model: "auto",
      cwd: "/tmp",
    });

    await agent.execute("prompt1");
    await agent.execute("prompt2");

    expect(Agent.create).toHaveBeenCalledTimes(1);
    expect(mockAgent.send).toHaveBeenCalledTimes(2);

    await agent.dispose();
  });
});