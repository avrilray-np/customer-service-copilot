import { NextResponse } from "next/server";
import { createProviderSelection } from "@/ai/provider-factory";
import { publicAiProviderErrorMessage } from "@/ai/ai-provider-error";
import { caseTwoEscalatedCandidate, caseTwoFollowUp, caseTwoInput } from "@/data/demos/case-two";
import { assertAiCandidate } from "@/validation/ai-candidate-validator";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求内容必须是JSON。" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    (body as { demoCase?: unknown }).demoCase !== "case-two-follow-up"
  ) {
    return NextResponse.json({ error: "当前接口只接受已定义的案例二追加诉求。" }, { status: 400 });
  }

  try {
    const selection = createProviderSelection();
    const candidate = selection.mode === "mock"
      ? caseTwoEscalatedCandidate
      : await selection.provider.analyze({
          ...caseTwoInput,
          message: `${caseTwoInput.message}\n用户追加诉求：${caseTwoFollowUp}`,
        });
    assertAiCandidate(candidate);
    return NextResponse.json({ candidate, mode: selection.mode, model: selection.model });
  } catch (error) {
    const requestedMode = process.env.AI_MODE?.trim().toLowerCase();
    const providerName = requestedMode === "deepseek" ? "DeepSeek" : requestedMode === "gemini" ? "Gemini" : "AI";
    return NextResponse.json({ error: publicAiProviderErrorMessage(error, providerName) }, { status: 502 });
  }
}
