import { describe, expect, it } from "vitest";
import { caseOneInput } from "@/data/demos/case-one";
import { caseTwoInput } from "@/data/demos/case-two";
import { caseThreeInput } from "@/data/demos/case-three";
import { isAiCandidate } from "@/validation/ai-candidate-validator";
import { createCaseThreeTicket, createWaitingTicket } from "@/domain/ticket/create-ticket";
import { isTicket } from "@/validation/ticket-validator";
import { mockCandidateFor } from "../helpers/mock-rag";

describe("MockAiProvider", () => {
  it("returns a traceable and schema-valid answer for case one", async () => {
    const candidate = (await mockCandidateFor(caseOneInput)).candidate;

    expect(isAiCandidate(candidate)).toBe(true);
    expect(candidate.handling_category).toBe("low_risk_info");
    expect(candidate.subtypes).toEqual(["membership_query", "renewal_query"]);
    expect(candidate.knowledge_sources.some((source) => source.document_id === "KB-MEMBER-001")).toBe(true);
    expect(candidate.user_data_sources[0].fields).toContain("auto_renewal_status");
    expect(isTicket(createWaitingTicket(candidate))).toBe(true);
  });

  it("keeps the first coupon question as an information query", async () => {
    const candidate = (await mockCandidateFor(caseTwoInput)).candidate;
    expect(candidate.handling_category).toBe("low_risk_info");
    expect(candidate.subtypes).toEqual(["policy_query", "operation_status_query"]);
    expect(candidate.subtypes).not.toContain("reissue");
    expect(candidate.subtypes).not.toContain("complaint");
    expect(candidate.reply).toContain("普通月卡");
    expect(candidate.reply).toContain("不符合原活动赠券资格");
  });

  it("routes refund and report directly to tier2 without promising a result", async () => {
    const candidate = (await mockCandidateFor(caseThreeInput)).candidate;
    expect(candidate.handling_category).toBe("high_risk");
    expect(candidate.subtypes).toEqual(["refund", "report"]);
    expect(candidate.risk_level).toBe("high");
    expect(candidate.evidence_status).toBe("insufficient");
    expect(candidate.recommended_action).toBe("assign_tier2");
    expect(candidate.reply).toContain("以人工核验为准");
    expect(candidate.reply).not.toContain("退款成功");
    expect(isTicket(createCaseThreeTicket(candidate))).toBe(true);
  });
});
