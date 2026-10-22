import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateBm25, type Bm25EvaluationCase } from "@/rag/bm25-evaluation";

const fixturePath = resolve(process.cwd(), "tests/fixtures/rag-bm25-baseline-v0.1.jsonl");

function loadCases(): Bm25EvaluationCase[] {
  return readFileSync(fixturePath, "utf8")
    .trim()
    .split(/\r?\n/u)
    .map((line) => JSON.parse(line) as Bm25EvaluationCase);
}

function writeReport(result: ReturnType<typeof evaluateBm25>) {
  const jsonPath = resolve(process.cwd(), "reports/rag-bm25-baseline-v0.1.json");
  const markdownPath = resolve(process.cwd(), "reports/rag-bm25-baseline-v0.1.md");
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  const rows = result.cases.map((entry) =>
    `| ${entry.eval_id} | ${entry.recall_at_3.toFixed(2)} | ${entry.reciprocal_rank.toFixed(2)} | ${entry.retrieved_chunk_ids.join("<br>")} |`,
  );
  writeFileSync(markdownPath, [
    "# BM25检索基线 v0.1",
    "",
    `- 案例数：${result.case_count}`,
    `- Recall@3：${result.recall_at_3.toFixed(4)}`,
    `- MRR：${result.mrr.toFixed(4)}`,
    "- 说明：本报告只评估本地BM25，不包含Embedding、RRF或生成回答质量。",
    "",
    "| 案例 | Recall@3 | Reciprocal Rank | Top-3片段 |",
    "|---|---:|---:|---|",
    ...rows,
    "",
  ].join("\n"));
}

describe("BM25 retrieval baseline", () => {
  it("meets the initial fixed-set retrieval baseline", () => {
    const cases = loadCases();
    const result = evaluateBm25(cases);
    expect(cases).toHaveLength(12);
    expect(result.recall_at_3).toBeGreaterThanOrEqual(0.9);
    expect(result.mrr).toBeGreaterThanOrEqual(0.8);
    if (process.env.RAG_WRITE_REPORT === "1") writeReport(result);
  });
});
