import type { CursorExecutionMode } from "./execution-mode.js";
import { loadEnvConfig, type EnvOptions } from "./env.js";

export type { CursorExecutionMode } from "./execution-mode.js";

export type BridgeConfig = {
  // === SDK FIELDS ===
  cursorApiKey?: string;
  useCloudRuntime?: boolean;

  // === KEPT FIELDS ===
  host: string;
  port: number;
  requiredKey?: string;
  defaultModel: string;
  mode: CursorExecutionMode;  // Note: will be ignored/removed later
  strictModel: boolean;
  workspace: string;
  timeoutMs: number;
  /** Path to TLS certificate file (e.g. Tailscale cert). When set with tlsKeyPath, server uses HTTPS. */
  tlsCertPath?: string;
  /** Path to TLS private key file. When set with tlsCertPath, server uses HTTPS. */
  tlsKeyPath?: string;
  /** Path to sessions log file; each request is appended as a line. Default: sessions.log in cwd. */
  sessionsLogPath: string;
  /** When true (default), run CLI in an empty temp dir so it cannot read or write the real project. Pure chat only. */
  chatOnlyWorkspace: boolean;
  /** True when CURSOR_BRIDGE_CHAT_ONLY_WORKSPACE was set in the environment (any value). */
  chatOnlyWorkspaceExplicit: boolean;
  /** When true, print full request/response content to stdout for each completion. */
  verbose: boolean;
  /** Pool of cursor configuration directories for round-robin account rotation. */
  configDirs: string[];
  /** When true, runs each config dir on its own incrementing port starting from `port` */
  multiPort: boolean;
};

export function loadBridgeConfig(opts: EnvOptions = {}): BridgeConfig {
  const env = loadEnvConfig(opts);
  const envSource = opts.env ?? process.env;

  const apiKey = envSource.CURSOR_API_KEY ?? envSource.CURSOR_AUTH_TOKEN;

  return {
    cursorApiKey: apiKey,
    useCloudRuntime: env.useCloudRuntime,
    host: env.host,
    port: env.port,
    requiredKey: env.requiredKey,
    defaultModel: env.defaultModel,
    mode: env.mode ?? opts.mode ?? "ask",
    strictModel: env.strictModel,
    workspace: env.workspace,
    timeoutMs: env.timeoutMs,
    tlsCertPath: env.tlsCertPath,
    tlsKeyPath: env.tlsKeyPath,
    sessionsLogPath: env.sessionsLogPath,
    chatOnlyWorkspace: env.chatOnlyWorkspace,
    chatOnlyWorkspaceExplicit: env.chatOnlyWorkspaceExplicit,
    verbose: env.verbose,
    configDirs: env.configDirs ?? [],
    multiPort: env.multiPort,
  };
}
