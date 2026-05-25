import { randomUUID } from "node:crypto";
import * as http from "node:http";

import { CursorSdkAgent } from "../sdk-agent.js";
import {
  isCursorAgentError,
  getHttpStatusCode,
  formatErrorForResponse,
} from "../sdk-errors.js";
import type { AnthropicMessagesRequest } from "../anthropic.js";
import { buildPromptFromAnthropicMessages } from "../anthropic.js";
import type { BridgeConfig } from "../config.js";
import type { CursorExecutionMode } from "../execution-mode.js";
import type { ModelCacheRef, CursorModel } from "./models.js";
import { getCachedCursorModels } from "./models.js";
import { json, writeSseHeaders } from "../http.js";
import { resolveModelForExecution } from "../model-map.js";
import { normalizeModelId, toolsToSystemText } from "../openai.js";
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
import { sanitizeMessages, sanitizeSystem } from "../sanitize.js";
import {
  getNextAccountConfigDir,
  reportRequestStart,
  reportRequestEnd,
  reportRateLimit,
  reportRequestSuccess,
  reportRequestError,
  getAccountStats,
} from "../account-pool.js";

function isRateLimited(err: unknown): boolean {
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

export type AnthropicMessagesCtx = {
  config: BridgeConfig;
  lastRequestedModelRef: { current?: string };
  modelCacheRef: ModelCacheRef;
};

export async function handleAnthropicMessages(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  ctx: AnthropicMessagesCtx,
  rawBody: string,
  method: string,
  pathname: string,
  remoteAddress: string,
): Promise<void> {
  const { config, lastRequestedModelRef, modelCacheRef } = ctx;
  const body = JSON.parse(rawBody || "{}") as AnthropicMessagesRequest;
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
  const displayModel =
    decision.requestedWasDefault && config.defaultModel !== "default"
      ? config.defaultModel
      : model;

  const cleanSystem = sanitizeSystem(body.system);
  const cleanMessages = sanitizeMessages(
    body.messages ?? [],
  ) as AnthropicMessagesRequest["messages"];

  const toolsText = toolsToSystemText((body as any).tools);
  const systemWithTools = toolsText
    ? [cleanSystem, toolsText].filter(Boolean).join("\n\n")
    : cleanSystem;
  const prompt = buildPromptFromAnthropicMessages(
    cleanMessages,
    systemWithTools as AnthropicMessagesRequest["system"],
  );

  if (body.max_tokens == null || typeof body.max_tokens !== "number") {
    json(res, 400, {
      error: {
        type: "invalid_request_error",
        message: "max_tokens is required",
      },
    });
    return;
  }

  const trafficMessages: TrafficMessage[] = [];
  if (cleanSystem) {
    const sys =
      typeof cleanSystem === "string"
        ? cleanSystem
        : (cleanSystem as Array<{ type?: string; text?: string }>)
            .filter((p) => p.type === "text")
            .map((p) => p.text ?? "")
            .join("\n");
    if (sys.trim())
      trafficMessages.push({ role: "system", content: sys.trim() });
  }
  for (const m of cleanMessages) {
    const text =
      typeof m.content === "string"
        ? m.content
        : (m.content as Array<{ type?: string; text?: string }>)
            .filter((p) => p.type === "text")
            .map((p) => p.text ?? "")
            .join("");
    if (text) trafficMessages.push({ role: m.role, content: text });
  }
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
    json(res, 400, {
      error: {
        type: "invalid_request_error",
        message: msg,
        code: "invalid_mode",
      },
    });
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
    json(res, 400, {
      error: { type: "invalid_request_error", message: msg },
    });
    return;
  }

  const msgId = `msg_${randomUUID().replace(/-/g, "")}`;

  // Account pool tracking
  const configDir = getNextAccountConfigDir();
  logAccountAssigned(configDir);
  reportRequestStart(configDir);

  const abortController = new AbortController();
  req.once("close", () => abortController.abort());

  // Check if API key is available for cloud runtime
  if (!config.cursorApiKey && config.useCloudRuntime) {
    reportRequestEnd(configDir);
    reportRequestError(configDir, 0);
    logAccountStats(config.verbose, getAccountStats());
    json(res, 500, {
      error: {
        type: "api_error",
        message: "CURSOR_API_KEY is required for cloud runtime",
        code: "missing_api_key",
      },
    });
    return;
  }

  if (body.stream) {
    writeSseHeaders(res);
    res.on("error", () => {
      /* client disconnected mid-stream */
    });

    const writeEvent = (evt: object) => {
      res.write(`data: ${JSON.stringify(evt)}\n\n`);
    };

    writeEvent({
      type: "message_start",
      message: {
        id: msgId,
        type: "message",
        role: "assistant",
        model: displayModel ?? cursorModel,
        content: [],
      },
    });
    writeEvent({
      type: "content_block_start",
      index: 0,
      content_block: { type: "text", text: "" },
    });

    const streamStart = Date.now();

    const agent = new CursorSdkAgent({
      apiKey: config.cursorApiKey ?? "",
      model: cursorModel,
      cwd: workspaceDir,
      timeoutMs: config.timeoutMs,
      signal: abortController.signal,
    });

    let accumulated = "";

    try {
      await agent.execute(prompt, (chunk) => {
        accumulated += chunk;
        writeEvent({
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: chunk },
        });
      });
    } catch (err) {
      const latencyMs = Date.now() - streamStart;
      reportRequestEnd(configDir);

      if (!abortController.signal.aborted) {
        reportRequestError(configDir, latencyMs);

        const statusCode = getHttpStatusCode(err);
        const formatted = formatErrorForResponse(err);

        logAgentError(
          config.sessionsLogPath,
          method,
          pathname,
          remoteAddress,
          isCursorAgentError(err) ? 1 : 500,
          isCursorAgentError(err) ? err.message : String(err),
        );

        if (isRateLimited(err)) {
          reportRateLimit(configDir, 60000);
        }

        writeEvent({
          type: "error",
          error: { type: "api_error", message: formatted.message },
        });
      }

      await agent.dispose();
      logAccountStats(config.verbose, getAccountStats());
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

    writeEvent({ type: "content_block_stop", index: 0 });
    writeEvent({
      type: "message_delta",
      delta: { stop_reason: "end_turn", stop_sequence: null },
      usage: { output_tokens: 0 },
    });
    writeEvent({ type: "message_stop" });

    logAccountStats(config.verbose, getAccountStats());
    res.end();
    return;
  }

  // Non-streaming mode
  const syncStart = Date.now();

  const agent = new CursorSdkAgent({
    apiKey: config.cursorApiKey ?? "",
    model: cursorModel,
    cwd: workspaceDir,
    timeoutMs: config.timeoutMs,
    signal: abortController.signal,
  });

  let result: string;
  try {
    const agentResult = await agent.execute(prompt);
    result = agentResult.text;
  } catch (err) {
    const syncLatency = Date.now() - syncStart;
    reportRequestEnd(configDir);
    reportRequestError(configDir, syncLatency);

    const statusCode = getHttpStatusCode(err);
    const formatted = formatErrorForResponse(err);

    logAgentError(
      config.sessionsLogPath,
      method,
      pathname,
      remoteAddress,
      isCursorAgentError(err) ? 1 : 500,
      isCursorAgentError(err) ? err.message : String(err),
    );

    if (isRateLimited(err)) {
      reportRateLimit(configDir, 60000);
    }

    await agent.dispose();
    logAccountStats(config.verbose, getAccountStats());

    json(res, statusCode, {
      error: {
        type: "api_error",
        message: formatted.message,
        code: "cursor_sdk_error",
      },
    });
    return;
  }

  await agent.dispose();

  const syncLatency = Date.now() - syncStart;
  reportRequestEnd(configDir);
  reportRequestSuccess(configDir, syncLatency);

  logTrafficResponse(config.verbose, model ?? cursorModel, result, false);
  logAccountStats(config.verbose, getAccountStats());

  const inTok = Math.max(1, Math.round(prompt.length / 4));
  const outTok = Math.max(1, Math.round(result.length / 4));

  json(res, 200, {
    id: msgId,
    type: "message",
    role: "assistant",
    content: [{ type: "text", text: result }],
    model: displayModel ?? cursorModel,
    stop_reason: "end_turn",
    usage: {
      input_tokens: inTok,
      output_tokens: outTok,
    },
  });
}