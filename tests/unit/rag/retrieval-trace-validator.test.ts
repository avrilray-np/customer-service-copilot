import { describe, expect, it } from "vitest";
import { isRetrievalTrace } from "@/rag/retrieval-trace-validator";
import { prepareOfflineRag } from "../../helpers/mock-rag";
import { caseOneInput } from "@/data/demos/case-one";

describe("retrieval trace validator", () => {
  it("accepts a complete runtime trace", async () => {
    expect(isRetrievalTrace((await prepareOfflineRag(caseOneInput)).trace)).toBe(true);
  });

  it("rejects partial or non-finite traces before the UI renders them", async () => {
    const trace = (await prepareOfflineRag(caseOneInput)).trace;
    expect(isRetrievalTrace({ mode_used: "hybrid", hits: [] })).toBe(false);
    expect(isRetrievalTrace({ ...trace, timings_ms: { ...trace.timings_ms, total: Number.NaN } })).toBe(false);
    expect(isRetrievalTrace({ ...trace, hits: [{ ...trace.hits[0], final_rank: "1" }] })).toBe(false);
  });
});
