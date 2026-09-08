import { DemoApp } from "@/components/demo-app";
import { requestedAiMode } from "@/ai/provider-factory";
import { mockAiProvider } from "@/ai/mock-ai-provider";
import { caseOneInput } from "@/data/demos/case-one";
import { caseTwoInput } from "@/data/demos/case-two";
import { caseThreeInput } from "@/data/demos/case-three";
import { createCaseThreeTicket, createCaseTwoWaitingTicket, createWaitingTicket } from "@/domain/ticket/create-ticket";
import { isTicket, ticketValidationErrors } from "@/validation/ticket-validator";

export default async function HomePage() {
  const [candidate, caseTwoCandidate, caseThreeCandidate] = await Promise.all([
    mockAiProvider.analyze(caseOneInput),
    mockAiProvider.analyze(caseTwoInput),
    mockAiProvider.analyze(caseThreeInput),
  ]);
  const initialTicket = createWaitingTicket(candidate);
  const caseTwoTicket = createCaseTwoWaitingTicket(caseTwoCandidate);
  const caseThreeTicket = createCaseThreeTicket(caseThreeCandidate);
  if (!isTicket(initialTicket) || !isTicket(caseTwoTicket) || !isTicket(caseThreeTicket)) {
    throw new Error(`工单数据校验失败：${JSON.stringify(ticketValidationErrors())}`);
  }

  const requestedMode = requestedAiMode();
  return (
    <DemoApp
      initialTicket={initialTicket}
      caseTwoTicket={caseTwoTicket}
      caseThreeTicket={caseThreeTicket}
      aiRuntime={{ requestedMode, activeMode: "mock", model: null, warning: null }}
    />
  );
}
