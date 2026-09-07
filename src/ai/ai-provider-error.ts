export type AiProviderErrorCode = "missing_configuration" | "request_failed" | "empty_response" | "invalid_response" | "policy_violation";

export class AiProviderError extends Error {
  constructor(
    public readonly code: AiProviderErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AiProviderError";
  }
}

export function publicAiProviderErrorMessage(error: unknown, providerName = "AI") {
  if (error instanceof AiProviderError) return error.message;
  return `${providerName}暂时无法完成分析，请重试、转人工或明确切换到Mock模式。`;
}
