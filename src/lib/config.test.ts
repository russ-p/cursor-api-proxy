import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { loadBridgeConfig } from "./config.js";

describe("loadBridgeConfig", () => {
  it("returns defaults when env is empty", () => {
    const config = loadBridgeConfig({ env: {}, cwd: "/workspace" });

    expect(config.cursorApiKey).toBeUndefined();
    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(8765);
    expect(config.requiredKey).toBeUndefined();
    expect(config.defaultModel).toBe("default");
    expect(config.strictModel).toBe(true);
    expect(config.mode).toBe("ask");
    expect(config.workspace).toBe("/workspace");
    expect(config.chatOnlyWorkspace).toBe(true);
    expect(config.chatOnlyWorkspaceExplicit).toBe(false);
    expect(config.sessionsLogPath).toBe(path.join("/workspace", "sessions.log"));
    expect(config.useCloudRuntime).toBe(false);
  });

  it("assembles config from the centralized env layer", () => {
    const config = loadBridgeConfig({
      env: {
        CURSOR_BRIDGE_HOST: "0.0.0.0",
        CURSOR_BRIDGE_PORT: "9999",
        CURSOR_BRIDGE_API_KEY: "sk-secret",
        CURSOR_BRIDGE_DEFAULT_MODEL: "org/claude-3-opus",
        CURSOR_BRIDGE_STRICT_MODEL: "false",
        CURSOR_BRIDGE_WORKSPACE: "./my-workspace",
        CURSOR_BRIDGE_TIMEOUT_MS: "60000",
        CURSOR_BRIDGE_CHAT_ONLY_WORKSPACE: "false",
        CURSOR_BRIDGE_VERBOSE: "1",
        CURSOR_BRIDGE_TLS_CERT: "./certs/test.crt",
        CURSOR_BRIDGE_TLS_KEY: "./certs/test.key",
      },
      cwd: "/tmp/project",
    });

    expect(config.host).toBe("0.0.0.0");
    expect(config.port).toBe(9999);
    expect(config.requiredKey).toBe("sk-secret");
    expect(config.defaultModel).toBe("claude-3-opus");
    expect(config.strictModel).toBe(false);
    expect(path.isAbsolute(config.workspace)).toBe(true);
    expect(config.workspace).toContain("my-workspace");
    expect(config.timeoutMs).toBe(60000);
    expect(config.chatOnlyWorkspace).toBe(false);
    expect(config.chatOnlyWorkspaceExplicit).toBe(true);
    expect(config.verbose).toBe(true);
    expect(config.tlsCertPath).toBe(
      path.resolve("/tmp/project", "./certs/test.crt"),
    );
    expect(config.tlsKeyPath).toBe(
      path.resolve("/tmp/project", "./certs/test.key"),
    );
  });

  it("sets cursorApiKey when CURSOR_API_KEY is set", () => {
    const config = loadBridgeConfig({
      env: { CURSOR_API_KEY: "sk-abc" },
      cwd: "/workspace",
    });
    expect(config.cursorApiKey).toBe("sk-abc");
  });

  it("sets cursorApiKey when CURSOR_AUTH_TOKEN is set", () => {
    const config = loadBridgeConfig({
      env: { CURSOR_AUTH_TOKEN: "sk-xyz" },
      cwd: "/workspace",
    });
    expect(config.cursorApiKey).toBe("sk-xyz");
  });

  it("prefers CURSOR_API_KEY over CURSOR_AUTH_TOKEN", () => {
    const config = loadBridgeConfig({
      env: { CURSOR_API_KEY: "sk-api", CURSOR_AUTH_TOKEN: "sk-auth" },
      cwd: "/workspace",
    });
    expect(config.cursorApiKey).toBe("sk-api");
  });

  it("sets useCloudRuntime to true when CURSOR_BRIDGE_USE_CLOUD_RUNTIME is set", () => {
    const config = loadBridgeConfig({
      env: { CURSOR_BRIDGE_USE_CLOUD_RUNTIME: "true" },
      cwd: "/workspace",
    });
    expect(config.useCloudRuntime).toBe(true);
  });

  it("uses tailscale host fallback without mutating process.env", () => {
    const config = loadBridgeConfig({
      env: {},
      tailscale: true,
      cwd: "/workspace",
    });

    expect(config.host).toBe("0.0.0.0");
  });

  it("reads CURSOR_BRIDGE_MODE from env", () => {
    const config = loadBridgeConfig({
      env: { CURSOR_BRIDGE_MODE: "agent" },
      cwd: "/workspace",
    });
    expect(config.mode).toBe("agent");
  });

  it("prefers env mode over CLI opts.mode", () => {
    const config = loadBridgeConfig({
      env: { CURSOR_BRIDGE_MODE: "plan" },
      mode: "agent",
      cwd: "/workspace",
    });
    expect(config.mode).toBe("plan");
  });

  it("uses opts.mode when env unset", () => {
    const config = loadBridgeConfig({
      env: {},
      mode: "agent",
      cwd: "/workspace",
    });
    expect(config.mode).toBe("agent");
  });

  it("throws on invalid CURSOR_BRIDGE_MODE", () => {
    expect(() =>
      loadBridgeConfig({
        env: { CURSOR_BRIDGE_MODE: "bogus" },
        cwd: "/workspace",
      }),
    ).toThrow(/CURSOR_BRIDGE_MODE/);
  });
});