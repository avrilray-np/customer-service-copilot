import { describe, expect, it, vi } from "vitest";
import { DeepSeekAiProvider } from "@/ai/deepseek-ai-provider";
import { AiProviderError } from "@/ai/ai-provider-error";
import { caseOneInput } from "@/data/demos/case-one";
import { caseTwoInput } from "@/data/demos/case-two";
import { caseThreeInput } from "@/data/demos/case-three";

function structuredResult(overrides: Record<string, unknown> = {}) {
  return {
    summary: "用户已取消自动续订，咨询会员有效期和后续扣费。",
    handling_category: "low_risk_info",
    subtypes: ["membership_query", "renewal_query"],
    risk_level: "low",
    risk_reason: "仅查询会员与续订状态。",
    classification_confidence: "high",
    reply: "当前会员有效，自动续订已取消，到期后不会继续扣费。",
    evidence_status: "sufficient",
    recommended_action: "reply",
    knowledge_source_ids: ["KB-MEMBER-001"],
    user_data_source_names: ["demo_membership_service"],
    missing_information: [],
    ...overrides,
  };
}

function deepSeekResponse(result: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify({
    status: status === 200 ? "completed" : "failed",
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(result) }] }],
  }), { status, headers: { "content-type": "application/json" } });
}

describe("DeepSeekAiProvider", () => {
  it("uses the Responses API JSON Schema and restores trusted sources", async () => {
    const fetcher = vi.fn().mockResolvedValue(deepSeekResponse(structuredResult()));
    const provider = new DeepSeekAiProvider({ apiKey: "test-only-key", model: "deepseek-test", fetcher });

    const candidate = await provider.analyze(caseOneInput);

    expect(candidate.knowledge_sources).toEqual(caseOneInput.knowledge_sources);
    expect(candidate.user_data_sources).toEqual(caseOneInput.user_data_sources);
    expect(candidate.recommended_action).toBe("reply");
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.deepseek.com/responses");
    expect(init.headers.authorization).toBe("Bearer test-only-key");
    const request = JSON.parse(init.body);
    expect(request.model).toBe("deepseek-test");
    expect(request.text.format.type).toBe("json_schema");
    expect(request.text.format.strict).toBe(true);
    expect(request.text.format.schema.additionalProperties).toBe(false);
    expect(request.input[1].content).toContain('"auto_renewal_status":"cancelled"');
  });

  it("ignores reasoning text and parses only the final message output", async () => {
    const response = new Response(JSON.stringify({
      status: "completed",
      output: [
        { type: "reasoning", content: [{ type: "output_text", text: "这不是JSON" }] },
        { type: "message", content: [{ type: "output_text", text: JSON.stringify(structuredResult()) }] },
      ],
    }), { status: 200 });
    const provider = new DeepSeekAiProvider({ apiKey: "test-only-key", fetcher: vi.fn().mockResolvedValue(response) });

    await expect(provider.analyze(caseOneInput)).resolves.toMatchObject({ handling_category: "low_risk_info" });
  });

  it("rejects a source id that the application did not supply", async () => {
    const fetcher = vi.fn().mockResolvedValue(deepSeekResponse(structuredResult({ knowledge_source_ids: ["KB-FABRICATED-999"] })));
    const provider = new DeepSeekAiProvider({ apiKey: "test-only-key", fetcher });

    await expect(provider.analyze(caseOneInput)).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("applies the tier2 guard without overwriting a valid evidence status", async () => {
    const result = structuredResult({
      summary: "用户咨询扣费。",
      subtypes: ["renewal_query"],
      knowledge_source_ids: ["KB-REFUND-007"],
      user_data_source_names: ["demo_payment_service"],
    });
    const provider = new DeepSeekAiProvider({ apiKey: "test-only-key", fetcher: vi.fn().mockResolvedValue(deepSeekResponse(result)) });

    await expect(provider.analyze(caseThreeInput)).resolves.toMatchObject({
      handling_category: "high_risk",
      risk_level: "high",
      recommended_action: "assign_tier2",
      evidence_status: "sufficient",
    });
  });

  it("accepts the real case-two wording that says the coupon has not arrived", async () => {
    const reply = "您好，已收到您关于优惠券未到账的反馈及对活动规则的投诉。我们将转交一线人工复核，补发结果以人工审核为准。";
    const result = structuredResult({
      summary: "用户要求补发优惠券并投诉活动规则不清楚。",
      handling_category: "low_risk_other",
      subtypes: ["reissue", "complaint"],
      risk_reason: "需要一线人工核验争议补偿条件并登记投诉。",
      reply,
      recommended_action: "assign_tier1",
      knowledge_source_ids: ["KB-BENEFIT-003"],
      user_data_source_names: ["demo_benefit_service"],
      missing_information: ["活动页面资格提示展示情况"],
    });
    const provider = new DeepSeekAiProvider({ apiKey: "test-only-key", fetcher: vi.fn().mockResolvedValue(deepSeekResponse(result)) });

    await expect(provider.analyze({ ...caseTwoInput, message: `${caseTwoInput.message}\n用户追加诉求：帮我补发优惠券，我还要投诉活动规则不清楚。` })).resolves.toMatchObject({
      reply,
      handling_category: "low_risk_other",
      recommended_action: "assign_tier1",
    });
  });

  it("returns a safe diagnostic for an API failure", async () => {
    const response = new Response(JSON.stringify({ status: "failed", error: { code: "insufficient_balance", message: "private detail" } }), { status: 402 });
    const fetcher = vi.fn().mockResolvedValue(response);
    const provider = new DeepSeekAiProvider({ apiKey: "test-only-key", fetcher });

    await expect(provider.analyze(caseOneInput)).rejects.toMatchObject({
      code: "request_failed",
      message: expect.stringContaining("insufficient_balance"),
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("rejects an empty successful response", async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ status: "completed", output: [] }), { status: 200 })));
    const provider = new DeepSeekAiProvider({ apiKey: "test-only-key", fetcher });

    await expect(provider.analyze(caseOneInput)).rejects.toMatchObject({ code: "empty_response" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("retries one rejected candidate and accepts a safe replacement", async () => {
    const unsafe = deepSeekResponse(structuredResult({ reply: "已为您取消自动续订。" }));
    const safe = deepSeekResponse(structuredResult({ reply: "查询结果显示自动续订状态为已取消。" }));
    const fetcher = vi.fn().mockResolvedValueOnce(unsafe).mockResolvedValueOnce(safe);
    const provider = new DeepSeekAiProvider({ apiKey: "test-only-key", fetcher });

    await expect(provider.analyze(caseOneInput)).resolves.toMatchObject({ reply: "查询结果显示自动续订状态为已取消。" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("requires a server-side API key", () => {
    expect(() => new DeepSeekAiProvider()).toThrowError(AiProviderError);
  });
});
