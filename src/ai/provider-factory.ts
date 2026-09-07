import type { AiProvider } from "./ai-provider";
import type { AiMode } from "./types";
import { DeepSeekAiProvider } from "./deepseek-ai-provider";
import { GeminiAiProvider } from "./gemini-ai-provider";
import { AiProviderError } from "./ai-provider-error";
import { mockAiProvider } from "./mock-ai-provider";

export interface ProviderSelection {
  provider: AiProvider;
  mode: AiMode;
  model: string | null;
}

export function requestedAiMode(env: NodeJS.ProcessEnv = process.env): AiMode {
  const value = env.AI_MODE?.trim().toLowerCase() || "mock";
  if (value !== "mock" && value !== "gemini" && value !== "deepseek") {
    throw new AiProviderError("missing_configuration", `AI_MODE必须是mock、gemini或deepseek，当前值为${value}。`);
  }
  return value;
}

export function createProviderSelection(env: NodeJS.ProcessEnv = process.env): ProviderSelection {
  const mode = requestedAiMode(env);
  if (mode === "mock") return { provider: mockAiProvider, mode, model: null };

  if (mode === "deepseek") {
    const model = env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-flash";
    return { provider: new DeepSeekAiProvider({ apiKey: env.DEEPSEEK_API_KEY, model }), mode, model };
  }

  const apiKey = env.GOOGLE_API_KEY || env.GEMINI_API_KEY;
  const model = env.GEMINI_MODEL?.trim() || "gemini-3.7-flash";
  return { provider: new GeminiAiProvider({ apiKey, model }), mode, model };
}
