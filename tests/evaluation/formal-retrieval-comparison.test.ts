import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { evaluateEvidence } from "@/rag/evidence-gate";
import { parseFormalEvaluationJsonl, validateFormalEvaluationCases } from "@/rag/formal-evaluation";
import { KnowledgeRepository } from "@/rag/knowledge-repository";
import { RagService } from "@/rag/rag-service";
import { evaluateRetrievalResults } from "@/rag/retrieval-evaluation";
import { SiliconFlowEmbeddingProvider } from "@/rag/siliconflow-embedding-provider";
import type { RetrievalQuery, RetrievalResult } from "@/rag/types";

function localApiKey() {
  if (process.env.SILICONFLOW_API_KEY) return process.env.SILICONFLOW_API_KEY;
  const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const line = content.split(/\r?\n/u).find((entry) => entry.trim().startsWith("SILICONFLOW_API_KEY="));
  if (!line) throw new Error(".env.local缺少SILICONFLOW_API_KEY");
  return line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/gu, "");
}

function gated(result: RetrievalResult, query: RetrievalQuery): RetrievalResult {
  return { ...result, status: evaluateEvidence(result, { queryText: query.text }) };
}

function writeReports(report: Record<string, unknown> & { modes: ReturnType<typeof evaluateRetrievalResults>[] }) {
  const jsonPath = resolve(process.cwd(), "reports/rag-formal-retrieval-comparison-v0.1.json");
  const markdownPath = resolve(process.cwd(), "reports/rag-formal-retrieval-comparison-v0.1.md");
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  const summaryRows = report.modes.map((mode) =>
    `| ${mode.mode} | ${mode.recall_at_3.toFixed(4)} | ${mode.mrr.toFixed(4)} | ${mode.precision_at_3.toFixed(4)} | ${mode.answerability_accuracy.toFixed(4)} | ${mode.total_latency_ms.p50.toFixed(2)} / ${mode.total_latency_ms.p95.toFixed(2)} | ${mode.embedding_latency_ms ? `${mode.embedding_latency_ms.p50.toFixed(2)} / ${mode.embedding_latency_ms.p95.toFixed(2)}` : "—"} |`,
  );
  const comparisonRows = report.modes[0].cases.map((entry, index) =>
    `| ${entry.eval_id} | ${report.modes.map((mode) => mode.cases[index].retrieved_chunk_ids.join("<br>")).join(" | ")} |`,
  );
  writeFileSync(markdownPath, [
    "# 正式RAG检索模式对比 v0.1",
    "",
    `- 知识库版本：${String(report.knowledge_base_version)}`,
    `- Embedding：${String(report.embedding_provider)} / ${String(report.embedding_model)}`,
    `- 固定评估集：${String(report.case_count)}条；BM25、Vector和Hybrid使用同一知识库、问题、元数据过滤与Top-3口径。`,
    "- 本次Vector和Hybrid均使用真实查询向量，禁用BM25降级。",
    "- Recall@3和MRR只统计有必需依据的28条案例；Precision@3和EvidenceGate可回答性准确率统计全部30条。",
    "- 延迟是本次本地运行观测值，不代表线上SLA；生成回答质量尚未运行或评分。",
    "",
    "| 模式 | Recall@3 | MRR | Precision@3 | 可回答性准确率 | 检索P50/P95(ms) | Embedding P50/P95(ms) |",
    "|---|---:|---:|---:|---:|---:|---:|",
    ...summaryRows,
    "",
    "## 每题Top-3",
    "",
    "| 案例 | BM25 | Vector | Hybrid |",
    "|---|---|---|---|",
    ...comparisonRows,
    "",
  ].join("\n"));
}

describe("formal BM25, Vector and Hybrid comparison", () => {
  it.skipIf(process.env.RAG_LIVE_FORMAL_EVALUATION !== "1")("compares 30 cases with one real query-embedding batch", async () => {
    const repository = new KnowledgeRepository();
    const cases = parseFormalEvaluationJsonl(readFileSync(resolve(process.cwd(), "tests/fixtures/rag-evaluation-v0.1.jsonl"), "utf8"));
    validateFormalEvaluationCases(cases, repository);
    const queries: RetrievalQuery[] = cases.map((entry) => ({
      text: entry.query,
      query_time: entry.query_time,
      audience: entry.audience,
      known_product_type: entry.known_product_type,
      language: "zh-CN",
    }));
    const provider = new SiliconFlowEmbeddingProvider({ apiKey: localApiKey() });
    const service = new RagService({ repository, embeddingProvider: provider, allowLexicalFallback: false });
    const embeddingStartedAt = performance.now();
    const queryVectors = await provider.embedDocuments(queries.map((query) => query.text));
    const embeddingMsPerQuery = (performance.now() - embeddingStartedAt) / cases.length;
    const bm25Results = queries.map((query) => gated(service.retrieveBm25(query), query));
    const vectorResults = queries.map((query, index) => gated(service.retrieveWithQueryVector(query, queryVectors[index], "vector", embeddingMsPerQuery), query));
    const hybridResults = queries.map((query, index) => gated(service.retrieveWithQueryVector(query, queryVectors[index], "hybrid", embeddingMsPerQuery), query));
    const modes = [
      evaluateRetrievalResults("bm25", cases, bm25Results),
      evaluateRetrievalResults("vector", cases, vectorResults),
      evaluateRetrievalResults("hybrid", cases, hybridResults),
    ];
    expect(cases).toHaveLength(30);
    expect(queryVectors).toHaveLength(30);
    for (const mode of modes) {
      expect(mode.cases.every((entry) => entry.mode_used === mode.mode && entry.warning === null)).toBe(true);
      expect(mode.cases.filter((entry) => ["RAG-029", "RAG-030"].includes(entry.eval_id)).every((entry) => entry.status === "insufficient")).toBe(true);
    }
    expect(modes.find((mode) => mode.mode === "hybrid")?.answerability_accuracy).toBe(1);
    writeReports({
      generated_at: new Date().toISOString(),
      knowledge_base_version: repository.manifest.knowledge_base_version,
      embedding_provider: provider.providerName,
      embedding_model: provider.model,
      dimensions: provider.dimensions,
      case_count: cases.length,
      answerable_case_count: cases.filter((entry) => entry.answerability === "answerable").length,
      top_k: 3,
      lexical_fallback_enabled: false,
      generation_evaluation_status: "not_run",
      modes,
    });
  }, 30_000);
});
