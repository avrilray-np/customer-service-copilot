import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const knowledgeRoot = resolve(root, "src/data/knowledge");
const documentRoot = resolve(knowledgeRoot, "documents");
const chunkRoot = resolve(knowledgeRoot, "chunks");
const manifestPath = resolve(knowledgeRoot, "manifest.json");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

const documentFiles = readdirSync(documentRoot).filter((file) => file.endsWith(".json")).sort();
const chunkFiles = readdirSync(chunkRoot).filter((file) => file.endsWith(".json")).sort();
const documents = documentFiles.map((file) => readJson(resolve(documentRoot, file)));
const documentsById = new Map(documents.map((document) => [document.document_id, document]));
const chunks = [];

for (const file of chunkFiles) {
  const path = resolve(chunkRoot, file);
  const entries = readJson(path);
  for (const chunk of entries) {
    const document = documentsById.get(chunk.document_id);
    if (!document) throw new Error(`Missing document for ${chunk.chunk_id}`);
    const searchText = [document.title, chunk.section_path.join(" "), chunk.text].join(" ");
    chunk.checksum = sha256(searchText);
    chunks.push(chunk);
  }
  writeFileSync(path, `${JSON.stringify(entries, null, 2)}\n`);
}

const previousManifest = readJson(manifestPath);
const contentChecksum = sha256(stableStringify({ documents, chunks }));
const manifest = {
  ...previousManifest,
  built_at: previousManifest.content_checksum === contentChecksum
    ? previousManifest.built_at
    : new Date().toISOString(),
  document_ids: documents.map((document) => document.document_id),
  chunk_count: chunks.length,
  content_checksum: contentChecksum,
  embedding: previousManifest.content_checksum === contentChecksum
    ? previousManifest.embedding
    : null,
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({
  knowledge_base_version: manifest.knowledge_base_version,
  document_count: documents.length,
  chunk_count: chunks.length,
  content_checksum: manifest.content_checksum,
}, null, 2));
