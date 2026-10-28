import { DemoApp } from "@/components/demo-app";
import { requestedAiMode } from "@/ai/provider-factory";
import { mockAiProvider } from "@/ai/mock-ai-provider";
import { caseOneInput } from "@/data/demos/case-one";
import { caseTwoFollowUpInput, caseTwoInput } from "@/data/demos/case-two";
import { caseThreeInput } from "@/data/demos/case-three";
import { createCaseThreeTicket, createCaseTwoWaitingTicket, createWaitingTicket } from "@/domain/ticket/create-ticket";
import { isTicket, ticketValidationErrors } from "@/validation/ticket-validator";
import { prepareRagAnalyses } from "@/rag/demo-rag-pipeline";
import type { DemoLocale } from "@/localization/demo-copy";
import { connection } from "next/server";

export async function DemoPage({ locale }: { locale: DemoLocale }) {
  await connection();
  const [caseOnePrepared, caseTwoPrepared, caseThreePrepared, caseTwoFollowUpPrepared] = await prepareRagAnalyses([
    caseOneInput, caseTwoInput, caseThreeInput, caseTwoFollowUpInput,
  ]);
  const [candidate, caseTwoCandidate, caseThreeCandidate, caseTwoFollowUpCandidate] = await Promise.all([
    mockAiProvider.analyze(caseOnePrepared.input),
    mockAiProvider.analyze(caseTwoPrepared.input),
    mockAiProvider.analyze(caseThreePrepared.input),
    mockAiProvider.analyze(caseTwoFollowUpPrepared.input),
  ]);
  const initialTicket = createWaitingTicket(candidate, { knowledgeBaseVersion: caseOnePrepared.trace.knowledge_base_version });
  const caseTwoTicket = createCaseTwoWaitingTicket(caseTwoCandidate, { knowledgeBaseVersion: caseTwoPrepared.trace.knowledge_base_version });
  const caseThreeTicket = createCaseThreeTicket(caseThreeCandidate, { knowledgeBaseVersion: caseThreePrepared.trace.knowledge_base_version });
  if (!isTicket(initialTicket) || !isTicket(caseTwoTicket) || !isTicket(caseThreeTicket)) {
    throw new Error(`工单数据校验失败：${JSON.stringify(ticketValidationErrors())}`);
  }

  const requestedMode = requestedAiMode();
  return (
    <DemoApp
      locale={locale}
      initialTicket={initialTicket}
      caseTwoTicket={caseTwoTicket}
      caseThreeTicket={caseThreeTicket}
      initialRetrievalTraces={{
        "case-one": caseOnePrepared.trace,
        "case-two": caseTwoPrepared.trace,
        "case-three": caseThreePrepared.trace,
      }}
      caseTwoFollowUpCandidate={caseTwoFollowUpCandidate}
      caseTwoFollowUpTrace={caseTwoFollowUpPrepared.trace}
      aiRuntime={{ requestedMode, activeMode: "mock", model: null, warning: null }}
    />
  );
}
