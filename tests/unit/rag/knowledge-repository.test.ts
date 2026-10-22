import { describe, expect, it } from "vitest";
import { knowledgeCatalog } from "@/data/knowledge/catalog";
import { KnowledgeRepository } from "@/rag/knowledge-repository";
import type { KnowledgeCatalog } from "@/rag/types";

describe("KnowledgeRepository", () => {
  it("loads the versioned catalog and validates all checksums", () => {
    const repository = new KnowledgeRepository();
    expect(repository.documents).toHaveLength(10);
    expect(repository.chunks).toHaveLength(33);
    expect(repository.manifest.knowledge_base_version).toBe("kb-2026.10-rag-v0.1");
    expect(repository.manifest.content_checksum).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it("keeps personal customer records out of the knowledge index", () => {
    const serialized = JSON.stringify(knowledgeCatalog);
    expect(serialized).not.toContain("DEMO-U");
    expect(serialized).not.toMatch(/TK-\d{8}/u);
    expect(serialized).not.toContain("user_uid");
    expect(serialized).not.toContain("queried_at");
  });

  it("rejects a changed chunk whose checksum was not rebuilt", () => {
    const broken = structuredClone(knowledgeCatalog) as KnowledgeCatalog;
    broken.chunks[0].text = `${broken.chunks[0].text} 未重建索引。`;
    expect(() => new KnowledgeRepository(broken)).toThrow(/片段校验和不一致/u);
  });
});
