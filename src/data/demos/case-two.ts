import type { AiAnalysisCandidate, AiAnalysisInput } from "@/ai/types";

export const caseTwoInput: AiAnalysisInput = {
  message: "你们平台圣诞节的活动，我开通了会员，为什么50块钱的优惠券没有到账？",
  identity_status: "verified",
  user_facts: {
    membership_order: "ordinary_monthly_card",
    subscription_product_type: "ordinary_monthly_card",
    coupon_delivery_status: "not_generated",
  },
  knowledge_sources: [
    {
      document_id: "KB-BENEFIT-003",
      title: "会员活动资格与争议补偿规则",
      section: "活动资格与人工争议补偿",
      version: "2026.09",
      quote: "原活动仅面向连续包月产品；资格提示存在明确争议时，可由一线人工审核一次性非现金权益补偿。",
    },
  ],
  user_data_sources: [
    {
      source: "demo_benefit_service",
      fields: ["membership_order", "subscription_product_type", "coupon_delivery_status"],
      queried_at: "2026-09-01T10:15:08+08:00",
    },
  ],
};

export const caseTwoFollowUp = "帮我补发优惠券，我还要投诉活动规则不清楚。";

export const caseTwoEscalatedCandidate: AiAnalysisCandidate = {
  summary: "用户购买普通月卡后未收到50元活动优惠券，在获知不符合原活动资格后，明确要求补发并投诉活动资格提示不清。",
  handling_category: "low_risk_other",
  subtypes: ["reissue", "complaint"],
  risk_level: "low",
  risk_reason: "用户明确提出非现金权益补发和投诉，需要一线人工核验争议补偿条件并登记投诉；不涉及退款。",
  classification_confidence: "high",
  reply: "已记录你的补发和投诉诉求。你购买的普通月卡不符合原活动赠券资格；一线客服将核验活动资格提示和一次性争议补偿条件，补发结果以人工审核为准。",
  evidence_status: "sufficient",
  recommended_action: "assign_tier1",
  knowledge_sources: caseTwoInput.knowledge_sources,
  user_data_sources: caseTwoInput.user_data_sources,
  missing_information: ["活动页面资格提示展示情况", "一线争议补偿审核结果"],
};
