/**
 * @deprecated For cloud runtime, use CURSOR_API_KEY or CURSOR_AUTH_TOKEN environment variables.
 * For local runtime, this command is not supported. Please use the Cursor app or
 * existing local agent binary directly if needed.
 */

import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "../lib/env.js";
import { ACCOUNTS_DIR } from "./constants.js";
import { readKeychainToken, writeCachedToken } from "./usage.js";

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export async function handleLogin(
  _accountName?: string,
  _proxies?: string[],
): Promise<void> {
  const envCfg = loadEnvConfig();

  if (envCfg.useCloudRuntime) {
    console.log(
      "❌ Login command not supported for cloud runtime.\n",
    );
    console.log(
      "For cloud runtime, set the CURSOR_API_KEY or CURSOR_AUTH_TOKEN environment variable instead.\n",
    );
    console.log(
      "Example:\n  export CURSOR_API_KEY='your-api-key-here'\n  cursor-api-proxy start\n",
    );
    process.exit(1);
  }

  console.log(
    "❌ Login command is deprecated for local runtime.\n",
  );
  console.log(
    "Please use the Cursor app to log in, or use the existing local agent binary directly.\n",
  );
  console.log(
    "For multi-account pool management, the accounts command will be deprecated in a future version.\n",
  );
  process.exit(1);
}