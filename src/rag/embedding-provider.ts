export interface EmbeddingProvider {
  readonly providerName: string;
  readonly model: string;
  readonly dimensions: number;
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
}

export function normalizeVector(vector: number[], dimensions: number) {
  if (vector.length !== dimensions || vector.some((value) => !Number.isFinite(value))) {
    throw new Error(`Embedding向量必须包含${dimensions}个有限数值`);
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(magnitude) || magnitude === 0) throw new Error("Embedding向量不能为零向量");
  return vector.map((value) => value / magnitude);
}
