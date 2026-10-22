import type { KnowledgeAudience, KnowledgeChunk } from "./types";

export type EvaluationAnswerability = "answerable" | "unanswerable" | "conflicting";
export type EvaluationRoute = "ai" | "tier1" | "tier2";

export interface FormalRagEvaluationCase {
  eval_id: string;
  query: string;
  conversation_context: string[];
  query_time: string;
  audience: KnowledgeAudience;
  known_product_type: string | null;
  identity_status: "verified" | "unverified" | "not_required";
  answerability: EvaluationAnswerability;
  relevant_chunk_ids: string[];
  acceptable_chunk_ids: string[];
  reference_answer: string | null;
  required_claims: string[];
  forbidden_claims: string[];
  expected_citation_chunk_ids: string[];
  expected_route: EvaluationRoute;
  tags: string[];
  notes: string;
}

function uniqueStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") && new Set(value).size === value.length;
}

export function parseFormalEvaluationJsonl(content: string): FormalRagEvaluationCase[] {
  const lines = content.trim().split(/\r?\n/u).filter(Boolean);
  return lines.map((line, index) => {
    try {
      return JSON.parse(line) as FormalRagEvaluationCase;
    } catch (error) {
      throw new Error(`正式RAG评估集第${index + 1}行不是有效JSON`, { cause: error });
    }
  });
}

export function validateFormalEvaluationCases(
  cases: FormalRagEvaluationCase[],
  knowledge: { chunks: Array<Pick<KnowledgeChunk, "chunk_id">> },
  expectedCount = 30,
) {
  if (cases.length !== expectedCount) throw new Error(`正式RAG评估集应包含${expectedCount}条，实际为${cases.length}条`);
  const knownChunkIds = new Set(knowledge.chunks.map((chunk) => chunk.chunk_id));
  const ids = new Set<string>();
  for (const [index, testCase] of cases.entries()) {
    const row = index + 1;
    if (!/^RAG-\d{3}$/u.test(testCase.eval_id) || ids.has(testCase.eval_id)) throw new Error(`第${row}条eval_id无效或重复`);
    ids.add(testCase.eval_id);
    if (!testCase.query.trim() || !Number.isFinite(Date.parse(testCase.query_time))) throw new Error(`${testCase.eval_id}缺少有效问题或时间`);
    if (!(["ai", "tier1", "tier2"] as unknown[]).includes(testCase.audience)) throw new Error(`${testCase.eval_id}的audience无效`);
    if (!(["verified", "unverified", "not_required"] as unknown[]).includes(testCase.identity_status)) throw new Error(`${testCase.eval_id}的identity_status无效`);
    if (!(["answerable", "unanswerable", "conflicting"] as unknown[]).includes(testCase.answerability)) throw new Error(`${testCase.eval_id}的answerability无效`);
    if (!(["ai", "tier1", "tier2"] as unknown[]).includes(testCase.expected_route)) throw new Error(`${testCase.eval_id}的expected_route无效`);
    const arrays = [testCase.conversation_context, testCase.relevant_chunk_ids, testCase.acceptable_chunk_ids, testCase.required_claims, testCase.forbidden_claims, testCase.expected_citation_chunk_ids, testCase.tags];
    if (arrays.some((value) => !uniqueStrings(value))) throw new Error(`${testCase.eval_id}包含无效或重复数组值`);
    const referencedChunks = [...testCase.relevant_chunk_ids, ...testCase.acceptable_chunk_ids, ...testCase.expected_citation_chunk_ids];
    if (referencedChunks.some((chunkId) => !knownChunkIds.has(chunkId))) throw new Error(`${testCase.eval_id}引用了不存在的知识片段`);
    if (testCase.relevant_chunk_ids.some((chunkId) => testCase.acceptable_chunk_ids.includes(chunkId))) throw new Error(`${testCase.eval_id}的必需与可接受片段重叠`);
    const allowedCitationIds = new Set([...testCase.relevant_chunk_ids, ...testCase.acceptable_chunk_ids]);
    if (testCase.expected_citation_chunk_ids.some((chunkId) => !allowedCitationIds.has(chunkId))) throw new Error(`${testCase.eval_id}的预期引用不在相关片段集合中`);
    if (testCase.answerability === "answerable" && (testCase.relevant_chunk_ids.length === 0 || !testCase.reference_answer)) throw new Error(`${testCase.eval_id}可回答但缺少必需依据或参考答案`);
    if (testCase.answerability === "unanswerable" && (testCase.relevant_chunk_ids.length > 0 || testCase.reference_answer !== null || testCase.expected_citation_chunk_ids.length > 0 || testCase.expected_route === "ai")) throw new Error(`${testCase.eval_id}知识缺口标注不一致`);
    if (testCase.answerability === "conflicting" && testCase.expected_route === "ai") throw new Error(`${testCase.eval_id}冲突案例不得直接路由AI`);
    if (!testCase.notes.trim() || testCase.tags.length === 0) throw new Error(`${testCase.eval_id}缺少标签或标注说明`);
  }
}
