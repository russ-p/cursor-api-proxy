import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { describe, expect, it, afterEach } from "vitest";

import { loadEnvConfig, resolveAgentCommand } from "./env.js";

describe("loadEnvConfig", () => {
  it("returns defaults when env is empty", () => {
    const loaded = loadEnvConfig({ env: {}, cwd: "/workspace" });

    expect(loaded.cursorApiKey).toBeUndefined();
    expect(loaded.host).toBe("127.0.0.1");
    expect(loaded.port).toBe(8765);
    expect(loaded.defaultModel).toBe("default");
    expect(loaded.strictModel).toBe(true);
    expect(loaded.workspace).toBe("/workspace");
    expect(loaded.sessionsLogPath).toBe(path.join("/workspace", "sessions.log"));
    expect(loaded.chatOnlyWorkspace).toBe(true);
    expect(loaded.chatOnlyWorkspaceExplicit).toBe(false);
    expect(loaded.mode).toBeUndefined();
    expect(loaded.verbose).toBe(false);
    expect(loaded.commandShell).toBe("cmd.exe");
    expect(loaded.useCloudRuntime).toBe(false);
  });

  it("parses booleans, numbers, and model normalization", () => {
    const loaded = loadEnvConfig({
      env: {
        CURSOR_BRIDGE_STRICT_MODEL: "off",
        CURSOR_BRIDGE_TIMEOUT_MS: "60000",
        CURSOR_BRIDGE_DEFAULT_MODEL: "org/claude-3-opus",
      },
    });

    expect(loaded.strictModel).toBe(false);
    expect(loaded.timeoutMs).toBe(60000);
    expect(loaded.defaultModel).toBe("claude-3-opus");
  });

  it("parses CURSOR_BRIDGE_MODE and marks chat-only env as explicit", () => {
    const loaded = loadEnvConfig({
      env: {
        CURSOR_BRIDGE_MODE: "plan",
        CURSOR_BRIDGE_CHAT_ONLY_WORKSPACE: "false",
      },
      cwd: "/w",
    });
    expect(loaded.mode).toBe("plan");
    expect(loaded.chatOnlyWorkspaceExplicit).toBe(true);
    expect(loaded.chatOnlyWorkspace).toBe(false);
  });

  it("throws on invalid CURSOR_BRIDGE_MODE", () => {
    expect(() =>
      loadEnvConfig({ env: { CURSOR_BRIDGE_MODE: "nope" }, cwd: "/w" }),
    ).toThrow(/CURSOR_BRIDGE_MODE/);
  });

  it("resolves workspace and explicit paths from cwd", () => {
    const loaded = loadEnvConfig({
      env: {
        CURSOR_BRIDGE_WORKSPACE: "./repo",
        CURSOR_BRIDGE_SESSIONS_LOG: "./logs/sessions.log",
        CURSOR_BRIDGE_TLS_CERT: "./certs/dev.crt",
        CURSOR_BRIDGE_TLS_KEY: "./certs/dev.key",
      },
      cwd: "/tmp/project",
    });

    expect(loaded.workspace).toBe(path.resolve("/tmp/project", "./repo"));
    expect(loaded.sessionsLogPath).toBe(
      path.resolve("/tmp/project", "./logs/sessions.log"),
    );
    expect(loaded.tlsCertPath).toBe(
      path.resolve("/tmp/project", "./certs/dev.crt"),
    );
    expect(loaded.tlsKeyPath).toBe(
      path.resolve("/tmp/project", "./certs/dev.key"),
    );
  });

  it("uses HOME before USERPROFILE for default sessions log path", () => {
    const loaded = loadEnvConfig({
      env: {
        HOME: "/home/alice",
        USERPROFILE: "C:\\Users\\alice",
      },
      cwd: "/tmp/project",
    });

    expect(loaded.sessionsLogPath).toBe(
      path.join("/home/alice", ".cursor-api-proxy", "sessions.log"),
    );
  });

  it("uses USERPROFILE when HOME is not set", () => {
    const loaded = loadEnvConfig({
      env: {
        USERPROFILE: "C:\\Users\\alice",
      },
      cwd: "/tmp/project",
    });

    expect(loaded.sessionsLogPath).toBe(
      path.join("C:\\Users\\alice", ".cursor-api-proxy", "sessions.log"),
    );
  });

  it("applies tailscale host fallback only when host is unset", () => {
    expect(loadEnvConfig({ env: {}, tailscale: true }).host).toBe("0.0.0.0");

    expect(
      loadEnvConfig({
        env: { CURSOR_BRIDGE_HOST: "10.0.0.5" },
        tailscale: true,
      }).host,
    ).toBe("10.0.0.5");
  });

  it("parses CURSOR_CONFIG_DIRS as comma-separated absolute paths", () => {
    const loaded = loadEnvConfig({
      env: { CURSOR_CONFIG_DIRS: "/acc/a,/acc/b,/acc/c" },
      cwd: "/workspace",
    });
    expect(loaded.configDirs).toEqual([
      path.resolve("/workspace", "/acc/a"),
      path.resolve("/workspace", "/acc/b"),
      path.resolve("/workspace", "/acc/c"),
    ]);
  });

  it("CURSOR_ACCOUNT_DIRS is an alias for CURSOR_CONFIG_DIRS", () => {
    const loaded = loadEnvConfig({
      env: { CURSOR_ACCOUNT_DIRS: "/acc/x,/acc/y" },
      cwd: "/workspace",
    });
    expect(loaded.configDirs).toEqual([
      path.resolve("/workspace", "/acc/x"),
      path.resolve("/workspace", "/acc/y"),
    ]);
  });

  it("CURSOR_CONFIG_DIRS takes precedence over CURSOR_ACCOUNT_DIRS", () => {
    const loaded = loadEnvConfig({
      env: {
        CURSOR_CONFIG_DIRS: "/primary/a",
        CURSOR_ACCOUNT_DIRS: "/secondary/b",
      },
      cwd: "/workspace",
    });
    expect(loaded.configDirs).toEqual([
      path.resolve("/workspace", "/primary/a"),
    ]);
  });

  it("trims whitespace from each dir in CURSOR_CONFIG_DIRS", () => {
    const loaded = loadEnvConfig({
      env: { CURSOR_CONFIG_DIRS: " /acc/a , /acc/b " },
      cwd: "/workspace",
    });
    expect(loaded.configDirs).toEqual([
      path.resolve("/workspace", "/acc/a"),
      path.resolve("/workspace", "/acc/b"),
    ]);
  });

  it("resolves relative dirs in CURSOR_CONFIG_DIRS against cwd", () => {
    const loaded = loadEnvConfig({
      env: { CURSOR_CONFIG_DIRS: "./accounts/a,./accounts/b" },
      cwd: "/workspace",
    });
    expect(loaded.configDirs).toEqual([
      path.resolve("/workspace", "./accounts/a"),
      path.resolve("/workspace", "./accounts/b"),
    ]);
  });

  it("returns empty configDirs when CURSOR_CONFIG_DIRS is unset and no accounts dir", () => {
    const loaded = loadEnvConfig({
      env: { HOME: "/nonexistent-home-" + Date.now() },
      cwd: "/workspace",
    });
    expect(loaded.configDirs).toEqual([]);
  });

  it("multiPort defaults to false", () => {
    const loaded = loadEnvConfig({ env: {}, cwd: "/workspace" });
    expect(loaded.multiPort).toBe(false);
  });

  it("multiPort is parsed from CURSOR_BRIDGE_MULTI_PORT env var", () => {
    expect(
      loadEnvConfig({ env: { CURSOR_BRIDGE_MULTI_PORT: "true" } }).multiPort,
    ).toBe(true);
    expect(
      loadEnvConfig({ env: { CURSOR_BRIDGE_MULTI_PORT: "1" } }).multiPort,
    ).toBe(true);
    expect(
      loadEnvConfig({ env: { CURSOR_BRIDGE_MULTI_PORT: "false" } }).multiPort,
    ).toBe(false);
  });

  it("falls back to default port 8765 for invalid CURSOR_BRIDGE_PORT", () => {
    expect(
      loadEnvConfig({ env: { CURSOR_BRIDGE_PORT: "not-a-number" } }).port,
    ).toBe(8765);
    expect(loadEnvConfig({ env: { CURSOR_BRIDGE_PORT: "0" } }).port).toBe(8765);
    expect(loadEnvConfig({ env: { CURSOR_BRIDGE_PORT: "-1" } }).port).toBe(
      8765,
    );
  });

  it("sets cursorApiKey when CURSOR_API_KEY is set", () => {
    expect(loadEnvConfig({ env: { CURSOR_API_KEY: "sk-abc" } }).cursorApiKey).toBe("sk-abc");
  });

  it("sets cursorApiKey when CURSOR_AUTH_TOKEN is set", () => {
    expect(loadEnvConfig({ env: { CURSOR_AUTH_TOKEN: "sk-xyz" } }).cursorApiKey).toBe("sk-xyz");
  });

  it("prefers CURSOR_API_KEY over CURSOR_AUTH_TOKEN", () => {
    expect(
      loadEnvConfig({
        env: { CURSOR_API_KEY: "sk-api", CURSOR_AUTH_TOKEN: "sk-auth" },
      }).cursorApiKey,
    ).toBe("sk-api");
  });

  it("sets useCloudRuntime to true when CURSOR_BRIDGE_USE_CLOUD_RUNTIME is set", () => {
    expect(
      loadEnvConfig({ env: { CURSOR_BRIDGE_USE_CLOUD_RUNTIME: "true" } }).useCloudRuntime,
    ).toBe(true);
  });
});

describe("discoverAccountDirs filtering", () => {
  let tmpBase: string;

  afterEach(() => {
    if (tmpBase) {
      try {
        fs.rmSync(tmpBase, { recursive: true, force: true });
      } catch {}
    }
  });

  function makeTmpAccounts(): string {
    tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "cap-test-"));
    const accountsDir = path.join(tmpBase, ".cursor-api-proxy", "accounts");
    fs.mkdirSync(accountsDir, { recursive: true });
    return accountsDir;
  }

  function writeCliConfig(dir: string, withAuth: boolean) {
    fs.mkdirSync(dir, { recursive: true });
    const cfg = withAuth
      ? {
          authInfo: { email: "test@example.com", displayName: "Test" },
          version: 1,
        }
      : { version: 1, permissions: {} };
    fs.writeFileSync(path.join(dir, "cli-config.json"), JSON.stringify(cfg));
  }

  it("auto-discovers only authenticated account dirs", () => {
    const accountsDir = makeTmpAccounts();
    writeCliConfig(path.join(accountsDir, "auth-account"), true);
    writeCliConfig(path.join(accountsDir, "no-auth-account"), false);
    fs.mkdirSync(path.join(accountsDir, "empty-account"), { recursive: true }); // no cli-config.json

    const loaded = loadEnvConfig({ env: { HOME: tmpBase }, cwd: "/workspace" });
    expect(loaded.configDirs).toHaveLength(1);
    expect(loaded.configDirs[0]).toContain("auth-account");
  });

  it("returns empty configDirs when all account dirs are unauthenticated", () => {
    const accountsDir = makeTmpAccounts();
    writeCliConfig(path.join(accountsDir, "no-auth-1"), false);
    writeCliConfig(path.join(accountsDir, "no-auth-2"), false);

    const loaded = loadEnvConfig({ env: { HOME: tmpBase }, cwd: "/workspace" });
    expect(loaded.configDirs).toEqual([]);
  });

  it("returns empty when accounts dir does not exist", () => {
    tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "cap-test-"));
    const loaded = loadEnvConfig({ env: { HOME: tmpBase }, cwd: "/workspace" });
    expect(loaded.configDirs).toEqual([]);
  });

  it("discovers multiple authenticated accounts and preserves filesystem order", () => {
    const accountsDir = makeTmpAccounts();
    writeCliConfig(path.join(accountsDir, "a-account"), true);
    writeCliConfig(path.join(accountsDir, "b-account"), true);
    writeCliConfig(path.join(accountsDir, "c-account"), true);

    const loaded = loadEnvConfig({ env: { HOME: tmpBase }, cwd: "/workspace" });
    expect(loaded.configDirs).toHaveLength(3);
    expect(loaded.configDirs.map((d) => path.basename(d))).toEqual(
      expect.arrayContaining(["a-account", "b-account", "c-account"]),
    );
  });

  it("CURSOR_CONFIG_DIRS takes priority over auto-discovery", () => {
    const accountsDir = makeTmpAccounts();
    writeCliConfig(path.join(accountsDir, "discovered"), true);

    const loaded = loadEnvConfig({
      env: { HOME: tmpBase, CURSOR_CONFIG_DIRS: "/explicit/dir" },
      cwd: "/workspace",
    });
    expect(loaded.configDirs).toEqual([
      path.resolve("/workspace", "/explicit/dir"),
    ]);
  });
});

describe("resolveAgentCommand", () => {
  it("returns stub result on all platforms", () => {
    const command = resolveAgentCommand("agent", ["--help"], {
      platform: "darwin",
      env: {},
    });

    expect(command.command).toBe("agent");
    expect(command.args).toEqual(["--help"]);
    expect(command.windowsVerbatimArguments).toBeUndefined();
  });

  it("returns stub result on Windows", () => {
    const command = resolveAgentCommand("agent.cmd", ["--print", "hello"], {
      platform: "win32",
      env: {},
    });

    expect(command.command).toBe("agent.cmd");
    expect(command.args).toEqual(["--print", "hello"]);
    expect(command.windowsVerbatimArguments).toBeUndefined();
  });
});