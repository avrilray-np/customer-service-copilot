import type { AiProvider } from "./ai-provider";
import type { AiAnalysisCandidate, AiAnalysisInput } from "./types";
import { AiProviderError } from "./ai-provider-error";
import responseSchema from "@/validation/ai-response.schema.json";
import { buildAiAnalysisPrompt, customerServiceSystemInstruction, finalizeAiAnalysis } from "./provider-analysis";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface DeepSeekResponseBody {
  status?: string;
  error?: { code?: string; message?: string } | null;
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
}

export interface DeepSeekAiProviderOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fetcher?: Fetcher;
}

function outputText(body: DeepSeekResponseBody): string | null {
  if (typeof body.output_text === "string" && body.output_text.trim()) return body.output_text;
  for (const item of body.output ?? []) {
    if (item.type !== "message") continue;
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string" && content.text.trim()) {
        return content.text;
      }
    }
  }
  return null;
}

export class DeepSeekAiProvider implements AiProvider {
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;

  constructor(options: DeepSeekAiProviderOptions = {}) {
    if (!options.apiKey) {
      throw new AiProviderError("missing_configuration", "未配置DEEPSEEK_API_KEY，无法启用DeepSeek模式。");
    }
    this.apiKey = options.apiKey;
    this.model = options.model ?? "deepseek-v4-flash";
    this.baseUrl = (options.baseUrl ?? "https://api.deepseek.com").replace(/\/$/u, "");
    this.fetcher = options.fetcher ?? fetch;
  }

  async analyze(input: AiAnalysisInput): Promise<AiAnalysisCandidate> {
    try {
      return await this.analyzeOnce(input);
    } catch (error) {
      const retryable = error instanceof AiProviderError &&
        (error.code === "empty_response" || error.code === "invalid_response" || error.code === "policy_violation");
      if (!retryable) throw error;
      return this.analyzeOnce(input);
    }
  }

  private async analyzeOnce(input: AiAnalysisInput): Promise<AiAnalysisCandidate> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}/responses`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          input: [
            { role: "system", content: customerServiceSystemInstruction },
            { role: "user", content: buildAiAnalysisPrompt(input) },
          ],
          reasoning: { effort: "low" },
          max_output_tokens: 2000,
          text: {
            format: {
              type: "json_schema",
              name: "customer_service_analysis",
              strict: true,
              schema: responseSchema,
            },
          },
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      throw new AiProviderError("request_failed", "DeepSeek调用失败，请检查密钥、余额、模型权限或网络后重试。", { cause: error });
    }

    let body: DeepSeekResponseBody;
    try {
      body = await response.json() as DeepSeekResponseBody;
    } catch (error) {
      throw new AiProviderError("invalid_response", "DeepSeek返回了无法解析的响应，已拒绝应用。", { cause: error });
    }

    if (!response.ok || body.status === "failed" || body.error) {
      const diagnostic = body.error?.code ? `（${body.error.code}）` : `（HTTP ${response.status}）`;
      throw new AiProviderError("request_failed", `DeepSeek调用失败${diagnostic}，请检查密钥、余额、模型权限或网络后重试。`);
    }

    const text = outputText(body);
    if (!text) {
      throw new AiProviderError("empty_response", "DeepSeek没有返回可用的分析结果。");
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (error) {
      throw new AiProviderError("invalid_response", "DeepSeek返回的JSON无法解析，已拒绝应用。", { cause: error });
    }
    return finalizeAiAnalysis(raw, input, "DeepSeek");
  }
}
