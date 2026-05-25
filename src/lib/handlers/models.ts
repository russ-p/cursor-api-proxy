import * as http from "node:http";

import type { BridgeConfig } from "../config.js";
import { listSdkModels } from "../sdk-models.js";
import { json } from "../http.js";
import { getAnthropicModelAliases } from "../model-map.js";

const MODEL_CACHE_TTL_MS = 5 * 60_000;

export type CursorModel = { id: string; name: string };
export type ModelCache = { at: number; models: CursorModel[] };
export type ModelCacheRef = {
  current?: ModelCache;
  inflight?: Promise<CursorModel[]>;
};

export type HandleModelsOpts = {
  config: BridgeConfig;
  modelCacheRef: ModelCacheRef;
};

export async function getCachedCursorModels(
  config: BridgeConfig,
  modelCacheRef: ModelCacheRef,
): Promise<CursorModel[]> {
  const now = Date.now();
  if (
    !modelCacheRef.current ||
    now - modelCacheRef.current.at > MODEL_CACHE_TTL_MS
  ) {
    // Deduplicate concurrent fetches — reuse a single in-flight promise
    if (!modelCacheRef.inflight) {
      modelCacheRef.inflight = listSdkModels(config.cursorApiKey).then(
        (models) => {
          modelCacheRef.current = { at: Date.now(), models };
          modelCacheRef.inflight = undefined;
          return models;
        },
        (err) => {
          modelCacheRef.inflight = undefined;
          throw err;
        },
      );
    }
    await modelCacheRef.inflight;
  }
  return modelCacheRef.current?.models ?? [];
}

export async function handleModels(
  res: http.ServerResponse,
  opts: HandleModelsOpts,
): Promise<void> {
  const { config, modelCacheRef } = opts;
  const models = await getCachedCursorModels(config, modelCacheRef);
  const cursorModels = models.map((m) => ({
    id: m.id,
    object: "model" as const,
    owned_by: "cursor" as const,
    name: m.name,
  }));
  const anthropicAliases = getAnthropicModelAliases(
    models.map((m) => m.id),
  ).map((a) => ({
    id: a.id,
    object: "model" as const,
    owned_by: "cursor" as const,
    name: a.name,
  }));

  json(res, 200, {
    object: "list",
    data: [...cursorModels, ...anthropicAliases],
  });
}
