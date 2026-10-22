import embeddingIndexJson from "@/data/knowledge/index/embeddings-v0.1.json";
import type { EmbeddingIndex } from "./types";
import { KnowledgeRepository } from "./knowledge-repository";

export class EmbeddingIndexRepository {
  readonly index: EmbeddingIndex;
  private readonly vectorsByChunkId: Map<string, number[]>;

  constructor(
    private readonly knowledgeRepository: KnowledgeRepository,
    index: EmbeddingIndex = embeddingIndexJson as EmbeddingIndex,
  ) {
    this.index = index;
    this.validate();
    this.vectorsByChunkId = new Map(index.entries.map((entry) => [entry.chunk_id, entry.vector]));
  }

  vectorFor(chunkId: string) {
    const vector = this.vectorsByChunkId.get(chunkId);
    if (!vector) throw new Error(`向量索引缺少知识片段：${chunkId}`);
    return vector;
  }

  private validate() {
    const embedding = this.knowledgeRepository.manifest.embedding;
    if (!embedding) throw new Error("知识manifest未声明Embedding索引");
    if (
      this.index.knowledge_base_version !== this.knowledgeRepository.manifest.knowledge_base_version ||
      this.index.provider !== embedding.provider || this.index.model !== embedding.model ||
      this.index.dimensions !== embedding.dimensions || this.index.normalized !== embedding.normalized
    ) throw new Error("Embedding索引元数据与知识manifest不一致");
    if (!this.index.normalized) throw new Error("v0.1只接受已归一化的Embedding索引");
    if (this.index.entries.length !== this.knowledgeRepository.chunks.length) {
      throw new Error("Embedding索引条目数量与知识片段数量不一致");
    }
    const entriesById = new Map(this.index.entries.map((entry) => [entry.chunk_id, entry]));
    if (entriesById.size !== this.index.entries.length) throw new Error("Embedding索引片段ID必须唯一");
    for (const chunk of this.knowledgeRepository.chunks) {
      const entry = entriesById.get(chunk.chunk_id);
      if (!entry || entry.text_checksum !== chunk.checksum) {
        throw new Error(`Embedding索引与知识片段校验和不一致：${chunk.chunk_id}`);
      }
      if (entry.vector.length !== this.index.dimensions || entry.vector.some((value) => !Number.isFinite(value))) {
        throw new Error(`Embedding索引向量无效：${chunk.chunk_id}`);
      }
      const magnitude = Math.sqrt(entry.vector.reduce((sum, value) => sum + value * value, 0));
      if (Math.abs(magnitude - 1) > 1e-5) throw new Error(`Embedding索引向量未归一化：${chunk.chunk_id}`);
    }
  }
}
