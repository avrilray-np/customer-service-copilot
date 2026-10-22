import type { EvaluationRoute, FormalRagEvaluationCase } from "./formal-evaluation";

export type CriticalErrorType = "forbidden_claim" | "policy_violation" | "unsafe_action" | "wrong_route";

export interface RagHumanEvaluationRecord {
  eval_id: string;
  retrieval_mode_used: "bm25" | "vector" | "hybrid" | null;
  generated_answer: string | null;
  cited_chunk_ids: string[];
  actual_route: EvaluationRoute | null;
  abstained_or_handed_off: boolean | null;
  answer_correctness_score: 0 | 1 | 2 | null;
  faithfulness_score: 0 | 1 | 2 | null;
  has_critical_error: boolean | null;
  critical_error_types: CriticalErrorType[];
  reviewer_note: string;
  reviewed_at: string | null;
}

export interface ScoredAnswerEvaluation {
  eval_id: string;
  citation_precision: number | null;
  citation_recall: number;
  forbidden_claim_found: boolean;
  route_correct: boolean | null;
  handoff_correct: boolean | null;
  answer_correctness_score: 0 | 1 | 2 | null;
  faithfulness_score: 0 | 1 | 2 | null;
  has_critical_error: boolean | null;
}

export function scoreAnswerEvaluation(testCase: FormalRagEvaluationCase, record: RagHumanEvaluationRecord): ScoredAnswerEvaluation {
  if (testCase.eval_id !== record.eval_id) throw new Error("Gold案例与人工评分记录ID不一致");
  const acceptableCitations = new Set([...testCase.relevant_chunk_ids, ...testCase.acceptable_chunk_ids]);
  const expectedCitations = new Set(testCase.expected_citation_chunk_ids);
  const supportedCitationCount = record.cited_chunk_ids.filter((chunkId) => acceptableCitations.has(chunkId)).length;
  const foundExpectedCitations = [...expectedCitations].filter((chunkId) => record.cited_chunk_ids.includes(chunkId)).length;
  const forbiddenClaimFound = record.generated_answer !== null && testCase.forbidden_claims.some((claim) => record.generated_answer!.includes(claim));
  const expectedHandoff = testCase.answerability !== "answerable" || testCase.expected_route !== "ai";
  return {
    eval_id: testCase.eval_id,
    citation_precision: record.cited_chunk_ids.length > 0 ? supportedCitationCount / record.cited_chunk_ids.length : expectedCitations.size === 0 ? 1 : null,
    citation_recall: expectedCitations.size > 0 ? foundExpectedCitations / expectedCitations.size : record.cited_chunk_ids.length === 0 ? 1 : 0,
    forbidden_claim_found: forbiddenClaimFound,
    route_correct: record.actual_route === null ? null : record.actual_route === testCase.expected_route,
    handoff_correct: record.abstained_or_handed_off === null ? null : record.abstained_or_handed_off === expectedHandoff,
    answer_correctness_score: record.answer_correctness_score,
    faithfulness_score: record.faithfulness_score,
    has_critical_error: record.has_critical_error,
  };
}

export function summarizeAnswerEvaluations(evaluations: ScoredAnswerEvaluation[]) {
  const reviewed = evaluations.filter((entry) => entry.answer_correctness_score !== null && entry.faithfulness_score !== null && entry.has_critical_error !== null);
  const withCitationPrecision = evaluations.filter((entry) => entry.citation_precision !== null);
  const withRoute = evaluations.filter((entry) => entry.route_correct !== null);
  const withHandoff = evaluations.filter((entry) => entry.handoff_correct !== null);
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  return {
    case_count: evaluations.length,
    reviewed_count: reviewed.length,
    citation_precision: average(withCitationPrecision.map((entry) => entry.citation_precision ?? 0)),
    citation_recall: average(evaluations.map((entry) => entry.citation_recall)),
    route_accuracy: average(withRoute.map((entry) => entry.route_correct ? 1 : 0)),
    handoff_accuracy: average(withHandoff.map((entry) => entry.handoff_correct ? 1 : 0)),
    answer_correctness_average: reviewed.length > 0 ? average(reviewed.map((entry) => entry.answer_correctness_score ?? 0)) : null,
    answer_correctness_full_rate: reviewed.length > 0 ? reviewed.filter((entry) => entry.answer_correctness_score === 2).length / reviewed.length : null,
    answer_correctness_error_rate: reviewed.length > 0 ? reviewed.filter((entry) => entry.answer_correctness_score === 0).length / reviewed.length : null,
    faithfulness_average: reviewed.length > 0 ? average(reviewed.map((entry) => entry.faithfulness_score ?? 0)) : null,
    critical_error_rate: reviewed.length > 0 ? reviewed.filter((entry) => entry.has_critical_error).length / reviewed.length : null,
    forbidden_claim_rate: evaluations.filter((entry) => entry.forbidden_claim_found).length / Math.max(evaluations.length, 1),
  };
}
