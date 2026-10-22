import { describe, expect, it, vi } from "vitest";
import { SiliconFlowEmbeddingProvider } from "@/rag/siliconflow-embedding-provider";

function vector(length = 1024) {
  return Array.from({ length }, (_, index) => index / 1000);
}

describe("SiliconFlowEmbeddingProvider", () => {
  it("returns vectors in response index order without exposing the key", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchMock = async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      return new Response(JSON.stringify({ data: [
      { index: 1, embedding: vector().map((value) => value + 1) },
      { index: 0, embedding: vector() },
      ] }), { status: 200 });
    };
    const provider = new SiliconFlowEmbeddingProvider({ apiKey: "secret-key", fetchImpl: fetchMock as unknown as typeof fetch });
    const result = await provider.embedDocuments(["甲", "乙"]);
    expect(result).toHaveLength(2);
    expect(result[0][1]).toBe(0.001);
    expect(result[1][0]).toBe(1);
    expect(String(capturedInit?.body)).not.toContain("secret-key");
  });

  it("rejects non-success responses and invalid dimensions", async () => {
    const failedFetch = vi.fn(async () => new Response(JSON.stringify({ message: "denied" }), { status: 401 })) as unknown as typeof fetch;
    await expect(new SiliconFlowEmbeddingProvider({ apiKey: "x", fetchImpl: failedFetch }).embedQuery("问题"))
      .rejects.toThrow("HTTP 401");

    const invalidFetch = vi.fn(async () => new Response(JSON.stringify({ data: [{ index: 0, embedding: vector(3) }] }), { status: 200 })) as unknown as typeof fetch;
    await expect(new SiliconFlowEmbeddingProvider({ apiKey: "x", fetchImpl: invalidFetch }).embedQuery("问题"))
      .rejects.toThrow("1024维");
  });

  it("rejects duplicate response indexes", async () => {
    const duplicateFetch = vi.fn(async () => new Response(JSON.stringify({ data: [
      { index: 0, embedding: vector() },
      { index: 0, embedding: vector() },
    ] }), { status: 200 })) as unknown as typeof fetch;
    await expect(new SiliconFlowEmbeddingProvider({ apiKey: "x", fetchImpl: duplicateFetch }).embedDocuments(["甲", "乙"]))
      .rejects.toThrow("序号缺失、重复或越界");
  });
});
