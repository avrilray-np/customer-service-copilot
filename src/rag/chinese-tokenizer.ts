const baseTerms = [
  "自动续订", "连续包月", "取消续订", "关闭续费", "下期扣费", "当前权益", "会员权益",
  "会员状态", "到期时间", "身份验证", "消费记录", "扣费记录", "普通月卡", "活动资格",
  "优惠券", "未到账", "补发", "争议补偿", "投诉", "建议", "退款", "退费", "举报",
  "异常扣费", "账户安全", "冒用身份", "人身安全", "法律风险", "人工客服", "处理进度",
  "绑定手机号", "资料修改", "支付渠道", "风控", "非现金权益", "活动规则",
];

function normalize(text: string) {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
}

function chineseNgrams(segment: string) {
  const characters = [...segment];
  const tokens: string[] = [...characters];
  for (const size of [2, 3]) {
    for (let index = 0; index <= characters.length - size; index += 1) {
      tokens.push(characters.slice(index, index + size).join(""));
    }
  }
  return tokens;
}

export function tokenizeChinese(text: string, extraTerms: string[] = []): string[] {
  const normalized = normalize(text);
  if (!normalized) return [];

  const tokens: string[] = [];
  const segments = normalized.match(/[\p{Script=Han}]+|[a-z0-9]+(?:[._-][a-z0-9]+)*/gu) ?? [];
  for (const segment of segments) {
    if (/^\p{Script=Han}+$/u.test(segment)) tokens.push(...chineseNgrams(segment));
    else tokens.push(segment);
  }

  for (const term of [...baseTerms, ...extraTerms]) {
    const normalizedTerm = normalize(term);
    if (normalizedTerm && normalized.includes(normalizedTerm)) tokens.push(normalizedTerm);
  }

  return tokens;
}
