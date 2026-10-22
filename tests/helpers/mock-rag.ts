import { mockAiProvider } from "@/ai/mock-ai-provider";
import { caseOneInput } from "@/data/demos/case-one";
import { caseTwoFollowUpInput, caseTwoInput } from "@/data/demos/case-two";
import { caseThreeInput } from "@/data/demos/case-three";
import { prepareRagAnalyses, prepareRagAnalysis } from "@/rag/demo-rag-pipeline";
import type { AiAnalysisInput } from "@/ai/types";

const offlineEnv = { NODE_ENV: "test", RAG_ALLOW_LEXICAL_FALLBACK: "true" } as NodeJS.ProcessEnv;

export async function prepareOfflineRag(input: AiAnalysisInput) {
  return prepareRagAnalysis(input, offlineEnv);
}

export async function mockCandidateFor(input: AiAnalysisInput) {
  const prepared = await prepareOfflineRag(input);
  return { candidate: await mockAiProvider.analyze(prepared.input), trace: prepared.trace, input: prepared.input };
}

export async function mockDemoData() {
  const [caseOne, caseTwo, caseThree, caseTwoFollowUpPrepared] = await prepareRagAnalyses(
    [caseOneInput, caseTwoInput, caseThreeInput, caseTwoFollowUpInput],
    offlineEnv,
  );
  return {
    caseOne: { ...caseOne, candidate: await mockAiProvider.analyze(caseOne.input) },
    caseTwo: { ...caseTwo, candidate: await mockAiProvider.analyze(caseTwo.input) },
    caseThree: { ...caseThree, candidate: await mockAiProvider.analyze(caseThree.input) },
    caseTwoFollowUp: { ...caseTwoFollowUpPrepared, candidate: await mockAiProvider.analyze(caseTwoFollowUpPrepared.input) },
  };
}
