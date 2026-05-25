import { Agent } from "@cursor/sdk";
import type { SDKAgent } from "@cursor/sdk";

export type SdkAgentOptions = {
  apiKey: string;
  model: string;
  cwd: string;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export type SdkAgentResult = {
  text: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

export type SdkStreamCallback = (chunk: string) => void;

/**
 * Wrapper around @cursor/sdk Agent.
 * Handles execution, streaming, timeout emulation, and cleanup.
 */
export class CursorSdkAgent {
  private agent?: SDKAgent;
  private disposed = false;

  constructor(private options: SdkAgentOptions) {
    if (!options.apiKey) {
      throw new Error("CURSOR_API_KEY is required");
    }
  }

  /**
   * Execute a prompt, optionally streaming chunks via callback.
   */
  async execute(
    prompt: string,
    onStream?: SdkStreamCallback,
  ): Promise<SdkAgentResult> {
    if (this.disposed) {
      throw new Error("Agent has been disposed");
    }

    // Lazy agent creation
    if (!this.agent) {
      this.agent = await Agent.create({
        apiKey: this.options.apiKey,
        model: { id: this.options.model },
        local: { cwd: this.options.cwd },
      });
    }

    const run = await this.agent.send(prompt);

    // Timeout emulation (SDK doesn't have direct timeout support)
    let timeoutHandle: NodeJS.Timeout | undefined;
    if (this.options.timeoutMs && this.options.timeoutMs > 0) {
      if (run.supports("cancel")) {
        timeoutHandle = setTimeout(() => {
          try {
            run.cancel();
          } catch {
            // Cancel may fail if already finished
          }
        }, this.options.timeoutMs);
      }
    }

    // Streaming if callback provided and supported
    if (onStream && run.supports("stream")) {
      for await (const event of run.stream()) {
        if (event.type === "assistant") {
          for (const block of event.message.content) {
            if (block.type === "text") {
              onStream(block.text);
            }
          }
        }
      }
    }

    // Wait for completion
    const result = await run.wait();

    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    // Check for execution error
    if (result.status === "error") {
      throw new Error(
        `Agent execution failed: ${result.id} - check agent for details`,
      );
    }

    return {
      text: result.result ?? "",
      model: this.options.model,
      usage: this.extractUsageFromResult(result),
    };
  }

  /**
   * Extract usage information from SDK result.
   * Note: SDK doesn't provide token usage in RunResult, so we estimate.
   */
  private extractUsageFromResult(result: any):
    | { promptTokens: number; completionTokens: number; totalTokens: number }
    | undefined {
    // SDK doesn't provide token usage directly
    // Return undefined - the caller can estimate from text length
    return undefined;
  }

  /**
   * Clean up resources.
   * Must be called to prevent leaks.
   */
  async dispose(): Promise<void> {
    if (this.agent && !this.disposed) {
      await this.agent[Symbol.asyncDispose]();
      this.disposed = true;
      this.agent = undefined;
    }
  }

  /**
   * Check if agent has been disposed.
   */
  isDisposed(): boolean {
    return this.disposed;
  }
}