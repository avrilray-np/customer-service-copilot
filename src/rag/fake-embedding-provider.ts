import type { EmbeddingProvider } from "./embedding-provider";

export class FakeEmbeddingProvider implements EmbeddingProvider {
  constructor(
    readonly dimensions: number,
    readonly model: string,
    private readonly vectorsByText: ReadonlyMap<string, number[]>,
    readonly providerName = "fake",
  ) {}

  async embedQuery(text: string) {
    const vector = this.vectorsByText.get(text);
    if (!vector) throw new Error(`Fake Embedding未配置输入：${text}`);
    return [...vector];
  }

  async embedDocuments(texts: string[]) {
    return Promise.all(texts.map((text) => this.embedQuery(text)));
  }
}
