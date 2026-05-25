import { Cursor } from "@cursor/sdk";

export type SdkModel = {
  id: string;
  name: string;
};

/**
 * Fetch available models from Cursor SDK.
 */
export async function listSdkModels(apiKey?: string): Promise<SdkModel[]> {
  const models = await Cursor.models.list({ apiKey });

  return models.map((m) => ({
    id: m.id,
    name: m.displayName ?? m.id,
  }));
}