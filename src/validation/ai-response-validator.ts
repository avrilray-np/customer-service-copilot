import Ajv2020 from "ajv/dist/2020";
import schema from "./ai-response.schema.json";

export interface AiStructuredAnalysis {
  summary: string;
  handling_category: "low_risk_info" | "low_risk_other" | "high_risk";
  subtypes: string[];
  risk_level: "low" | "high";
  risk_reason: string;
  classification_confidence: "high" | "low";
  reply: string;
  evidence_status: "sufficient" | "insufficient" | "conflicting";
  recommended_action: "reply" | "ask_clarification" | "assign_tier1" | "assign_tier2" | "notify_department";
  knowledge_source_ids: string[];
  user_data_source_names: string[];
  missing_information: string[];
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile<AiStructuredAnalysis>(schema);

export function assertAiStructuredAnalysis(value: unknown): asserts value is AiStructuredAnalysis {
  if (!validate(value)) {
    const details = validate.errors?.map((error) => `${error.instancePath || "/"} ${error.message}`).join("; ");
    throw new Error(`AI结构化输出校验失败：${details ?? "未知错误"}`);
  }
}
