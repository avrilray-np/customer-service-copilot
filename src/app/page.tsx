import { DemoApp } from "@/components/demo-app";
import type { AiProvider } from "@/ai/ai-provider";
import type { AiRuntimeInfo } from "@/ai/types";
import { publicAiProviderErrorMessage } from "@/ai/ai-provider-error";
import { createProviderSelection, requestedAiMode } from "@/ai/provider-factory";
import { mockAiProvider } from "@/ai/mock-ai-provider";
import { caseOneInput } from "@/data/demos/case-one";
import { caseTwoInput } from "@/data/demos/case-two";
import { caseThreeInput } from "@/data/demos/case-three";
import { assertAiCandidate } from "@/validation/ai-candidate-validator";
import { createCaseThreeTicket, createCaseTwoWaitingTicket, createWaitingTicket } from "@/domain/ticket/create-ticket";
import { isTicket, ticketValidationErrors } from "@/validation/ticket-validator";

export const dynamic = "force-dynamic";

async function analyzeDemoCases(provider: AiProvider) {
  return Promise.all([
    provider.analyze(caseOneInput),
    provider.analyze(caseTwoInput),
    provider.analyze(caseThreeInput),
  ]);
}

export default async function HomePage() {
  const requestedMode = requestedAiMode();
  let activeMode: AiRuntimeInfo["activeMode"] = requestedMode;
  let model: string | null = null;
  let warning: string | null = null;
  let candidates;

  try {
    const selection = createProviderSelection();
    model = selection.model;
    candidates = await analyzeDemoCases(selection.provider);
  } catch (error) {
    if (requestedMode === "mock") throw error;
    candidates = await analyzeDemoCases(mockAiProvider);
    activeMode = "mock";
    const providerName = requestedMode === "deepseek" ? "DeepSeek" : "Gemini";
    warning = `${publicAiProviderErrorMessage(error, providerName)} 当前页面已明确切换为Mock演示数据。`;
  }

  const [candidate, caseTwoCandidate, caseThreeCandidate] = candidates;
  assertAiCandidate(candidate);
  assertAiCandidate(caseTwoCandidate);
  assertAiCandidate(caseThreeCandidate);
  const promptVersion = activeMode === "deepseek"
    ? "customer-service-deepseek-v1.0"
    : activeMode === "gemini"
      ? "customer-service-gemini-v1.0"
      : "customer-service-v1.0";
  const initialTicket = createWaitingTicket(candidate, { promptVersion });
  const caseTwoTicket = createCaseTwoWaitingTicket(caseTwoCandidate, { promptVersion });
  const caseThreeTicket = createCaseThreeTicket(caseThreeCandidate, { promptVersion });
  if (!isTicket(initialTicket) || !isTicket(caseTwoTicket) || !isTicket(caseThreeTicket)) {
    throw new Error(`工单数据校验失败：${JSON.stringify(ticketValidationErrors())}`);
  }

  return (
    <DemoApp
      initialTicket={initialTicket}
      caseTwoTicket={caseTwoTicket}
      caseThreeTicket={caseThreeTicket}
      aiRuntime={{ requestedMode, activeMode, model: activeMode === "mock" ? null : model, warning }}
    />
  );
}
