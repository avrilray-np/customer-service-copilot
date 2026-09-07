import type { AiProvider } from "./ai-provider";
import type { AiAnalysisCandidate, AiAnalysisInput } from "./types";

class MockAiProvider implements AiProvider {
  async analyze(input: AiAnalysisInput): Promise<AiAnalysisCandidate> {
    const hasRequiredEvidence =
      input.identity_status === "verified" &&
      input.knowledge_sources.length > 0 &&
      input.user_data_sources.length > 0;

    if (!hasRequiredEvidence) {
      return {
        summary: "用户咨询会员与自动续订状态，但当前证据不足。",
        handling_category: "low_risk_info",
        subtypes: ["membership_query", "renewal_query"],
        risk_level: "low",
        risk_reason: "问题本身属于状态查询，但缺少完成回复所需的身份或来源数据。",
        classification_confidence: "high",
        reply: "当前信息不足，我已为你转人工客服继续核验。",
        evidence_status: "insufficient",
        recommended_action: "assign_tier1",
        knowledge_sources: input.knowledge_sources,
        user_data_sources: input.user_data_sources,
        missing_information: ["已验证身份", "会员与自动续订记录"],
      };
    }

    if (input.message.includes("圣诞节") && input.message.includes("优惠券")) {
      return {
        summary: "用户购买会员后未收到圣诞活动50元优惠券，咨询未到账原因。",
        handling_category: "low_risk_info",
        subtypes: ["policy_query", "operation_status_query"],
        risk_level: "low",
        risk_reason: "当前仅查询活动资格与优惠券发放状态，尚未提出补发、投诉或退款诉求。",
        classification_confidence: "high",
        reply: "已为你查询：本次活动赠券仅面向连续包月产品。你购买的是普通月卡，因此不符合原活动赠券资格，系统没有生成50元优惠券。",
        evidence_status: "sufficient",
        recommended_action: "reply",
        knowledge_sources: input.knowledge_sources,
        user_data_sources: input.user_data_sources,
        missing_information: [],
      };
    }

    if (input.message.includes("扣了我30元") && input.message.includes("举报")) {
      return {
        summary: "用户称已取消自动续订但仍被扣费30元，明确要求退款并表示将举报平台。",
        handling_category: "high_risk",
        subtypes: ["refund", "report"],
        risk_level: "high",
        risk_reason: "诉求涉及资金退回并同时出现举报，需要具备退款权限的二线客服核验，AI不得承诺退款或判断举报成立。",
        classification_confidence: "high",
        reply: "已记录你的退款和举报诉求，工单已转交二线客服核查。退款结果及举报处理结论以人工核验为准。",
        evidence_status: "insufficient",
        recommended_action: "assign_tier2",
        knowledge_sources: input.knowledge_sources,
        user_data_sources: input.user_data_sources,
        missing_information: ["取消续订是否在本次扣费周期生效", "支付渠道退款状态", "举报事项核查结论"],
      };
    }

    return {
      summary: "用户已取消自动续订，咨询当前会员仍有效的原因及后续是否扣费。",
      handling_category: "low_risk_info",
      subtypes: ["membership_query", "renewal_query"],
      risk_level: "low",
      risk_reason: "仅查询会员权益和自动续订状态，不涉及修改权益或资金操作。",
      classification_confidence: "high",
      reply:
        "已为你查询：自动续订已取消，当前会员权益仍有效至2026年9月30日23:59。取消自动续订不会提前终止已支付周期内的权益；按照当前状态，下一周期不会自动续费。",
      evidence_status: "sufficient",
      recommended_action: "reply",
      knowledge_sources: input.knowledge_sources,
      user_data_sources: input.user_data_sources,
      missing_information: [],
    };
  }
}

export const mockAiProvider = new MockAiProvider();
