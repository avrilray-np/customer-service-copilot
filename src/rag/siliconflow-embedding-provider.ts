import type { EmbeddingProvider } from "./embedding-provider";

interface SiliconFlowEmbeddingResponse {
  data?: Array<{ index?: number; embedding?: number[] }>;
}

export interface SiliconFlowEmbeddingProviderOptions {
  apiKey?: string;
  model?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
}

export class SiliconFlowEmbeddingProvider implements EmbeddingProvider {
  readonly providerName = "siliconflow";
  readonly dimensions = 1024;
  readonly model: string;
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SiliconFlowEmbeddingProviderOptions = {}) {
    const apiKey = options.apiKey ?? process.env.SILICONFLOW_API_KEY;
    if (!apiKey) throw new Error("缺少SILICONFLOW_API_KEY，无法使用真实Embedding");
    this.apiKey = apiKey;
    this.model = options.model ?? process.env.EMBEDDING_MODEL ?? "BAAI/bge-m3";
    this.endpoint = options.endpoint ?? "https://api.siliconflow.cn/v1/embeddings";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async embedQuery(text: string) {
    const [vector] = await this.embedDocuments([text]);
    return vector;
  }

  async embedDocuments(texts: string[]) {
    if (texts.length === 0 || texts.some((text) => !text.trim())) {
      throw new Error("Embedding输入不能为空");
    }
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: this.model, input: texts, encoding_format: "float" }),
    });
    const payload = await response.json().catch(() => null) as SiliconFlowEmbeddingResponse | { message?: string } | null;
    if (!response.ok) {
      const message = payload && "message" in payload ? payload.message : null;
      throw new Error(`SiliconFlow Embedding请求失败（HTTP ${response.status}）${message ? `：${message}` : ""}`);
    }
    if (!payload || !("data" in payload) || !Array.isArray(payload.data) || payload.data.length !== texts.length) {
      throw new Error("SiliconFlow Embedding返回数量与输入不一致");
    }
    const ordered = [...payload.data].sort((left, right) => (left.index ?? -1) - (right.index ?? -1));
    if (ordered.some((entry, index) => entry.index !== index)) {
      throw new Error("SiliconFlow Embedding返回的序号缺失、重复或越界");
    }
    return ordered.map((entry) => {
      if (!Array.isArray(entry.embedding) || entry.embedding.length !== this.dimensions || entry.embedding.some((value) => !Number.isFinite(value))) {
        throw new Error(`SiliconFlow Embedding返回的向量不是${this.dimensions}维有限数值`);
      }
      return entry.embedding;
    });
  }
}
