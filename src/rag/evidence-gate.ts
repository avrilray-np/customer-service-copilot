import type { RetrievalResult, RetrievalStatus } from "./types";

export interface EvidenceGateOptions {
  queryText?: string;
  minimumVectorScore?: number;
  minimumLexicalScore?: number;
  minimumQueryEvidenceCoverage?: number;
  strongVectorScore?: number;
  strongLexicalScore?: number;
}

const queryNoisePhrases = [
  "帮我", "请问", "你们", "可以", "能不能", "是不是", "怎么", "为什么", "有没有", "一下",
  "直接", "马上", "这个", "那个", "一般", "具体", "现在", "已经", "还会", "还是", "给我",
  "用户", "系统", "的话", "这个账号", "一笔", "哪一笔", "这个月", "下个月", "今天", "上周", "事情",
];

function normalizeFocusText(value: string) {
  let normalized = value.normalize("NFKC").toLowerCase().replace(/[^\p{Script=Han}a-z0-9]/gu, "");
  for (const phrase of queryNoisePhrases) normalized = normalized.split(phrase).join("");
  return normalized;
}

function bigrams(value: string) {
  const characters = [...normalizeFocusText(value)];
  const result = new Set<string>();
  for (let index = 0; index < characters.length - 1; index += 1) {
    result.add(characters.slice(index, index + 2).join(""));
  }
  return result;
}

export function queryEvidenceCoverage(queryText: string, result: RetrievalResult) {
  const queryBigrams = bigrams(queryText);
  if (queryBigrams.size === 0) return 0;
  const evidence = result.hits.map((hit) => [
    hit.document.title,
    hit.chunk.section_path.join(" "),
    hit.chunk.text,
    hit.chunk.keywords.join(" "),
  ].join(" ")).join(" ");
  const evidenceBigrams = bigrams(evidence);
  const matched = [...queryBigrams].filter((bigram) => evidenceBigrams.has(bigram)).length;
  return matched / queryBigrams.size;
}

export function evaluateEvidence(result: RetrievalResult, options: EvidenceGateOptions = {}): RetrievalStatus {
  if (result.status === "unavailable") return "unavailable";
  if (result.hits.length === 0) return "insufficient";

  const decisionsByRule = new Map<string, Set<string>>();
  for (const hit of result.hits) {
    if (!hit.chunk.decision_value) continue;
    const decisions = decisionsByRule.get(hit.chunk.rule_key) ?? new Set<string>();
    decisions.add(hit.chunk.decision_value);
    decisionsByRule.set(hit.chunk.rule_key, decisions);
  }
  if ([...decisionsByRule.values()].some((decisions) => decisions.size > 1)) return "conflicting";

  const minimumVectorScore = options.minimumVectorScore ?? 0.55;
  const minimumLexicalScore = options.minimumLexicalScore ?? 1.5;
  const hasRelevantHit = result.hits.some((hit) =>
    (hit.vector_score !== null && hit.vector_score >= minimumVectorScore) ||
    (hit.lexical_score !== null && hit.lexical_score >= minimumLexicalScore),
  );
  if (!hasRelevantHit) return "insufficient";
  if (!options.queryText) return "available";

  const minimumQueryEvidenceCoverage = options.minimumQueryEvidenceCoverage ?? 0.21;
  const strongVectorScore = options.strongVectorScore ?? 0.67;
  const strongLexicalScore = options.strongLexicalScore ?? 20;
  const hasSpecificCoverage = queryEvidenceCoverage(options.queryText, result) >= minimumQueryEvidenceCoverage;
  const hasStrongSignal = result.hits.some((hit) =>
    (hit.vector_score !== null && hit.vector_score >= strongVectorScore) ||
    (hit.lexical_score !== null && hit.lexical_score >= strongLexicalScore),
  );
  return hasSpecificCoverage || hasStrongSignal ? "available" : "insufficient";
}
