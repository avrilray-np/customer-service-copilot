import { describe, expect, it } from "vitest";
import { RagService } from "@/rag/rag-service";

const service = new RagService();

function retrieve(text: string, audience: "ai" | "tier1" | "tier2" = "ai") {
  return service.retrieveBm25({
    text,
    query_time: "2026-10-21T10:00:00+08:00",
    audience,
    known_product_type: null,
    language: "zh-CN",
  }, { topK: 3 });
}

describe("Chinese BM25 retrieval", () => {
  it("returns the cancellation entitlement rule first", () => {
    const result = retrieve("我取消连续包月了，为什么现在还是会员？");
    expect(result.mode_used).toBe("bm25");
    expect(result.status).toBe("available");
    expect(result.hits[0].chunk.chunk_id).toBe("KB-MEMBER-001#cancel-current-entitlement");
  });

  it("retrieves the post-cancellation charge evidence rule", () => {
    const result = retrieve("取消自动续订以后还是扣了30元");
    expect(result.hits.map((hit) => hit.chunk.chunk_id)).toContain("KB-REFUND-007#post-cancellation-charge");
  });

  it("never returns the retired ordinary-card campaign rule", () => {
    const result = retrieve("普通月卡赠券支付以后是不是即时到账？");
    expect(result.hits.some((hit) => hit.document.document_id === "KB-BENEFIT-OLD-010")).toBe(false);
  });

  it("hides tier1-only dispute guidance from the AI audience", () => {
    const aiResult = retrieve("活动资格提示没写清楚，怎么审核补偿？");
    const tier1Result = retrieve("活动资格提示没写清楚，怎么审核补偿？", "tier1");
    expect(aiResult.hits.some((hit) => hit.document.document_id === "KB-BENEFIT-004")).toBe(false);
    expect(tier1Result.hits.some((hit) => hit.document.document_id === "KB-BENEFIT-004")).toBe(true);
  });

  it("limits one document to two of the Top-K slots", () => {
    const result = service.retrieveBm25({
      text: "取消自动续订 退订 下期扣费 会员权益",
      query_time: "2026-10-21T10:00:00+08:00",
      audience: "ai",
      known_product_type: null,
      language: "zh-CN",
    }, { topK: 5, maxChunksPerDocument: 2 });
    const counts = result.hits.reduce<Record<string, number>>((accumulator, hit) => {
      accumulator[hit.document.document_id] = (accumulator[hit.document.document_id] ?? 0) + 1;
      return accumulator;
    }, {});
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(2);
  });
});
