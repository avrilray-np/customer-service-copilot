import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { AiAnalysisCandidate, AiAnalysisInput } from "@/ai/types";
import { applyBusinessRules } from "@/domain/classification/apply-business-rules";
import { createWaitingTicket } from "@/domain/ticket/create-ticket";
import { canAutoClose, transitionTicket } from "@/domain/workflow/ticket-state-machine";
import { assertAiStructuredAnalysis } from "@/validation/ai-response-validator";

interface AcceptanceRow {
  case_id: string;
  user_input: string;
  expected_category: "low_risk_info" | "low_risk_other" | "high_risk";
  expected_subtypes: string;
  identity_status: "verified" | "unverified" | "not_required";
  evidence_status: "sufficient" | "insufficient" | "conflicting";
  expected_route: "ai" | "tier1" | "tier2";
  auto_reply_allowed: "true" | "false";
  expected_close_condition: string;
  test_focus: string;
}

const baselinePath = resolve(
  process.cwd(),
  "tests/fixtures/classification-routing-cases.csv",
);

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += character;
    }
  }

  cells.push(cell);
  return cells;
}

function loadAcceptanceRows(): AcceptanceRow[] {
  const [headerLine, ...dataLines] = readFileSync(baselinePath, "utf8").trim().split(/\r?\n/u);
  const headers = parseCsvLine(headerLine);
  return dataLines.map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index]])) as unknown as AcceptanceRow;
  });
}

const rows = loadAcceptanceRows();
const ordinaryRows = rows.filter((row) => row.case_id !== "T031");

const knowledgeSource = {
  document_id: "KB-ACCEPTANCE-001",
  title: "分类与流转验收规则",
  section: "测试基线",
  version: "0.1",
  quote: "根据风险、身份和证据状态决定回复或人工流转。",
};

const userDataSource = {
  source: "acceptance_test_service",
  fields: ["acceptance_fixture"],
  queried_at: "2026-09-01T09:00:00+08:00",
};

function expectedSubtypes(row: AcceptanceRow) {
  return row.expected_subtypes.split("|");
}

function inputFor(row: AcceptanceRow): AiAnalysisInput {
  return {
    message: row.user_input,
    identity_status: row.identity_status,
    user_facts: row.identity_status === "verified" ? { acceptance_fixture: true } : {},
    knowledge_sources: [knowledgeSource],
    user_data_sources: row.identity_status === "verified" ? [userDataSource] : [],
  };
}

function candidateFor(row: AcceptanceRow): AiAnalysisCandidate {
  return {
    summary: row.test_focus,
    handling_category: "low_risk_info",
    subtypes: expectedSubtypes(row),
    risk_level: "low",
    risk_reason: row.test_focus,
    classification_confidence: ["T008", "T018"].includes(row.case_id) ? "low" : "high",
    reply: "已记录你的问题；涉及人工操作或进一步核验时，将转交相应客服处理。",
    evidence_status: row.evidence_status,
    recommended_action: "reply",
    knowledge_sources: [knowledgeSource],
    user_data_sources: row.identity_status === "verified" ? [userDataSource] : [],
    missing_information: row.evidence_status === "sufficient" ? [] : [row.expected_close_condition],
  };
}

function expectedAction(route: AcceptanceRow["expected_route"]) {
  if (route === "ai") return "reply";
  if (route === "tier1") return "assign_tier1";
  return "assign_tier2";
}

describe("32-case classification and routing acceptance baseline", () => {
  it("loads every uniquely numbered acceptance case from the canonical CSV", () => {
    expect(rows).toHaveLength(32);
    expect(new Set(rows.map((row) => row.case_id)).size).toBe(32);
    expect(rows.map((row) => row.case_id)).toEqual(
      Array.from({ length: 32 }, (_, index) => `T${String(index + 1).padStart(3, "0")}`),
    );
  });

  it.each(ordinaryRows)("$case_id: $test_focus", (row) => {
    const result = applyBusinessRules(candidateFor(row), inputFor(row));

    expect(result.handling_category).toBe(row.expected_category);
    expect([...result.subtypes].sort()).toEqual([...expectedSubtypes(row)].sort());
    expect(result.risk_level).toBe(row.expected_category === "high_risk" ? "high" : "low");
    expect(result.evidence_status).toBe(row.evidence_status);
    expect(result.recommended_action).toBe(expectedAction(row.expected_route));
    expect(result.recommended_action === "reply").toBe(row.auto_reply_allowed === "true");

    expect(() =>
      assertAiStructuredAnalysis({
        summary: result.summary,
        handling_category: result.handling_category,
        subtypes: result.subtypes,
        risk_level: result.risk_level,
        risk_reason: result.risk_reason,
        classification_confidence: result.classification_confidence,
        reply: result.reply,
        evidence_status: result.evidence_status,
        recommended_action: result.recommended_action,
        knowledge_source_ids: result.knowledge_sources.map((source) => source.document_id),
        user_data_source_names: result.user_data_sources.map((source) => source.source),
        missing_information: result.missing_information,
      }),
    ).not.toThrow();
  });

  it("T031 keeps the original classification when the user only requests human help", () => {
    const row = rows.find((item) => item.case_id === "T031");
    expect(row).toBeDefined();
    if (!row) return;

    const originalCandidate = candidateFor(row);
    const ticket = createWaitingTicket(originalCandidate);
    const result = transitionTicket(ticket, {
      type: "USER_REQUESTED_HUMAN",
      occurredAt: "2026-09-01T09:32:00+08:00",
    });

    expect(result.issue.handling_category).toBe(row.expected_category);
    expect(result.issue.subtypes).toEqual(expectedSubtypes(row));
    expect(result.issue.risk_level).toBe("low");
    expect(result.workflow.current_owner).toBe(row.expected_route);
    expect(result.workflow.user_resolution_confirmation).toBe("unresolved");
    expect(canAutoClose(result)).toBe(row.auto_reply_allowed === "true");
  });
});
