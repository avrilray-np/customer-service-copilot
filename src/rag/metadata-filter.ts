import type { KnowledgeAudience, KnowledgeDocument, RetrievalQuery } from "./types";

function isValidDate(value: string) {
  return Number.isFinite(Date.parse(value));
}

export function documentMatchesQuery(document: KnowledgeDocument, query: RetrievalQuery) {
  if (document.status !== "active" || document.language !== query.language) return false;
  if (!document.audiences.includes(query.audience as KnowledgeAudience)) return false;
  if (!isValidDate(query.query_time)) throw new Error("检索时间不是有效ISO日期");

  const queryTime = Date.parse(query.query_time);
  if (!isValidDate(document.effective_from) || Date.parse(document.effective_from) > queryTime) return false;
  if (document.effective_to !== null) {
    if (!isValidDate(document.effective_to) || Date.parse(document.effective_to) <= queryTime) return false;
  }

  if (
    query.known_product_type &&
    !document.applicable_products.includes("all") &&
    !document.applicable_products.includes(query.known_product_type)
  ) return false;

  return true;
}
