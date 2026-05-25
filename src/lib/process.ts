/**
 * @deprecated This file is deprecated. The SDK (@cursor/sdk) now handles
 * agent execution directly via CursorSdkAgent. This file is kept only for
 * backward compatibility with deprecated code and will be removed in a future version.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { resolveAgentCommand } from "./env.js";
import { runMaxModePreflight } from "./max-mode-preflight.js";

export type RunResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export type RunOptions = {
  cwd?: string;
  timeoutMs?: number;
  /** Enable Cursor Max Mode (preflight writes maxMode to cli-config.json). */
  maxMode?: boolean;
  /** When set, pass this string to the child process stdin and close it (avoids long prompt in argv on Windows). */
  stdinContent?: string;
  /** Env overrides for the child (e.g. HOME, CURSOR_CONFIG_DIR to isolate from global rules). */
  envOverrides?: Record<string, string>;
  /** Custom config dir for round-robin account rotation */
  configDir?: string;
  /** Abort signal — when aborted, the child process is killed immediately */
  signal?: AbortSignal;
};

export type RunStreamingOptions = RunOptions & {
  onLine: (line: string) => void;
};

// ---------------------------------------------------------------------------
// Global child process registry — used for graceful shutdown
// ---------------------------------------------------------------------------

const activeChildren = new Set<ChildProcess>();

/** Kill all in-flight agent child processes. Called on server shutdown. */
export function killAllChildProcesses(): void {
  for (const child of activeChildren) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* already exited */
    }
  }
  activeChildren.clear();
}

/** Register a child (e.g. ACP) for graceful shutdown; removed on close. */
export function trackChildProcess(child: ChildProcess): void {
  activeChildren.add(child);
  child.once("close", () => {
    activeChildren.delete(child);
  });
}

// ---------------------------------------------------------------------------
// Public API (deprecated)
// ---------------------------------------------------------------------------

/**
 * @deprecated Use CursorSdkAgent.execute() instead.
 */
export function runStreaming(
  _cmd: string,
  _args: string[],
  _opts: RunStreamingOptions,
): Promise<{ code: number; stderr: string }> {
  throw new Error(
    "runStreaming is deprecated. Use CursorSdkAgent.execute() with streaming callback instead.",
  );
}

/**
 * @deprecated Use CursorSdkAgent.execute() instead.
 */
export function run(
  _cmd: string,
  _args: string[],
  _opts: RunOptions = {},
): Promise<RunResult> {
  throw new Error(
    "run is deprecated. Use CursorSdkAgent.execute() instead.",
  );
}