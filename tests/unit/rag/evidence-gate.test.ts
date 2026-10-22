import { describe, expect, it } from "vitest";
import { evaluateEvidence, queryEvidenceCoverage } from "@/rag/evidence-gate";
import type { RetrievalHit, RetrievalResult } from "@/rag/types";

function hit(overrides: Partial<RetrievalHit> = {}): RetrievalHit {
  return {
    chunk: {
      chunk_id: "KB-TEST-001#rule",
      document_id: "KB-TEST-001",
      section_path: ["测试规则"],
      text: "测试规则正文",
      keywords: [],
      issue_subtypes: [],
      rule_key: "test.rule",
      decision_value: "allowed",
      priority: 1,
      checksum: "a".repeat(64),
    },
    document: {
      document_id: "KB-TEST-001",
      title: "测试规则",
      version: "1.0",
      status: "active",
      language: "zh-CN",
      effective_from: "2026-01-01T00:00:00+08:00",
      effective_to: null,
      supersedes_document_id: null,
      business_domains: ["test"],
      applicable_products: ["all"],
      audiences: ["ai"],
      source_owner: "test",
      updated_at: "2026-01-01T00:00:00+08:00",
    },
    lexical_score: 2,
    vector_score: 0.7,
    lexical_rank: 1,
    vector_rank: 1,
    rrf_score: 0.03,
    final_rank: 1,
    ...overrides,
  };
}

function result(hits: RetrievalHit[], status: RetrievalResult["status"] = "available"): RetrievalResult {
  return {
    mode_requested: "hybrid",
    mode_used: "hybrid",
    status,
    knowledge_base_version: "test-v1",
    embedding_model: "test-model",
    hits,
    filtered_count: hits.length,
    timings_ms: { metadata_filter: 0, lexical: 0, embedding: 0, vector: 0, fusion: 0, total: 0 },
    warning: null,
  };
}

describe("EvidenceGate", () => {
  it("accepts evidence when at least one hit passes the vector or lexical threshold", () => {
    expect(evaluateEvidence(result([hit({ vector_score: 0.6, lexical_score: 0.2 })]))).toBe("available");
    expect(evaluateEvidence(result([hit({ vector_score: 0.2, lexical_score: 1.6 })]))).toBe("available");
  });

  it("marks empty or low-relevance results as insufficient", () => {
    expect(evaluateEvidence(result([]))).toBe("insufficient");
    expect(evaluateEvidence(result([hit({ vector_score: 0.54, lexical_score: 1.49 })]))).toBe("insufficient");
  });

  it("rejects topic-only evidence that does not cover the specific question", () => {
    const couponDelivery = hit({
      chunk: {
        ...hit().chunk,
        text: "优惠券会在活动页面公示的发放周期内进入用户券包。",
        keywords: ["优惠券", "发放时间", "券包"],
      },
      lexical_score: 17.7,
      vector_score: 0.659,
    });
    const queryText = "优惠券可以转送给朋友使用吗？";

    expect(queryEvidenceCoverage(queryText, result([couponDelivery]))).toBeLessThan(0.21);
    expect(evaluateEvidence(result([couponDelivery]), { queryText })).toBe("insufficient");
  });

  it("accepts specific coverage or a calibrated strong retrieval signal", () => {
    const complaintRule = hit({
      chunk: {
        ...hit().chunk,
        text: "用户投诉活动规则提示不清时，应登记投诉并通知相关部门。",
        keywords: ["投诉", "活动规则", "提示不清"],
      },
      lexical_score: 8,
      vector_score: 0.6,
    });
    expect(evaluateEvidence(result([complaintRule]), { queryText: "我要投诉活动规则写得不清楚。" })).toBe("available");
    expect(evaluateEvidence(result([hit({ lexical_score: 20, vector_score: 0.2 })]), { queryText: "完全不同的问法" })).toBe("available");
    expect(evaluateEvidence(result([hit({ lexical_score: 0.2, vector_score: 0.67 })]), { queryText: "完全不同的问法" })).toBe("available");
  });

  it("marks contradictory decisions for the same rule as conflicting", () => {
    const opposite = hit({
      chunk: { ...hit().chunk, chunk_id: "KB-TEST-002#rule", decision_value: "denied" },
      final_rank: 2,
    });
    expect(evaluateEvidence(result([hit(), opposite]), { queryText: "与规则正文没有重合的具体问题" })).toBe("conflicting");
  });

  it("preserves unavailable retrieval instead of upgrading it", () => {
    expect(evaluateEvidence(result([], "unavailable"), { queryText: "任意问题" })).toBe("unavailable");
  });
});
