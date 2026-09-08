import { expect, test } from "@playwright/test";

test("case one closes only after explicit user confirmation", async ({ page }) => {
  let analysisCalls = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/ai/analyze")) analysisCalls += 1;
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Mock Mode" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "AI Mode" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("group", { name: "AI运行模式" }).getByRole("button")).toHaveCount(2);
  await expect(page.getByText(/DeepSeek|Gemini|deepseek-v4-flash/)).toHaveCount(0);
  expect(analysisCalls).toBe(0);
  await expect(page.getByLabel("用户端")).toBeVisible();
  await expect(page.getByLabel("客服系统")).toBeVisible();
  await expect(page.getByLabel("问题输入框")).toBeVisible();
  await expect(page.getByTestId("ticket-status")).toContainText("AI处理中");
  await expect(page.getByRole("button", { name: "查看回答依据" })).toBeVisible();
  await expect(page.getByTestId("ticket-status")).toContainText("等待用户确认");
  await page.getByRole("button", { name: "查看回答依据" }).click();
  await expect(page.getByLabel("用户端").getByText("会员自动续订与退订规则", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "已解决" }).click();
  await expect(page.getByLabel("工单列表页")).toBeVisible();
  await expect(page.getByTestId("ticket-status")).toContainText("已完结");
  await expect(page.getByText("问题已解决")).toBeVisible();
  await page.getByRole("button", { name: "查看工单详情" }).click();
  await expect(page.getByLabel("工单详情页")).toBeVisible();
  await expect(page.getByLabel("AI生成的用户诉求摘要")).toContainText("用户已取消自动续订");
  await expect(page.getByTestId("customer-uid")).toHaveText("DEMO-U001");
  const detailText = await page.getByLabel("工单详情页").innerText();
  expect(detailText.indexOf("AI生成的用户诉求摘要")).toBeLessThan(detailText.indexOf("AI处理信息"));
  expect(detailText.indexOf("AI处理信息")).toBeLessThan(detailText.indexOf("用户基本信息"));
  expect(detailText.indexOf("处理结果与审计")).toBeLessThan(detailText.indexOf("流转信息"));
  await expect(page.getByLabel("原始录音与转写")).toBeVisible();
  await page.getByRole("button", { name: "播放模拟录音" }).click();
  await expect(page.getByRole("button", { name: "暂停模拟录音" })).toBeVisible();
  await expect(page.getByLabel("工单流转轨迹")).toContainText("系统自动完结工单");
  await expect(page.getByText(/用户明确确认已解决/)).toBeVisible();
  await page.getByRole("button", { name: /返回工单列表/ }).click();
  await expect(page.getByLabel("工单列表页")).toBeVisible();
});

test("T031 keeps the original classification when only unresolved is clicked", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "未解决，转人工" }).click();
  await expect(page.getByLabel("工单列表页")).toBeVisible();
  await expect(page.getByTestId("ticket-status")).toContainText("一线客服处理中");
  await page.getByRole("button", { name: "查看工单详情" }).click();
  await expect(page.getByTestId("handling-category")).toHaveText("低风险信息咨询");
  await expect(page.getByText(/没有自动增加补发或投诉诉求/)).toBeVisible();
  await expect(page.getByLabel("工单流转轨迹")).toContainText("系统派单至一线客服");
  await expect(page.getByText("tier1-general-queue")).toBeVisible();
});

test("reset restores the initial ticket and collapses evidence", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "查看回答依据" }).click();
  await page.getByRole("button", { name: "未解决，转人工" }).click();
  await expect(page.getByLabel("工单列表页")).toBeVisible();
  await page.getByRole("button", { name: "重置演示" }).click();

  await expect(page.getByLabel("工单列表页")).toHaveCount(0);
  await expect(page.getByTestId("ticket-status")).toContainText("AI处理中");
  await expect(page.getByLabel("用户端").getByText("会员自动续订与退订规则", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "查看回答依据" })).toBeVisible();
  await expect(page.getByTestId("ticket-status")).toContainText("等待用户确认");
  await expect(page.getByRole("button", { name: "查看回答依据" })).toHaveAttribute("aria-expanded", "false");
});

test("case two is reclassified only after follow-up and closes after tier1 operations", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Low-Risk AI Assist & Handoff" }).click();
  await expect(page.getByRole("button", { name: /继续提出：补发并投诉/ })).toBeVisible();
  await expect(page.getByTestId("handling-category")).toHaveText("低风险信息咨询");
  await page.getByRole("button", { name: /继续提出：补发并投诉/ }).click();
  await expect(page.getByText("帮我补发优惠券，我还要投诉活动规则不清楚。")).toBeVisible();
  await expect(page.getByLabel("客服回电提示")).toContainText("一线客服 · 回电中");
  await expect(page.getByLabel("客服回电提示").locator(".callback-dots i")).toHaveCount(3);
  await expect(page.getByLabel("工单列表页")).toBeVisible();
  await expect(page.getByLabel("工单列表页").getByText("低风险其他类")).toBeVisible();
  await page.getByRole("button", { name: "查看工单详情" }).click();
  await expect(page.getByLabel("一线处理操作")).toContainText("原活动资格：不符合");
  const aiCard = page.locator(".ai-processing-card");
  await expect(aiCard).toContainText("检索结果");
  await expect(aiCard).toContainText("依据充分");
  await expect(aiCard).not.toContainText("建议动作");
  await expect(aiCard).not.toContainText("活动资格与人工争议补偿 · 2026.09");
  await expect(aiCard).not.toContainText("查询于");
  const reorderedDetailText = await page.getByLabel("工单详情页").innerText();
  expect(reorderedDetailText.indexOf("AI处理信息")).toBeLessThan(reorderedDetailText.indexOf("一线处理操作"));
  expect(reorderedDetailText.indexOf("一线处理操作")).toBeLessThan(reorderedDetailText.indexOf("用户基本信息"));
  const closeButton = page.getByRole("button", { name: "完结并归档" });
  await expect(closeButton).toBeDisabled();
  await page.getByRole("button", { name: "补发优惠券" }).click();
  await expect(closeButton).toBeDisabled();
  await page.getByRole("button", { name: "通知活动策划部" }).click();
  await expect(closeButton).toBeEnabled();
  await closeButton.click();
  await expect(page.getByTestId("ticket-status")).toContainText("已完结");
  await expect(page.getByText("人工客服处理完成")).toBeVisible();
  await expect(page.getByText("感谢你的确认，本次咨询已结束。")).toHaveCount(0);
  await expect(page.getByLabel("工单流转轨迹")).toContainText("一线客服完结并归档");
});

test("case two supports notifying the department before simulated reissue", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Low-Risk AI Assist & Handoff" }).click();
  await page.getByRole("button", { name: /继续提出：补发并投诉/ }).click();
  await page.getByRole("button", { name: "查看工单详情" }).click();
  await page.getByRole("button", { name: "通知活动策划部" }).click();
  await page.getByRole("button", { name: "补发优惠券" }).click();
  await expect(page.getByRole("button", { name: "完结并归档" })).toBeEnabled();
});

test("case three routes refund and report to tier2 and closes after both actions", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "High-Risk AI Fast-Track" }).click();
  await expect(page.getByLabel("工单列表页")).toBeVisible();
  await expect(page.getByRole("heading", { name: "已转交二线客服" })).toBeVisible();
  await expect(page.getByLabel("客服回电提示")).toContainText("二线客服 · 回电中");
  await expect(page.getByLabel("客服回电提示").locator(".callback-dots i")).toHaveCount(3);
  await expect(page.getByTestId("ticket-status")).toContainText("二线客服处理中");
  await page.getByRole("button", { name: "查看工单详情" }).click();
  await expect(page.getByLabel("二线处理操作")).toContainText("高风险：退款＋举报");
  await expect(page.getByTestId("handling-category")).toHaveText("高风险类");
  await expect(page.getByTestId("risk-level")).toHaveText("高");
  const closeButton = page.getByRole("button", { name: "二线完结并归档" });
  await expect(closeButton).toBeDisabled();
  await page.getByRole("button", { name: "退费30元" }).click();
  await expect(closeButton).toBeDisabled();
  await page.getByRole("button", { name: "登记举报诉求" }).click();
  await expect(closeButton).toBeEnabled();
  await closeButton.click();
  await expect(page.getByTestId("ticket-status")).toContainText("已完结");
  await expect(page.getByText("二线客服处理完成")).toBeVisible();
  await expect(page.getByLabel("工单流转轨迹")).toContainText("二线客服完结并归档");
});

test("case three transfers unresolved payment checks to department processing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "High-Risk AI Fast-Track" }).click();
  await expect(page.getByLabel("工单列表页")).toBeVisible();
  await page.getByRole("button", { name: "查看工单详情" }).click();
  await page.getByRole("button", { name: "转支付／风控部门" }).click();
  await expect(page.getByTestId("ticket-status")).toContainText("部门处理中");
  await expect(page.getByRole("button", { name: "等待支付／风控部门处理" })).toBeDisabled();
  await expect(page.getByText("payment-risk-joint-queue")).toBeVisible();
});
