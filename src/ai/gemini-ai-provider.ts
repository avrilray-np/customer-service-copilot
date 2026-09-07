import { GoogleGenAI } from "@google/genai";
import type { AiProvider } from "./ai-provider";
import type { AiAnalysisCandidate, AiAnalysisInput } from "./types";
import { AiProviderError } from "./ai-provider-error";
import responseSchema from "@/validation/ai-response.schema.json";
import { buildAiAnalysisPrompt, customerServiceSystemInstruction, finalizeAiAnalysis } from "./provider-analysis";

interface GeminiClientLike {
  interactions: {
    create(
      params: Record<string, unknown>,
      options?: { timeout?: number; maxRetries?: number },
    ): Promise<{ output_text?: string }>;
  };
}

export interface GeminiAiProviderOptions {
  apiKey?: string;
  model?: string;
  client?: GeminiClientLike;
}

// Gemini structured output only accepts a documented JSON Schema subset.
// Keep stricter constraints such as minLength/uniqueItems in the local AJV validation.
function toGeminiResponseSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toGeminiResponseSchema);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "minLength" && key !== "uniqueItems")
      .map(([key, child]) => [key, toGeminiResponseSchema(child)]),
  );
}

const geminiResponseSchema = toGeminiResponseSchema(responseSchema);

export class GeminiAiProvider implements AiProvider {
  readonly model: string;
  private readonly client: GeminiClientLike;

  constructor(options: GeminiAiProviderOptions = {}) {
    this.model = options.model ?? "gemini-3.7-flash";
    if (options.client) {
      this.client = options.client;
      return;
    }
    if (!options.apiKey) {
      throw new AiProviderError("missing_configuration", "未配置GEMINI_API_KEY，无法启用Gemini模式。");
    }
    this.client = new GoogleGenAI({ apiKey: options.apiKey }) as unknown as GeminiClientLike;
  }

  async analyze(input: AiAnalysisInput): Promise<AiAnalysisCandidate> {
    let outputText: string;
    try {
      const interaction = await this.client.interactions.create({
        model: this.model,
        input: buildAiAnalysisPrompt(input),
        system_instruction: customerServiceSystemInstruction,
        response_format: { type: "text", mime_type: "application/json", schema: geminiResponseSchema },
        generation_config: { thinking_level: "low", max_output_tokens: 2000 },
        store: false,
      }, { timeout: 15_000, maxRetries: 1 });
      if (!interaction.output_text) {
        throw new AiProviderError("empty_response", "Gemini没有返回可用的分析结果。");
      }
      outputText = interaction.output_text;
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw new AiProviderError("request_failed", "Gemini调用失败，请检查密钥、模型权限或网络后重试。", { cause: error });
    }

    let raw: unknown;
    try {
      raw = JSON.parse(outputText);
    } catch (error) {
      throw new AiProviderError("invalid_response", "Gemini返回的JSON无法解析，已拒绝应用。", { cause: error });
    }
    return finalizeAiAnalysis(raw, input, "Gemini");
  }
}
