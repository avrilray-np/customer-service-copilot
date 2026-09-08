"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import type { AiAnalysisCandidate, AiMode } from "@/ai/types";
import type { Ticket } from "@/domain/ticket/types";
import { transitionTicket } from "@/domain/workflow/ticket-state-machine";
import { caseTwoEscalatedCandidate, caseTwoFollowUp } from "@/data/demos/case-two";
import { isAiCandidate } from "@/validation/ai-candidate-validator";

export type DemoCase = "case-one" | "case-two" | "case-three";
type SessionAction =
  | { type: "ai_completed" } | { type: "confirm_resolved" } | { type: "request_human" }
  | { type: "follow_up_started" } | { type: "follow_up_failed"; error: string }
  | { type: "add_case_two_request"; candidate: AiAnalysisCandidate; source: AiMode }
  | { type: "complete_reissue" } | { type: "notify_department" } | { type: "close_tier1" }
  | { type: "complete_refund" } | { type: "register_report" } | { type: "transfer_department" } | { type: "close_tier2" }
  | { type: "open_ticket" } | { type: "back_to_list" } | { type: "reset" };

export type ServiceView = "live" | "list" | "detail";
export interface DemoTimelineEvent { id: string; label: string; actor: string; occurredAt: string; }
interface SessionState {
  ticket: Ticket; runId: number; serviceView: ServiceView; timeline: DemoTimelineEvent[]; hasFollowUp: boolean;
  followUpSubmitted: boolean; followUpAnalyzing: boolean; followUpError: string | null; followUpNotice: string | null;
}
interface SessionContextValue extends Omit<SessionState, "runId"> {
  initialTicket: Ticket; demoCase: DemoCase;
  confirmResolved: () => void; requestHuman: () => void; addCaseTwoRequest: () => Promise<void>; continueFollowUpWithMock: () => Promise<void>;
  completeReissue: () => void; notifyDepartment: () => void; closeTier1: () => void;
  completeRefund: () => void; registerReport: () => void; transferDepartment: () => void; closeTier2: () => void;
  openTicket: () => void; backToList: () => void; reset: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);
function initialTimeline(demoCase: DemoCase): DemoTimelineEvent[] {
  const base = demoCase === "case-one" ? "2026-09-01T09:30:00+08:00" : demoCase === "case-two" ? "2026-09-01T10:15:00+08:00" : "2026-09-01T11:20:00+08:00";
  return [
    { id: "call-received", label: "接收用户来电", actor: "用户", occurredAt: base },
    { id: "transcribed", label: "录音转写完成", actor: "语音转写服务", occurredAt: base },
    { id: "ai-accepted", label: "AI客服受理", actor: "AI客服", occurredAt: base },
  ];
}
function now() { return new Date().toISOString(); }
function createProcessingTicket(ticket: Ticket): Ticket {
  return { ...ticket, workflow: { ...ticket.workflow, ticket_status: "ai_processing", current_owner: "ai", user_resolution_confirmation: "pending" }, resolution: { action_result: null, summary: null, closed_by: null, closed_at: null } };
}

export function DemoSessionProvider({ initialTicket, demoCase, aiMode = "mock", processingDelayMs = 900, processingPaused = false, children }: { initialTicket: Ticket; demoCase: DemoCase; aiMode?: AiMode; processingDelayMs?: number; processingPaused?: boolean; children: ReactNode }) {
  const [state, dispatch] = useReducer((current: SessionState, action: SessionAction): SessionState => {
    if (action.type === "reset") return { ticket: createProcessingTicket(initialTicket), runId: current.runId + 1, serviceView: "live", timeline: initialTimeline(demoCase), hasFollowUp: false, followUpSubmitted: false, followUpAnalyzing: false, followUpError: null, followUpNotice: null };
    if (action.type === "ai_completed") {
      if (current.ticket.workflow.ticket_status !== "ai_processing") return current;
      return { ...current, ticket: initialTicket, serviceView: demoCase === "case-three" ? "list" : "live", timeline: [...current.timeline, { id: "ai-completed", label: demoCase === "case-two" ? "AI完成活动资格查询，等待用户反馈" : demoCase === "case-three" ? "AI识别高风险诉求并直接派至二线" : "AI完成分析，等待用户确认", actor: "AI客服", occurredAt: initialTicket.updated_at ?? initialTicket.created_at }] };
    }
    if (action.type === "confirm_resolved") {
      const occurredAt = now();
      return { ...current, ticket: transitionTicket(current.ticket, { type: "USER_CONFIRMED_RESOLVED", occurredAt }), serviceView: "list", timeline: [...current.timeline, { id: "user-resolved", label: "用户确认问题已解决", actor: "用户", occurredAt }, { id: "auto-closed", label: "系统自动完结工单", actor: "工单系统", occurredAt }] };
    }
    if (action.type === "request_human") {
      const occurredAt = now();
      return { ...current, ticket: transitionTicket(current.ticket, { type: "USER_REQUESTED_HUMAN", occurredAt }), serviceView: "list", timeline: [...current.timeline, { id: "user-unresolved", label: "用户反馈问题未解决", actor: "用户", occurredAt }, { id: "tier1-assigned", label: "系统派单至一线客服", actor: "工单系统", occurredAt }] };
    }
    if (action.type === "follow_up_started") return { ...current, followUpSubmitted: true, followUpAnalyzing: true, followUpError: null, followUpNotice: null };
    if (action.type === "follow_up_failed") return { ...current, followUpAnalyzing: false, followUpError: action.error };
    if (action.type === "add_case_two_request") {
      const occurredAt = now();
      return { ...current, ticket: transitionTicket(current.ticket, { type: "USER_ADDED_REISSUE_COMPLAINT", occurredAt, message: caseTwoFollowUp, candidate: action.candidate }), serviceView: "list", hasFollowUp: true, followUpAnalyzing: false, followUpError: null, followUpNotice: action.source === "mock" && aiMode !== "mock" ? "AI分析失败后，本轮追加诉求已由你明确选择使用Mock结果继续。" : null, timeline: [...current.timeline, { id: "follow-up", label: "用户追加补发与投诉诉求", actor: "用户", occurredAt }, { id: "reclassified", label: "AI重新分类为低风险其他类", actor: "AI客服", occurredAt }, { id: "tier1-benefit-assigned", label: "系统派单至一线客服", actor: "工单系统", occurredAt }] };
    }
    if (action.type === "complete_reissue") {
      const occurredAt = now();
      return { ...current, ticket: transitionTicket(current.ticket, { type: "TIER1_REISSUE_COMPLETED", occurredAt }), timeline: [...current.timeline, { id: "reissue-completed", label: "人工审核并模拟补发优惠券", actor: "一线客服 · agent-demo-01", occurredAt }] };
    }
    if (action.type === "notify_department") {
      const occurredAt = now();
      return { ...current, ticket: transitionTicket(current.ticket, { type: "TIER1_DEPARTMENT_NOTIFIED", occurredAt }), timeline: [...current.timeline, { id: "department-notified", label: "投诉已通知活动策划部", actor: "一线客服 · agent-demo-01", occurredAt }] };
    }
    if (action.type === "close_tier1") {
      const occurredAt = now();
      return { ...current, ticket: transitionTicket(current.ticket, { type: "TIER1_CLOSED", occurredAt }), timeline: [...current.timeline, { id: "tier1-closed", label: "一线客服完结并归档", actor: "一线客服 · agent-demo-01", occurredAt }] };
    }
    if (action.type === "complete_refund") {
      const occurredAt = now();
      return { ...current, ticket: transitionTicket(current.ticket, { type: "TIER2_REFUND_COMPLETED", occurredAt }), timeline: [...current.timeline, { id: "refund-completed", label: "核验扣费记录并模拟退款30元", actor: "二线客服 · tier2-demo-01", occurredAt }] };
    }
    if (action.type === "register_report") {
      const occurredAt = now();
      return { ...current, ticket: transitionTicket(current.ticket, { type: "TIER2_REPORT_REGISTERED", occurredAt }), timeline: [...current.timeline, { id: "report-registered", label: "登记举报诉求", actor: "二线客服 · tier2-demo-01", occurredAt }] };
    }
    if (action.type === "transfer_department") {
      const occurredAt = now();
      return { ...current, ticket: transitionTicket(current.ticket, { type: "TIER2_TRANSFERRED_DEPARTMENT", occurredAt }), timeline: [...current.timeline, { id: "department-transferred", label: "转支付与风控部门继续核查", actor: "二线客服 · tier2-demo-01", occurredAt }] };
    }
    if (action.type === "close_tier2") {
      const occurredAt = now();
      return { ...current, ticket: transitionTicket(current.ticket, { type: "TIER2_CLOSED", occurredAt }), timeline: [...current.timeline, { id: "tier2-closed", label: "二线客服完结并归档", actor: "二线客服 · tier2-demo-01", occurredAt }] };
    }
    if (action.type === "open_ticket") return { ...current, serviceView: "detail" };
    if (action.type === "back_to_list") return { ...current, serviceView: "list" };
    return current;
  }, { ticket: createProcessingTicket(initialTicket), runId: 0, serviceView: "live", timeline: initialTimeline(demoCase), hasFollowUp: false, followUpSubmitted: false, followUpAnalyzing: false, followUpError: null, followUpNotice: null });

  useEffect(() => {
    if (processingPaused || state.ticket.workflow.ticket_status !== "ai_processing") return;
    const timer = window.setTimeout(() => dispatch({ type: "ai_completed" }), processingDelayMs);
    return () => window.clearTimeout(timer);
  }, [processingDelayMs, processingPaused, state.runId, state.ticket.workflow.ticket_status]);

  const analyzeCaseTwoFollowUp = useCallback(async (forceMock: boolean) => {
    dispatch({ type: "follow_up_started" });
    if (forceMock || aiMode === "mock") {
      dispatch({ type: "add_case_two_request", candidate: caseTwoEscalatedCandidate, source: "mock" });
      return;
    }

    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ demoCase: "case-two-follow-up" }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error("AI暂时无法分析追加诉求，请稍后重试。");
      }
      const candidate = result && typeof result === "object" && "candidate" in result ? result.candidate : null;
      if (!isAiCandidate(candidate)) throw new Error("服务端返回的AI结果不符合工单契约。");
      const source = result && typeof result === "object" && "mode" in result && (result.mode === "gemini" || result.mode === "deepseek") ? result.mode : aiMode;
      dispatch({ type: "add_case_two_request", candidate, source });
    } catch (error) {
      dispatch({ type: "follow_up_failed", error: error instanceof Error ? error.message : "AI暂时无法分析追加诉求，请稍后重试。" });
    }
  }, [aiMode]);

  const value = useMemo<SessionContextValue>(() => ({
    ticket: state.ticket, initialTicket, demoCase, serviceView: state.serviceView, timeline: state.timeline, hasFollowUp: state.hasFollowUp, followUpSubmitted: state.followUpSubmitted, followUpAnalyzing: state.followUpAnalyzing, followUpError: state.followUpError, followUpNotice: state.followUpNotice,
    confirmResolved: () => dispatch({ type: "confirm_resolved" }), requestHuman: () => dispatch({ type: "request_human" }), addCaseTwoRequest: () => analyzeCaseTwoFollowUp(false), continueFollowUpWithMock: () => analyzeCaseTwoFollowUp(true),
    completeReissue: () => dispatch({ type: "complete_reissue" }), notifyDepartment: () => dispatch({ type: "notify_department" }), closeTier1: () => dispatch({ type: "close_tier1" }),
    completeRefund: () => dispatch({ type: "complete_refund" }), registerReport: () => dispatch({ type: "register_report" }), transferDepartment: () => dispatch({ type: "transfer_department" }), closeTier2: () => dispatch({ type: "close_tier2" }),
    openTicket: () => dispatch({ type: "open_ticket" }), backToList: () => dispatch({ type: "back_to_list" }), reset: () => dispatch({ type: "reset" }),
  }), [analyzeCaseTwoFollowUp, demoCase, initialTicket, state.followUpAnalyzing, state.followUpError, state.followUpNotice, state.followUpSubmitted, state.hasFollowUp, state.serviceView, state.ticket, state.timeline]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useDemoSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useDemoSession必须在DemoSessionProvider中使用");
  return value;
}
