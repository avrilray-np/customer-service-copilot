import { NextResponse } from "next/server";
import { createProviderSelection } from "@/ai/provider-factory";
import { publicAiProviderErrorMessage } from "@/ai/ai-provider-error";
import { caseOneInput } from "@/data/demos/case-one";
import { caseTwoFollowUp, caseTwoInput } from "@/data/demos/case-two";
import { caseThreeInput } from "@/data/demos/case-three";
import { assertAiCandidate } from "@/validation/ai-candidate-validator";

export const runtime = "nodejs";

const demoInputs = {
  "case-one": caseOneInput,
  "case-two": caseTwoInput,
  "case-three": caseThreeInput,
  "case-two-follow-up": {
    ...caseTwoInput,
    message: `${caseTwoInput.message}\n用户追加诉求：${caseTwoFollowUp}`,
  },
} as const;

type DemoAnalysisRequest = keyof typeof demoInputs;

function isDemoAnalysisRequest(value: unknown): value is DemoAnalysisRequest {
  return typeof value === "string" && value in demoInputs;
}

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
    !isDemoAnalysisRequest((body as { demoCase?: unknown }).demoCase)
  ) {
    return NextResponse.json({ error: "当前接口只接受已定义的演示案例。" }, { status: 400 });
  }

  const demoCase = (body as { demoCase: DemoAnalysisRequest }).demoCase;
  try {
    const selection = createProviderSelection();
    if (selection.mode === "mock") {
      return NextResponse.json({ error: "服务器尚未配置真实AI，当前只能使用Mock Mode。" }, { status: 503 });
    }
    const candidate = await selection.provider.analyze(demoInputs[demoCase]);
    assertAiCandidate(candidate);
    return NextResponse.json({ candidate, mode: selection.mode, model: selection.model });
  } catch (error) {
    const requestedMode = process.env.AI_MODE?.trim().toLowerCase();
    const providerName = requestedMode === "deepseek" ? "DeepSeek" : requestedMode === "gemini" ? "Gemini" : "AI";
    return NextResponse.json({ error: publicAiProviderErrorMessage(error, providerName) }, { status: 502 });
  }
}
