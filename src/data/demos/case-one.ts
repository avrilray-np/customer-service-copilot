import type { AiAnalysisInput } from "@/ai/types";

export const caseOneInput: AiAnalysisInput = {
  message: "我昨天已经取消连续包月了，为什么今天还是会员？之后还会扣钱吗？",
  identity_status: "verified",
  user_facts: {
    membership_status: "active",
    auto_renewal_status: "cancelled",
    entitlement_expires_at: "2026-09-30T23:59:59+08:00",
  },
  knowledge_sources: [],
  user_data_sources: [
    {
      source: "demo_membership_service",
      fields: ["membership_status", "auto_renewal_status", "entitlement_expires_at"],
      queried_at: "2026-09-01T09:30:05+08:00",
    },
  ],
  retrieval_context: {
    query_time: "2026-10-21T09:30:05+08:00",
    audience: "ai",
    known_product_type: "continuous_monthly",
  },
};
