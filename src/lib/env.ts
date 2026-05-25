import * as fs from "node:fs";
import * as path from "node:path";

import type { CursorExecutionMode } from "./execution-mode.js";
import { tryParseExecutionModeEnv } from "./execution-mode.js";

export type EnvSource = Record<string, string | undefined>;

export type EnvOptions = {
  tailscale?: boolean;
  env?: EnvSource;
  cwd?: string;
  platform?: NodeJS.Platform;
  /** CLI `--mode` (overridden by CURSOR_BRIDGE_MODE when set). */
  mode?: CursorExecutionMode;
};

export type LoadedEnv = {
  // === ADDED ===
  cursorApiKey?: string;
  useCloudRuntime?: boolean;

  // === KEPT ===
  commandShell: string;
  host: string;
  port: number;
  requiredKey?: string;
  defaultModel: string;
  strictModel: boolean;
  workspace: string;
  timeoutMs: number;
  tlsCertPath?: string;
  tlsKeyPath?: string;
  sessionsLogPath: string;
  chatOnlyWorkspace: boolean;
  /** True when CURSOR_BRIDGE_CHAT_ONLY_WORKSPACE key exists in env. */
  chatOnlyWorkspaceExplicit: boolean;
  mode?: CursorExecutionMode;
  verbose: boolean;
  /** Pool of cursor configuration directories for round-robin account rotation. */
  configDirs: string[];
  /** When true, runs each config dir on its own incrementing port starting from `port` */
  multiPort: boolean;
};

export type AgentCommand = {
  command: string;
  args: string[];
  env: EnvSource;
  windowsVerbatimArguments?: boolean;
  /** Path to agent entry script (e.g. index.js). Set when using node+script so max-mode preflight can find config. */
  agentScriptPath?: string;
  /** Cursor config dir (cli-config.json). Set so CLI reads the same config preflight wrote to. */
  configDir?: string;
};

function getEnvSource(env?: EnvSource): EnvSource {
  return env ?? process.env;
}

function getCwd(cwd?: string): string {
  return cwd ?? process.cwd();
}

function firstDefined(env: EnvSource, names: string[]): string | undefined {
  for (const name of names) {
    const value = env[name];
    if (value != null) return value;
  }
  return undefined;
}

function envString(env: EnvSource, names: string[]): string | undefined {
  const value = firstDefined(env, names);
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function envBool(
  env: EnvSource,
  names: string[],
  defaultValue: boolean,
): boolean {
  const raw = envString(env, names);
  if (raw == null) return defaultValue;
  const value = raw.toLowerCase();
  if (value === "1" || value === "true" || value === "yes" || value === "on")
    return true;
  if (value === "0" || value === "false" || value === "no" || value === "off")
    return false;
  return defaultValue;
}

function envNumber(
  env: EnvSource,
  names: string[],
  defaultValue: number,
): number {
  const raw = envString(env, names);
  if (raw == null) return defaultValue;
  const value = Number(raw);
  return Number.isFinite(value) ? value : defaultValue;
}

function normalizeModelId(raw: string | undefined): string {
  if (!raw) return "default";
  const parts = raw.split("/");
  return parts[parts.length - 1] || "default";
}

function resolveAbsolutePath(
  raw: string | undefined,
  cwd: string,
): string | undefined {
  if (!raw) return undefined;
  return path.resolve(cwd, raw);
}

/** Version dir name format: YYYY.MM.DD-commit (matches cursor-agent.ps1). */
const VERSION_DIR_REGEX = /^(\d{4})\.(\d{1,2})\.(\d{1,2})-[a-f0-9]+$/;

function parseVersionToInt(name: string): number {
  const m = name.match(VERSION_DIR_REGEX);
  if (!m) return 0;
  const [, year, month, day] = m;
  const y = year!.padStart(4, "0");
  const mo = month!.padStart(2, "0");
  const d = day!.padStart(2, "0");
  return parseInt(y + mo + d, 10);
}

/**
 * Find the latest version directory under dir/versions/ (e.g. cursor-agent/versions/2026.03.11-6dfa30c).
 * Returns the full path to the version dir, or undefined if none found.
 */
function findLatestVersionDir(dir: string): string | undefined {
  const versionsDir = path.join(dir, "versions");
  if (!fs.existsSync(versionsDir) || !fs.statSync(versionsDir).isDirectory()) {
    return undefined;
  }
  const entries = fs.readdirSync(versionsDir, { withFileTypes: true });
  const versionDirs = entries
    .filter((e) => e.isDirectory() && VERSION_DIR_REGEX.test(e.name))
    .sort((a, b) => parseVersionToInt(b.name) - parseVersionToInt(a.name));
  if (versionDirs.length === 0) return undefined;
  return path.join(versionsDir, versionDirs[0]!.name);
}

/**
 * Auto-discovers configuration directories located inside ~/.cursor-api-proxy/accounts/
 */
function isAuthenticatedAccountDir(dir: string): boolean {
  const configFile = path.join(dir, "cli-config.json");
  if (!fs.existsSync(configFile)) return false;
  try {
    const config = JSON.parse(fs.readFileSync(configFile, "utf-8")) as {
      authInfo?: { email?: string };
    };
    return Boolean(config?.authInfo?.email);
  } catch {
    return false;
  }
}

function discoverAccountDirs(homeDir: string | undefined): string[] {
  if (!homeDir) return [];
  const accountsDir = path.join(homeDir, ".cursor-api-proxy", "accounts");
  if (!fs.existsSync(accountsDir)) return [];

  try {
    const entries = fs.readdirSync(accountsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => path.join(accountsDir, e.name))
      .filter(isAuthenticatedAccountDir);
  } catch {
    return [];
  }
}

export function loadEnvConfig(opts: EnvOptions = {}): LoadedEnv {
  const env = getEnvSource(opts.env);
  const cwd = getCwd(opts.cwd);

  const host =
    envString(env, ["CURSOR_BRIDGE_HOST"]) ??
    (opts.tailscale ? "0.0.0.0" : "127.0.0.1");
  const portValue = envNumber(env, ["CURSOR_BRIDGE_PORT"], 8765);
  const port = Number.isFinite(portValue) && portValue > 0 ? portValue : 8765;

  const home = envString(env, ["HOME", "USERPROFILE"]);

  const sessionsLogPath = (() => {
    const explicit = resolveAbsolutePath(
      envString(env, ["CURSOR_BRIDGE_SESSIONS_LOG"]),
      cwd,
    );
    if (explicit) return explicit;
    if (home) return path.join(home, ".cursor-api-proxy", "sessions.log");
    return path.join(cwd, "sessions.log");
  })();

  const force = envBool(env, ["CURSOR_BRIDGE_FORCE"], false);

  const rawConfigDirs = envString(env, [
    "CURSOR_CONFIG_DIRS",
    "CURSOR_ACCOUNT_DIRS",
  ]);

  let configDirs = rawConfigDirs
    ? rawConfigDirs
        .split(",")
        .map((d) => resolveAbsolutePath(d.trim(), cwd))
        .filter((d): d is string => d !== undefined)
    : [];

  if (configDirs.length === 0) {
    configDirs = discoverAccountDirs(home);
  }

  const winCmdlineRaw = envNumber(
    env,
    ["CURSOR_BRIDGE_WIN_CMDLINE_MAX"],
    30_000,
  );
  const winCmdlineMax = Math.min(
    32_700,
    Math.max(4096, Number.isFinite(winCmdlineRaw) ? winCmdlineRaw : 30_000),
  );

  const chatOnlyWorkspaceExplicit = Object.prototype.hasOwnProperty.call(
    env,
    "CURSOR_BRIDGE_CHAT_ONLY_WORKSPACE",
  );

  const mode = tryParseExecutionModeEnv(firstDefined(env, ["CURSOR_BRIDGE_MODE"]));

  return {
    // ADDED:
    cursorApiKey: envString(env, ["CURSOR_API_KEY", "CURSOR_AUTH_TOKEN"]),
    useCloudRuntime: envBool(env, ["CURSOR_BRIDGE_USE_CLOUD_RUNTIME"], false),

    commandShell: envString(env, ["COMSPEC"]) ?? "cmd.exe",
    host,
    port,
    requiredKey: envString(env, ["CURSOR_BRIDGE_API_KEY"]),
    defaultModel: normalizeModelId(
      envString(env, ["CURSOR_BRIDGE_DEFAULT_MODEL"]),
    ),
    strictModel: envBool(env, ["CURSOR_BRIDGE_STRICT_MODEL"], true),
    workspace:
      resolveAbsolutePath(envString(env, ["CURSOR_BRIDGE_WORKSPACE"]), cwd) ??
      cwd,
    timeoutMs: envNumber(env, ["CURSOR_BRIDGE_TIMEOUT_MS"], 300_000),
    tlsCertPath: resolveAbsolutePath(
      envString(env, ["CURSOR_BRIDGE_TLS_CERT"]),
      cwd,
    ),
    tlsKeyPath: resolveAbsolutePath(
      envString(env, ["CURSOR_BRIDGE_TLS_KEY"]),
      cwd,
    ),
    sessionsLogPath,
    chatOnlyWorkspaceExplicit,
    chatOnlyWorkspace: envBool(
      env,
      ["CURSOR_BRIDGE_CHAT_ONLY_WORKSPACE"],
      true,
    ),
    mode,
    verbose: envBool(env, ["CURSOR_BRIDGE_VERBOSE"], false),
    configDirs,
    multiPort: envBool(env, ["CURSOR_BRIDGE_MULTI_PORT"], false),
  };
}

export function resolveAgentCommand(
  cmd: string,
  args: string[],
  opts: EnvOptions = {},
): AgentCommand {
  // This function is deprecated and no longer needed with SDK.
  // Kept for backward compatibility during migration.
  return { command: cmd, args, env: getEnvSource(opts.env) };
}
