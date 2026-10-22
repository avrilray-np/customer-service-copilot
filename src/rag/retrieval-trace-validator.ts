import type { RetrievalTrace } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableFiniteNumber(value: unknown) {
  return value === null || isFiniteNumber(value);
}

export function isRetrievalTrace(value: unknown): value is RetrievalTrace {
  if (!isRecord(value) || !isRecord(value.timings_ms) || !Array.isArray(value.hits)) return false;
  if (!(["bm25", "vector", "hybrid"] as unknown[]).includes(value.mode_requested)) return false;
  if (!(["bm25", "vector", "hybrid"] as unknown[]).includes(value.mode_used)) return false;
  if (!(["available", "insufficient", "conflicting", "unavailable"] as unknown[]).includes(value.retrieval_status)) return false;
  if (typeof value.knowledge_base_version !== "string" || !isNullableFiniteNumber(value.timings_ms.embedding)) return false;
  if (!(value.embedding_model === null || typeof value.embedding_model === "string")) return false;
  if (!isFiniteNumber(value.filtered_count) || !(value.warning === null || typeof value.warning === "string")) return false;
  if (!isFiniteNumber(value.timings_ms.metadata_filter) || !isNullableFiniteNumber(value.timings_ms.lexical) ||
      !isNullableFiniteNumber(value.timings_ms.vector) || !isNullableFiniteNumber(value.timings_ms.fusion) ||
      !isFiniteNumber(value.timings_ms.total)) return false;
  return value.hits.every((hit) => isRecord(hit) &&
    typeof hit.chunk_id === "string" && typeof hit.document_id === "string" && typeof hit.title === "string" &&
    isFiniteNumber(hit.final_rank) && isNullableFiniteNumber(hit.lexical_rank) &&
    isNullableFiniteNumber(hit.vector_rank) && isNullableFiniteNumber(hit.rrf_score));
}
