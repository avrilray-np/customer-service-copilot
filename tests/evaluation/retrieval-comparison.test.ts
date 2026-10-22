import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { evaluateRetrievalResults } from "@/rag/retrieval-evaluation";
import { RagService } from "@/rag/rag-service";
import { SiliconFlowEmbeddingProvider } from "@/rag/siliconflow-embedding-provider";
import type { KnowledgeAudience, RetrievalQuery } from "@/rag/types";

interface EvaluationFixture {
  eval_id: string;
  query: string;
  query_time: string;
  audience: KnowledgeAudience;
  known_product_type: string | null;
  relevant_chunk_ids: string[];
}

function loadCases(): EvaluationFixture[] {
  return readFileSync(resolve(process.cwd(), "tests/fixtures/rag-bm25-baseline-v0.1.jsonl"), "utf8")
    .trim().split(/\r?\n/u).map((line) => JSON.parse(line) as EvaluationFixture);
}

function localApiKey() {
  if (process.env.SILICONFLOW_API_KEY) return process.env.SILICONFLOW_API_KEY;
  const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const line = content.split(/\r?\n/u).find((entry) => entry.trim().startsWith("SILICONFLOW_API_KEY="));
  if (!line) throw new Error(".env.local缺少SILICONFLOW_API_KEY");
  return line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/gu, "");
}

function writeReports(report: Record<string, unknown> & { modes: ReturnType<typeof evaluateRetrievalResults>[] }) {
  const jsonPath = resolve(process.cwd(), "reports/rag-retrieval-comparison-v0.1.json");
  const markdownPath = resolve(process.cwd(), "reports/rag-retrieval-comparison-v0.1.md");
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  const summaryRows = report.modes.map((mode) =>
    `| ${mode.mode} | ${mode.recall_at_3.toFixed(4)} | ${mode.mrr.toFixed(4)} | ${mode.average_total_ms.toFixed(2)} |`,
  );
  const caseRows = report.modes[0].cases.map((_, index) => {
    const cells = report.modes.map((mode) => mode.cases[index].retrieved_chunk_ids.join("<br>"));
    return `| ${report.modes[0].cases[index].eval_id} | ${cells.join(" | ")} |`;
  });
  writeFileSync(markdownPath, [
    "# RAG检索模式对比 v0.1",
    "",
    `- 知识库版本：${String(report.knowledge_base_version)}`,
    `- Embedding：${String(report.embedding_provider)} / ${String(report.embedding_model)}`,
    `- 固定评估问题：${String(report.case_count)}条；所有模式使用同一知识库、同一问题和Top-3口径。`,
    "- Vector与Hybrid均为真实运行结果；本报告未启用BM25降级。",
    "- 耗时为本次本地运行观测值，仅用于相对比较，不代表线上SLA。",
    "",
    "| 模式 | Recall@3 | MRR | 平均总耗时(ms) |",
    "|---|---:|---:|---:|",
    ...summaryRows,
    "",
    "| 案例 | BM25 Top-3 | Vector Top-3 | Hybrid Top-3 |",
    "|---|---|---|---|",
    ...caseRows,
    "",
  ].join("\n"));
}

describe("BM25, Vector and Hybrid retrieval comparison", () => {
  it.skipIf(process.env.RAG_LIVE_EVALUATION !== "1")("compares all modes with one real query-embedding batch", async () => {
    const cases = loadCases();
    const queries: RetrievalQuery[] = cases.map((entry) => ({
      text: entry.query,
      query_time: entry.query_time,
      audience: entry.audience,
      known_product_type: entry.known_product_type,
      language: "zh-CN",
    }));
    const provider = new SiliconFlowEmbeddingProvider({ apiKey: localApiKey() });
    const service = new RagService({ embeddingProvider: provider, allowLexicalFallback: false });
    const embeddingStartedAt = performance.now();
    const queryVectors = await provider.embedDocuments(queries.map((query) => query.text));
    const embeddingMsPerQuery = (performance.now() - embeddingStartedAt) / cases.length;
    const bm25Results = queries.map((query) => service.retrieveBm25(query));
    const vectorResults = queries.map((query, index) => service.retrieveWithQueryVector(query, queryVectors[index], "vector", embeddingMsPerQuery));
    const hybridResults = queries.map((query, index) => service.retrieveWithQueryVector(query, queryVectors[index], "hybrid", embeddingMsPerQuery));
    const modes = [
      evaluateRetrievalResults("bm25", cases, bm25Results),
      evaluateRetrievalResults("vector", cases, vectorResults),
      evaluateRetrievalResults("hybrid", cases, hybridResults),
    ];
    expect(cases).toHaveLength(12);
    expect(queryVectors).toHaveLength(12);
    for (const mode of modes) {
      expect(mode.cases.every((entry) => entry.mode_used === mode.mode)).toBe(true);
      expect(mode.cases.every((entry) => entry.warning === null)).toBe(true);
    }
    const report = {
      generated_at: new Date().toISOString(),
      knowledge_base_version: bm25Results[0].knowledge_base_version,
      embedding_provider: provider.providerName,
      embedding_model: provider.model,
      dimensions: provider.dimensions,
      case_count: cases.length,
      top_k: 3,
      lexical_fallback_enabled: false,
      modes,
    };
    writeReports(report);
  }, 30_000);
});
