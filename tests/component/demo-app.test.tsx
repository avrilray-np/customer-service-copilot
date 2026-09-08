import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiRuntimeInfo } from "@/ai/types";
import { DemoApp } from "@/components/demo-app";
import { createCaseThreeTicket, createCaseTwoWaitingTicket, createWaitingTicket } from "@/domain/ticket/create-ticket";
import { mockAiProvider } from "@/ai/mock-ai-provider";
import { caseOneInput } from "@/data/demos/case-one";
import { caseTwoInput } from "@/data/demos/case-two";
import { caseThreeInput } from "@/data/demos/case-three";

async function renderApp(aiRuntime?: AiRuntimeInfo) {
  const ticket = createWaitingTicket(await mockAiProvider.analyze(caseOneInput));
  const caseTwoTicket = createCaseTwoWaitingTicket(await mockAiProvider.analyze(caseTwoInput));
  const caseThreeTicket = createCaseThreeTicket(await mockAiProvider.analyze(caseThreeInput));
  return render(<DemoApp initialTicket={ticket} caseTwoTicket={caseTwoTicket} caseThreeTicket={caseThreeTicket} aiRuntime={aiRuntime} processingDelayMs={20} sequenceDelayMs={40} />);
}

afterEach(() => vi.unstubAllGlobals());

describe("DemoApp", () => {
  it("shows evidence and closes after explicit confirmation", async () => {
    const user = userEvent.setup();
    await renderApp();

    expect(screen.getByLabelText("用户端")).toBeInTheDocument();
    expect(screen.getByLabelText("客服系统")).toBeInTheDocument();
    expect(screen.getByLabelText("语音转录示意")).toBeInTheDocument();
    expect(screen.getByLabelText("问题输入框")).toBeInTheDocument();
    expect(screen.getByTestId("ticket-status")).toHaveTextContent("AI处理中");
    await screen.findByRole("button", { name: "查看回答依据" });
    expect(screen.getByTestId("ticket-status")).toHaveTextContent("等待用户确认");
    await user.click(screen.getByRole("button", { name: "查看回答依据" }));
    expect(screen.getByText("会员自动续订与退订规则")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "已解决" }));
    expect(screen.getByLabelText("工单列表页")).toBeInTheDocument();
    expect(screen.getByTestId("ticket-status")).toHaveTextContent("已完结");
    expect(screen.getByText("问题已解决")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "查看工单详情" }));
    expect(screen.getByLabelText("工单详情页")).toBeInTheDocument();
    expect(screen.getByLabelText("AI生成的用户诉求摘要")).toHaveTextContent("用户已取消自动续订");
    expect(screen.getByTestId("customer-uid")).toHaveTextContent("DEMO-U001");
    const detailText = screen.getByLabelText("工单详情页").textContent ?? "";
    expect(detailText.indexOf("AI生成的用户诉求摘要")).toBeLessThan(detailText.indexOf("AI处理信息"));
    expect(detailText.indexOf("AI处理信息")).toBeLessThan(detailText.indexOf("用户基本信息"));
    expect(detailText.indexOf("用户基本信息")).toBeLessThan(detailText.indexOf("处理结果与审计"));
    expect(detailText.indexOf("处理结果与审计")).toBeLessThan(detailText.indexOf("流转信息"));
    expect(screen.getByLabelText("工单基础信息").querySelectorAll(".meta-item")).toHaveLength(0);
    expect(screen.getByText("语音转写", { exact: true })).toBeInTheDocument();
    expect(screen.getByLabelText("原始录音与转写")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "播放模拟录音" }));
    expect(screen.getByRole("button", { name: "暂停模拟录音" })).toBeInTheDocument();
    expect(screen.getByLabelText("工单流转轨迹")).toHaveTextContent("用户确认问题已解决");
    expect(screen.getByLabelText("工单流转轨迹")).toHaveTextContent("系统自动完结工单");
    expect(screen.getByText(/用户明确确认已解决/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /返回工单列表/ }));
    expect(screen.getByLabelText("工单列表页")).toBeInTheDocument();
  });

  it("does not invent new intents when the user only asks for human help", async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(await screen.findByRole("button", { name: "未解决，转人工" }));
    expect(screen.getByLabelText("工单列表页")).toBeInTheDocument();
    expect(screen.getByTestId("ticket-status")).toHaveTextContent("一线客服处理中");
    await user.click(screen.getByRole("button", { name: "查看工单详情" }));
    expect(screen.getByText(/没有自动增加补发或投诉诉求/)).toBeInTheDocument();
    expect(screen.getByTestId("handling-category")).toHaveTextContent("低风险信息咨询");
    expect(screen.getByLabelText("工单流转轨迹")).toHaveTextContent("系统派单至一线客服");
    expect(screen.getByText("tier1-general-queue")).toBeInTheDocument();
  });

  it("resets both ticket data and local interface state", async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(await screen.findByRole("button", { name: "查看回答依据" }));
    expect(screen.getByText("会员自动续订与退订规则")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "未解决，转人工" }));
    expect(screen.getByLabelText("工单列表页")).toBeInTheDocument();
    const resetButton = screen.getByRole("button", { name: "重置演示" });
    expect(resetButton.closest(".outside-reset")).toBeInTheDocument();
    expect(resetButton.closest(".phone-frame")).not.toBeInTheDocument();
    await user.click(resetButton);

    expect(screen.queryByLabelText("工单列表页")).not.toBeInTheDocument();
    expect(screen.getByTestId("ticket-status")).toHaveTextContent("AI处理中");
    expect(screen.queryByText("会员自动续订与退订规则")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("ticket-status")).toHaveTextContent("等待用户确认"));
    expect(screen.getByRole("button", { name: "查看回答依据" })).toHaveAttribute("aria-expanded", "false");
  });

  it("runs case two through tier1 review, reissue, department notice and closure", async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole("button", { name: "Low-Risk AI Assist & Handoff" }));
    const followUpButton = await screen.findByRole("button", { name: /继续提出：补发并投诉/ });
    expect(followUpButton.closest(".follow-up-action")).toBeInTheDocument();
    expect(screen.getByTestId("handling-category")).toHaveTextContent("低风险信息咨询");
    await user.click(followUpButton);
    expect(screen.getByText("帮我补发优惠券，我还要投诉活动规则不清楚。")).toBeInTheDocument();
    expect(screen.queryByLabelText("AI追加回复")).not.toBeInTheDocument();
    const followUpReply = await screen.findByLabelText("AI追加回复");
    expect(followUpReply).toHaveTextContent("补发");
    expect(screen.queryByText("已转接人工客服")).not.toBeInTheDocument();
    const callback = await screen.findByLabelText("客服回电提示");
    expect(callback).toHaveTextContent("一线客服 · 回电中");
    expect(callback).not.toHaveTextContent("正在核验补发与投诉信息");
    expect(callback.querySelectorAll(".callback-dots i")).toHaveLength(3);
    expect(screen.getByLabelText("工单列表页")).toBeInTheDocument();
    expect(screen.getByText("低风险其他类")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "查看工单详情" }));
    expect(screen.getByLabelText("一线处理操作")).toHaveTextContent("原活动资格：不符合");
    expect(screen.getByLabelText("一线处理操作").querySelector(".ai-suggestion")).toBeInTheDocument();
    const aiCard = screen.getByText("AI处理信息").closest(".ai-processing-card");
    expect(aiCard).toHaveTextContent("检索结果依据充分");
    expect(aiCard).toHaveTextContent("信息缺口活动页面资格提示展示情况、一线争议补偿审核结果");
    expect(aiCard).not.toHaveTextContent("建议动作");
    expect(aiCard).not.toHaveTextContent("活动资格与人工争议补偿 · 2026.09");
    expect(aiCard).not.toHaveTextContent("查询于");
    expect(aiCard?.querySelector(".ai-reply")).toBeInTheDocument();
    const detailText = screen.getByLabelText("工单详情页").textContent ?? "";
    expect(detailText.indexOf("AI处理信息")).toBeLessThan(detailText.indexOf("一线处理操作"));
    expect(detailText.indexOf("一线处理操作")).toBeLessThan(detailText.indexOf("用户基本信息"));
    const closeButton = screen.getByRole("button", { name: "完结并归档" });
    expect(closeButton).toHaveClass("floating-close-action");
    expect(closeButton.parentElement?.parentElement).toHaveClass("service-window");
    expect(closeButton).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "补发优惠券" }));
    expect(closeButton).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "通知活动策划部" }));
    expect(closeButton).toBeEnabled();
    await user.click(closeButton);
    expect(screen.getByTestId("ticket-status")).toHaveTextContent("已完结");
    expect(screen.getByText("人工客服处理完成")).toBeInTheDocument();
    expect(screen.queryByText("感谢你的确认，本次咨询已结束。")).not.toBeInTheDocument();
    expect(screen.getByLabelText("工单流转轨迹")).toHaveTextContent("一线客服完结并归档");
  });

  it("allows case two operations in department-notice-first order", async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole("button", { name: "Low-Risk AI Assist & Handoff" }));
    await user.click(await screen.findByRole("button", { name: /继续提出：补发并投诉/ }));
    await user.click(screen.getByRole("button", { name: "查看工单详情" }));
    await user.click(screen.getByRole("button", { name: "通知活动策划部" }));
    await user.click(screen.getByRole("button", { name: "补发优惠券" }));
    expect(screen.getByRole("button", { name: "完结并归档" })).toBeEnabled();
  });

  it("routes case three directly to tier2 and closes only after refund and report handling", async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole("button", { name: "High-Risk AI Fast-Track" }));
    await waitFor(() => expect(screen.getByLabelText("工单列表页")).toBeInTheDocument());
    expect(screen.queryByText("已转交二线客服")).not.toBeInTheDocument();
    expect(await screen.findByText("已转交二线客服")).toBeInTheDocument();
    expect(await screen.findByLabelText("客服回电提示")).toHaveTextContent("二线客服 · 回电中");
    expect(screen.getByLabelText("客服回电提示").querySelectorAll(".callback-dots i")).toHaveLength(3);
    expect(screen.getByText("高风险类")).toBeInTheDocument();
    expect(screen.getByTestId("ticket-status")).toHaveTextContent("二线客服处理中");
    await user.click(screen.getByRole("button", { name: "查看工单详情" }));
    const panel = screen.getByLabelText("二线处理操作");
    expect(panel).toHaveTextContent("高风险：退款＋举报");
    expect(panel).toHaveTextContent("AI不得承诺退款，也不得判断举报成立");
    expect(screen.getByTestId("handling-category")).toHaveTextContent("高风险类");
    expect(screen.getByTestId("risk-level")).toHaveTextContent("高");
    const closeButton = screen.getByRole("button", { name: "二线完结并归档" });
    expect(closeButton).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "退费30元" }));
    expect(closeButton).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "登记举报诉求" }));
    expect(closeButton).toBeEnabled();
    await user.click(closeButton);
    expect(screen.getByTestId("ticket-status")).toHaveTextContent("已完结");
    expect(screen.getByText("二线客服处理完成")).toBeInTheDocument();
    expect(screen.getByLabelText("工单流转轨迹")).toHaveTextContent("二线客服完结并归档");
  });

  it("moves case three to department processing when tier2 cannot decide", async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole("button", { name: "High-Risk AI Fast-Track" }));
    await waitFor(() => expect(screen.getByLabelText("工单列表页")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "查看工单详情" }));
    await user.click(screen.getByRole("button", { name: "转支付／风控部门" }));
    expect(screen.getByTestId("ticket-status")).toHaveTextContent("部门处理中");
    expect(screen.getByRole("button", { name: "等待支付／风控部门处理" })).toBeDisabled();
    expect(screen.getByText("payment-risk-joint-queue")).toBeInTheDocument();
  });

  it("reveals each conversation step only after the previous step delay", async () => {
    const user = userEvent.setup();
    await renderApp();

    await screen.findByRole("button", { name: "查看回答依据" });
    expect(screen.queryByRole("button", { name: "已解决" })).not.toBeInTheDocument();
    await screen.findByRole("button", { name: "已解决" });

    await user.click(screen.getByRole("button", { name: "Low-Risk AI Assist & Handoff" }));
    await screen.findByRole("button", { name: "查看回答依据" });
    expect(screen.queryByRole("button", { name: /继续提出：补发并投诉/ })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /继续提出：补发并投诉/ }));

    expect(screen.getByLabelText("用户追加诉求")).toBeInTheDocument();
    expect(screen.queryByLabelText("AI追加回复")).not.toBeInTheDocument();
    expect(screen.queryByText("已转接人工客服")).not.toBeInTheDocument();
    await screen.findByLabelText("AI追加回复");
    expect(screen.queryByText("已转接人工客服")).not.toBeInTheDocument();
    await screen.findByText("已转接人工客服");

    await user.click(screen.getByRole("button", { name: "High-Risk AI Fast-Track" }));
    await screen.findByRole("button", { name: "查看回答依据" });
    expect(screen.queryByText("已转交二线客服")).not.toBeInTheDocument();
    await screen.findByText("已转交二线客服");
  });

  it("starts in Mock Mode without calling the configured AI provider", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await renderApp({ requestedMode: "deepseek", activeMode: "mock", model: "deepseek-v4-flash", warning: null });

    expect(screen.getByRole("button", { name: "Mock Mode" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "AI Mode" })).toHaveAttribute("aria-pressed", "false");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps exactly two mode tabs and a stable AI Mode label while loading", async () => {
    const user = userEvent.setup();
    const candidate = await mockAiProvider.analyze(caseOneInput);
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 30));
      return new Response(JSON.stringify({ candidate, mode: "deepseek", model: "deepseek-v4-flash" }), { status: 200, headers: { "content-type": "application/json" } });
    }));
    await renderApp({ requestedMode: "deepseek", activeMode: "mock", model: "deepseek-v4-flash", warning: null });

    const modeSwitcher = screen.getByRole("group", { name: "AI运行模式" });
    expect(modeSwitcher.querySelectorAll("button")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "AI Mode" }));
    expect(screen.getByRole("button", { name: "AI Mode" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("group", { name: "AI运行模式" }).querySelector(".mode-spinner")).toBeInTheDocument();
    expect(screen.queryByText(/AI Loading|DeepSeek|deepseek-v4-flash/)).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole("button", { name: "AI Mode" })).toHaveAttribute("aria-busy", "false"));
    expect(screen.getByRole("group", { name: "AI运行模式" }).querySelectorAll("button")).toHaveLength(2);
    expect(screen.queryByText(/DeepSeek|deepseek-v4-flash/)).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "已解决" }));
    await user.click(screen.getByRole("button", { name: "查看工单详情" }));
    expect(screen.getByText("customer-service-ai-v1.0")).toBeInTheDocument();
    expect(screen.queryByText(/DeepSeek|Gemini|deepseek-v4-flash/)).not.toBeInTheDocument();
  });

  it("does not reveal the AI reply or next action before a slow AI Mode request completes", async () => {
    const user = userEvent.setup();
    const candidate = await mockAiProvider.analyze(caseOneInput);
    let finishRequest: ((response: Response) => void) | undefined;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise<Response>((resolve) => {
      finishRequest = resolve;
    })));
    await renderApp({ requestedMode: "deepseek", activeMode: "mock", model: "deepseek-v4-flash", warning: null });

    await user.click(screen.getByRole("button", { name: "AI Mode" }));
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    expect(screen.getByLabelText("AI正在回复")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "查看回答依据" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "已解决" })).not.toBeInTheDocument();

    finishRequest?.(new Response(JSON.stringify({ candidate, mode: "deepseek", model: "deepseek-v4-flash" }), { status: 200, headers: { "content-type": "application/json" } }));
    await waitFor(() => expect(screen.getByRole("button", { name: "AI Mode" })).toHaveAttribute("aria-busy", "false"));
    await screen.findByRole("button", { name: "查看回答依据" });
    expect(screen.queryByRole("button", { name: "已解决" })).not.toBeInTheDocument();
    await screen.findByRole("button", { name: "已解决" });
  });

  it("loads only the selected case in AI Mode and reuses its page-session cache", async () => {
    const user = userEvent.setup();
    const caseOneCandidate = await mockAiProvider.analyze(caseOneInput);
    const caseTwoCandidate = await mockAiProvider.analyze(caseTwoInput);
    const fetcher = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const { demoCase } = JSON.parse(String(init.body));
      const candidate = demoCase === "case-two" ? caseTwoCandidate : caseOneCandidate;
      return new Response(JSON.stringify({ candidate, mode: "deepseek", model: "deepseek-v4-flash" }), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetcher);
    await renderApp({ requestedMode: "deepseek", activeMode: "mock", model: "deepseek-v4-flash", warning: null });

    await user.click(screen.getByRole("button", { name: "AI Mode" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "AI Mode" })).toHaveAttribute("aria-busy", "false"));
    expect(screen.queryByText(/DeepSeek|deepseek-v4-flash/)).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetcher.mock.calls[0][1].body))).toEqual({ demoCase: "case-one" });

    await user.click(screen.getByRole("button", { name: "Low-Risk AI Assist & Handoff" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetcher.mock.calls[1][1].body))).toEqual({ demoCase: "case-two" });

    await user.click(screen.getByRole("button", { name: "AI Only" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "AI Mode" })).toHaveAttribute("aria-pressed", "true"));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps Mock data selected when AI Mode fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "DeepSeek余额不足。" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    })));
    await renderApp({ requestedMode: "deepseek", activeMode: "mock", model: "deepseek-v4-flash", warning: null });

    await user.click(screen.getByRole("button", { name: "AI Mode" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("AI暂时无法分析当前案例");
    expect(screen.getByRole("alert")).not.toHaveTextContent("DeepSeek");
    expect(screen.getByRole("button", { name: "Mock Mode" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(screen.getByTestId("ticket-status")).toHaveTextContent("等待用户确认"));
    expect(screen.getByTestId("handling-category")).toHaveTextContent("低风险信息咨询");
  });

  it("keeps a failed Gemini follow-up pending until the user explicitly chooses Mock", async () => {
    const user = userEvent.setup();
    const initialCandidate = await mockAiProvider.analyze(caseTwoInput);
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidate: initialCandidate, mode: "gemini", model: "gemini-test" }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Gemini服务暂时不可用。" }), { status: 502, headers: { "content-type": "application/json" } })));
    await renderApp({ requestedMode: "gemini", activeMode: "mock", model: "gemini-test", warning: null });

    await user.click(screen.getByRole("button", { name: "Low-Risk AI Assist & Handoff" }));
    await user.click(screen.getByRole("button", { name: "AI Mode" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "AI Mode" })).toHaveAttribute("aria-busy", "false"));
    await user.click(await screen.findByRole("button", { name: /继续提出：补发并投诉/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("AI暂时无法分析追加诉求");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Gemini");
    expect(screen.queryByLabelText("工单列表页")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "明确使用Mock继续" }));
    expect(screen.getByLabelText("工单列表页")).toBeInTheDocument();
    expect(screen.getByText(/明确选择使用Mock结果继续/)).toBeInTheDocument();
  });

  it("keeps a failed DeepSeek follow-up pending until the user explicitly chooses Mock", async () => {
    const user = userEvent.setup();
    const initialCandidate = await mockAiProvider.analyze(caseTwoInput);
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidate: initialCandidate, mode: "deepseek", model: "deepseek-v4-flash" }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "DeepSeek服务暂时不可用。" }), { status: 502, headers: { "content-type": "application/json" } })));
    await renderApp({ requestedMode: "deepseek", activeMode: "mock", model: "deepseek-v4-flash", warning: null });

    await user.click(screen.getByRole("button", { name: "Low-Risk AI Assist & Handoff" }));
    await user.click(screen.getByRole("button", { name: "AI Mode" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "AI Mode" })).toHaveAttribute("aria-busy", "false"));
    await user.click(await screen.findByRole("button", { name: /继续提出：补发并投诉/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("AI暂时无法分析追加诉求");
    expect(screen.getByRole("alert")).not.toHaveTextContent("DeepSeek");
    expect(screen.queryByLabelText("工单列表页")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试AI" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "明确使用Mock继续" }));
    expect(screen.getByLabelText("工单列表页")).toBeInTheDocument();
    expect(screen.getByText(/AI分析失败后.*明确选择使用Mock结果继续/)).toBeInTheDocument();
  });
});
