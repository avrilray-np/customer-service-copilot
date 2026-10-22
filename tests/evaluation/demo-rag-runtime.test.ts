import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { caseOneInput } from "@/data/demos/case-one";
import { caseTwoFollowUpInput, caseTwoInput } from "@/data/demos/case-two";
import { caseThreeInput } from "@/data/demos/case-three";
import { prepareRagAnalyses } from "@/rag/demo-rag-pipeline";

function localApiKey() {
  if (process.env.SILICONFLOW_API_KEY) return process.env.SILICONFLOW_API_KEY;
  const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const line = content.split(/\r?\n/u).find((entry) => entry.trim().startsWith("SILICONFLOW_API_KEY="));
  if (!line) throw new Error(".env.local缺少SILICONFLOW_API_KEY");
  return line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/gu, "");
}

describe("demo runtime Hybrid retrieval", () => {
  it.skipIf(process.env.RAG_LIVE_DEMO !== "1")("retrieves live evidence for all four runtime analyses without fallback", async () => {
    const prepared = await prepareRagAnalyses(
      [caseOneInput, caseTwoInput, caseThreeInput, caseTwoFollowUpInput],
      {
        ...process.env,
        SILICONFLOW_API_KEY: localApiKey(),
        RAG_ALLOW_LEXICAL_FALLBACK: "false",
      },
    );

    expect(prepared).toHaveLength(4);
    for (const item of prepared) {
      expect(item.trace.mode_requested).toBe("hybrid");
      expect(item.trace.mode_used).toBe("hybrid");
      expect(item.trace.warning).toBeNull();
      expect(item.trace.retrieval_status).not.toBe("unavailable");
      expect(item.input.knowledge_sources.length).toBeGreaterThan(0);
    }
    expect(prepared[0].trace.hits.some((hit) => hit.document_id === "KB-MEMBER-001")).toBe(true);
    expect(prepared[1].trace.hits.some((hit) => hit.document_id === "KB-BENEFIT-003")).toBe(true);
    expect(prepared[2].trace.hits.some((hit) => hit.document_id === "KB-REFUND-007")).toBe(true);
    expect(prepared[3].trace.hits.some((hit) => hit.document_id === "KB-BENEFIT-004")).toBe(true);
  }, 30_000);
});
