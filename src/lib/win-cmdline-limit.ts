/**
 * @deprecated This file is deprecated. The SDK (@cursor/sdk) now handles
 * agent execution directly via CursorSdkAgent. Windows command line limits
 * are no longer a concern with the SDK. This file is kept only for
 * backward compatibility and will be removed in a future version.
 */

import type { AgentCommand } from "./env.js";
import { resolveAgentCommand, type EnvOptions } from "./env.js";

/** Shown at the start of the prompt when earlier text was dropped on Windows. */
export const WIN_PROMPT_OMISSION_PREFIX =
  "[Earlier messages omitted: Windows command-line length limit.]\n\n";

export type FitPromptOk = {
  ok: true;
  args: string[];
  truncated: boolean;
  originalLength: number;
  finalPromptLength: number;
};

export type FitPromptErr = {
  ok: false;
  error: string;
};

export type FitPromptResult = FitPromptOk | FitPromptErr;

/**
 * @deprecated Not needed with SDK.
 */
export function estimateCmdlineLength(_resolved: AgentCommand): number {
  throw new Error(
    "estimateCmdlineLength is deprecated. The SDK does not have Windows command line limits.",
  );
}

/**
 * @deprecated Not needed with SDK.
 */
export function fitPromptToWinCmdline(
  _agentBin: string,
  _fixedArgs: string[],
  _prompt: string,
  _opts: {
    maxCmdline: number;
    platform: NodeJS.Platform;
    cwd?: string;
    env?: EnvOptions["env"];
  },
): FitPromptResult {
  throw new Error(
    "fitPromptToWinCmdline is deprecated. The SDK does not have Windows command line limits.",
  );
}

/**
 * @deprecated Not needed with SDK.
 */
export function warnPromptTruncated(
  _originalLength: number,
  _finalLength: number,
): void {
  throw new Error(
    "warnPromptTruncated is deprecated. The SDK does not have Windows command line limits.",
  );
}