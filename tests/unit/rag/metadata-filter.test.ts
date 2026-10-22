import { describe, expect, it } from "vitest";
import { knowledgeCatalog } from "@/data/knowledge/catalog";
import { documentMatchesQuery } from "@/rag/metadata-filter";

const baseQuery = {
  text: "优惠券为什么没到账",
  query_time: "2026-10-21T10:00:00+08:00",
  audience: "ai" as const,
  known_product_type: null,
  language: "zh-CN" as const,
};

describe("RAG metadata filter", () => {
  it("filters retired and expired knowledge", () => {
    const retired = knowledgeCatalog.documents.find((document) => document.document_id === "KB-BENEFIT-OLD-010");
    expect(retired).toBeDefined();
    expect(retired && documentMatchesQuery(retired, baseQuery)).toBe(false);
  });

  it("enforces audience visibility", () => {
    const dispute = knowledgeCatalog.documents.find((document) => document.document_id === "KB-BENEFIT-004");
    expect(dispute).toBeDefined();
    expect(dispute && documentMatchesQuery(dispute, baseQuery)).toBe(false);
    expect(dispute && documentMatchesQuery(dispute, { ...baseQuery, audience: "tier1" })).toBe(true);
  });

  it("filters active documents outside their effective window", () => {
    const current = knowledgeCatalog.documents[0];
    expect(documentMatchesQuery({ ...current, effective_from: "2026-11-01T00:00:00+08:00" }, baseQuery)).toBe(false);
    expect(documentMatchesQuery({ ...current, effective_to: "2026-10-01T00:00:00+08:00" }, baseQuery)).toBe(false);
  });

  it("applies trusted product scope without excluding documents when the product is unknown", () => {
    const scoped = { ...knowledgeCatalog.documents[0], applicable_products: ["continuous_monthly"] };
    expect(documentMatchesQuery(scoped, { ...baseQuery, known_product_type: "ordinary_monthly_card" })).toBe(false);
    expect(documentMatchesQuery(scoped, { ...baseQuery, known_product_type: "continuous_monthly" })).toBe(true);
    expect(documentMatchesQuery(scoped, baseQuery)).toBe(true);
  });

  it("rejects an invalid query time instead of silently using current time", () => {
    const document = knowledgeCatalog.documents[0];
    expect(() => documentMatchesQuery(document, { ...baseQuery, query_time: "not-a-date" })).toThrow(/有效ISO日期/u);
  });
});
