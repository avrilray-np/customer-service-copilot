import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateEvidence } from "@/rag/evidence-gate";
import { parseFormalEvaluationJsonl, validateFormalEvaluationCases } from "@/rag/formal-evaluation";
import { KnowledgeRepository } from "@/rag/knowledge-repository";
import { RagService } from "@/rag/rag-service";
import { evaluateRetrievalResults } from "@/rag/retrieval-evaluation";
import type { RetrievalQuery } from "@/rag/types";

const fixturePath = resolve(process.cwd(), "tests/fixtures/rag-evaluation-v0.1.jsonl");

function writeReport(result: ReturnType<typeof evaluateRetrievalResults>) {
  const jsonPath = resolve(process.cwd(), "reports/rag-formal-bm25-v0.1.json");
  const markdownPath = resolve(process.cwd(), "reports/rag-formal-bm25-v0.1.md");
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  const misses = result.cases.filter((entry) => entry.recall_at_3 !== null && entry.recall_at_3 < 1);
  writeFileSync(markdownPath, [
    "# 正式RAG评估集 BM25结果 v0.1",
    "",
    `- 案例：${result.case_count}条，其中有必需依据的案例${result.answerable_case_count}条。`,
    `- Recall@3：${result.recall_at_3.toFixed(4)}`,
    `- MRR：${result.mrr.toFixed(4)}`,
    `- Precision@3：${result.precision_at_3.toFixed(4)}`,
    `- EvidenceGate可回答性准确率：${result.answerability_accuracy.toFixed(4)}`,
    `- 检索延迟P50/P95：${result.total_latency_ms.p50.toFixed(2)} / ${result.total_latency_ms.p95.toFixed(2)} ms`,
    "- 本报告不包含生成回答、引用正确性或人工Answer Correctness评分。",
    "",
    "## 未完全召回案例",
    "",
    ...(misses.length > 0 ? misses.map((entry) => `- ${entry.eval_id}：Recall@3=${entry.recall_at_3?.toFixed(2)}；Top-3=${entry.retrieved_chunk_ids.join(", ")}`) : ["- 无"]),
    "",
  ].join("\n"));
}

describe("formal RAG BM25 evaluation", () => {
  it("evaluates all 30 cases without external calls", () => {
    const repository = new KnowledgeRepository();
    const cases = parseFormalEvaluationJsonl(readFileSync(fixturePath, "utf8"));
    validateFormalEvaluationCases(cases, repository);
    const service = new RagService({ repository });
    const queries: RetrievalQuery[] = cases.map((entry) => ({
      text: entry.query,
      query_time: entry.query_time,
      audience: entry.audience,
      known_product_type: entry.known_product_type,
      language: "zh-CN",
    }));
    const results = queries.map((query) => {
      const result = service.retrieveBm25(query);
      return { ...result, status: evaluateEvidence(result, { queryText: query.text }) };
    });
    const evaluation = evaluateRetrievalResults("bm25", cases, results);

    expect(evaluation.case_count).toBe(30);
    expect(evaluation.answerable_case_count).toBe(28);
    expect(evaluation.cases.every((entry) => entry.mode_used === "bm25" && entry.warning === null)).toBe(true);
    expect(Number.isFinite(evaluation.recall_at_3)).toBe(true);
    expect(Number.isFinite(evaluation.precision_at_3)).toBe(true);
    expect(evaluation.answerability_accuracy).toBe(1);
    expect(evaluation.cases.filter((entry) => ["RAG-029", "RAG-030"].includes(entry.eval_id)).every((entry) => entry.status === "insufficient")).toBe(true);
    if (process.env.RAG_WRITE_FORMAL_REPORT === "1") writeReport(evaluation);
  });
});
