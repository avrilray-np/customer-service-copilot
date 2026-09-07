import type { AiAnalysisInput } from "@/ai/types";

export const caseOneInput: AiAnalysisInput = {
  message: "我昨天已经取消连续包月了，为什么今天还是会员？之后还会扣钱吗？",
  identity_status: "verified",
  user_facts: {
    membership_status: "active",
    auto_renewal_status: "cancelled",
    entitlement_expires_at: "2026-09-30T23:59:59+08:00",
  },
  knowledge_sources: [
    {
      document_id: "KB-MEMBER-001",
      title: "会员自动续订与退订规则",
      section: "取消续订后的权益",
      version: "2026.08",
      quote: "取消自动续订不影响当前已支付周期内的会员权益。",
    },
  ],
  user_data_sources: [
    {
      source: "demo_membership_service",
      fields: ["membership_status", "auto_renewal_status", "entitlement_expires_at"],
      queried_at: "2026-09-01T09:30:05+08:00",
    },
  ],
};
