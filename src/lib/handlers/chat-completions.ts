import { randomUUID } from "node:crypto";
import * as http from "node:http";

import { CursorSdkAgent } from "../sdk-agent.js";
import {
  isCursorAgentError,
  getHttpStatusCode,
  formatErrorForResponse,
} from "../sdk-errors.js";
import type { BridgeConfig } from "../config.js";
import type { CursorExecutionMode } from "../execution-mode.js";
import type { ModelCacheRef, CursorModel } from "./models.js";
import { getCachedCursorModels } from "./models.js";
import { json, writeSseHeaders } from "../http.js";
import { resolveModelForExecution } from "../model-map.js";
import {
  buildPromptFromMessages,
  normalizeModelId,
  toolsToSystemText,
  type OpenAiChatCompletionRequest,
} from "../openai.js";
import {
  logAgentError,
  logAccountAssigned,
  logAccountStats,
  logModelResolution,
  logTrafficRequest,
  logTrafficResponse,
  type TrafficMessage,
} from "../request-log.js";
import { rememberResolvedModel, resolveModel } from "../resolve-model.js";
import { resolveRequestMode } from "../resolve-mode.js";
import { resolveWorkspace } from "../workspace.js";
import { sanitizeMessages } from "../sanitize.js";
import {
  getNextAccountConfigDir,
  reportRequestStart,
  reportRequestEnd,
  reportRateLimit,
  reportRequestSuccess,
  reportRequestError,
  getAccountStats,
} from "../account-pool.js";
import { buildRuntimeOptions } from "../sdk-runtime.js";

export type ChatCompletionsCtx = {
  config: BridgeConfig;
  lastRequestedModelRef: { current?: string };
  modelCacheRef: ModelCacheRef;
};

export async function handleChatCompletions(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  ctx: ChatCompletionsCtx,
  rawBody: string,
  method: string,
  pathname: string,
  remoteAddress: string,
): Promise<void> {
  const { config, lastRequestedModelRef, modelCacheRef } = ctx;
  const body = JSON.parse(rawBody || "{}") as OpenAiChatCompletionRequest;
  const requested = normalizeModelId(body.model);
  const model = resolveModel(requested, lastRequestedModelRef, config);
  const models = await getCachedCursorModels(config, modelCacheRef);
  const decision = resolveModelForExecution({
    requested: model,
    defaultModel: config.defaultModel,
    availableCursorIds: models.map((m) => m.id),
  });
  const cursorModel = decision.final;
  rememberResolvedModel(cursorModel, lastRequestedModelRef);
  logModelResolution(config.verbose, decision);
  // When request is "default", use defaultModel for response display (dashboard) if set; else echo "default"
  const displayModel =
    decision.requestedWasDefault && config.defaultModel !== "default"
      ? config.defaultModel
      : model;

  const cleanMessages = sanitizeMessages(body.messages ?? []);

  const toolsText = toolsToSystemText(body.tools, body.functions);
  const messagesWithTools = toolsText
    ? [{ role: "system", content: toolsText }, ...cleanMessages]
    : cleanMessages;
  const prompt = buildPromptFromMessages(messagesWithTools);

  const trafficMessages: TrafficMessage[] = cleanMessages.map((m: any) => {
    const content =
      typeof m?.content === "string"
        ? m.content
        : Array.isArray(m?.content)
          ? (m.content as Array<{ type?: string; text?: string }>)
              .filter((p) => p.type === "text")
              .map((p) => p.text ?? "")
              .join("")
          : "";
    return { role: String(m?.role ?? "user"), content };
  });
  logTrafficRequest(
    config.verbose,
    model ?? cursorModel,
    trafficMessages,
    !!body.stream,
  );

  let mode: CursorExecutionMode;
  try {
    mode = resolveRequestMode(
      config,
      req.headers["x-cursor-mode"],
      body.mode,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid mode";
    json(res, 400, { error: { message: msg, code: "invalid_mode" } });
    return;
  }

  const effectiveChatOnly =
    mode === "ask"
      ? config.chatOnlyWorkspace
      : config.chatOnlyWorkspaceExplicit && config.chatOnlyWorkspace;

  const headerWs = req.headers["x-cursor-workspace"];
  let workspaceDir: string;
  try {
    const ws = resolveWorkspace(config, headerWs, effectiveChatOnly);
    workspaceDir = ws.workspaceDir;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid workspace";
    json(res, 400, { error: { message: msg, code: "invalid_workspace" } });
    return;
  }

  const id = `chatcmpl_${randomUUID().replace(/-/g, "")}`;
  const created = Math.floor(Date.now() / 1000);

  // Account pool tracking (for multi-account scenarios)
  const configDir = getNextAccountConfigDir();
  logAccountAssigned(configDir);
  reportRequestStart(configDir);

  const abortController = new AbortController();
  req.once("close", () => abortController.abort());

  // Check if API key is available
  if (!config.cursorApiKey && config.useCloudRuntime) {
    reportRequestEnd(configDir);
    reportRequestError(configDir, 0);
    logAccountStats(config.verbose, getAccountStats());
    json(res, 500, {
      error: {
        message: "CURSOR_API_KEY is required for cloud runtime",
        code: "missing_api_key",
        type: "api_error",
      },
    });
    return;
  }

  // Build runtime options
  const runtime = buildRuntimeOptions({
    type: config.useCloudRuntime ? "cloud" : "local",
    cwd: workspaceDir,
  });

  // Create SDK agent
  const agent = new CursorSdkAgent({
    apiKey: config.cursorApiKey ?? "",
    model: cursorModel,
    cwd: workspaceDir,
    timeoutMs: config.timeoutMs,
    signal: abortController.signal,
  });

  const streamStart = Date.now();

  if (body.stream) {
    writeSseHeaders(res);
    res.on("error", () => {
      /* client disconnected mid-stream */
    });

    let accumulated = "";

    try {
      await agent.execute(prompt, (chunk) => {
        accumulated += chunk;
        res.write(
          `data: ${JSON.stringify({
            id,
            object: "chat.completion.chunk",
            created,
            model: displayModel,
            choices: [
              { index: 0, delta: { content: chunk }, finish_reason: null },
            ],
          })}\n\n`,
        );
      });
    } catch (err) {
      const latencyMs = Date.now() - streamStart;
      reportRequestEnd(configDir);

      if (!abortController.signal.aborted) {
        reportRequestError(configDir, latencyMs);

        const statusCode = getHttpStatusCode(err);
        const formatted = formatErrorForResponse(err);

        // Log the error
        logAgentError(
          config.sessionsLogPath,
          method,
          pathname,
          remoteAddress,
          isCursorAgentError(err) ? 1 : 500,
          isCursorAgentError(err) ? err.message : String(err),
        );

        if (isRateLimitError(err)) {
          reportRateLimit(configDir, 60000);
        }

        res.write(
          `data: ${JSON.stringify({
            error: { message: formatted.message, code: "cursor_sdk_error" },
          })}\n\n`,
        );
      }

      await agent.dispose();
      logAccountStats(config.verbose, getAccountStats());
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    await agent.dispose();

    const latencyMs = Date.now() - streamStart;
    reportRequestEnd(configDir);
    reportRequestSuccess(configDir, latencyMs);

    logTrafficResponse(
      config.verbose,
      model ?? cursorModel,
      accumulated,
      true,
    );

    const promptTokens = Math.max(1, Math.round(prompt.length / 4));
    const completionTokens = Math.max(1, Math.round(accumulated.length / 4));
    res.write(
      `data: ${JSON.stringify({
        id,
        object: "chat.completion.chunk",
        created,
        model: displayModel,
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
      })}\n\n`,
    );
    res.write("data: [DONE]\n\n");
    res.end();
    logAccountStats(config.verbose, getAccountStats());
    return;
  }

  // Non-streaming mode
  let result: string;
  try {
    const agentResult = await agent.execute(prompt);
    result = agentResult.text;
  } catch (err) {
    const syncLatency = Date.now() - streamStart;
    reportRequestEnd(configDir);
    reportRequestError(configDir, syncLatency);

    const statusCode = getHttpStatusCode(err);
    const formatted = formatErrorForResponse(err);

    // Log the error
    logAgentError(
      config.sessionsLogPath,
      method,
      pathname,
      remoteAddress,
      isCursorAgentError(err) ? 1 : 500,
      isCursorAgentError(err) ? err.message : String(err),
    );

    if (isRateLimitError(err)) {
      reportRateLimit(configDir, 60000);
    }

    await agent.dispose();
    logAccountStats(config.verbose, getAccountStats());

    json(res, statusCode, {
      error: {
        message: formatted.message,
        code: "cursor_sdk_error",
        type: formatted.type,
      },
    });
    return;
  }

  await agent.dispose();

  const syncLatency = Date.now() - streamStart;
  reportRequestEnd(configDir);
  reportRequestSuccess(configDir, syncLatency);

  logTrafficResponse(config.verbose, model ?? cursorModel, result, false);

  const promptTokens = Math.max(1, Math.round(prompt.length / 4));
  const completionTokens = Math.max(1, Math.round(result.length / 4));
  const totalTokens = promptTokens + completionTokens;

  logAccountStats(config.verbose, getAccountStats());
  json(res, 200, {
    id,
    object: "chat.completion",
    created,
    model: displayModel,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: result },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
    },
  });
}

// Helper function for rate limit detection
function isRateLimitError(err: unknown): boolean {
  if (isCursorAgentError(err)) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("429") ||
      msg.includes("rate limit") ||
      msg.includes("too many requests")
    );
  }
  return false;
}