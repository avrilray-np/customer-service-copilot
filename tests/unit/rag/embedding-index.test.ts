import { describe, expect, it } from "vitest";
import rawIndex from "@/data/knowledge/index/embeddings-v0.1.json";
import { EmbeddingIndexRepository } from "@/rag/embedding-index";
import { KnowledgeRepository } from "@/rag/knowledge-repository";
import type { EmbeddingIndex } from "@/rag/types";

function cloneIndex() {
  return structuredClone(rawIndex) as EmbeddingIndex;
}

describe("EmbeddingIndexRepository", () => {
  it("loads the complete normalized versioned index", () => {
    const repository = new KnowledgeRepository();
    const index = new EmbeddingIndexRepository(repository);
    expect(index.index.entries).toHaveLength(33);
    expect(index.index.dimensions).toBe(1024);
    expect(index.vectorFor(repository.chunks[0].chunk_id)).toHaveLength(1024);
  });

  it("rejects stale checksums and malformed vectors", () => {
    const repository = new KnowledgeRepository();
    const stale = cloneIndex();
    stale.entries[0].text_checksum = "sha256:stale";
    expect(() => new EmbeddingIndexRepository(repository, stale)).toThrow("校验和不一致");

    const wrongDimension = cloneIndex();
    wrongDimension.entries[0].vector = [1, 0];
    expect(() => new EmbeddingIndexRepository(repository, wrongDimension)).toThrow("向量无效");
  });
});
