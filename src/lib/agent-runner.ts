/**
 * @deprecated This file is deprecated. The SDK (@cursor/sdk) now handles
 * agent execution directly via CursorSdkAgent. This file is kept only for
 * backward compatibility with existing tests and will be removed in a future version.
 */

import * as fs from "node:fs";

import { runAcpStream, runAcpSync } from "./acp-client.js";
import type { BridgeConfig } from "./config.js";
import type { CursorExecutionMode } from "./execution-mode.js";
import { run, runStreaming } from "./process.js";
import { getChatOnlyEnvOverrides } from "./workspace.js";
import { readKeychainToken, writeCachedToken } from "./token-cache.js";

export type AgentRunResult = {
  code: number;
  stdout: string;
  stderr: string;
};

/**
 * @deprecated Use CursorSdkAgent.execute() instead.
 */
export function runAgentSync(
  _config: BridgeConfig,
  _workspaceDir: string,
  _effectiveChatOnly: boolean,
  _cmdArgs: string[],
  _tempDir?: string,
  _stdinPrompt?: string,
  _configDir?: string,
  _signal?: AbortSignal,
): Promise<AgentRunResult> {
  throw new Error(
    "runAgentSync is deprecated. Use CursorSdkAgent.execute() instead.",
  );
}

export type StreamLineHandler = (line: string) => void;

/**
 * @deprecated Use CursorSdkAgent.execute() with streaming callback instead.
 */
export function runAgentStream(
  _config: BridgeConfig,
  _workspaceDir: string,
  _effectiveChatOnly: boolean,
  _cmdArgs: string[],
  _onLine: StreamLineHandler,
  _tempDir?: string,
  _stdinPrompt?: string,
  _configDir?: string,
  _signal?: AbortSignal,
): Promise<{ code: number; stderr: string }> {
  throw new Error(
    "runAgentStream is deprecated. Use CursorSdkAgent.execute() with streaming callback instead.",
  );
}