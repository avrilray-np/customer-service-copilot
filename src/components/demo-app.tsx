"use client";

import { useEffect, useRef, useState } from "react";
import type { AiAnalysisCandidate, AiMode, AiRuntimeInfo } from "@/ai/types";
import type { Ticket } from "@/domain/ticket/types";
import { DemoSessionProvider, useDemoSession, type DemoCase } from "@/session/demo-session";
import { caseTwoFollowUp } from "@/data/demos/case-two";
import { caseThreeFacts } from "@/data/demos/case-three";
import { createCaseThreeTicket, createCaseTwoWaitingTicket, createWaitingTicket } from "@/domain/ticket/create-ticket";
import { isAiCandidate } from "@/validation/ai-candidate-validator";
import { isTicket } from "@/validation/ticket-validator";

const statusLabels: Record<Ticket["workflow"]["ticket_status"], string> = {
  ai_processing: "AI处理中",
  waiting_user_confirmation: "等待用户确认",
  human_processing: "一线客服处理中",
  tier2_processing: "二线客服处理中",
  department_notified: "已通知部门",
  department_processing: "部门处理中",
  closed: "已完结",
};

const channelLabels: Record<Ticket["channel"], string> = { text: "文字", voice_transcript: "语音转写" };
const ownerLabels: Record<Ticket["workflow"]["current_owner"], string> = { ai: "AI客服", tier1: "一线客服", tier2: "二线客服", department: "相关部门", none: "无（已结束）" };
const categoryLabels: Record<Ticket["issue"]["handling_category"], string> = { low_risk_info: "低风险信息咨询", low_risk_other: "低风险其他类", high_risk: "高风险类" };
const subtypeLabels: Record<string, string> = {
  policy_query: "规则咨询", membership_query: "会员状态查询", renewal_query: "自动续订查询",
  consumption_record_query: "消费记录查询", operation_status_query: "操作状态查询", unsubscribe: "退订",
  reissue: "补发", complaint: "投诉", suggestion: "建议", general_operation: "一般操作", refund: "退款",
  report: "举报", account_security: "账户安全", legal_or_safety: "法律或安全",
};
const evidenceLabels: Record<Ticket["ai_processing"]["evidence_status"], string> = { sufficient: "依据充分", insufficient: "依据不足", conflicting: "依据冲突" };
const actionLabels: Record<Ticket["ai_processing"]["recommended_action"], string> = { reply: "直接回复", ask_clarification: "补充询问", assign_tier1: "派一线客服", assign_tier2: "派二线客服", notify_department: "通知相关部门" };
const confirmationLabels: Record<Ticket["workflow"]["user_resolution_confirmation"], string> = { resolved: "已解决", unresolved: "未解决", pending: "待确认" };
const departmentStatusLabels: Record<Ticket["workflow"]["department_notification_status"], string> = { not_required: "不涉及", pending: "待通知", sent: "已发送", failed: "发送失败" };
const closedByLabels: Record<NonNullable<Ticket["resolution"]["closed_by"]>, string> = { ai_confirmed: "AI确认完结", tier1: "一线客服完结", tier2: "二线客服完结", department: "相关部门完结" };

function formatDate(value: string | null | undefined) {
  if (!value) return "暂无";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(value));
}

function createDemoTicket(demoCase: DemoCase, candidate: AiAnalysisCandidate) {
  const options = { promptVersion: "customer-service-ai-v1.0" };
  const ticket = demoCase === "case-one"
    ? createWaitingTicket(candidate, options)
    : demoCase === "case-two"
      ? createCaseTwoWaitingTicket(candidate, options)
      : createCaseThreeTicket(candidate, options);
  if (!isTicket(ticket)) throw new Error("服务端返回的AI结果无法生成有效工单。");
  return ticket;
}

type DisplayMode = "mock" | "ai";
type DemoTicketMap = Record<DemoCase, Ticket>;

function useDelayedReveal(active: boolean, delayMs: number, sequenceRunId: number) {
  const [revealedRunId, setRevealedRunId] = useState<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setRevealedRunId(sequenceRunId), delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs, sequenceRunId]);

  return active && revealedRunId === sequenceRunId;
}

export function DemoApp({
  initialTicket,
  caseTwoTicket,
  caseThreeTicket,
  aiRuntime = { requestedMode: "mock", activeMode: "mock", model: null, warning: null },
  processingDelayMs,
  sequenceDelayMs = 2000,
}: {
  initialTicket: Ticket;
  caseTwoTicket?: Ticket;
  caseThreeTicket?: Ticket;
  aiRuntime?: AiRuntimeInfo;
  processingDelayMs?: number;
  sequenceDelayMs?: number;
}) {
  const [selectedCase, setSelectedCase] = useState<DemoCase>("case-one");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("mock");
  const [aiTickets, setAiTickets] = useState<Partial<DemoTicketMap>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const mockTickets: DemoTicketMap = {
    "case-one": initialTicket,
    "case-two": caseTwoTicket ?? initialTicket,
    "case-three": caseThreeTicket ?? initialTicket,
  };
  const configuredAiMode = aiRuntime.requestedMode === "mock" ? null : aiRuntime.requestedMode;
  const activeTicket = displayMode === "ai" && aiTickets[selectedCase] ? aiTickets[selectedCase] : mockTickets[selectedCase];
  const activeProviderMode: AiMode = displayMode === "ai" && configuredAiMode ? configuredAiMode : "mock";

  const loadAiCase = async (demoCase: DemoCase) => {
    if (!configuredAiMode) {
      setDisplayMode("mock");
      setAiError("服务器尚未配置真实AI，当前只能使用Mock Mode。");
      return;
    }
    if (aiTickets[demoCase]) {
      setAiError(null);
      return;
    }

    const requestId = ++requestSequence.current;
    setAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ demoCase }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
          ? result.error
          : "AI暂时无法分析当前案例。";
        throw new Error(message);
      }
      const candidate = result && typeof result === "object" && "candidate" in result ? result.candidate : null;
      if (!isAiCandidate(candidate)) throw new Error("服务端返回的AI结果不符合工单契约。");
      const ticket = createDemoTicket(demoCase, candidate);
      setAiTickets((current) => ({ ...current, [demoCase]: ticket }));
    } catch (error) {
      if (requestId === requestSequence.current) {
        setDisplayMode("mock");
        setAiError(error instanceof Error && !error.message.includes("DeepSeek") && !error.message.includes("Gemini") ? error.message : "AI暂时无法分析当前案例，请稍后重试。" );
      }
    } finally {
      if (requestId === requestSequence.current) setAiLoading(false);
    }
  };

  const selectMode = (mode: DisplayMode) => {
    if (mode === "mock") {
      requestSequence.current += 1;
      setAiLoading(false);
      setAiError(null);
      setDisplayMode("mock");
      return;
    }
    setDisplayMode("ai");
    void loadAiCase(selectedCase);
  };

  const selectCase = (demoCase: DemoCase) => {
    requestSequence.current += 1;
    setAiLoading(false);
    setAiError(null);
    setSelectedCase(demoCase);
    if (displayMode === "ai") void loadAiCase(demoCase);
  };

  const currentRuntime: AiRuntimeInfo = {
    requestedMode: aiRuntime.requestedMode,
    activeMode: activeProviderMode,
    model: null,
    warning: aiError,
  };
  return (
    <DemoSessionProvider key={`${selectedCase}-${displayMode}-${aiLoading ? "loading" : "ready"}`} initialTicket={activeTicket} demoCase={selectedCase} aiMode={activeProviderMode} processingDelayMs={processingDelayMs} processingPaused={aiLoading}>
      <DemoScreen selectedCase={selectedCase} onSelectCase={selectCase} caseTwoAvailable={Boolean(caseTwoTicket)} caseThreeAvailable={Boolean(caseThreeTicket)} aiRuntime={currentRuntime} displayMode={displayMode} onSelectMode={selectMode} aiLoading={aiLoading} sequenceDelayMs={sequenceDelayMs} />
    </DemoSessionProvider>
  );
}

function DemoScreen({ selectedCase, onSelectCase, caseTwoAvailable, caseThreeAvailable, aiRuntime, displayMode, onSelectMode, aiLoading, sequenceDelayMs }: { selectedCase: DemoCase; onSelectCase: (value: DemoCase) => void; caseTwoAvailable: boolean; caseThreeAvailable: boolean; aiRuntime: AiRuntimeInfo; displayMode: DisplayMode; onSelectMode: (mode: DisplayMode) => void; aiLoading: boolean; sequenceDelayMs: number }) {
  const { ticket, initialTicket, demoCase, serviceView, timeline, hasFollowUp, followUpSubmitted, followUpError, followUpNotice, confirmResolved, requestHuman, addCaseTwoRequest, continueFollowUpWithMock, completeReissue, notifyDepartment, closeTier1, completeRefund, registerReport, transferDepartment, closeTier2, openTicket, backToList, reset } = useDemoSession();
  const [showSources, setShowSources] = useState(false);
  const [sequenceRunId, setSequenceRunId] = useState(0);
  const processing = ticket.workflow.ticket_status === "ai_processing";
  const waiting = ticket.workflow.ticket_status === "waiting_user_confirmation";
  const closed = ticket.workflow.ticket_status === "closed";
  const transferred = demoCase === "case-two" ? hasFollowUp : demoCase === "case-three" ? !processing : ticket.workflow.ticket_status === "human_processing";
  const isCaseTwo = demoCase === "case-two";
  const isCaseThree = demoCase === "case-three";
  const reissueDone = Boolean(ticket.resolution.action_result);
  const departmentDone = ticket.workflow.department_notification_status === "sent";
  const refundDone = Boolean(ticket.resolution.action_result?.includes("模拟退款30元成功"));
  const reportDone = Boolean(ticket.resolution.action_result?.includes("举报诉求已登记"));
  const departmentProcessing = ticket.workflow.ticket_status === "department_processing";
  const showInitialNextStep = useDelayedReveal(!processing, sequenceDelayMs, sequenceRunId);
  const followUpWaitFinished = useDelayedReveal(followUpSubmitted, sequenceDelayMs, sequenceRunId);
  const showFollowUpReply = hasFollowUp && followUpWaitFinished;
  const showDelayedTransfer = useDelayedReveal(isCaseThree ? !processing : showFollowUpReply, sequenceDelayMs, sequenceRunId);
  const showTransfer = transferred && (isCaseThree || isCaseTwo ? showDelayedTransfer : true);

  const resetDemo = () => {
    setShowSources(false);
    setSequenceRunId((value) => value + 1);
    reset();
  };

  return (
    <main className="page-shell">
      <div className="demo-wrap">
        {(caseTwoAvailable || caseThreeAvailable) && <nav className="case-switcher" aria-label="演示案例切换">
          <button type="button" className={selectedCase === "case-one" ? "active" : ""} onClick={() => onSelectCase("case-one")}>AI Only</button>
          <button type="button" className={selectedCase === "case-two" ? "active" : ""} onClick={() => onSelectCase("case-two")}>Low-Risk AI Assist &amp; Handoff</button>
          {caseThreeAvailable && <button type="button" className={selectedCase === "case-three" ? "active" : ""} onClick={() => onSelectCase("case-three")}>High-Risk AI Fast-Track</button>}
        </nav>}
        <header className="demo-header">
          <div>
            <div className="demo-eyebrow">CUSTOMER SERVICE COPILOT · AI DEMO</div>
            <h1>AI客服与工单流转演示</h1>
            <p>用户问题出现后，客服系统同步建单、分析并更新处理状态。</p>
          </div>
          <div className="mode-switcher" role="group" aria-label="AI运行模式">
            <button type="button" aria-pressed={displayMode === "mock"} className={displayMode === "mock" ? "active" : ""} onClick={() => onSelectMode("mock")}>Mock Mode</button>
            <button type="button" aria-pressed={displayMode === "ai"} aria-busy={aiLoading} className={displayMode === "ai" ? "active" : ""} onClick={() => onSelectMode("ai")} disabled={aiLoading}>{aiLoading && <span className="mode-spinner" aria-hidden="true" />}AI Mode</button>
          </div>
        </header>

        {aiLoading && <div className="runtime-loading" role="status">AI正在分析当前案例，仅本次首次查看会产生调用。</div>}
        {aiRuntime.warning && <div className="runtime-warning" role="alert"><strong>AI Mode未启用：</strong>{aiRuntime.warning} 当前仍使用Mock演示数据。</div>}

        <div className="dual-stage">
          <section className="user-side" aria-label="用户端">
            <div className="endpoint-heading user-endpoint-heading">
              <VoiceTranscriptIcon />
              <div><h2>用户端</h2><span>语音转录示意</span></div>
            </div>
            <div className="phone-frame">
              <div className="phone-speaker" />
              <header className="chat-header">
                <button className="back-button" type="button" aria-label="返回">‹</button>
                <div className="chat-avatar">C</div>
                <div className="chat-title"><strong>在线客服</strong><span><i /> AI客服在线</span></div>
                <button className="more-button" type="button" aria-label="更多">•••</button>
              </header>

              <div className="chat-body">
                <div className="message user">
                  <div className="message-label">你 · 09:30</div>
                  <div className="bubble">{initialTicket.issue.original_message}</div>
                </div>

                {processing && (
                  <div className="message ai typing-message" aria-label="AI正在回复">
                    <div className="message-label">AI客服</div>
                    <div className="typing-bubble"><span /><span /><span /></div>
                  </div>
                )}

                {!processing && (
                  <div className="message ai response-enter">
                    <div className="message-label">AI客服 · 09:30</div>
                    <div className="bubble">{hasFollowUp ? initialTicket.ai_processing.reply : ticket.ai_processing.reply}</div>
                    <button className="source-link" aria-expanded={showSources} onClick={() => setShowSources((value) => !value)}>
                      {showSources ? "收起回答依据" : "查看回答依据"}
                    </button>
                  </div>
                )}

                {showSources && !processing && (
                  <div className="source-card">
                    <div className="source-card-title">本次回答依据</div>
                    {ticket.ai_processing.knowledge_sources.map((source) => (
                      <div key={source.document_id}>
                        <strong>{source.title}</strong>
                        <div className="muted">{source.section} · {source.version}</div>
                        <div className="source-quote">“{source.quote}”</div>
                      </div>
                    ))}
                    <p>{isCaseThree ? "扣费记录查询时间：2026-09-01 11:20" : isCaseTwo ? "活动资格查询时间：2026-09-01 10:15" : "会员及续订状态查询时间：2026-09-01 09:30"}</p>
                  </div>
                )}

                {followUpSubmitted && <div className="message user response-enter" aria-label="用户追加诉求"><div className="message-label">你 · 10:16</div><div className="bubble">{caseTwoFollowUp}</div></div>}
                {showFollowUpReply && <div className="message ai response-enter" aria-label="AI追加回复"><div className="message-label">AI客服 · 10:16</div><div className="bubble">{ticket.ai_processing.reply}</div></div>}

                {waiting && !isCaseTwo && showInitialNextStep && (
                  <div className="actions">
                    <button className="button primary" onClick={confirmResolved}>已解决</button>
                    <button className="button" onClick={requestHuman}>未解决，转人工</button>
                  </div>
                )}

                {waiting && isCaseTwo && showInitialNextStep && !followUpSubmitted && <div className="follow-up-action"><button type="button" onClick={() => void addCaseTwoRequest()}>继续提出：补发并投诉 <span>›</span></button></div>}

                {followUpError && <div className="follow-up-error" role="alert"><strong>AI分析失败</strong><p>{followUpError}</p><div><button type="button" onClick={() => void addCaseTwoRequest()}>重试AI</button><button type="button" onClick={() => void continueFollowUpWithMock()}>明确使用Mock继续</button></div></div>}
                {followUpNotice && <div className="follow-up-notice" role="status">{followUpNotice}</div>}

                {closed && (
                  <div className="result-card success-card" role="status">
                    <div className="result-icon">✓</div>
                    <div><h4>{isCaseThree ? "二线客服处理完成" : isCaseTwo ? "人工客服处理完成" : "问题已解决"}</h4><p>{isCaseThree ? "退款核验及举报登记已处理，本次工单已归档。" : isCaseTwo ? "补发审核及投诉登记已处理，本次工单已归档。" : "感谢你的确认，本次咨询已结束。"}</p></div>
                  </div>
                )}

                {showTransfer && (
                  <div className="result-card transfer-card" role="status">
                    <div className="result-icon">→</div>
                    <div><h4>{isCaseThree ? "已转交二线客服" : "已转接人工客服"}</h4><p>{isCaseThree ? "二线客服将核验扣费、退款与举报信息。" : "一线客服将继续跟进，请稍候。"}</p></div>
                  </div>
                )}

                {showTransfer && (isCaseTwo || isCaseThree) && (
                  <div className="message ai agent-callback response-enter" aria-label="客服回电提示">
                    <div className="message-label">{isCaseThree ? "二线客服" : "一线客服"} · 回电中</div>
                    <div className="bubble"><PhoneIcon /><span className="callback-dots" aria-label="接通中"><i /><i /><i /></span></div>
                  </div>
                )}
              </div>

              <div className="composer">
                <input aria-label="问题输入框" placeholder="请输入你的问题" />
                <button type="button" aria-label="发送" disabled>↑</button>
              </div>
              <div className="home-indicator" />
            </div>
            {(closed || transferred) && <div className="outside-reset"><button className="button reset-button" onClick={resetDemo}>重置演示</button></div>}
          </section>

          <section className="service-side" aria-label="客服系统">
            <div className="endpoint-heading service-endpoint-heading">
              <span className="system-icon">CS</span>
              <div><h2>客服系统</h2><span>工单处理与AI辅助</span></div>
            </div>
            <div className="service-window">
              <header className="service-topbar">
                <div className="service-brand"><span>CS</span><div><strong>客服工单系统</strong><small>AI辅助处理工作台</small></div></div>
                <div className="agent-chip"><i /> {isCaseThree ? "二线客服 · 在线" : "一线客服 · 在线"}</div>
              </header>

              {serviceView === "live" && <div className="service-body">
                <aside className="ticket-list">
                  <div className="list-heading"><strong>工单池</strong><span>1</span></div>
                  <div className="ticket-item active">
                    <div className="ticket-item-top"><strong>{ticket.ticket_id}</strong><span>{statusLabels[ticket.workflow.ticket_status]}</span></div>
                    <p>{ticket.issue.original_message}</p>
                    <small>刚刚 · {channelLabels[ticket.channel]}渠道</small>
                  </div>
                </aside>

                <div className="ticket-detail">
                  <header className="ticket-heading">
                    <div><small>工单编号 {ticket.ticket_id}</small><h3>{ticket.issue.summary}</h3></div>
                    <strong className={`status-pill status-${ticket.workflow.ticket_status}`} data-testid="ticket-status">
                      ● {statusLabels[ticket.workflow.ticket_status]}
                    </strong>
                  </header>

                  {processing ? (
                    <div className="processing-panel" role="status">
                      <div className="processing-orbit"><span /></div>
                      <h3>AI正在识别问题并查询相关记录</h3>
                      <p>工单已创建，分析完成后将自动补充分类、风险和来源信息。</p>
                      <div className="progress-steps"><span className="done">建单</span><span className="active">语义识别</span><span>查询记录</span><span>生成回复</span></div>
                    </div>
                  ) : (
                    <div className="detail-grid response-enter">
                      <div className="system-card">
                        <div className="card-heading"><h4>用户状态</h4><span>实时查询</span></div>
                        <div className="fact-row"><span>会员状态</span><strong>有效</strong></div>
                        <div className="fact-row"><span>{isCaseTwo ? "会员产品" : "自动续订"}</span><strong>{isCaseTwo ? "普通月卡" : "已取消"}</strong></div>
                        <div className="fact-row"><span>{isCaseTwo ? "优惠券状态" : "权益到期"}</span><strong>{isCaseTwo ? "未生成" : "2026-09-30 23:59"}</strong></div>
                        <div className="fact-row"><span>身份校验</span><strong>已验证</strong></div>
                      </div>
                      <div className="system-card">
                        <div className="card-heading"><h4>AI判断</h4><span>结构化输出</span></div>
                        <div className="fact-row"><span>分类</span><strong data-testid="handling-category">{categoryLabels[ticket.issue.handling_category]}</strong></div>
                        <div className="fact-row"><span>风险等级</span><strong data-testid="risk-level">低</strong></div>
                        <div className="fact-row"><span>置信状态</span><strong>高</strong></div>
                        <div className="fact-row"><span>建议动作</span><strong>{actionLabels[ticket.ai_processing.recommended_action]}</strong></div>
                      </div>
                      <div className="system-card full-card">
                        <div className="card-heading"><h4>来源与审计</h4><span>可追溯</span></div>
                        <div className="source-grid">
                          <div><span>知识库来源</span><strong>{ticket.ai_processing.knowledge_sources[0]?.document_id} · {ticket.ai_processing.knowledge_sources[0]?.title}</strong></div>
                          <div><span>用户数据</span><strong>{ticket.ai_processing.user_data_sources[0]?.fields.join("、")}</strong></div>
                          <div><span>Prompt版本</span><strong>{ticket.audit.prompt_version}</strong></div>
                        </div>
                        {transferred && <div className="routing-note">转派原因：{ticket.workflow.routing_reason}。{isCaseTwo ? "原活动资格判断仍为不符合；争议补偿由一线人工审核，AI未自动执行补发。" : "原分类、子类型和风险等级保持不变，没有自动增加补发或投诉诉求。"}</div>}
                      </div>
                    </div>
                  )}
                </div>
              </div>}

              {serviceView === "list" && (
                <div className="ticket-list-page response-enter" aria-label="工单列表页">
                  <header className="page-section-heading">
                    <div><small>WORK ORDER POOL</small><h3>工单列表</h3><p>共1条工单，点击可查看完整处理记录。</p></div>
                    <div className="list-filters"><button className="active" type="button">全部</button><button type="button">处理中</button><button type="button">已完结</button></div>
                  </header>
                  <div className="ticket-table" role="table" aria-label="工单列表">
                    <div className="ticket-table-row ticket-table-header" role="row">
                      <span>工单编号</span><span>用户诉求</span><span>问题类型</span><span>当前状态</span><span>操作</span>
                    </div>
                    <div className="ticket-table-row" role="row">
                      <strong>{ticket.ticket_id}</strong>
                      <span className="ticket-summary-cell">{ticket.issue.summary}</span>
                      <span>{categoryLabels[ticket.issue.handling_category]}</span>
                      <strong className={`status-pill status-${ticket.workflow.ticket_status}`} data-testid="ticket-status">● {statusLabels[ticket.workflow.ticket_status]}</strong>
                      <button className="table-action" type="button" onClick={openTicket}>查看工单详情</button>
                    </div>
                  </div>
                </div>
              )}

              {serviceView === "detail" && (
                <div className="ticket-detail-page response-enter" aria-label="工单详情页">
                  <button className="back-to-list" type="button" onClick={backToList}>← 返回工单列表</button>
                  <header className="page-section-heading detail-page-heading">
                    <div><small>WORK ORDER DETAIL</small><h3>工单处理详情</h3></div>
                    <strong className={`status-pill status-${ticket.workflow.ticket_status}`} data-testid="ticket-status">● {statusLabels[ticket.workflow.ticket_status]}</strong>
                  </header>

                  <div className="ticket-meta-compact" aria-label="工单基础信息">
                    <span>工单 <strong>{ticket.ticket_id}</strong></span>
                    <span>UID <strong data-testid="customer-uid">{ticket.customer.user_uid}</strong></span>
                    <span>{channelLabels[ticket.channel]}</span>
                    <span>创建 {formatDate(ticket.created_at)}</span>
                    <span>更新 {formatDate(ticket.updated_at)}</span>
                    <span>处理方 {ownerLabels[ticket.workflow.current_owner]}</span>
                  </div>

                  <div className="summary-recording-grid">
                    <section className="summary-card" aria-label="AI生成的用户诉求摘要">
                      <div className="feature-card-label"><span className="ai-mark">AI</span> AI生成的用户诉求摘要</div>
                      <p>{ticket.issue.summary}</p>
                    </section>
                    <section className="recording-card" aria-label="原始录音与转写">
                      <div className="feature-card-label">原始录音与转写 <span>录音示意</span></div>
                      <MockRecordingPlayer />
                      <details className="transcript-details">
                        <summary>查看语音转写全文</summary>
                        <p style={{ whiteSpace: "pre-line" }}>{ticket.issue.original_message}</p>
                      </details>
                    </section>
                  </div>

                  <div className="detail-grid detail-page-grid">
                    <div className="system-card full-card ai-processing-card">
                      <div className="card-heading"><h4>AI处理信息</h4><span>来源可追溯</span></div>
                      <div className="ai-status-line">
                        <div><span>检索结果</span><strong>{evidenceLabels[ticket.ai_processing.evidence_status]}</strong></div>
                        <div><span>信息缺口</span><strong>{ticket.ai_processing.missing_information.length ? ticket.ai_processing.missing_information.join("、") : "无"}</strong></div>
                      </div>
                      <div className="record-item ai-reply"><span>AI回复</span><p>{ticket.ai_processing.reply ?? "暂无"}</p></div>
                      <div className="evidence-grid">
                        <div><span>知识来源</span>{ticket.ai_processing.knowledge_sources.map((source) => <p key={source.document_id}><strong>{source.document_id} · {source.title}</strong><small>“{source.quote ?? "无引用片段"}”</small></p>)}</div>
                        <div><span>用户数据来源</span>{ticket.ai_processing.user_data_sources.map((source) => <p key={`${source.source}-${source.queried_at}`}><strong>{source.source}</strong><small>{source.fields.join("、")}</small></p>)}</div>
                      </div>
                    </div>
                    {isCaseThree && <Tier2OperationPanel ticket={ticket} refundDone={refundDone} reportDone={reportDone} departmentProcessing={departmentProcessing} completeRefund={completeRefund} registerReport={registerReport} transferDepartment={transferDepartment} />}
                    {isCaseTwo && hasFollowUp && <Tier1OperationPanel ticket={ticket} reissueDone={reissueDone} departmentDone={departmentDone} completeReissue={completeReissue} notifyDepartment={notifyDepartment} />}
                    <div className="system-card">
                      <div className="card-heading"><h4>用户基本信息</h4><span>实时查询</span></div>
                      <div className="fact-row"><span>身份校验状态</span><strong>{ticket.customer.identity_status === "verified" ? "已验证" : ticket.customer.identity_status === "unverified" ? "未验证" : "无需验证"}</strong></div>
                      <div className="fact-row"><span>会员状态</span><strong>{ticket.customer.membership_status === "active" ? "有效" : ticket.customer.membership_status ?? "暂无"}</strong></div>
                      <div className="fact-row"><span>自动续订状态</span><strong>{ticket.customer.auto_renewal_status === "cancelled" ? "已取消" : ticket.customer.auto_renewal_status ?? "暂无"}</strong></div>
                      <div className="fact-row"><span>权益到期时间</span><strong>{formatDate(ticket.customer.entitlement_expires_at)}</strong></div>
                    </div>
                    <div className="system-card">
                      <div className="card-heading"><h4>问题识别信息</h4><span>AI结构化输出</span></div>
                      <div className="fact-row"><span>风险与处理类型</span><strong data-testid="handling-category">{categoryLabels[ticket.issue.handling_category]}</strong></div>
                      <div className="fact-row"><span>问题子类型</span><strong>{ticket.issue.subtypes.map((item) => subtypeLabels[item] ?? item).join("、")}</strong></div>
                      <div className="fact-row"><span>风险等级</span><strong data-testid="risk-level">{ticket.issue.risk_level === "low" ? "低" : "高"}</strong></div>
                      <div className="fact-row"><span>分类置信状态</span><strong>{ticket.issue.classification_confidence === "high" ? "高" : "低"}</strong></div>
                      <div className="fact-row stacked-row"><span>风险判断理由</span><strong>{ticket.issue.risk_reason}</strong></div>
                    </div>
                    <div className="system-card full-card result-audit-card">
                      <div className="card-heading"><h4>处理结果与审计</h4><span>结果留痕</span></div>
                      <div className="detail-facts-grid result-audit-grid">
                        <MetaItem label="操作结果" value={ticket.resolution.action_result ?? (transferred ? isCaseThree ? "等待二线客服处理" : "等待一线客服处理" : "暂无")} />
                        <MetaItem label="完结摘要" value={ticket.resolution.summary ?? "尚未完结"} />
                        <MetaItem label="完结方式" value={ticket.resolution.closed_by ? closedByLabels[ticket.resolution.closed_by] : "尚未完结"} />
                        <MetaItem label="完结时间" value={formatDate(ticket.resolution.closed_at)} />
                        <MetaItem label="Prompt版本" value={ticket.audit.prompt_version} />
                        <MetaItem label="知识库版本" value={ticket.audit.knowledge_base_version ?? "暂无"} />
                        <MetaItem label="人工修改AI内容" value={ticket.audit.human_edit_record ?? "无"} />
                      </div>
                      {closed && <div className="resolution-note">{isCaseThree ? "二线客服已完成退款核验、模拟退款和举报登记，工单完结归档。" : isCaseTwo ? "一线客服已完成人工审核、模拟补发和部门通知，工单完结归档。" : "用户明确确认已解决，工单由AI路径自动完结。"}</div>}
                    </div>
                    <div className="system-card full-card">
                      <div className="card-heading"><h4>流转信息</h4><span>当前状态与完整轨迹</span></div>
                      <div className="detail-facts-grid workflow-facts">
                        <MetaItem label="当前处理状态" value={statusLabels[ticket.workflow.ticket_status]} />
                        <MetaItem label="当前处理方" value={ownerLabels[ticket.workflow.current_owner]} />
                        <MetaItem label="转派对象" value={ticket.workflow.assigned_to ?? "不涉及"} />
                        <MetaItem label="转派原因" value={ticket.workflow.routing_reason ?? "不涉及"} />
                        <MetaItem label="用户确认结果" value={confirmationLabels[ticket.workflow.user_resolution_confirmation]} />
                        <MetaItem label="相关部门及通知" value={`${ticket.workflow.related_department ?? "不涉及"} · ${departmentStatusLabels[ticket.workflow.department_notification_status]}`} />
                      </div>
                      <ol className="workflow-timeline" aria-label="工单流转轨迹">
                        {timeline.map((event) => <li key={event.id}><i /><div><strong>{event.label}</strong><span>{event.actor} · {formatDate(event.occurredAt)}</span></div></li>)}
                      </ol>
                      {transferred && <div className="routing-note">{isCaseThree ? "退款与举报同时命中高风险路径，系统直接派给二线；AI仅整理依据和待核实事项，不承诺退款或判断举报成立。" : isCaseTwo ? "用户明确追加补发与投诉后，AI才更新为低风险其他类并派给一线；原活动资格仍为不符合，补发由人工审核。" : "原分类、子类型和风险等级保持不变，没有自动增加补发或投诉诉求。"}</div>}
                    </div>
                  </div>
                </div>
              )}
              {serviceView === "detail" && isCaseTwo && hasFollowUp && <div className="floating-close-wrap"><button type="button" className="floating-close-action" onClick={closeTier1} disabled={!reissueDone || !departmentDone || closed}>{closed ? "✓ 已完结并归档" : "完结并归档"}</button></div>}
              {serviceView === "detail" && isCaseThree && <div className="floating-close-wrap"><button type="button" className="floating-close-action tier2-close-action" onClick={closeTier2} disabled={!refundDone || !reportDone || departmentProcessing || closed}>{closed ? "✓ 已完结并归档" : departmentProcessing ? "等待支付／风控部门处理" : "二线完结并归档"}</button></div>}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function MetaItem({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return <div className="meta-item"><span>{label}</span><strong data-testid={testId}>{value}</strong></div>;
}

function Tier2OperationPanel({ ticket, refundDone, reportDone, departmentProcessing, completeRefund, registerReport, transferDepartment }: { ticket: Ticket; refundDone: boolean; reportDone: boolean; departmentProcessing: boolean; completeRefund: () => void; registerReport: () => void; transferDepartment: () => void }) {
  const locked = departmentProcessing || ticket.workflow.ticket_status === "closed";
  return <div className="system-card full-card operation-panel tier2-operation-panel" aria-label="二线处理操作">
    <div className="card-heading"><h4>二线处理操作</h4><span>授权人工核验后模拟执行</span></div>
    <div className="high-risk-note"><strong>高风险：退款＋举报</strong><span>涉及资金退回和举报诉求；AI不得承诺退款，也不得判断举报成立。</span></div>
    <div className="operation-checklist tier2-checklist">
      <div><span>✓</span><p><strong>身份已验证</strong><small>{ticket.customer.user_uid}</small></p></div>
      <div><span>✓</span><p><strong>取消续订时间</strong><small>{formatDate(caseThreeFacts.cancellationAt)}</small></p></div>
      <div><span>!</span><p><strong>扣费记录待核验</strong><small>{formatDate(caseThreeFacts.chargedAt)} · {caseThreeFacts.amount}</small></p></div>
      <div><span>!</span><p><strong>支付交易</strong><small>{caseThreeFacts.transactionId}</small></p></div>
    </div>
    <div className="ai-suggestion tier2-suggestion"><strong>AI核查建议</strong><p>请二线客服核对取消时间是否早于扣费周期、支付渠道状态与退款权限；举报仅登记和核查，不预判成立。</p></div>
    <div className="operation-actions">
      <button type="button" className="button tier2-primary" onClick={completeRefund} disabled={refundDone || locked}>{refundDone ? "已退费30元" : "退费30元"}</button>
      <button type="button" className="button" onClick={registerReport} disabled={reportDone || locked}>{reportDone ? "已登记举报诉求" : "登记举报诉求"}</button>
      <button type="button" className="button department-transfer" onClick={transferDepartment} disabled={locked}>转支付／风控部门</button>
    </div>
    <div className="operation-audit"><strong>操作人：二线客服 · tier2-demo-01</strong><span>{departmentProcessing ? "已转支付与风控部门，等待继续核查" : `${refundDone ? "退款操作已留痕" : "等待退款核验"}；${reportDone ? "举报诉求已登记" : "等待举报登记"}`}</span></div>
  </div>;
}

function Tier1OperationPanel({ ticket, reissueDone, departmentDone, completeReissue, notifyDepartment }: { ticket: Ticket; reissueDone: boolean; departmentDone: boolean; completeReissue: () => void; notifyDepartment: () => void }) {
  return <div className="system-card full-card operation-panel" aria-label="一线处理操作">
    <div className="card-heading"><h4>一线处理操作</h4><span>人工确认后模拟执行</span></div>
    <div className="eligibility-note"><strong>原活动资格：不符合</strong><span>普通月卡不属于连续包月产品；此结论不会因争议补偿而改变。</span></div>
    <div className="operation-checklist">
      <div><span>✓</span><p><strong>身份已验证</strong><small>{ticket.customer.user_uid}</small></p></div>
      <div><span>✓</span><p><strong>普通月卡已支付</strong><small>原活动资格不符合</small></p></div>
      <div><span>✓</span><p><strong>优惠券未生成</strong><small>不存在重复补发记录</small></p></div>
      <div><span>✓</span><p><strong>用户明确提出争议</strong><small>投诉资格提示不清</small></p></div>
    </div>
    <div className="ai-suggestion"><strong>AI建议</strong><p>请一线客服根据活动规则人工核验一次性非现金争议补偿条件。AI仅提供依据、摘要和操作指引，不自动补发或通知部门。</p></div>
    <div className="operation-actions">
      <button type="button" className="button primary" onClick={completeReissue} disabled={reissueDone}>{reissueDone ? "已补发优惠券" : "补发优惠券"}</button>
      <button type="button" className="button" onClick={notifyDepartment} disabled={departmentDone}>{departmentDone ? "已通知活动策划部" : "通知活动策划部"}</button>
    </div>
    <div className="operation-audit"><strong>操作人：一线客服 · agent-demo-01</strong><span>{reissueDone ? "争议补偿审核与模拟补发已留痕" : "等待补发操作"}；{departmentDone ? "部门通知已发送" : "等待部门通知"}</span></div>
  </div>;
}

function MockRecordingPlayer() {
  const duration = 18;
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setElapsed((value) => {
        if (value >= duration - 1) {
          setPlaying(false);
          return duration;
        }
        return value + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playing]);

  const toggle = () => {
    if (elapsed >= duration) setElapsed(0);
    setPlaying((value) => !value);
  };

  return (
    <div className={`mock-player ${playing ? "is-playing" : ""}`}>
      <button type="button" aria-label={playing ? "暂停模拟录音" : "播放模拟录音"} onClick={toggle}>{playing ? "Ⅱ" : "▶"}</button>
      <div className="waveform" aria-hidden="true">{Array.from({ length: 22 }, (_, index) => <i key={index} style={{ height: `${7 + ((index * 7) % 18)}px` }} />)}</div>
      <span>{`00:${String(elapsed).padStart(2, "0")} / 00:18`}</span>
      <div className="recording-progress" role="progressbar" aria-label="模拟录音播放进度" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={elapsed}><i style={{ width: `${(elapsed / duration) * 100}%` }} /></div>
    </div>
  );
}

function VoiceTranscriptIcon() {
  return (
    <svg className="voice-transcript-icon" viewBox="0 0 48 48" role="img" aria-label="语音转录示意">
      <title>语音转录示意</title>
      <circle cx="18" cy="15" r="7" />
      <path d="M7 37c1.6-7.2 5.2-11 11-11s9.4 3.8 11 11" />
      <path d="M31 17c3 2 3 8 0 10M36 13c6 5 6 14 0 19M41 9c8 8 8 20 0 28" />
    </svg>
  );
}

function PhoneIcon() {
  return <svg className="phone-call-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 3.8 9.8 8l-2 1.8c1.1 2.4 3 4.3 5.4 5.4l1.8-2 4.2 2.6-.8 3c-.3 1-1.2 1.7-2.2 1.6C9.5 19.8 4.2 14.5 3.6 7.8c-.1-1 .6-1.9 1.6-2.2l2-.8Z" /></svg>;
}
