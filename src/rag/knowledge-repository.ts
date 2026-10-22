import { createHash } from "node:crypto";
import { knowledgeCatalog } from "@/data/knowledge/catalog";
import type { KnowledgeCatalog, KnowledgeChunk, KnowledgeDocument } from "./types";

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value: string) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function knowledgeChunkSearchText(chunk: KnowledgeChunk, document: KnowledgeDocument) {
  return [document.title, chunk.section_path.join(" "), chunk.text].join(" ");
}

export function knowledgeContentChecksum(documents: KnowledgeDocument[], chunks: KnowledgeChunk[]) {
  return sha256(stableStringify({ documents, chunks }));
}

export class KnowledgeRepository {
  readonly manifest;
  readonly documents;
  readonly chunks;
  private readonly documentsById;

  constructor(catalog: KnowledgeCatalog = knowledgeCatalog) {
    this.manifest = catalog.manifest;
    this.documents = catalog.documents;
    this.chunks = catalog.chunks;
    this.documentsById = new Map(catalog.documents.map((document) => [document.document_id, document]));
    this.validate();
  }

  documentFor(chunk: KnowledgeChunk) {
    const document = this.documentsById.get(chunk.document_id);
    if (!document) throw new Error(`知识片段 ${chunk.chunk_id} 找不到所属文档`);
    return document;
  }

  private validate() {
    const validStatuses = new Set(["draft", "active", "retired"]);
    const validAudiences = new Set(["ai", "tier1", "tier2"]);
    const documentIds = this.documents.map((document) => document.document_id);
    const chunkIds = this.chunks.map((chunk) => chunk.chunk_id);
    if (new Set(documentIds).size !== documentIds.length) throw new Error("知识文档ID必须唯一");
    if (new Set(chunkIds).size !== chunkIds.length) throw new Error("知识片段ID必须唯一");
    if (this.manifest.chunk_count !== this.chunks.length) throw new Error("知识manifest片段数量不一致");
    if ([...this.manifest.document_ids].sort().join("|") !== [...documentIds].sort().join("|")) {
      throw new Error("知识manifest文档列表不一致");
    }

    for (const document of this.documents) {
      if (
        !document.document_id || !document.title || !document.version || document.language !== "zh-CN" ||
        !validStatuses.has(document.status) || document.business_domains.length === 0 ||
        document.applicable_products.length === 0 || document.audiences.length === 0 ||
        document.audiences.some((audience) => !validAudiences.has(audience)) || !document.source_owner
      ) {
        throw new Error(`知识文档契约无效：${document.document_id || "unknown"}`);
      }
      if (!Number.isFinite(Date.parse(document.effective_from)) || !Number.isFinite(Date.parse(document.updated_at))) {
        throw new Error(`知识文档日期无效：${document.document_id}`);
      }
      if (document.effective_to !== null && !Number.isFinite(Date.parse(document.effective_to))) {
        throw new Error(`知识文档结束日期无效：${document.document_id}`);
      }
    }

    for (const chunk of this.chunks) {
      const document = this.documentFor(chunk);
      if (
        !chunk.chunk_id.startsWith(`${document.document_id}#`) || !chunk.text || chunk.section_path.length === 0 ||
        chunk.keywords.length === 0 || chunk.issue_subtypes.length === 0 || !chunk.rule_key ||
        !Number.isFinite(chunk.priority)
      ) {
        throw new Error(`知识片段契约无效：${chunk.chunk_id}`);
      }
      const expectedChecksum = sha256(knowledgeChunkSearchText(chunk, document));
      if (chunk.checksum !== expectedChecksum) throw new Error(`知识片段校验和不一致：${chunk.chunk_id}`);
    }

    const expectedContentChecksum = knowledgeContentChecksum(this.documents, this.chunks);
    if (this.manifest.content_checksum !== expectedContentChecksum) throw new Error("知识manifest内容校验和不一致");
  }
}
