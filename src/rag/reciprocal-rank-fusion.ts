import type { RetrievalHit, VectorSearchOptions } from "./types";

interface CombinedHit {
  lexical?: RetrievalHit;
  vector?: RetrievalHit;
}

export function reciprocalRankFusion(
  lexicalHits: RetrievalHit[],
  vectorHits: RetrievalHit[],
  options: VectorSearchOptions = {},
) {
  const topK = options.topK ?? 3;
  const maxChunksPerDocument = options.maxChunksPerDocument ?? 2;
  const rrfK = options.rrfK ?? 60;
  const combined = new Map<string, CombinedHit>();
  for (const hit of lexicalHits) combined.set(hit.chunk.chunk_id, { ...combined.get(hit.chunk.chunk_id), lexical: hit });
  for (const hit of vectorHits) combined.set(hit.chunk.chunk_id, { ...combined.get(hit.chunk.chunk_id), vector: hit });

  const ranked = [...combined.values()].map((entry) => {
    const source = entry.lexical ?? entry.vector;
    if (!source) throw new Error("RRF候选缺少检索结果");
    const score = (entry.lexical?.lexical_rank ? 1 / (rrfK + entry.lexical.lexical_rank) : 0) +
      (entry.vector?.vector_rank ? 1 / (rrfK + entry.vector.vector_rank) : 0);
    return {
      chunk: source.chunk,
      document: source.document,
      lexical_score: entry.lexical?.lexical_score ?? null,
      vector_score: entry.vector?.vector_score ?? null,
      lexical_rank: entry.lexical?.lexical_rank ?? null,
      vector_rank: entry.vector?.vector_rank ?? null,
      rrf_score: Number(score.toFixed(8)),
      final_rank: 0,
    } satisfies RetrievalHit;
  }).sort((left, right) =>
    (right.rrf_score ?? 0) - (left.rrf_score ?? 0) ||
    right.chunk.priority - left.chunk.priority ||
    left.chunk.chunk_id.localeCompare(right.chunk.chunk_id),
  );

  const selected: RetrievalHit[] = [];
  const perDocument = new Map<string, number>();
  for (const hit of ranked) {
    const count = perDocument.get(hit.document.document_id) ?? 0;
    if (count >= maxChunksPerDocument) continue;
    selected.push({ ...hit, final_rank: selected.length + 1 });
    perDocument.set(hit.document.document_id, count + 1);
    if (selected.length >= topK) break;
  }
  return selected;
}
