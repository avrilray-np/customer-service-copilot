import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const fixturePath = resolve(root, "tests/fixtures/rag-evaluation-v0.1.jsonl");
const outputPath = resolve(root, "reports/rag-human-evaluation-template-v0.1.jsonl");
const cases = readFileSync(fixturePath, "utf8").trim().split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
const rows = cases.map((entry) => ({
  eval_id: entry.eval_id,
  retrieval_mode_used: null,
  generated_answer: null,
  cited_chunk_ids: [],
  actual_route: null,
  abstained_or_handed_off: null,
  answer_correctness_score: null,
  faithfulness_score: null,
  has_critical_error: null,
  critical_error_types: [],
  reviewer_note: "",
  reviewed_at: null,
}));
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
console.log(`已生成${rows.length}条人工评估模板：${outputPath}`);
