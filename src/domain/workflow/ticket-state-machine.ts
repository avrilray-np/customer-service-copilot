import type { Ticket } from "@/domain/ticket/types";
import type { AiAnalysisCandidate } from "@/ai/types";

export type TicketEvent =
  | { type: "USER_CONFIRMED_RESOLVED"; occurredAt: string }
  | { type: "USER_REQUESTED_HUMAN"; occurredAt: string }
  | { type: "USER_ADDED_REISSUE_COMPLAINT"; occurredAt: string; message: string; candidate: AiAnalysisCandidate }
  | { type: "TIER1_REISSUE_COMPLETED"; occurredAt: string }
  | { type: "TIER1_DEPARTMENT_NOTIFIED"; occurredAt: string }
  | { type: "TIER1_CLOSED"; occurredAt: string }
  | { type: "TIER2_REFUND_COMPLETED"; occurredAt: string }
  | { type: "TIER2_REPORT_REGISTERED"; occurredAt: string }
  | { type: "TIER2_TRANSFERRED_DEPARTMENT"; occurredAt: string }
  | { type: "TIER2_CLOSED"; occurredAt: string };

export function canAutoClose(ticket: Ticket): boolean {
  return (
    ticket.workflow.ticket_status === "waiting_user_confirmation" &&
    ticket.issue.handling_category === "low_risk_info" &&
    ticket.issue.classification_confidence === "high" &&
    ticket.ai_processing.evidence_status === "sufficient" &&
    ticket.ai_processing.recommended_action === "reply"
  );
}

export function transitionTicket(ticket: Ticket, event: TicketEvent): Ticket {
  if (event.type === "USER_CONFIRMED_RESOLVED") {
    if (!canAutoClose(ticket)) {
      throw new Error("当前工单不满足AI自动完结条件");
    }

    return {
      ...ticket,
      updated_at: event.occurredAt,
      workflow: {
        ...ticket.workflow,
        ticket_status: "closed",
        current_owner: "none",
        user_resolution_confirmation: "resolved",
      },
      resolution: {
        action_result: "用户确认已理解会员与自动续订状态。",
        summary: "AI结合会员规则和实时用户状态完成答复，用户确认问题已解决，工单自动完结。",
        closed_by: "ai_confirmed",
        closed_at: event.occurredAt,
      },
    };
  }

  if (event.type === "USER_ADDED_REISSUE_COMPLAINT") {
    const candidate = event.candidate;
    if (ticket.workflow.ticket_status !== "waiting_user_confirmation") throw new Error("只有等待用户确认的工单可以追加诉求");
    if (candidate.handling_category !== "low_risk_other" || candidate.risk_level !== "low" || candidate.recommended_action !== "assign_tier1" || !candidate.subtypes.includes("reissue") || !candidate.subtypes.includes("complaint")) {
      throw new Error("追加诉求不满足一线派单规则");
    }
    return {
      ...ticket,
      updated_at: event.occurredAt,
      issue: {
        original_message: `${ticket.issue.original_message}\n用户追加：${event.message}`,
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
        ticket_status: "human_processing",
        current_owner: "tier1",
        assigned_to: "tier1-benefit-queue",
        routing_reason: "用户明确要求补发优惠券并投诉活动规则不清",
        user_resolution_confirmation: "unresolved",
        related_department: "活动策划部",
        department_notification_status: "pending",
      },
      resolution: { action_result: null, summary: null, closed_by: null, closed_at: null },
    };
  }

  if (event.type === "TIER1_REISSUE_COMPLETED") {
    if (!(["human_processing", "department_notified"] as string[]).includes(ticket.workflow.ticket_status) || !ticket.issue.subtypes.includes("reissue")) throw new Error("当前工单不能执行模拟补发");
    return {
      ...ticket,
      updated_at: event.occurredAt,
      resolution: { ...ticket.resolution, action_result: "一线客服确认用户不符合原活动资格，但符合活动信息争议补偿条件；一次性模拟补发50元非现金优惠券成功。" },
      audit: { ...ticket.audit, human_edit_record: "一线客服 agent-demo-01 完成争议补偿核验并模拟补发。" },
    };
  }

  if (event.type === "TIER1_DEPARTMENT_NOTIFIED") {
    if (!(["human_processing", "department_notified"] as string[]).includes(ticket.workflow.ticket_status) || !ticket.issue.subtypes.includes("complaint")) throw new Error("当前工单不能通知相关部门");
    return {
      ...ticket,
      updated_at: event.occurredAt,
      workflow: { ...ticket.workflow, ticket_status: "department_notified", current_owner: "tier1", department_notification_status: "sent" },
      audit: { ...ticket.audit, human_edit_record: `${ticket.audit.human_edit_record ? `${ticket.audit.human_edit_record} ` : ""}一线客服 agent-demo-01 已通知活动策划部。` },
    };
  }

  if (event.type === "TIER1_CLOSED") {
    if (!ticket.resolution.action_result || ticket.workflow.department_notification_status !== "sent") throw new Error("完成模拟补发并通知相关部门后才能完结");
    if (!(["human_processing", "department_notified"] as string[]).includes(ticket.workflow.ticket_status)) throw new Error("当前工单不能由一线完结");
    return {
      ...ticket,
      updated_at: event.occurredAt,
      workflow: { ...ticket.workflow, ticket_status: "closed", current_owner: "none" },
      resolution: { ...ticket.resolution, summary: "一线客服完成人工争议补偿审核与模拟补发，并将活动规则投诉通知活动策划部，工单归档。", closed_by: "tier1", closed_at: event.occurredAt },
    };
  }

  if (event.type === "TIER2_REFUND_COMPLETED") {
    if (ticket.workflow.ticket_status !== "tier2_processing" || !ticket.issue.subtypes.includes("refund")) throw new Error("当前工单不能执行模拟退款");
    const result = ticket.resolution.action_result ? `${ticket.resolution.action_result}；模拟退款30元成功` : "模拟退款30元成功";
    return {
      ...ticket,
      updated_at: event.occurredAt,
      resolution: { ...ticket.resolution, action_result: result },
      audit: { ...ticket.audit, human_edit_record: `${ticket.audit.human_edit_record ? `${ticket.audit.human_edit_record} ` : ""}二线客服 tier2-demo-01 核验扣费记录并模拟退款30元。` },
    };
  }

  if (event.type === "TIER2_REPORT_REGISTERED") {
    if (ticket.workflow.ticket_status !== "tier2_processing" || !ticket.issue.subtypes.includes("report")) throw new Error("当前工单不能登记举报");
    const result = ticket.resolution.action_result ? `${ticket.resolution.action_result}；举报诉求已登记` : "举报诉求已登记";
    return {
      ...ticket,
      updated_at: event.occurredAt,
      resolution: { ...ticket.resolution, action_result: result },
      audit: { ...ticket.audit, human_edit_record: `${ticket.audit.human_edit_record ? `${ticket.audit.human_edit_record} ` : ""}二线客服 tier2-demo-01 已登记举报诉求，未判断举报成立。` },
    };
  }

  if (event.type === "TIER2_TRANSFERRED_DEPARTMENT") {
    if (ticket.workflow.ticket_status !== "tier2_processing") throw new Error("当前工单不能转支付或风控部门");
    return {
      ...ticket,
      updated_at: event.occurredAt,
      workflow: {
        ...ticket.workflow,
        ticket_status: "department_processing",
        current_owner: "department",
        assigned_to: "payment-risk-joint-queue",
        routing_reason: "二线无法确认扣费或退款状态，转支付与风控部门继续核查",
        related_department: "支付与风控部门",
        department_notification_status: "sent",
      },
      audit: { ...ticket.audit, human_edit_record: `${ticket.audit.human_edit_record ? `${ticket.audit.human_edit_record} ` : ""}二线客服 tier2-demo-01 已转支付与风控部门。` },
    };
  }

  if (event.type === "TIER2_CLOSED") {
    const result = ticket.resolution.action_result ?? "";
    if (ticket.workflow.ticket_status !== "tier2_processing") throw new Error("当前工单不能由二线完结");
    if (!result.includes("模拟退款30元成功") || !result.includes("举报诉求已登记")) throw new Error("完成退款核验和举报登记后才能完结");
    return {
      ...ticket,
      updated_at: event.occurredAt,
      workflow: { ...ticket.workflow, ticket_status: "closed", current_owner: "none" },
      resolution: { ...ticket.resolution, summary: "二线客服核验取消与扣费记录后完成30元模拟退款，并登记举报诉求，工单完结归档。", closed_by: "tier2", closed_at: event.occurredAt },
    };
  }

  if (ticket.workflow.ticket_status !== "waiting_user_confirmation") {
    throw new Error("只有等待用户确认的工单可以转人工");
  }

  return {
    ...ticket,
    updated_at: event.occurredAt,
    workflow: {
      ...ticket.workflow,
      ticket_status: "human_processing",
      current_owner: "tier1",
      assigned_to: "tier1-general-queue",
      routing_reason: "用户确认AI回复未解决",
      user_resolution_confirmation: "unresolved",
    },
  };
}
