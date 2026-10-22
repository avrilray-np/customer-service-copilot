import { describe, expect, it } from "vitest";
import { caseOneInput } from "@/data/demos/case-one";
import { caseTwoFollowUp } from "@/data/demos/case-two";
import { caseThreeInput } from "@/data/demos/case-three";
import { createCaseThreeTicket, createCaseTwoWaitingTicket, createWaitingTicket } from "@/domain/ticket/create-ticket";
import { transitionTicket } from "@/domain/workflow/ticket-state-machine";
import { mockCandidateFor, mockDemoData } from "../helpers/mock-rag";

async function ticketFixture() {
  return createWaitingTicket((await mockCandidateFor(caseOneInput)).candidate);
}

describe("ticket state machine", () => {
  it("closes only after the user explicitly confirms resolution", async () => {
    const ticket = await ticketFixture();
    const result = transitionTicket(ticket, { type: "USER_CONFIRMED_RESOLVED", occurredAt: "2026-09-01T09:32:00+08:00" });

    expect(result.workflow.ticket_status).toBe("closed");
    expect(result.workflow.user_resolution_confirmation).toBe("resolved");
    expect(result.resolution.closed_by).toBe("ai_confirmed");
  });

  it("keeps classification and risk unchanged when the user only requests human help", async () => {
    const ticket = await ticketFixture();
    const result = transitionTicket(ticket, { type: "USER_REQUESTED_HUMAN", occurredAt: "2026-09-01T09:32:00+08:00" });

    expect(result.workflow.ticket_status).toBe("human_processing");
    expect(result.workflow.routing_reason).toBe("用户确认AI回复未解决");
    expect(result.issue.handling_category).toBe(ticket.issue.handling_category);
    expect(result.issue.subtypes).toEqual(ticket.issue.subtypes);
    expect(result.issue.risk_level).toBe(ticket.issue.risk_level);
  });

  it("rejects auto-close when evidence is insufficient", async () => {
    const ticket = await ticketFixture();
    ticket.ai_processing.evidence_status = "insufficient";

    expect(() => transitionTicket(ticket, {
      type: "USER_CONFIRMED_RESOLVED",
      occurredAt: "2026-09-01T09:32:00+08:00",
    })).toThrow("当前工单不满足AI自动完结条件");
  });

  it("reclassifies and assigns tier1 only after an explicit reissue and complaint request", async () => {
    const data = await mockDemoData();
    const initial = createCaseTwoWaitingTicket(data.caseTwo.candidate);
    const result = transitionTicket(initial, { type: "USER_ADDED_REISSUE_COMPLAINT", occurredAt: "2026-09-01T10:16:00+08:00", message: caseTwoFollowUp, candidate: data.caseTwoFollowUp.candidate });
    expect(result.issue.handling_category).toBe("low_risk_other");
    expect(result.issue.subtypes).toEqual(["reissue", "complaint"]);
    expect(result.workflow.assigned_to).toBe("tier1-benefit-queue");
    expect(result.resolution.action_result).toBeNull();
  });

  it("requires both tier1 operations before closing case two", async () => {
    const data = await mockDemoData();
    const initial = createCaseTwoWaitingTicket(data.caseTwo.candidate);
    const routed = transitionTicket(initial, { type: "USER_ADDED_REISSUE_COMPLAINT", occurredAt: "2026-09-01T10:16:00+08:00", message: caseTwoFollowUp, candidate: data.caseTwoFollowUp.candidate });
    expect(() => transitionTicket(routed, { type: "TIER1_CLOSED", occurredAt: "2026-09-01T10:20:00+08:00" })).toThrow("完成模拟补发并通知相关部门后才能完结");
    const reissued = transitionTicket(routed, { type: "TIER1_REISSUE_COMPLETED", occurredAt: "2026-09-01T10:18:00+08:00" });
    expect(() => transitionTicket(reissued, { type: "TIER1_CLOSED", occurredAt: "2026-09-01T10:20:00+08:00" })).toThrow("完成模拟补发并通知相关部门后才能完结");
    const notified = transitionTicket(reissued, { type: "TIER1_DEPARTMENT_NOTIFIED", occurredAt: "2026-09-01T10:19:00+08:00" });
    const closed = transitionTicket(notified, { type: "TIER1_CLOSED", occurredAt: "2026-09-01T10:20:00+08:00" });
    expect(closed.workflow.ticket_status).toBe("closed");
    expect(closed.resolution.closed_by).toBe("tier1");
  });

  it("supports notifying the department before completing the simulated reissue", async () => {
    const data = await mockDemoData();
    const initial = createCaseTwoWaitingTicket(data.caseTwo.candidate);
    const routed = transitionTicket(initial, { type: "USER_ADDED_REISSUE_COMPLAINT", occurredAt: "2026-09-01T10:16:00+08:00", message: caseTwoFollowUp, candidate: data.caseTwoFollowUp.candidate });
    const notified = transitionTicket(routed, { type: "TIER1_DEPARTMENT_NOTIFIED", occurredAt: "2026-09-01T10:18:00+08:00" });
    const reissued = transitionTicket(notified, { type: "TIER1_REISSUE_COMPLETED", occurredAt: "2026-09-01T10:19:00+08:00" });
    const closed = transitionTicket(reissued, { type: "TIER1_CLOSED", occurredAt: "2026-09-01T10:20:00+08:00" });
    expect(closed.workflow.ticket_status).toBe("closed");
    expect(closed.workflow.department_notification_status).toBe("sent");
  });

  it("requires both tier2 refund and report records before closure", async () => {
    const ticket = createCaseThreeTicket((await mockCandidateFor(caseThreeInput)).candidate);
    expect(() => transitionTicket(ticket, { type: "TIER2_CLOSED", occurredAt: "2026-09-01T11:30:00+08:00" })).toThrow("完成退款核验和举报登记后才能完结");
    const refunded = transitionTicket(ticket, { type: "TIER2_REFUND_COMPLETED", occurredAt: "2026-09-01T11:25:00+08:00" });
    expect(() => transitionTicket(refunded, { type: "TIER2_CLOSED", occurredAt: "2026-09-01T11:30:00+08:00" })).toThrow("完成退款核验和举报登记后才能完结");
    const reported = transitionTicket(refunded, { type: "TIER2_REPORT_REGISTERED", occurredAt: "2026-09-01T11:26:00+08:00" });
    const closed = transitionTicket(reported, { type: "TIER2_CLOSED", occurredAt: "2026-09-01T11:30:00+08:00" });
    expect(closed.workflow.ticket_status).toBe("closed");
    expect(closed.resolution.closed_by).toBe("tier2");
  });

  it("moves unresolved payment checks to department processing and blocks tier2 closure", async () => {
    const ticket = createCaseThreeTicket((await mockCandidateFor(caseThreeInput)).candidate);
    const transferred = transitionTicket(ticket, { type: "TIER2_TRANSFERRED_DEPARTMENT", occurredAt: "2026-09-01T11:25:00+08:00" });
    expect(transferred.workflow.ticket_status).toBe("department_processing");
    expect(transferred.workflow.current_owner).toBe("department");
    expect(transferred.workflow.assigned_to).toBe("payment-risk-joint-queue");
    expect(() => transitionTicket(transferred, { type: "TIER2_CLOSED", occurredAt: "2026-09-01T11:30:00+08:00" })).toThrow("当前工单不能由二线完结");
  });
});
