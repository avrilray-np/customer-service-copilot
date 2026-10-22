export type KnowledgeStatus = "draft" | "active" | "retired";
export type KnowledgeAudience = "ai" | "tier1" | "tier2";
export type RetrievalMode = "bm25" | "vector" | "hybrid";
export type RetrievalStatus = "available" | "insufficient" | "conflicting" | "unavailable";

export interface KnowledgeDocument {
  document_id: string;
  title: string;
  version: string;
  status: KnowledgeStatus;
  language: "zh-CN";
  effective_from: string;
  effective_to: string | null;
  supersedes_document_id: string | null;
  business_domains: string[];
  applicable_products: string[];
  audiences: KnowledgeAudience[];
  source_owner: string;
  updated_at: string;
}

export interface KnowledgeChunk {
  chunk_id: string;
  document_id: string;
  section_path: string[];
  text: string;
  keywords: string[];
  issue_subtypes: string[];
  rule_key: string;
  decision_value: string | null;
  priority: number;
  checksum: string;
}

export interface KnowledgeManifest {
  knowledge_base_version: string;
  built_at: string;
  document_ids: string[];
  chunk_count: number;
  content_checksum: string;
  embedding: null | {
    provider: string;
    model: string;
    dimensions: number;
    normalized: boolean;
    index_file: string;
  };
}

export interface EmbeddingIndex {
  knowledge_base_version: string;
  built_at: string;
  provider: string;
  model: string;
  dimensions: number;
  normalized: boolean;
  entries: Array<{
    chunk_id: string;
    text_checksum: string;
    vector: number[];
  }>;
}

export interface KnowledgeCatalog {
  manifest: KnowledgeManifest;
  documents: KnowledgeDocument[];
  chunks: KnowledgeChunk[];
}

export interface RetrievalQuery {
  text: string;
  query_time: string;
  audience: KnowledgeAudience;
  known_product_type: string | null;
  language: "zh-CN";
}

export interface RetrievalHit {
  chunk: KnowledgeChunk;
  document: KnowledgeDocument;
  lexical_score: number | null;
  vector_score: number | null;
  lexical_rank: number | null;
  vector_rank: number | null;
  rrf_score: number | null;
  final_rank: number;
}

export interface RetrievalResult {
  mode_requested: RetrievalMode;
  mode_used: RetrievalMode;
  status: RetrievalStatus;
  knowledge_base_version: string;
  embedding_model: string | null;
  hits: RetrievalHit[];
  filtered_count: number;
  timings_ms: {
    metadata_filter: number;
    lexical: number | null;
    embedding: number | null;
    vector: number | null;
    fusion: number | null;
    total: number;
  };
  warning: string | null;
}

export interface RetrievalTrace {
  mode_requested: RetrievalMode;
  mode_used: RetrievalMode;
  retrieval_status: RetrievalStatus;
  knowledge_base_version: string;
  embedding_model: string | null;
  filtered_count: number;
  timings_ms: RetrievalResult["timings_ms"];
  warning: string | null;
  hits: Array<{
    chunk_id: string;
    document_id: string;
    title: string;
    final_rank: number;
    lexical_rank: number | null;
    vector_rank: number | null;
    rrf_score: number | null;
  }>;
}

export interface Bm25SearchOptions {
  topK?: number;
  maxChunksPerDocument?: number;
}

export interface VectorSearchOptions extends Bm25SearchOptions {
  candidateTopK?: number;
  rrfK?: number;
}
