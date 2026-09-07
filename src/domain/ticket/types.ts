export type HandlingCategory = "low_risk_info" | "low_risk_other" | "high_risk";
export type RiskLevel = "low" | "high";
export type ClassificationConfidence = "high" | "low";
export type EvidenceStatus = "sufficient" | "insufficient" | "conflicting";
export type TicketStatus =
  | "ai_processing"
  | "waiting_user_confirmation"
  | "human_processing"
  | "tier2_processing"
  | "department_notified"
  | "department_processing"
  | "closed";

export interface KnowledgeSource {
  document_id: string;
  title: string;
  section: string;
  version: string;
  quote?: string | null;
}

export interface UserDataSource {
  source: string;
  fields: string[];
  queried_at: string;
}

export interface Ticket {
  schema_version: "0.1";
  ticket_id: string;
  created_at: string;
  updated_at?: string;
  channel: "text" | "voice_transcript";
  customer: {
    user_uid: string;
    identity_status: "verified" | "unverified" | "not_required";
    membership_status: "active" | "expired" | "suspended" | "none" | null;
    auto_renewal_status: "active" | "cancelled" | "cancelling" | "not_applicable" | null;
    entitlement_expires_at: string | null;
  };
  issue: {
    original_message: string;
    summary: string;
    handling_category: HandlingCategory;
    subtypes: string[];
    risk_level: RiskLevel;
    risk_reason: string;
    classification_confidence: ClassificationConfidence;
  };
  ai_processing: {
    reply: string | null;
    evidence_status: EvidenceStatus;
    recommended_action: "reply" | "ask_clarification" | "assign_tier1" | "assign_tier2" | "notify_department";
    knowledge_sources: KnowledgeSource[];
    user_data_sources: UserDataSource[];
    missing_information: string[];
  };
  workflow: {
    ticket_status: TicketStatus;
    current_owner: "ai" | "tier1" | "tier2" | "department" | "none";
    assigned_to: string | null;
    routing_reason: string | null;
    user_resolution_confirmation: "resolved" | "unresolved" | "pending";
    related_department: string | null;
    department_notification_status: "not_required" | "pending" | "sent" | "failed";
  };
  resolution: {
    action_result: string | null;
    summary: string | null;
    closed_by: "ai_confirmed" | "tier1" | "tier2" | "department" | null;
    closed_at: string | null;
  };
  audit: {
    prompt_version: string;
    knowledge_base_version: string | null;
    human_edit_record: string | null;
  };
}
