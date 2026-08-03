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

function assistantEvent(text: string) {
  return {
    type: "assistant" as const,
    message: {
      content: [{ type: "text" as const, text }],
    },
  };
}

function createMockRun(options: {
  streamTexts?: string[];
  result?: string;
  waitError?: Error;
  supportsStream?: boolean;
}) {
  const streamTexts = options.streamTexts ?? [];
  const supportsStream = options.supportsStream ?? streamTexts.length > 0;

  return {
    stream: vi.fn().mockImplementation(async function* () {
      for (const text of streamTexts) {
        yield assistantEvent(text);
      }
    }),
    wait: options.waitError
      ? vi.fn().mockRejectedValue(options.waitError)
      : vi.fn().mockResolvedValue({
          id: "run-123",
          status: "completed",
          result: options.result ?? streamTexts.join(""),
        }),
    cancel: vi.fn(),
    supports: vi.fn((feature: string) => feature === "stream" && supportsStream),
  };
}

function createMockAgent(mockRun: ReturnType<typeof createMockRun>) {
  return {
    send: vi.fn().mockResolvedValue(mockRun),
    [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined),
  };
}

describe("CursorSdkAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should create agent on first execution", async () => {
    const mockRun = createMockRun({ result: "test response" });
    const mockAgent = createMockAgent(mockRun);

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
    const mockRun = createMockRun({
      streamTexts: ["Hello", " ", "world", "!"],
      result: "Hello world!",
    });
    const mockAgent = createMockAgent(mockRun);

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
    const mockRun = createMockRun({ result: "test" });
    const mockAgent = createMockAgent(mockRun);

    vi.mocked(Agent.create).mockResolvedValue(mockAgent as any);

    const agent = new CursorSdkAgent({
      apiKey: "test-key",
      model: "auto",
      cwd: "/tmp",
    });

    await agent.execute("test prompt");
    await agent.dispose();

    expect(mockAgent[Symbol.asyncDispose]).toHaveBeenCalled();
  });

  it("should throw after disposal", async () => {
    const mockRun = createMockRun({ result: "test" });
    const mockAgent = createMockAgent(mockRun);

    vi.mocked(Agent.create).mockResolvedValue(mockAgent as any);

    const agent = new CursorSdkAgent({
      apiKey: "test-key",
      model: "auto",
      cwd: "/tmp",
    });

    await agent.execute("test");
    await agent.dispose();

    await expect(agent.execute("test")).rejects.toThrow("Agent has been disposed");
  });

  it("should require non-empty API key", () => {
    expect(() => {
      new CursorSdkAgent({
        apiKey: "",
        model: "auto",
        cwd: "/tmp",
      });
    }).toThrow("CURSOR_API_KEY is required");
  });

  it("should handle SDK errors", async () => {
    const sdkError = new CursorAgentError("SDK error", {
      code: "AUTH_ERROR",
      isRetryable: false,
    });

    const mockRun = createMockRun({ waitError: sdkError });
    const mockAgent = createMockAgent(mockRun);

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
    const mockRun = createMockRun({ result: "response" });
    const mockAgent = createMockAgent(mockRun);

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
