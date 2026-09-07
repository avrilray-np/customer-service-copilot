import type { AiAnalysisCandidate } from "@/ai/types";
import type { Ticket } from "./types";

interface TicketCreationOptions {
  promptVersion?: string;
}

export function createWaitingTicket(candidate: AiAnalysisCandidate, options: TicketCreationOptions = {}): Ticket {
  return {
    schema_version: "0.1",
    ticket_id: "TK-20260901-001",
    created_at: "2026-09-01T09:30:00+08:00",
    updated_at: "2026-09-01T09:30:08+08:00",
    channel: "voice_transcript",
    customer: {
      user_uid: "DEMO-U001",
      identity_status: "verified",
      membership_status: "active",
      auto_renewal_status: "cancelled",
      entitlement_expires_at: "2026-09-30T23:59:59+08:00",
    },
    issue: {
      original_message: "我昨天已经取消连续包月了，为什么今天还是会员？之后还会扣钱吗？",
      summary: candidate.summary,
      handling_category: candidate.handling_category,
      subtypes: candidate.subtypes,
      risk_level: candidate.risk_level,
      risk_reason: candidate.risk_reason,
      classification_confidence: candidate.classification_confidence,
    },
    ai_processing: {
      reply: candidate.reply,
      evidence_status: candidate.evidence_status,
      recommended_action: candidate.recommended_action,
      knowledge_sources: candidate.knowledge_sources,
      user_data_sources: candidate.user_data_sources,
      missing_information: candidate.missing_information,
    },
    workflow: {
      ticket_status: "waiting_user_confirmation",
      current_owner: "ai",
      assigned_to: null,
      routing_reason: null,
      user_resolution_confirmation: "pending",
      related_department: null,
      department_notification_status: "not_required",
    },
    resolution: {
      action_result: null,
      summary: null,
      closed_by: null,
      closed_at: null,
    },
    audit: {
      prompt_version: options.promptVersion ?? "customer-service-v1.0",
      knowledge_base_version: "kb-2026.08",
      human_edit_record: null,
    },
  };
}

export function createCaseTwoWaitingTicket(candidate: AiAnalysisCandidate, options: TicketCreationOptions = {}): Ticket {
  return {
    schema_version: "0.1",
    ticket_id: "TK-20260901-002",
    created_at: "2026-09-01T10:15:00+08:00",
    updated_at: "2026-09-01T10:15:08+08:00",
    channel: "voice_transcript",
    customer: {
      user_uid: "DEMO-U002",
      identity_status: "verified",
      membership_status: "active",
      auto_renewal_status: "active",
      entitlement_expires_at: "2026-09-15T23:59:59+08:00",
    },
    issue: {
      original_message: "你们平台圣诞节的活动，我开通了会员，为什么50块钱的优惠券没有到账？",
      summary: candidate.summary,
      handling_category: candidate.handling_category,
      subtypes: candidate.subtypes,
      risk_level: candidate.risk_level,
      risk_reason: candidate.risk_reason,
      classification_confidence: candidate.classification_confidence,
    },
    ai_processing: {
      reply: candidate.reply,
      evidence_status: candidate.evidence_status,
      recommended_action: candidate.recommended_action,
      knowledge_sources: candidate.knowledge_sources,
      user_data_sources: candidate.user_data_sources,
      missing_information: candidate.missing_information,
    },
    workflow: {
      ticket_status: "waiting_user_confirmation",
      current_owner: "ai",
      assigned_to: null,
      routing_reason: null,
      user_resolution_confirmation: "pending",
      related_department: null,
      department_notification_status: "not_required",
    },
    resolution: { action_result: null, summary: null, closed_by: null, closed_at: null },
    audit: { prompt_version: options.promptVersion ?? "customer-service-v1.0", knowledge_base_version: "kb-2026.09", human_edit_record: null },
  };
}

export function createCaseThreeTicket(candidate: AiAnalysisCandidate, options: TicketCreationOptions = {}): Ticket {
  return {
    schema_version: "0.1",
    ticket_id: "TK-20260901-003",
    created_at: "2026-09-01T11:20:00+08:00",
    updated_at: "2026-09-01T11:20:08+08:00",
    channel: "voice_transcript",
    customer: {
      user_uid: "DEMO-U003",
      identity_status: "verified",
      membership_status: "active",
      auto_renewal_status: "cancelled",
      entitlement_expires_at: "2026-09-30T23:59:59+08:00",
    },
    issue: {
      original_message: "我上周就取消自动续订了，今天还是扣了我30元，马上给我退款，不然我就举报。",
      summary: candidate.summary,
      handling_category: candidate.handling_category,
      subtypes: candidate.subtypes,
      risk_level: candidate.risk_level,
      risk_reason: candidate.risk_reason,
      classification_confidence: candidate.classification_confidence,
    },
    ai_processing: {
      reply: candidate.reply,
      evidence_status: candidate.evidence_status,
      recommended_action: candidate.recommended_action,
      knowledge_sources: candidate.knowledge_sources,
      user_data_sources: candidate.user_data_sources,
      missing_information: candidate.missing_information,
    },
    workflow: {
      ticket_status: "tier2_processing",
      current_owner: "tier2",
      assigned_to: "tier2-refund-risk-queue",
      routing_reason: "涉及资金退款并同时出现举报诉求，按最高风险路径直接派二线",
      user_resolution_confirmation: "pending",
      related_department: null,
      department_notification_status: "not_required",
    },
    resolution: { action_result: null, summary: null, closed_by: null, closed_at: null },
    audit: { prompt_version: options.promptVersion ?? "customer-service-v1.0", knowledge_base_version: "kb-2026.09", human_edit_record: null },
  };
}
