import type { AiAnalysisInput, RetrievedKnowledgeSource } from "@/ai/types";
import { SiliconFlowEmbeddingProvider } from "./siliconflow-embedding-provider";
import { RagService } from "./rag-service";
import { buildRetrievalQuery } from "./retrieval-query-builder";
import { evaluateEvidence } from "./evidence-gate";
import type { RetrievalQuery, RetrievalResult, RetrievalTrace } from "./types";

export interface PreparedRagAnalysis {
  input: AiAnalysisInput;
  trace: RetrievalTrace;
}

function lexicalFallbackAllowed(env: NodeJS.ProcessEnv) {
  return env.RAG_ALLOW_LEXICAL_FALLBACK?.trim().toLowerCase() !== "false";
}

function createRuntimeRagService(env: NodeJS.ProcessEnv) {
  const apiKey = env.SILICONFLOW_API_KEY?.trim();
  const embeddingProvider = apiKey
    ? new SiliconFlowEmbeddingProvider({ apiKey, model: env.EMBEDDING_MODEL?.trim() || "BAAI/bge-m3" })
    : undefined;
  return new RagService({ embeddingProvider, allowLexicalFallback: lexicalFallbackAllowed(env) });
}

function sourceFromHit(hit: RetrievalResult["hits"][number]): RetrievedKnowledgeSource {
  return {
    chunk_id: hit.chunk.chunk_id,
    document_id: hit.document.document_id,
    title: hit.document.title,
    section: hit.chunk.section_path.join(" / "),
    version: hit.document.version,
    quote: hit.chunk.text,
  };
}

function traceFromResult(result: RetrievalResult): RetrievalTrace {
  return {
    mode_requested: result.mode_requested,
    mode_used: result.mode_used,
    retrieval_status: result.status,
    knowledge_base_version: result.knowledge_base_version,
    embedding_model: result.embedding_model,
    filtered_count: result.filtered_count,
    timings_ms: result.timings_ms,
    warning: result.warning,
    hits: result.hits.map((hit) => ({
      chunk_id: hit.chunk.chunk_id,
      document_id: hit.document.document_id,
      title: hit.document.title,
      final_rank: hit.final_rank,
      lexical_rank: hit.lexical_rank,
      vector_rank: hit.vector_rank,
      rrf_score: hit.rrf_score,
    })),
  };
}

function prepare(input: AiAnalysisInput, query: RetrievalQuery, rawResult: RetrievalResult): PreparedRagAnalysis {
  const retrievalStatus = evaluateEvidence(rawResult, { queryText: query.text });
  const result = { ...rawResult, status: retrievalStatus };
  return {
    input: {
      ...input,
      knowledge_sources: result.hits.map(sourceFromHit),
      retrieval_status: retrievalStatus,
      knowledge_base_version: result.knowledge_base_version,
    },
    trace: traceFromResult(result),
  };
}

export async function prepareRagAnalysis(input: AiAnalysisInput, env: NodeJS.ProcessEnv = process.env) {
  const service = createRuntimeRagService(env);
  const query = buildRetrievalQuery(input);
  const result = await service.retrieve(query, "hybrid");
  return prepare(input, query, result);
}

export async function prepareRagAnalyses(inputs: AiAnalysisInput[], env: NodeJS.ProcessEnv = process.env) {
  const service = createRuntimeRagService(env);
  const queries = inputs.map(buildRetrievalQuery);
  const results = await service.retrieveMany(queries, "hybrid");
  return inputs.map((input, index) => prepare(input, queries[index], results[index]));
}
