/**
 * @deprecated This file is deprecated. The SDK (@cursor/sdk) now handles
 * agent execution directly. This file is kept only for backward compatibility
 * with existing tests and will be removed in a future version.
 */

import type { BridgeConfig } from "./config.js";
import type { CursorExecutionMode } from "./execution-mode.js";

/**
 * @deprecated SDK handles agent execution; no longer needed.
 */
export function buildAgentFixedArgs(
  _config: BridgeConfig,
  _workspaceDir: string,
  _model: string,
  _stream: boolean,
  _mode: CursorExecutionMode,
  _effectiveChatOnly: boolean,
): string[] {
  throw new Error(
    "buildAgentFixedArgs is deprecated. The SDK now handles agent execution directly.",
  );
}

/**
 * @deprecated SDK handles agent execution; no longer needed.
 */
export function buildAgentCmdArgs(
  _config: BridgeConfig,
  _workspaceDir: string,
  _model: string,
  _prompt: string,
  _stream: boolean,
  _mode: CursorExecutionMode,
  _effectiveChatOnly: boolean,
): string[] {
  throw new Error(
    "buildAgentCmdArgs is deprecated. The SDK now handles agent execution directly.",
  );
}