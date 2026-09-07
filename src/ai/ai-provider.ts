import type { AiAnalysisCandidate, AiAnalysisInput } from "./types";

export interface AiProvider {
  analyze(input: AiAnalysisInput): Promise<AiAnalysisCandidate>;
}
