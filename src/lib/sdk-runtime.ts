import { Agent } from "@cursor/sdk";

export type RuntimeConfig = {
  type: "local" | "cloud";
  cwd?: string;  // For local runtime
  repos?: Array<{ url: string; startingRef?: string }>;  // For cloud runtime
};

/**
 * Build runtime options for SDK Agent.
 */
export function buildRuntimeOptions(config: RuntimeConfig): {
  local?: { cwd: string; settingSources?: string[] };
  cloud?: {
    repos: Array<{ url: string; startingRef?: string }>;
    autoCreatePR?: boolean;
    skipReviewerRequest?: boolean;
  };
} {
  if (config.type === "cloud") {
    return {
      cloud: {
        repos: config.repos ?? [],
        autoCreatePR: false,  // Proxy is for chat, not PRs
        skipReviewerRequest: true,
      },
    };
  }

  // Local runtime
  return {
    local: {
      cwd: config.cwd ?? process.cwd(),
      settingSources: [],  // Don't load ambient settings by default
    },
  };
}