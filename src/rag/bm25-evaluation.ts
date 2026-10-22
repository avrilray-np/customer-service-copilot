import type { KnowledgeAudience } from "./types";
import { RagService } from "./rag-service";

export interface Bm25EvaluationCase {
  eval_id: string;
  query: string;
  query_time: string;
  audience: KnowledgeAudience;
  known_product_type: string | null;
  relevant_chunk_ids: string[];
}

export interface Bm25EvaluationCaseResult {
  eval_id: string;
  retrieved_chunk_ids: string[];
  relevant_chunk_ids: string[];
  recall_at_3: number;
  reciprocal_rank: number;
}

export interface Bm25EvaluationResult {
  case_count: number;
  recall_at_3: number;
  mrr: number;
  cases: Bm25EvaluationCaseResult[];
}

export function evaluateBm25(cases: Bm25EvaluationCase[], service = new RagService()): Bm25EvaluationResult {
  const results = cases.map((entry) => {
    const retrieval = service.retrieveBm25({
      text: entry.query,
      query_time: entry.query_time,
      audience: entry.audience,
      known_product_type: entry.known_product_type,
      language: "zh-CN",
    }, { topK: 3 });
    const retrievedChunkIds = retrieval.hits.map((hit) => hit.chunk.chunk_id);
    const retrievedRelevant = entry.relevant_chunk_ids.filter((id) => retrievedChunkIds.includes(id));
    const firstRelevantRank = retrievedChunkIds.findIndex((id) => entry.relevant_chunk_ids.includes(id));
    return {
      eval_id: entry.eval_id,
      retrieved_chunk_ids: retrievedChunkIds,
      relevant_chunk_ids: entry.relevant_chunk_ids,
      recall_at_3: retrievedRelevant.length / entry.relevant_chunk_ids.length,
      reciprocal_rank: firstRelevantRank < 0 ? 0 : 1 / (firstRelevantRank + 1),
    };
  });

  return {
    case_count: results.length,
    recall_at_3: results.reduce((sum, entry) => sum + entry.recall_at_3, 0) / results.length,
    mrr: results.reduce((sum, entry) => sum + entry.reciprocal_rank, 0) / results.length,
    cases: results,
  };
}
