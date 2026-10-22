import { tokenizeChinese } from "./chinese-tokenizer";
import { documentMatchesQuery } from "./metadata-filter";
import { knowledgeChunkSearchText, KnowledgeRepository } from "./knowledge-repository";
import type { Bm25SearchOptions, KnowledgeChunk, RetrievalHit, RetrievalQuery } from "./types";

interface IndexedChunk {
  chunk: KnowledgeChunk;
  weightedFrequency: Map<string, number>;
  length: number;
}

const fieldWeights = {
  title: 2,
  section: 1.5,
  text: 1,
  keywords: 1.4,
} as const;

function addTokens(target: Map<string, number>, tokens: string[], weight: number) {
  for (const token of tokens) target.set(token, (target.get(token) ?? 0) + weight);
}

export class Bm25Retriever {
  private readonly index: IndexedChunk[];

  constructor(private readonly repository: KnowledgeRepository) {
    this.index = repository.chunks.map((chunk) => {
      const document = repository.documentFor(chunk);
      const weightedFrequency = new Map<string, number>();
      addTokens(weightedFrequency, tokenizeChinese(document.title, chunk.keywords), fieldWeights.title);
      addTokens(weightedFrequency, tokenizeChinese(chunk.section_path.join(" "), chunk.keywords), fieldWeights.section);
      addTokens(weightedFrequency, tokenizeChinese(chunk.text, chunk.keywords), fieldWeights.text);
      addTokens(weightedFrequency, tokenizeChinese(chunk.keywords.join(" "), chunk.keywords), fieldWeights.keywords);
      const length = [...weightedFrequency.values()].reduce((sum, frequency) => sum + frequency, 0);
      return { chunk, weightedFrequency, length };
    });
  }

  search(query: RetrievalQuery, options: Bm25SearchOptions = {}): { hits: RetrievalHit[]; filteredCount: number; metadataMs: number; lexicalMs: number } {
    const topK = options.topK ?? 3;
    const maxChunksPerDocument = options.maxChunksPerDocument ?? 2;
    const queryTokens = [...new Set(tokenizeChinese(query.text))];
    const metadataStartedAt = performance.now();
    const allowed = this.index.filter((item) => documentMatchesQuery(this.repository.documentFor(item.chunk), query));
    const metadataMs = performance.now() - metadataStartedAt;
    const filteredCount = this.index.length - allowed.length;
    const averageLength = allowed.reduce((sum, item) => sum + item.length, 0) / Math.max(allowed.length, 1);
    const documentFrequency = new Map<string, number>();
    for (const item of allowed) {
      for (const token of queryTokens) {
        if (item.weightedFrequency.has(token)) documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
      }
    }
    const lexicalStartedAt = performance.now();
    const scored = allowed
      .map((item) => ({ item, score: this.score(item, queryTokens, allowed.length, averageLength, documentFrequency) }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score || right.item.chunk.priority - left.item.chunk.priority || left.item.chunk.chunk_id.localeCompare(right.item.chunk.chunk_id));

    const perDocument = new Map<string, number>();
    const selected: Array<{ item: IndexedChunk; score: number }> = [];
    for (const candidate of scored) {
      const count = perDocument.get(candidate.item.chunk.document_id) ?? 0;
      if (count >= maxChunksPerDocument) continue;
      selected.push(candidate);
      perDocument.set(candidate.item.chunk.document_id, count + 1);
      if (selected.length >= topK) break;
    }

    return {
      filteredCount,
      metadataMs,
      lexicalMs: performance.now() - lexicalStartedAt,
      hits: selected.map(({ item, score }, index) => ({
        chunk: item.chunk,
        document: this.repository.documentFor(item.chunk),
        lexical_score: Number(score.toFixed(6)),
        vector_score: null,
        lexical_rank: index + 1,
        vector_rank: null,
        rrf_score: null,
        final_rank: index + 1,
      })),
    };
  }

  searchTextFor(chunk: KnowledgeChunk) {
    return knowledgeChunkSearchText(chunk, this.repository.documentFor(chunk));
  }

  private score(item: IndexedChunk, queryTokens: string[], totalDocuments: number, averageLength: number, documentFrequency: Map<string, number>) {
    const k1 = 1.2;
    const b = 0.75;
    let score = 0;
    for (const token of queryTokens) {
      const frequency = item.weightedFrequency.get(token) ?? 0;
      if (frequency === 0) continue;
      const df = documentFrequency.get(token) ?? 0;
      const idf = Math.log(1 + (totalDocuments - df + 0.5) / (df + 0.5));
      const denominator = frequency + k1 * (1 - b + b * item.length / averageLength);
      score += idf * frequency * (k1 + 1) / denominator;
    }
    return score;
  }
}
