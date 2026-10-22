import { describe, expect, it } from "vitest";
import { caseOneInput } from "@/data/demos/case-one";
import { caseThreeInput } from "@/data/demos/case-three";
import { prepareRagAnalyses, prepareRagAnalysis } from "@/rag/demo-rag-pipeline";

const fallbackEnv = { NODE_ENV: "test", RAG_ALLOW_LEXICAL_FALLBACK: "true" } as NodeJS.ProcessEnv;

describe("demo RAG pipeline", () => {
  it("runs retrieval at request time and reports an explicit BM25 fallback", async () => {
    expect(caseOneInput.knowledge_sources).toEqual([]);
    const prepared = await prepareRagAnalysis(caseOneInput, fallbackEnv);

    expect(prepared.trace.mode_requested).toBe("hybrid");
    expect(prepared.trace.mode_used).toBe("bm25");
    expect(prepared.trace.warning).toMatch(/明确降级为BM25/u);
    expect(prepared.trace.retrieval_status).toBe("available");
    expect(prepared.input.knowledge_sources.length).toBeGreaterThan(0);
    expect(prepared.input.knowledge_sources.every((source) => source.chunk_id.includes("#"))).toBe(true);
    expect(prepared.input.knowledge_base_version).toBe(prepared.trace.knowledge_base_version);
  });

  it("keeps personal records out of the retrieval trace when batching demo cases", async () => {
    const prepared = await prepareRagAnalyses([caseOneInput, caseThreeInput], fallbackEnv);
    const serializedTrace = JSON.stringify(prepared.map((item) => item.trace));

    expect(serializedTrace).not.toContain("DEMO-U001");
    expect(serializedTrace).not.toContain("PAY-DEMO-9031");
    expect(prepared).toHaveLength(2);
  });
});
