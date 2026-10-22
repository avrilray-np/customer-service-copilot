import { describe, expect, it } from "vitest";
import { scoreAnswerEvaluation, summarizeAnswerEvaluations, type RagHumanEvaluationRecord } from "@/rag/answer-evaluation";
import type { FormalRagEvaluationCase } from "@/rag/formal-evaluation";

const testCase: FormalRagEvaluationCase = {
  eval_id: "RAG-999",
  query: "测试问题",
  conversation_context: [],
  query_time: "2026-10-22T10:00:00+08:00",
  audience: "ai",
  known_product_type: null,
  identity_status: "not_required",
  answerability: "answerable",
  relevant_chunk_ids: ["KB-TEST#required"],
  acceptable_chunk_ids: ["KB-TEST#acceptable"],
  reference_answer: "正确回答",
  required_claims: ["正确事实"],
  forbidden_claims: ["禁止事实"],
  expected_citation_chunk_ids: ["KB-TEST#required"],
  expected_route: "ai",
  tags: ["test"],
  notes: "测试",
};

function record(overrides: Partial<RagHumanEvaluationRecord> = {}): RagHumanEvaluationRecord {
  return {
    eval_id: "RAG-999",
    retrieval_mode_used: "hybrid",
    generated_answer: "正确回答",
    cited_chunk_ids: ["KB-TEST#required"],
    actual_route: "ai",
    abstained_or_handed_off: false,
    answer_correctness_score: 2,
    faithfulness_score: 2,
    has_critical_error: false,
    critical_error_types: [],
    reviewer_note: "",
    reviewed_at: "2026-10-22T12:00:00+08:00",
    ...overrides,
  };
}

describe("answer evaluation", () => {
  it("scores citations, routing, handoff and forbidden claims separately", () => {
    const scored = scoreAnswerEvaluation(testCase, record({
      generated_answer: "正确回答，但包含禁止事实。",
      cited_chunk_ids: ["KB-TEST#required", "KB-OTHER#wrong"],
      actual_route: "tier1",
    }));

    expect(scored.citation_precision).toBe(0.5);
    expect(scored.citation_recall).toBe(1);
    expect(scored.forbidden_claim_found).toBe(true);
    expect(scored.route_correct).toBe(false);
    expect(scored.handoff_correct).toBe(true);
  });

  it("keeps incomplete manual records out of human-score aggregates", () => {
    const complete = scoreAnswerEvaluation(testCase, record());
    const pending = scoreAnswerEvaluation(testCase, record({ answer_correctness_score: null, faithfulness_score: null, has_critical_error: null, reviewed_at: null }));
    const summary = summarizeAnswerEvaluations([complete, pending]);

    expect(summary.case_count).toBe(2);
    expect(summary.reviewed_count).toBe(1);
    expect(summary.answer_correctness_average).toBe(2);
    expect(summary.critical_error_rate).toBe(0);
  });
});
