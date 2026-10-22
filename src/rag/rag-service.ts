import { performance } from "node:perf_hooks";
import { Bm25Retriever } from "./bm25-retriever";
import type { EmbeddingProvider } from "./embedding-provider";
import { EmbeddingIndexRepository } from "./embedding-index";
import { KnowledgeRepository } from "./knowledge-repository";
import { reciprocalRankFusion } from "./reciprocal-rank-fusion";
import type { Bm25SearchOptions, RetrievalMode, RetrievalQuery, RetrievalResult, VectorSearchOptions } from "./types";
import { VectorRetriever } from "./vector-retriever";

export interface RagServiceOptions {
  repository?: KnowledgeRepository;
  embeddingIndex?: EmbeddingIndexRepository;
  embeddingProvider?: EmbeddingProvider;
  allowLexicalFallback?: boolean;
}

export class RagService {
  private readonly repository: KnowledgeRepository;
  private readonly bm25: Bm25Retriever;
  private readonly embeddingIndex: EmbeddingIndexRepository | null;
  private readonly vector: VectorRetriever | null;
  private readonly embeddingProvider: EmbeddingProvider | null;
  private readonly allowLexicalFallback: boolean;

  constructor(options: RagServiceOptions = {}) {
    this.repository = options.repository ?? new KnowledgeRepository();
    this.bm25 = new Bm25Retriever(this.repository);
    this.embeddingIndex = options.embeddingIndex ?? (
      this.repository.manifest.embedding ? new EmbeddingIndexRepository(this.repository) : null
    );
    this.vector = this.embeddingIndex ? new VectorRetriever(this.repository, this.embeddingIndex) : null;
    this.embeddingProvider = options.embeddingProvider ?? null;
    this.allowLexicalFallback = options.allowLexicalFallback ?? false;
    if (this.embeddingIndex && this.embeddingProvider && (
      this.embeddingProvider.providerName !== this.embeddingIndex.index.provider ||
      this.embeddingProvider.model !== this.embeddingIndex.index.model ||
      this.embeddingProvider.dimensions !== this.embeddingIndex.index.dimensions
    )) {
      throw new Error("查询Embedding Provider与文档向量索引的Provider、模型或维度不一致");
    }
  }

  retrieveBm25(query: RetrievalQuery, options: Bm25SearchOptions = {}): RetrievalResult {
    const startedAt = performance.now();
    const { hits, filteredCount, metadataMs, lexicalMs } = this.bm25.search(query, options);
    return {
      mode_requested: "bm25",
      mode_used: "bm25",
      status: hits.length > 0 ? "available" : "insufficient",
      knowledge_base_version: this.repository.manifest.knowledge_base_version,
      embedding_model: null,
      hits,
      filtered_count: filteredCount,
      timings_ms: {
        metadata_filter: Number(metadataMs.toFixed(3)),
        lexical: Number(lexicalMs.toFixed(3)),
        embedding: null,
        vector: null,
        fusion: null,
        total: Number((performance.now() - startedAt).toFixed(3)),
      },
      warning: null,
    };
  }

  async retrieve(query: RetrievalQuery, mode: RetrievalMode, options: VectorSearchOptions = {}) {
    if (mode === "bm25") return this.retrieveBm25(query, options);
    if (!this.embeddingProvider || !this.vector || !this.embeddingIndex) {
      return this.embeddingUnavailable(query, mode, options, "Embedding Provider或版本化向量索引未配置");
    }
    const embeddingStartedAt = performance.now();
    try {
      const queryVector = await this.embeddingProvider.embedQuery(query.text);
      return this.retrieveWithQueryVector(query, queryVector, mode, performance.now() - embeddingStartedAt, options);
    } catch (error) {
      return this.embeddingUnavailable(query, mode, options, error instanceof Error ? error.message : "Embedding请求失败");
    }
  }

  async retrieveMany(queries: RetrievalQuery[], mode: RetrievalMode, options: VectorSearchOptions = {}) {
    if (mode === "bm25") return queries.map((query) => this.retrieveBm25(query, options));
    if (!this.embeddingProvider || !this.vector || !this.embeddingIndex) {
      return queries.map((query) => this.embeddingUnavailable(query, mode, options, "Embedding Provider或版本化向量索引未配置"));
    }
    const embeddingStartedAt = performance.now();
    try {
      const queryVectors = await this.embeddingProvider.embedDocuments(queries.map((query) => query.text));
      const embeddingMsPerQuery = (performance.now() - embeddingStartedAt) / Math.max(queries.length, 1);
      if (queryVectors.length !== queries.length) throw new Error("批量查询向量数量与查询数量不一致");
      return queries.map((query, index) => this.retrieveWithQueryVector(query, queryVectors[index], mode, embeddingMsPerQuery, options));
    } catch (error) {
      const warning = error instanceof Error ? error.message : "Embedding请求失败";
      return queries.map((query) => this.embeddingUnavailable(query, mode, options, warning));
    }
  }

  retrieveWithQueryVector(
    query: RetrievalQuery,
    queryVector: number[],
    mode: Exclude<RetrievalMode, "bm25">,
    embeddingMs = 0,
    options: VectorSearchOptions = {},
  ): RetrievalResult {
    if (!this.vector || !this.embeddingIndex) throw new Error("版本化向量索引未配置");
    const startedAt = performance.now();
    if (mode === "vector") {
      const vectorResult = this.vector.search(query, queryVector, options);
      const hits = vectorResult.hits;
      return {
        mode_requested: "vector",
        mode_used: "vector",
        status: hits.length > 0 ? "available" : "insufficient",
        knowledge_base_version: this.repository.manifest.knowledge_base_version,
        embedding_model: this.embeddingIndex.index.model,
        hits,
        filtered_count: vectorResult.filteredCount,
        timings_ms: {
          metadata_filter: Number(vectorResult.metadataMs.toFixed(3)),
          lexical: null,
          embedding: Number(embeddingMs.toFixed(3)),
          vector: Number(vectorResult.vectorMs.toFixed(3)),
          fusion: null,
          total: Number((performance.now() - startedAt + embeddingMs).toFixed(3)),
        },
        warning: null,
      } satisfies RetrievalResult;
    }

    const candidateTopK = options.candidateTopK ?? 8;
    const vectorResult = this.vector.search(query, queryVector, { ...options, topK: candidateTopK, maxChunksPerDocument: candidateTopK });
    const lexical = this.bm25.search(query, { topK: candidateTopK, maxChunksPerDocument: candidateTopK });
    const fusionStartedAt = performance.now();
    const hits = reciprocalRankFusion(lexical.hits, vectorResult.hits, options);
    const fusionMs = performance.now() - fusionStartedAt;
    return {
      mode_requested: "hybrid",
      mode_used: "hybrid",
      status: hits.length > 0 ? "available" : "insufficient",
      knowledge_base_version: this.repository.manifest.knowledge_base_version,
      embedding_model: this.embeddingIndex.index.model,
      hits,
      filtered_count: Math.max(lexical.filteredCount, vectorResult.filteredCount),
      timings_ms: {
        metadata_filter: Number(Math.max(lexical.metadataMs, vectorResult.metadataMs).toFixed(3)),
        lexical: Number(lexical.lexicalMs.toFixed(3)),
        embedding: Number(embeddingMs.toFixed(3)),
        vector: Number(vectorResult.vectorMs.toFixed(3)),
        fusion: Number(fusionMs.toFixed(3)),
        total: Number((performance.now() - startedAt + embeddingMs).toFixed(3)),
      },
      warning: null,
    } satisfies RetrievalResult;
  }

  private embeddingUnavailable(query: RetrievalQuery, requestedMode: Exclude<RetrievalMode, "bm25">, options: VectorSearchOptions, reason: string): RetrievalResult {
    if (requestedMode === "hybrid" && this.allowLexicalFallback) {
      const fallback = this.retrieveBm25(query, options);
      return { ...fallback, mode_requested: "hybrid", warning: `Embedding不可用，已明确降级为BM25：${reason}` };
    }
    return {
      mode_requested: requestedMode,
      mode_used: requestedMode,
      status: "unavailable",
      knowledge_base_version: this.repository.manifest.knowledge_base_version,
      embedding_model: this.embeddingIndex?.index.model ?? null,
      hits: [],
      filtered_count: 0,
      timings_ms: { metadata_filter: 0, lexical: null, embedding: null, vector: null, fusion: null, total: 0 },
      warning: reason,
    };
  }
}
