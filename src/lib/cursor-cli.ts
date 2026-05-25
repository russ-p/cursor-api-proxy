/**
 * @deprecated This file is deprecated. The SDK (@cursor/sdk) now handles
 * agent execution directly via CursorSdkAgent. This file is kept only for
 * backward compatibility and will be removed in a future version.
 */

import type { BridgeConfig } from "./config.js";

export type CursorCliModel = { id: string; name: string };

/**
 * @deprecated Use listSdkModels() from sdk-models.ts instead.
 */
export function parseCursorCliModels(_output: string): CursorCliModel[] {
  throw new Error(
    "parseCursorCliModels is deprecated. Use listSdkModels() from sdk-models.ts instead.",
  );
}

/**
 * @deprecated Use listSdkModels() from sdk-models.ts instead.
 */
export async function listCursorCliModels(_args: {
  agentBin: string;
  timeoutMs: number;
}): Promise<CursorCliModel[]> {
  throw new Error(
    "listCursorCliModels is deprecated. Use listSdkModels() from sdk-models.ts instead.",
  );
}