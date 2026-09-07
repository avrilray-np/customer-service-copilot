import { describe, expect, it, vi } from "vitest";
import { GeminiAiProvider } from "@/ai/gemini-ai-provider";
import { caseOneInput } from "@/data/demos/case-one";
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

describe("GeminiAiProvider", () => {
  it("uses structured output and restores only trusted source objects", async () => {
    const create = vi.fn().mockResolvedValue({ output_text: JSON.stringify(structuredResult()) });
    const provider = new GeminiAiProvider({ model: "test-model", client: { interactions: { create } } });

    const candidate = await provider.analyze(caseOneInput);

    expect(candidate.knowledge_sources).toEqual(caseOneInput.knowledge_sources);
    expect(candidate.user_data_sources).toEqual(caseOneInput.user_data_sources);
    expect(candidate.recommended_action).toBe("reply");
    const request = create.mock.calls[0][0];
    expect(request.model).toBe("test-model");
    expect(request.store).toBe(false);
    expect(request.generation_config).toEqual({ thinking_level: "low", max_output_tokens: 2000 });
    expect(create.mock.calls[0][1]).toEqual({ timeout: 15_000, maxRetries: 1 });
    expect(request.response_format.schema).not.toHaveProperty("properties.summary.minLength");
    expect(request.response_format.schema).not.toHaveProperty("properties.subtypes.uniqueItems");
    expect(request.input).toContain('"auto_renewal_status":"cancelled"');
  });

  it("rejects a source id that was not supplied by the application", async () => {
    const output = structuredResult({ knowledge_source_ids: ["KB-FABRICATED-999"] });
    const provider = new GeminiAiProvider({ client: { interactions: { create: vi.fn().mockResolvedValue({ output_text: JSON.stringify(output) }) } } });

    await expect(provider.analyze(caseOneInput)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("forces refund and report requests onto tier2 while preserving the evidence status", async () => {
    const unsafeClassification = structuredResult({
      summary: "用户咨询扣费。",
      subtypes: ["renewal_query"],
      knowledge_source_ids: ["KB-REFUND-007"],
      user_data_source_names: ["demo_payment_service"],
    });
    const provider = new GeminiAiProvider({ client: { interactions: { create: vi.fn().mockResolvedValue({ output_text: JSON.stringify(unsafeClassification) }) } } });

    const candidate = await provider.analyze(caseThreeInput);

    expect(candidate.handling_category).toBe("high_risk");
    expect(candidate.risk_level).toBe("high");
    expect(candidate.subtypes).toEqual(expect.arrayContaining(["refund", "report"]));
    expect(candidate.recommended_action).toBe("assign_tier2");
    expect(candidate.evidence_status).toBe("sufficient");
  });

  it("rejects claims that a protected operation already succeeded", async () => {
    const output = structuredResult({ reply: "已退款成功，请查收。" });
    const provider = new GeminiAiProvider({ client: { interactions: { create: vi.fn().mockResolvedValue({ output_text: JSON.stringify(output) }) } } });

    await expect(provider.analyze(caseOneInput)).rejects.toMatchObject({
      code: "policy_violation",
    });
  });

  it.each([
    "已为您补发优惠券，请稍后查收。",
    "本次退款已到账，请查看支付账户。",
    "已替您取消自动续订，下月生效。",
  ])("rejects protected-operation completion variant: %s", async (reply) => {
    const output = structuredResult({ reply });
    const provider = new GeminiAiProvider({ client: { interactions: { create: vi.fn().mockResolvedValue({ output_text: JSON.stringify(output) }) } } });

    await expect(provider.analyze(caseOneInput)).rejects.toMatchObject({ code: "policy_violation" });
  });

  it.each([
    "已记录你的退款诉求，处理结果以人工核验为准。",
    "查询结果显示自动续订已取消，当前权益仍有效。",
  ])("allows a traceable status or intake statement: %s", async (reply) => {
    const output = structuredResult({ reply });
    const provider = new GeminiAiProvider({ client: { interactions: { create: vi.fn().mockResolvedValue({ output_text: JSON.stringify(output) }) } } });

    await expect(provider.analyze(caseOneInput)).resolves.toMatchObject({ reply });
  });

  it("returns a diagnostic error when the SDK response is empty", async () => {
    const provider = new GeminiAiProvider({ client: { interactions: { create: vi.fn().mockResolvedValue({}) } } });
    await expect(provider.analyze(caseOneInput)).rejects.toMatchObject({ code: "empty_response" });
  });
});
