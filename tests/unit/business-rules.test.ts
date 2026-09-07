import { describe, expect, it } from "vitest";
import { applyBusinessRules } from "@/domain/classification/apply-business-rules";
import { mockAiProvider } from "@/ai/mock-ai-provider";
import { caseOneInput } from "@/data/demos/case-one";

describe("AI business rules", () => {
  it("treats an explicit unsubscribe request as low-risk human work", async () => {
    const base = await mockAiProvider.analyze(caseOneInput);
    const result = applyBusinessRules(base, { ...caseOneInput, message: "请帮我退订连续包月。" });

    expect(result.handling_category).toBe("low_risk_other");
    expect(result.subtypes).toContain("unsubscribe");
    expect(result.recommended_action).toBe("assign_tier1");
  });

  it("does not mistake a historical cancellation statement for a new operation request", async () => {
    const base = await mockAiProvider.analyze(caseOneInput);
    const result = applyBusinessRules(base, caseOneInput);

    expect(result.handling_category).toBe("low_risk_info");
    expect(result.subtypes).not.toContain("unsubscribe");
    expect(result.recommended_action).toBe("reply");
  });

  it("blocks direct replies when identity verification is missing", async () => {
    const base = await mockAiProvider.analyze(caseOneInput);
    const result = applyBusinessRules(base, { ...caseOneInput, identity_status: "unverified" });

    expect(result.evidence_status).toBe("insufficient");
    expect(result.recommended_action).toBe("assign_tier1");
  });

  it.each([
    "优惠券未到账，请转一线客服核验。",
    "优惠券没有到账，当前仍待处理。",
    "目前尚未补发优惠券，结果以人工审核为准。",
    "补发尚未完成，请等待人工审核。",
    "已收到您关于优惠券未到账的反馈，补发诉求已记录。",
  ])("allows a negated or intake status instead of treating it as completed: %s", async (reply) => {
    const base = await mockAiProvider.analyze(caseOneInput);
    expect(() => applyBusinessRules({ ...base, reply }, caseOneInput)).not.toThrow();
  });

  it.each([
    "已为您补发优惠券，请查收。",
    "优惠券已经到账。",
    "优惠券补发成功。",
    "本次退款已到账。",
    "已替您取消自动续订。",
  ])("still rejects an unconfirmed completion claim: %s", async (reply) => {
    const base = await mockAiProvider.analyze(caseOneInput);
    expect(() => applyBusinessRules({ ...base, reply }, caseOneInput)).toThrow(/未经人工确认/);
  });
});
