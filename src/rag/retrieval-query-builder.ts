import type { AiAnalysisInput } from "@/ai/types";
import type { RetrievalQuery } from "./types";

function currentUserTurn(message: string) {
  const marker = "用户追加诉求：";
  const markerIndex = message.lastIndexOf(marker);
  if (markerIndex < 0) return message;
  return message.slice(markerIndex + marker.length).trim() || message;
}

export function buildRetrievalQuery(input: AiAnalysisInput): RetrievalQuery {
  if (!input.retrieval_context) throw new Error("演示输入缺少检索上下文");
  const currentTurn = currentUserTurn(input.message);
  const queryHint = input.retrieval_context.query_hint?.trim();
  return {
    text: queryHint ? `${currentTurn} ${queryHint}` : currentTurn,
    query_time: input.retrieval_context.query_time,
    audience: input.retrieval_context.audience,
    known_product_type: input.retrieval_context.known_product_type,
    language: "zh-CN",
  };
}
