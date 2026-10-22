import { describe, expect, it } from "vitest";
import { buildRetrievalQuery } from "@/rag/retrieval-query-builder";
import type { AiAnalysisInput } from "@/ai/types";

describe("buildRetrievalQuery", () => {
  it("uses the issue text and approved metadata without serializing user records", () => {
    const input: AiAnalysisInput = {
      message: "取消续订后为什么仍然扣费？",
      identity_status: "verified",
      user_facts: { user_uid: "DEMO-U001", payment_transaction: "PAY-DEMO-9031" },
      knowledge_sources: [],
      user_data_sources: [],
      retrieval_context: {
        query_time: "2026-10-21T10:00:00+08:00",
        audience: "ai",
        known_product_type: "continuous_monthly",
      },
    };

    const query = buildRetrievalQuery(input);
    expect(query).toEqual({
      text: input.message,
      query_time: "2026-10-21T10:00:00+08:00",
      audience: "ai",
      known_product_type: "continuous_monthly",
      language: "zh-CN",
    });
    expect(JSON.stringify(query)).not.toContain("DEMO-U001");
    expect(JSON.stringify(query)).not.toContain("PAY-DEMO-9031");
  });

  it("rejects inputs without retrieval metadata", () => {
    expect(() => buildRetrievalQuery({
      message: "测试",
      identity_status: "not_required",
      user_facts: {},
      knowledge_sources: [],
      user_data_sources: [],
    })).toThrow(/检索上下文/u);
  });

  it("prioritizes the latest explicit user turn for follow-up retrieval", () => {
    const query = buildRetrievalQuery({
      message: "优惠券为什么没有到账？\n用户追加诉求：帮我补发优惠券，我还要投诉活动规则不清楚。",
      identity_status: "verified",
      user_facts: {},
      knowledge_sources: [],
      user_data_sources: [],
      retrieval_context: {
        query_time: "2026-10-21T10:00:00+08:00",
        audience: "ai",
        known_product_type: "ordinary_monthly_card",
        query_hint: "活动资格提示 争议补偿",
      },
    });

    expect(query.text).toBe("帮我补发优惠券，我还要投诉活动规则不清楚。 活动资格提示 争议补偿");
  });
});
