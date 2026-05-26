import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the SDK at the top level before imports
vi.mock("@cursor/sdk", () => ({
  Cursor: {
    models: {
      list: vi.fn(),
    },
  },
}));

import { Cursor } from "@cursor/sdk";
import { listSdkModels } from "./sdk-models.js";

describe("sdk-models", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should list models", async () => {
    const mockModels = [
      { displayName: "Claude 3 Opus", id: "claude-3-opus" },
      { displayName: "Claude 3 Sonnet", id: "claude-3-sonnet" },
      { displayName: "Claude 3 Haiku", id: "claude-3-haiku" },
    ];

    vi.mocked(Cursor.models.list).mockResolvedValue(mockModels);

    const models = await listSdkModels("test-key");

    expect(Cursor.models.list).toHaveBeenCalledWith("test-key");
    expect(models).toHaveLength(3);
    expect(models[0]).toEqual({ id: "claude-3-opus", name: "Claude 3 Opus" });
    expect(models[1]).toEqual({ id: "claude-3-sonnet", name: "Claude 3 Sonnet" });
    expect(models[2]).toEqual({ id: "claude-3-haiku", name: "Claude 3 Haiku" });
  });

  it("should handle empty model list", async () => {
    vi.mocked(Cursor.models.list).mockResolvedValue([]);

    const models = await listSdkModels("test-key");

    expect(models).toHaveLength(0);
    expect(Cursor.models.list).toHaveBeenCalledWith("test-key");
  });

  it("should throw on SDK errors", async () => {
    const error = new Error("Unauthorized");
    vi.mocked(Cursor.models.list).mockRejectedValue(error);

    await expect(listSdkModels("invalid-key")).rejects.toThrow("Unauthorized");
  });

  it("should handle undefined API key", async () => {
    vi.mocked(Cursor.models.list).mockResolvedValue([
      { displayName: "Model 1", id: "model-1" },
    ]);

    const models = await listSdkModels(undefined);

    expect(Cursor.models.list).toHaveBeenCalledWith(undefined);
    expect(models).toHaveLength(1);
  });

  it("should handle models with complex IDs", async () => {
    const mockModels = [
      { displayName: "GPT-5", id: "org/gpt-5" },
      { displayName: "Claude Sonnet 4.5", id: "claude-sonnet-4-5-20250929" },
    ];

    vi.mocked(Cursor.models.list).mockResolvedValue(mockModels);

    const models = await listSdkModels("test-key");

    expect(models[0]).toEqual({ id: "org/gpt-5", name: "GPT-5" });
    expect(models[1]).toEqual({ id: "claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5" });
  });

  it("should map displayName to name property", async () => {
    const mockModels = [
      { displayName: "My Custom Model Name", id: "custom-model" },
    ];

    vi.mocked(Cursor.models.list).mockResolvedValue(mockModels);

    const models = await listSdkModels("test-key");

    expect(models[0]).toEqual({
      id: "custom-model",
      name: "My Custom Model Name",
    });
  });
});