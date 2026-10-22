import { describe, expect, it } from "vitest";
import { evaluateRetrievalResults } from "@/rag/retrieval-evaluation";
import type { KnowledgeChunk, KnowledgeDocument, RetrievalHit, RetrievalResult } from "@/rag/types";

function hit(chunkId: string): RetrievalHit {
  return {
    chunk: { chunk_id: chunkId } as KnowledgeChunk,
    document: {} as KnowledgeDocument,
    lexical_score: 2,
    vector_score: 0.8,
    lexical_rank: 1,
    vector_rank: 1,
    rrf_score: 0.03,
    final_rank: 1,
  };
}

function result(
  chunkIds: string[],
  status: RetrievalResult["status"],
  total: number,
  embedding: number | null,
): RetrievalResult {
  return {
    mode_requested: "hybrid",
    mode_used: "hybrid",
    hits: chunkIds.map(hit),
    status,
    knowledge_base_version: "test",
    embedding_model: embedding === null ? null : "test-embedding",
    filtered_count: chunkIds.length,
    warning: null,
    timings_ms: { metadata_filter: 0, lexical: 0, embedding, vector: 0, fusion: 0, total },
  };
}

describe("retrieval evaluation metrics", () => {
  it("keeps knowledge-gap cases out of Recall/MRR while scoring precision, gate and latency", () => {
    const evaluation = evaluateRetrievalResults(
      "hybrid",
      [
        { eval_id: "RAG-001", relevant_chunk_ids: ["a"], acceptable_chunk_ids: ["b"], answerability: "answerable" },
        { eval_id: "RAG-002", relevant_chunk_ids: ["c"], answerability: "answerable" },
        { eval_id: "RAG-003", relevant_chunk_ids: [], answerability: "unanswerable" },
      ],
      [
        result(["b", "a", "x"], "available", 10, 3),
        result(["x", "c"], "available", 20, 5),
        result([], "insufficient", 100, 7),
      ],
    );

    expect(evaluation.answerable_case_count).toBe(2);
    expect(evaluation.recall_at_3).toBe(1);
    expect(evaluation.mrr).toBeCloseTo(0.5);
    expect(evaluation.precision_at_3).toBeCloseTo((2 / 3 + 1 / 2 + 1) / 3);
    expect(evaluation.answerability_accuracy).toBe(1);
    expect(evaluation.total_latency_ms).toEqual({ p50: 20, p95: 100 });
    expect(evaluation.embedding_latency_ms).toEqual({ p50: 5, p95: 7 });
    expect(evaluation.cases[2].recall_at_3).toBeNull();
    expect(evaluation.cases[2].reciprocal_rank).toBeNull();
  });
});
