import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { KnowledgeRepository } from "@/rag/knowledge-repository";
import { parseFormalEvaluationJsonl, validateFormalEvaluationCases } from "@/rag/formal-evaluation";

describe("formal RAG evaluation fixture", () => {
  it("contains 30 valid, uniquely identified and knowledge-linked cases", () => {
    const content = readFileSync(resolve(process.cwd(), "tests/fixtures/rag-evaluation-v0.1.jsonl"), "utf8");
    const cases = parseFormalEvaluationJsonl(content);
    const repository = new KnowledgeRepository();

    expect(() => validateFormalEvaluationCases(cases, repository)).not.toThrow();
    expect(cases).toHaveLength(30);
    expect(cases.filter((entry) => entry.answerability === "unanswerable")).toHaveLength(2);
    expect(cases.filter((entry) => entry.expected_route === "tier2").length).toBeGreaterThanOrEqual(6);
    expect(cases.filter((entry) => entry.tags.includes("paraphrase")).length).toBeGreaterThanOrEqual(6);
    expect(cases.some((entry) => entry.audience === "tier1")).toBe(true);
  });
});
