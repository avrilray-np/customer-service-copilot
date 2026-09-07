import type { AiAnalysisCandidate, AiAnalysisInput } from "@/ai/types";
import { AiProviderError } from "@/ai/ai-provider-error";

const prohibitedOperationClaimPatterns = [
  /(?:已|已经)(?:成功)?(?:为|替)?(?:您|你)?(?:办理|完成|执行|操作)?(?:了)?\s*(?:退款|退费|补发|退订|取消订阅|取消自动续订|封禁)/u,
  /(?:退款|退费|款项|费用|\d+(?:\.\d+)?元).{0,10}(?:已)?(?:成功|完成|到账|退回)/u,
  /(?:优惠券|权益).{0,10}(?:(?:已|已经)(?:成功|完成)?(?:补发|发放|到账)|(?:补发|发放)(?:成功|完成|到账))/u,
  /(?:退款|退费|补发|退订|封禁)(?:操作|处理)?.{0,8}(?:已)?(?:成功|完成|生效|处理完毕)/u,
];

function containsProtectedOperationClaim(reply: string) {
  // Negated status descriptions are facts or unresolved states, not claims that an
  // operation succeeded. Remove them before checking positive completion wording.
  const withoutNegatedStatuses = reply
    .replace(/(?:尚未|还未|并未|未|没有|还没|还没有)(?:被|进行|完成|成功)?\s*(?:退款|退费|补发|发放|退订|取消订阅|取消自动续订|封禁|到账|退回|完成|生效)/gu, "[否定状态]")
    .replace(/(?:退款|退费|补发|发放|退订|取消订阅|取消自动续订|封禁).{0,4}(?:尚未|还未|并未|未|没有|还没|还没有)(?:完成|成功|生效|到账|退回)/gu, "[否定状态]");
  return prohibitedOperationClaimPatterns.some((pattern) => pattern.test(withoutNegatedStatuses));
}

function withSubtype(subtypes: string[], subtype: string) {
  return subtypes.includes(subtype) ? subtypes : [...subtypes, subtype];
}

function withoutSubtypes(subtypes: string[], disallowed: string[]) {
  return subtypes.filter((subtype) => !disallowed.includes(subtype));
}

export function applyBusinessRules(candidate: AiAnalysisCandidate, input: AiAnalysisInput): AiAnalysisCandidate {
  if (containsProtectedOperationClaim(candidate.reply)) {
    throw new AiProviderError("policy_violation", "AI回复包含未经人工确认的操作结果，已拒绝应用。");
  }

  const message = input.message;
  const suspiciousCharge = /(?:不认识|非本人|未经本人).{0,10}(?:扣费|扣款)/u.test(message);
  const identityMisuseCharge = /冒用.{0,8}身份.{0,12}(?:扣费|扣款)/u.test(message);
  const asksRefund =
    /(?:退款|退费|退回.{0,6}(?:钱|款)|(?:会员费|钱|款).{0,8}退(?:回|给)|我要退(?!订|掉)|不退(?:我|款|钱)|赔偿)/u.test(message) ||
    suspiciousCharge ||
    identityMisuseCharge;
  const reports = /举报/u.test(message);
  const accountSecurity =
    /(?:账号|账户).{0,12}(?:被盗|异常|冻结|安全|(?:别人|他人|陌生人).{0,4}登录)/u.test(message) ||
    /冒用.{0,8}身份/u.test(message) ||
    suspiciousCharge;
  const legalOrSafety = /(人身安全|生命安全|报警|起诉|律师|违法)/u.test(message);
  const queriesUnsubscribeStatus =
    /(?:有没有|是否|看看).{0,12}取消(?:订阅|自动续订|续订).{0,6}(?:成功|生效)?|取消(?:自动)?续订(?:成功|生效|后|了)|取消后.{0,12}扣费/u.test(message);
  const explicitUnsubscribeAfterQuery = /(?:直接|帮我|请).{0,6}退掉/u.test(message);
  const asksUnsubscribe =
    explicitUnsubscribeAfterQuery ||
    (!queriesUnsubscribeStatus &&
      /((帮我|请|要求|我要|想要|需要|马上|立即).{0,8}(退订|取消订阅|取消自动续订)|(怎么|如何).{0,5}(退订|取消订阅|取消自动续订)|关闭.{0,6}(连续包月|自动续订|自动续费)|取消.{0,8}(下个月|下月|下一期)?.{0,4}(续费|续订))/u.test(message));
  const queriesReissueStatus =
    /(?:上次|之前|已经|申请).{0,14}补发.{0,12}(?:处理|完成|成功|到账)?(?:了吗|没有|没|如何|怎样)|补发.{0,8}(?:处理|完成|成功|到账)(?:了吗|没有|没)/u.test(message);
  const asksReissue =
    !queriesReissueStatus &&
    /(?:(?:补发|补给|重新发).{0,8}(?:券|优惠券|权益)?|补一张.{0,10}优惠券|补不了)/u.test(message);
  const complains = /(投诉|规则不清|提示不清)/u.test(message);
  const suggests = /(建议|意见)/u.test(message);
  const asksGeneralOperation =
    /(?:改|修改|更换).{0,8}(?:绑定)?手机号/u.test(message) ||
    /(?:不想用了|不需要了).{0,8}(?:处理一下|帮我处理)/u.test(message);
  const requiredEvidencePresent =
    input.knowledge_sources.length > 0 &&
    (input.identity_status === "not_required" ||
      (input.identity_status === "verified" && input.user_data_sources.length > 0));

  let next: AiAnalysisCandidate = {
    ...candidate,
    subtypes: withoutSubtypes(candidate.subtypes, ["refund", "report", "account_security", "legal_or_safety", "unsubscribe", "reissue", "complaint", "suggestion", "general_operation"]),
  };

  if (asksRefund) next = { ...next, subtypes: withSubtype(next.subtypes, "refund") };
  if (reports) next = { ...next, subtypes: withSubtype(next.subtypes, "report") };
  if (accountSecurity) next = { ...next, subtypes: withSubtype(next.subtypes, "account_security") };
  if (legalOrSafety) next = { ...next, subtypes: withSubtype(next.subtypes, "legal_or_safety") };
  if (asksUnsubscribe) next = { ...next, subtypes: withSubtype(next.subtypes, "unsubscribe") };
  if (asksReissue) next = { ...next, subtypes: withSubtype(next.subtypes, "reissue") };
  if (complains) next = { ...next, subtypes: withSubtype(next.subtypes, "complaint") };
  if (suggests) next = { ...next, subtypes: withSubtype(next.subtypes, "suggestion") };
  if (asksGeneralOperation) next = { ...next, subtypes: withSubtype(next.subtypes, "general_operation") };

  const isHighRisk = asksRefund || reports || accountSecurity || legalOrSafety;
  const isLowRiskOther = asksUnsubscribe || asksReissue || complains || suggests || asksGeneralOperation;

  if (isHighRisk) {
    return {
      ...next,
      handling_category: "high_risk",
      risk_level: "high",
      recommended_action: "assign_tier2",
    };
  }

  if (isLowRiskOther) {
    return {
      ...next,
      handling_category: "low_risk_other",
      risk_level: "low",
      recommended_action: "assign_tier1",
    };
  }

  if (!requiredEvidencePresent || next.classification_confidence === "low" || next.evidence_status !== "sufficient") {
    return {
      ...next,
      handling_category: "low_risk_info",
      risk_level: "low",
      evidence_status: requiredEvidencePresent ? next.evidence_status : "insufficient",
      recommended_action: "assign_tier1",
    };
  }

  return { ...next, handling_category: "low_risk_info", risk_level: "low", recommended_action: "reply" };
}
