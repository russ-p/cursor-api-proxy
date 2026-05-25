import { describe, expect, it } from "vitest";

import { buildAgentFixedArgs } from "./agent-cmd-args.js";
import type { BridgeConfig } from "./config.js";

function cfg(overrides: Partial<BridgeConfig> = {}): BridgeConfig {
  return {
    host: "127.0.0.1",
    port: 8765,
    defaultModel: "default",
    mode: "ask",
    strictModel: true,
    workspace: "/w",
    timeoutMs: 30_000,
    sessionsLogPath: "/tmp/s.log",
    chatOnlyWorkspace: true,
    chatOnlyWorkspaceExplicit: false,
    verbose: false,
    configDirs: [],
    multiPort: false,
    useCloudRuntime: false,
    cursorApiKey: undefined,
    ...overrides,
  };
}

describe("buildAgentFixedArgs", () => {
  it("throws because it is deprecated", () => {
    expect(() =>
      buildAgentFixedArgs(cfg(), "/ws", "gpt-5", false, "agent", true),
    ).toThrow("deprecated");
  });
});