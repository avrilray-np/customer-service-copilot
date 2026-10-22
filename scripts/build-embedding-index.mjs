import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

const root = process.cwd();
const knowledgeRoot = resolve(root, "src/data/knowledge");
const manifestPath = resolve(knowledgeRoot, "manifest.json");
const indexPath = resolve(knowledgeRoot, "index/embeddings-v0.1.json");
const model = "BAAI/bge-m3";
const dimensions = 1024;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadLocalEnvironment() {
  const path = resolve(root, ".env.local");
  let content = "";
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function normalize(vector) {
  if (!Array.isArray(vector) || vector.length !== dimensions || vector.some((value) => !Number.isFinite(value))) {
    throw new Error(`Embedding返回的向量不是${dimensions}维有限数值`);
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(magnitude) || magnitude === 0) throw new Error("Embedding返回了零向量");
  return vector.map((value) => value / magnitude);
}

loadLocalEnvironment();
const apiKey = process.env.SILICONFLOW_API_KEY;
if (!apiKey) throw new Error("缺少SILICONFLOW_API_KEY，未生成向量索引");

const manifest = readJson(manifestPath);
const documentFiles = manifest.document_ids.map((documentId) =>
  resolve(knowledgeRoot, "documents", `${documentId}.json`),
);
const documents = documentFiles.map(readJson);
const documentsById = new Map(documents.map((document) => [document.document_id, document]));
const chunkFiles = [...new Set(manifest.document_ids.map((documentId) =>
  resolve(knowledgeRoot, "chunks", `${documentId}.json`),
))];
const chunks = chunkFiles.flatMap(readJson).sort((left, right) => left.chunk_id.localeCompare(right.chunk_id));
if (chunks.length !== manifest.chunk_count) throw new Error("知识片段数量与manifest不一致");

const texts = chunks.map((chunk) => {
  const document = documentsById.get(chunk.document_id);
  if (!document) throw new Error(`知识片段缺少文档：${chunk.chunk_id}`);
  return [document.title, chunk.section_path.join(" "), chunk.text].join(" ");
});

const startedAt = performance.now();
const response = await fetch("https://api.siliconflow.cn/v1/embeddings", {
  method: "POST",
  headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
  body: JSON.stringify({ model, input: texts, encoding_format: "float" }),
});
const payload = await response.json().catch(() => null);
if (!response.ok) {
  const reason = payload && typeof payload === "object" && "message" in payload ? `：${payload.message}` : "";
  throw new Error(`SiliconFlow Embedding请求失败（HTTP ${response.status}）${reason}`);
}
if (!payload || !Array.isArray(payload.data) || payload.data.length !== chunks.length) {
  throw new Error("Embedding返回数量与知识片段数量不一致");
}

const ordered = [...payload.data].sort((left, right) => left.index - right.index);
if (ordered.some((entry, index) => entry.index !== index)) {
  throw new Error("Embedding返回的序号缺失、重复或越界");
}
const vectors = ordered.map((entry) => normalize(entry.embedding));
const builtAt = new Date().toISOString();
const index = {
  knowledge_base_version: manifest.knowledge_base_version,
  built_at: builtAt,
  provider: "siliconflow",
  model,
  dimensions,
  normalized: true,
  entries: chunks.map((chunk, indexPosition) => ({
    chunk_id: chunk.chunk_id,
    text_checksum: chunk.checksum,
    vector: vectors[indexPosition],
  })),
};
writeFileSync(indexPath, `${JSON.stringify(index)}\n`);
writeFileSync(manifestPath, `${JSON.stringify({
  ...manifest,
  embedding: {
    provider: index.provider,
    model: index.model,
    dimensions: index.dimensions,
    normalized: index.normalized,
    index_file: "src/data/knowledge/index/embeddings-v0.1.json",
  },
}, null, 2)}\n`);

console.log(JSON.stringify({
  knowledge_base_version: index.knowledge_base_version,
  provider: index.provider,
  model: index.model,
  vector_count: index.entries.length,
  dimensions: index.dimensions,
  normalized: index.normalized,
  input_tokens: payload.usage?.total_tokens ?? null,
  latency_ms: Number((performance.now() - startedAt).toFixed(1)),
}, null, 2));
