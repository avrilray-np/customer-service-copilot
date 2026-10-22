import { describe, expect, it } from "vitest";
import { FakeEmbeddingProvider } from "@/rag/fake-embedding-provider";
import { EmbeddingIndexRepository } from "@/rag/embedding-index";
import { KnowledgeRepository } from "@/rag/knowledge-repository";
import { RagService } from "@/rag/rag-service";
import type { EmbeddingProvider } from "@/rag/embedding-provider";

const query = {
  text: "优惠券未到账",
  query_time: "2026-10-21T10:00:00+08:00",
  audience: "ai" as const,
  known_product_type: null,
  language: "zh-CN" as const,
};

describe("Vector and Hybrid retrieval", () => {
  it("uses versioned vectors and preserves rank evidence", async () => {
    const repository = new KnowledgeRepository();
    const index = new EmbeddingIndexRepository(repository);
    const expectedChunk = "KB-BENEFIT-003#coupon-status-data";
    const provider = new FakeEmbeddingProvider(1024, "BAAI/bge-m3", new Map([
      [query.text, index.vectorFor(expectedChunk)],
    ]), "siliconflow");
    const service = new RagService({ repository, embeddingIndex: index, embeddingProvider: provider });
    const vector = await service.retrieve(query, "vector");
    expect(vector.mode_used).toBe("vector");
    expect(vector.hits[0].chunk.chunk_id).toBe(expectedChunk);
    expect(vector.hits[0].vector_rank).toBe(1);
    expect(vector.hits.filter((hit) => hit.document.document_id === "KB-BENEFIT-003").length).toBeLessThanOrEqual(2);

    const hybrid = await service.retrieve(query, "hybrid");
    expect(hybrid.mode_used).toBe("hybrid");
    expect(hybrid.hits.some((hit) => hit.rrf_score !== null)).toBe(true);
    expect(hybrid.warning).toBeNull();
  });

  it("only falls back when explicitly allowed", async () => {
    const unavailableProvider: EmbeddingProvider = {
      providerName: "siliconflow", model: "BAAI/bge-m3", dimensions: 1024,
      embedQuery: async () => { throw new Error("offline"); },
      embedDocuments: async () => { throw new Error("offline"); },
    };
    const strict = new RagService({ embeddingProvider: unavailableProvider, allowLexicalFallback: false });
    const unavailable = await strict.retrieve(query, "hybrid");
    expect(unavailable.status).toBe("unavailable");
    expect(unavailable.mode_used).toBe("hybrid");

    const fallback = new RagService({ embeddingProvider: unavailableProvider, allowLexicalFallback: true });
    const degraded = await fallback.retrieve(query, "hybrid");
    expect(degraded.mode_requested).toBe("hybrid");
    expect(degraded.mode_used).toBe("bm25");
    expect(degraded.warning).toContain("明确降级");
  });

  it("rejects a query provider that does not match the document index", () => {
    const provider = new FakeEmbeddingProvider(1024, "another-model", new Map());
    expect(() => new RagService({ embeddingProvider: provider })).toThrow("模型或维度不一致");
  });
});
