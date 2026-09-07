import Ajv2020 from "ajv/dist/2020";
import type { AiAnalysisCandidate } from "@/ai/types";
import schema from "./ai-candidate.schema.json";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile<AiAnalysisCandidate>(schema);

export function isAiCandidate(value: unknown): value is AiAnalysisCandidate {
  return validate(value);
}

export function assertAiCandidate(value: unknown): asserts value is AiAnalysisCandidate {
  if (!validate(value)) {
    const details = validate.errors?.map((error) => `${error.instancePath || "/"} ${error.message}`).join("; ");
    throw new Error(`AI结构化输出校验失败：${details ?? "未知错误"}`);
  }
}
