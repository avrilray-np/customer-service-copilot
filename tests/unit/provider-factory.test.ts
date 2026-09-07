import { describe, expect, it } from "vitest";
import { AiProviderError } from "@/ai/ai-provider-error";
import { createProviderSelection, requestedAiMode } from "@/ai/provider-factory";

describe("provider factory", () => {
  it("defaults to the deterministic Mock provider", () => {
    const selection = createProviderSelection({ NODE_ENV: "test" } as NodeJS.ProcessEnv);
    expect(selection.mode).toBe("mock");
    expect(selection.model).toBeNull();
  });

  it("creates Gemini with an explicit model when configured", () => {
    const selection = createProviderSelection({
      AI_MODE: "gemini",
      GEMINI_API_KEY: "test-only-key",
      GEMINI_MODEL: "gemini-test-model",
      NODE_ENV: "test",
    } as NodeJS.ProcessEnv);
    expect(selection.mode).toBe("gemini");
    expect(selection.model).toBe("gemini-test-model");
  });

  it("rejects Gemini mode without a server-side key", () => {
    expect(() => createProviderSelection({ AI_MODE: "gemini", NODE_ENV: "test" } as NodeJS.ProcessEnv)).toThrowError(AiProviderError);
  });

  it("creates DeepSeek with an explicit model when configured", () => {
    const selection = createProviderSelection({
      AI_MODE: "deepseek",
      DEEPSEEK_API_KEY: "test-only-key",
      DEEPSEEK_MODEL: "deepseek-test-model",
      NODE_ENV: "test",
    } as NodeJS.ProcessEnv);
    expect(selection.mode).toBe("deepseek");
    expect(selection.model).toBe("deepseek-test-model");
  });

  it("rejects DeepSeek mode without a server-side key", () => {
    expect(() => createProviderSelection({ AI_MODE: "deepseek", NODE_ENV: "test" } as NodeJS.ProcessEnv)).toThrowError(AiProviderError);
  });

  it("rejects unknown provider modes", () => {
    expect(() => requestedAiMode({ AI_MODE: "other", NODE_ENV: "test" } as NodeJS.ProcessEnv)).toThrow(/mock、gemini或deepseek/);
  });
});
