import type { RetrievalResult } from "./types";

export interface RetrievalEvaluationCase {
  eval_id: string;
  relevant_chunk_ids: string[];
  acceptable_chunk_ids?: string[];
  answerability?: "answerable" | "unanswerable" | "conflicting";
}

export interface RetrievalModeEvaluation {
  mode: "bm25" | "vector" | "hybrid";
  case_count: number;
  answerable_case_count: number;
  recall_at_3: number;
  mrr: number;
  precision_at_3: number;
  answerability_accuracy: number;
  average_total_ms: number;
  total_latency_ms: { p50: number; p95: number };
  embedding_latency_ms: { p50: number; p95: number } | null;
  cases: Array<{
    eval_id: string;
    answerability: "answerable" | "unanswerable" | "conflicting";
    recall_at_3: number | null;
    reciprocal_rank: number | null;
    precision_at_3: number;
    answerability_correct: boolean;
    retrieved_chunk_ids: string[];
    total_ms: number;
    mode_used: string;
    status: string;
    warning: string | null;
  }>;
}

function percentile(values: number[], quantile: number) {
  if (values.length === 0) throw new Error("无法计算空数组的分位数");
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(quantile * sorted.length) - 1);
  return sorted[index];
}

export function evaluateRetrievalResults(
  mode: RetrievalModeEvaluation["mode"],
  cases: RetrievalEvaluationCase[],
  results: RetrievalResult[],
): RetrievalModeEvaluation {
  if (cases.length !== results.length) throw new Error("评估问题数量与检索结果数量不一致");
  const evaluated = cases.map((testCase, index) => {
    const result = results[index];
    const retrieved = result.hits.slice(0, 3).map((hit) => hit.chunk.chunk_id);
    const answerability = testCase.answerability ?? "answerable";
    const matches = testCase.relevant_chunk_ids.filter((chunkId) => retrieved.includes(chunkId));
    const firstRelevantRank = retrieved.findIndex((chunkId) => testCase.relevant_chunk_ids.includes(chunkId));
    const related = new Set([...testCase.relevant_chunk_ids, ...(testCase.acceptable_chunk_ids ?? [])]);
    const relatedHits = retrieved.filter((chunkId) => related.has(chunkId)).length;
    const expectedStatus = answerability === "answerable"
      ? "available"
      : answerability === "unanswerable"
        ? "insufficient"
        : "conflicting";
    return {
      eval_id: testCase.eval_id,
      answerability,
      recall_at_3: testCase.relevant_chunk_ids.length > 0 ? matches.length / testCase.relevant_chunk_ids.length : null,
      reciprocal_rank: testCase.relevant_chunk_ids.length > 0 ? firstRelevantRank < 0 ? 0 : 1 / (firstRelevantRank + 1) : null,
      precision_at_3: retrieved.length === 0 ? related.size === 0 ? 1 : 0 : relatedHits / retrieved.length,
      answerability_correct: result.status === expectedStatus,
      retrieved_chunk_ids: retrieved,
      total_ms: result.timings_ms.total,
      mode_used: result.mode_used,
      status: result.status,
      warning: result.warning,
    };
  });
  const divisor = Math.max(evaluated.length, 1);
  const answerable = evaluated.filter((entry) => entry.recall_at_3 !== null && entry.reciprocal_rank !== null);
  const embeddingLatencies = results.map((result) => result.timings_ms.embedding).filter((value): value is number => value !== null);
  const totalLatencies = results.map((result) => result.timings_ms.total);
  return {
    mode,
    case_count: evaluated.length,
    answerable_case_count: answerable.length,
    recall_at_3: answerable.reduce((sum, entry) => sum + (entry.recall_at_3 ?? 0), 0) / Math.max(answerable.length, 1),
    mrr: answerable.reduce((sum, entry) => sum + (entry.reciprocal_rank ?? 0), 0) / Math.max(answerable.length, 1),
    precision_at_3: evaluated.reduce((sum, entry) => sum + entry.precision_at_3, 0) / divisor,
    answerability_accuracy: evaluated.filter((entry) => entry.answerability_correct).length / divisor,
    average_total_ms: evaluated.reduce((sum, entry) => sum + entry.total_ms, 0) / divisor,
    total_latency_ms: { p50: percentile(totalLatencies, 0.5), p95: percentile(totalLatencies, 0.95) },
    embedding_latency_ms: embeddingLatencies.length > 0
      ? { p50: percentile(embeddingLatencies, 0.5), p95: percentile(embeddingLatencies, 0.95) }
      : null,
    cases: evaluated,
  };
}
