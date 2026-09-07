import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAiProvider } from "@/ai/mock-ai-provider";
import { caseOneInput } from "@/data/demos/case-one";

const provider = vi.hoisted(() => ({ analyze: vi.fn() }));
const selection = vi.hoisted(() => ({
  mode: "deepseek" as "mock" | "deepseek",
  model: "deepseek-test" as string | null,
  provider,
}));

vi.mock("@/ai/provider-factory", () => ({
  createProviderSelection: () => selection,
}));

import { POST } from "@/app/api/ai/analyze/route";

beforeEach(() => {
  provider.analyze.mockReset();
  selection.mode = "deepseek";
  selection.model = "deepseek-test";
});

function request(body: unknown) {
  return POST(new Request("http://localhost/api/ai/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
}

describe("POST /api/ai/analyze", () => {
  it("accepts only the four fixed demo analysis requests", async () => {
    const candidate = await mockAiProvider.analyze(caseOneInput);
    provider.analyze.mockResolvedValue(candidate);

    for (const demoCase of ["case-one", "case-two", "case-three", "case-two-follow-up"]) {
      const response = await request({ demoCase });
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.mode).toBe("deepseek");
      expect(body.model).toBe("deepseek-test");
    }

    expect(provider.analyze).toHaveBeenCalledTimes(4);
    expect(provider.analyze.mock.calls[0][0].message).toContain("取消连续包月");
    expect(provider.analyze.mock.calls[1][0].message).toContain("优惠券没有到账");
    expect(provider.analyze.mock.calls[2][0].message).toContain("马上给我退款");
    expect(provider.analyze.mock.calls[3][0].message).toContain("用户追加诉求");
  });

  it("does not impersonate AI Mode when the server only has Mock configured", async () => {
    selection.mode = "mock";
    selection.model = null;
    const response = await request({ demoCase: "case-one" });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "服务器尚未配置真实AI，当前只能使用Mock Mode。" });
    expect(provider.analyze).not.toHaveBeenCalled();
  });

  it("rejects malformed, unknown or expanded request bodies", async () => {
    expect((await request({ demoCase: "case-four" })).status).toBe(400);
    expect((await request({ demoCase: "case-two-follow-up", userFacts: { injected: true } })).status).toBe(400);
  });
});
