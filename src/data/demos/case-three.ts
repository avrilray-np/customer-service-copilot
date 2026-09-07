import type { AiAnalysisInput } from "@/ai/types";

export const caseThreeInput: AiAnalysisInput = {
  message: "我上周就取消自动续订了，今天还是扣了我30元，马上给我退款，不然我就举报。",
  identity_status: "verified",
  user_facts: {
    auto_renewal_status: "cancelled",
    cancellation_at: "2026-08-25T16:40:00+08:00",
    charged_at: "2026-09-01T08:12:00+08:00",
    charge_amount: 30,
    payment_transaction: "PAY-DEMO-9031",
  },
  knowledge_sources: [
    {
      document_id: "KB-REFUND-007",
      title: "自动续订扣费争议与退款处理规则",
      section: "取消时间、扣费时间与退款权限",
      version: "2026.09",
      quote: "涉及资金退回或举报的工单必须由二线客服核验取消时间、扣费记录和支付状态；AI不得承诺退款或判断举报成立。",
    },
  ],
  user_data_sources: [
    {
      source: "demo_payment_service",
      fields: ["auto_renewal_status", "cancellation_at", "charged_at", "charge_amount", "payment_transaction"],
      queried_at: "2026-09-01T11:20:08+08:00",
    },
  ],
};

export const caseThreeFacts = {
  cancellationAt: "2026-08-25T16:40:00+08:00",
  chargedAt: "2026-09-01T08:12:00+08:00",
  amount: "30.00元",
  transactionId: "PAY-DEMO-9031",
};
