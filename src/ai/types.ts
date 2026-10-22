import type {
  ClassificationConfidence,
  EvidenceStatus,
  HandlingCategory,
  KnowledgeSource,
  RiskLevel,
  UserDataSource,
} from "@/domain/ticket/types";
import type { KnowledgeAudience, RetrievalStatus } from "@/rag/types";

export interface RetrievedKnowledgeSource extends KnowledgeSource {
  chunk_id: string;
}

export interface AiAnalysisInput {
  message: string;
  identity_status: "verified" | "unverified" | "not_required";
  user_facts: Record<string, string | number | boolean | null>;
  knowledge_sources: RetrievedKnowledgeSource[];
  user_data_sources: UserDataSource[];
  retrieval_status?: RetrievalStatus;
  knowledge_base_version?: string;
  retrieval_context?: {
    query_time: string;
    audience: KnowledgeAudience;
    known_product_type: string | null;
    query_hint?: string;
  };
}

export type AiMode = "mock" | "gemini" | "deepseek";

export interface AiRuntimeInfo {
  requestedMode: AiMode;
  activeMode: AiMode;
  model: string | null;
  warning: string | null;
}

export interface AiAnalysisCandidate {
  summary: string;
  handling_category: HandlingCategory;
  subtypes: string[];
  risk_level: RiskLevel;
  risk_reason: string;
  classification_confidence: ClassificationConfidence;
  reply: string;
  evidence_status: EvidenceStatus;
  recommended_action: "reply" | "ask_clarification" | "assign_tier1" | "assign_tier2" | "notify_department";
  knowledge_sources: KnowledgeSource[];
  user_data_sources: UserDataSource[];
  missing_information: string[];
}
