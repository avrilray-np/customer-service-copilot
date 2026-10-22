import { normalizeVector } from "./embedding-provider";
import { EmbeddingIndexRepository } from "./embedding-index";
import { documentMatchesQuery } from "./metadata-filter";
import { KnowledgeRepository } from "./knowledge-repository";
import type { RetrievalHit, RetrievalQuery, VectorSearchOptions } from "./types";

function dotProduct(left: number[], right: number[]) {
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) sum += left[index] * right[index];
  return sum;
}

export class VectorRetriever {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly embeddingIndex: EmbeddingIndexRepository,
  ) {}

  search(query: RetrievalQuery, rawQueryVector: number[], options: VectorSearchOptions = {}) {
    const topK = options.topK ?? 3;
    const maxChunksPerDocument = options.maxChunksPerDocument ?? 2;
    const queryVector = normalizeVector(rawQueryVector, this.embeddingIndex.index.dimensions);
    const metadataStartedAt = performance.now();
    const allowed = this.repository.chunks.filter((chunk) => documentMatchesQuery(this.repository.documentFor(chunk), query));
    const metadataMs = performance.now() - metadataStartedAt;
    const vectorStartedAt = performance.now();
    const scored = allowed
      .map((chunk) => ({ chunk, score: dotProduct(queryVector, this.embeddingIndex.vectorFor(chunk.chunk_id)) }))
      .sort((left, right) => right.score - left.score || right.chunk.priority - left.chunk.priority || left.chunk.chunk_id.localeCompare(right.chunk.chunk_id));
    const perDocument = new Map<string, number>();
    const selected: typeof scored = [];
    for (const candidate of scored) {
      const count = perDocument.get(candidate.chunk.document_id) ?? 0;
      if (count >= maxChunksPerDocument) continue;
      selected.push(candidate);
      perDocument.set(candidate.chunk.document_id, count + 1);
      if (selected.length >= topK) break;
    }
    const vectorMs = performance.now() - vectorStartedAt;
    const hits: RetrievalHit[] = selected.map(({ chunk, score }, index) => ({
      chunk,
      document: this.repository.documentFor(chunk),
      lexical_score: null,
      vector_score: Number(score.toFixed(6)),
      lexical_rank: null,
      vector_rank: index + 1,
      rrf_score: null,
      final_rank: index + 1,
    }));
    return { hits, filteredCount: this.repository.chunks.length - allowed.length, metadataMs, vectorMs };
  }
}
