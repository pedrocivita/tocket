/** Meta-attention: Jev (or the stub) scores context chunks and gotcha packs. */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
  fileTimestamp,
  isInsideContext,
  resolveDecideMode,
  resolveSemantics,
  slugId,
  STUB_MODEL,
  type DecideMode,
  type DecideSemantics,
} from "./decide.js";
import { askJev, readTypesafeApiKey, type JevQuestion } from "./jev.js";

export const ATTENTION_SCHEMA = "tocket.attention/v0";
export const ATTENTION_DIR = ".context/attention";
export const HANDOFFS_DIR = ".context/handoffs";
export const GOTCHAS_DIR = ".context/gotchas";
export const ACTIVE_PACKS_REL = ".context/active/packs.md";
export const DEFAULT_THRESHOLD = 0.5;
export const SCORE_MIN = 0;
export const SCORE_MAX = 1;
export const MAX_CHUNK_CHARS = 700;
export const DECISION_CHUNK_LIMIT = 5;

const CONTEXT_FILES = [
  "activeContext.md",
  "systemPatterns.md",
  "techContext.md",
  "productContext.md",
  "progress.md",
] as const;

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "from",
  "into",
  "your",
  "are",
  "was",
  "were",
  "has",
  "have",
  "not",
  "but",
  "you",
  "our",
  "its",
  "per",
  "via",
  "any",
]);

export class AttentionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttentionError";
  }
}

export type AttentionSource = "stub" | "jev";
export type ChunkIntent = "relevant" | "load";

export interface ContextChunk {
  id: string;
  label: string;
  source: string;
  heading: string;
  text: string;
  intent: ChunkIntent;
}

export interface ScoredChunk extends ContextChunk {
  noul: number;
  score: number;
  kept: boolean;
  rationale: string;
}

export interface AttentionChunk {
  id: string;
  label: string;
  source: string;
  intent: ChunkIntent;
  noul: number;
  score: number;
  kept: boolean;
  rationale: string;
  preview: string;
}

export interface AttentionRecord {
  schema: typeof ATTENTION_SCHEMA;
  id: string;
  generated_at: string;
  query: string;
  threshold: number;
  source: AttentionSource;
  mode: DecideMode;
  semantics: DecideSemantics;
  model: string;
  executes: false;
  kind: "handoff" | "packs";
  chunks: AttentionChunk[];
  packs?: AttentionChunk[];
}

export interface JudgeResult {
  chunks: ScoredChunk[];
  source: AttentionSource;
  mode: DecideMode;
  semantics: DecideSemantics;
  model: string;
}

export function parseThreshold(value?: string): number {
  if (value === undefined || value === "") return DEFAULT_THRESHOLD;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new AttentionError("Threshold must be between 0 and 1.");
  }
  return n;
}

/** Kept when Noul >= threshold OR Score >= the same fraction of the score range (mid at 0.5). */
export function chunkKept(
  noul: number,
  score: number,
  threshold: number,
  scoreMin = SCORE_MIN,
  scoreMax = SCORE_MAX,
): boolean {
  const scoreCut = scoreMin + threshold * (scoreMax - scoreMin);
  return noul >= threshold || score >= scoreCut;
}

export function relevanceTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

/** Deterministic overlap. No network. Unrelated chunks stay under the default 0.5 cutoff. */
export function stubRelevance(
  query: string,
  chunkText: string,
): { noul: number; score: number; rationale: string } {
  const queryTokens = [...new Set(relevanceTokens(query))];
  if (queryTokens.length === 0) {
    return { noul: 0.5, score: 0.5, rationale: "Empty query; neutral stub." };
  }
  const body = chunkText.toLowerCase();
  const hits = queryTokens.filter((token) => body.includes(token));
  const ratio = hits.length / queryTokens.length;
  let noul = 0.08;
  if (hits.length === 0) noul = 0.08;
  else if (ratio < 0.34) noul = 0.22;
  else if (ratio < 0.67) noul = 0.64;
  else noul = 0.88;
  return {
    noul,
    score: Number(noul.toFixed(4)),
    rationale:
      hits.length === 0
        ? "No query tokens in chunk."
        : `Stub overlap ${hits.length}/${queryTokens.length} (${hits.join(", ")}).`,
  };
}

function maskFences(text: string): string {
  return text.replace(/```[\s\S]*?```/g, (block) => block.replace(/[^\n]/g, " "));
}

function cleanBody(body: string): string {
  return body
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^\s*---\s*$/gm, "")
    .trim();
}

function fileStem(source: string): string {
  const base = source.split(/[\\/]/).pop() ?? source;
  return base.replace(/\.md$/i, "") || source;
}

function uniqueId(base: string, used: Set<string>): string {
  const root = slugId(base);
  if (!used.has(root)) {
    used.add(root);
    return root;
  }
  let n = 2;
  while (used.has(`${root}-${n}`)) n += 1;
  const id = `${root}-${n}`;
  used.add(id);
  return id;
}

function splitLong(
  source: string,
  label: string,
  heading: string,
  body: string,
  maxChars: number,
  used: Set<string>,
  intent: ChunkIntent,
): ContextChunk[] {
  const trimmed = cleanBody(body);
  if (!trimmed) return [];
  const parts: string[] = [];
  if (trimmed.length <= maxChars) {
    parts.push(trimmed);
  } else {
    const paras = trimmed.split(/\n{2,}/);
    let buf = "";
    const flush = () => {
      if (buf.trim()) parts.push(buf.trim());
      buf = "";
    };
    for (const para of paras) {
      if (para.length > maxChars) {
        flush();
        for (let i = 0; i < para.length; i += maxChars) {
          const slice = para.slice(i, i + maxChars).trim();
          if (slice) parts.push(slice);
        }
        continue;
      }
      if (buf && buf.length + 2 + para.length > maxChars) flush();
      buf = buf ? `${buf}\n\n${para}` : para;
    }
    flush();
  }
  return parts.map((text, index) => {
    const partLabel = parts.length > 1 ? `${label} (${index + 1})` : label;
    return {
      id: uniqueId(`${source} ${partLabel}`, used),
      label: partLabel,
      source,
      heading: parts.length > 1 ? `${heading} (${index + 1})` : heading,
      text,
      intent,
    };
  });
}

/** Split a markdown file into small labeled chunks (## / ###, then paragraphs). */
export function splitMarkdown(
  source: string,
  markdown: string,
  intent: ChunkIntent = "relevant",
  maxChars = MAX_CHUNK_CHARS,
): ContextChunk[] {
  const text = markdown.replace(/\r\n/g, "\n");
  const masked = maskFences(text);
  const used = new Set<string>();
  const h2 = [...masked.matchAll(/^##[ \t]+(.+)$/gm)];
  if (h2.length === 0) {
    const withoutTitle = text.replace(/^#[ \t]+[^\n]*\n+/, "");
    const heading = fileStem(source);
    return splitLong(source, heading, heading, withoutTitle, maxChars, used, intent);
  }

  const chunks: ContextChunk[] = [];
  for (let i = 0; i < h2.length; i++) {
    const heading = h2[i][1].trim();
    const start = (h2[i].index ?? 0) + h2[i][0].length;
    const end = i + 1 < h2.length ? (h2[i + 1].index ?? text.length) : text.length;
    const section = text.slice(start, end);
    const sectionMasked = masked.slice(start, end);
    const h3 = [...sectionMasked.matchAll(/^###[ \t]+(.+)$/gm)];
    if (h3.length === 0) {
      chunks.push(...splitLong(source, heading, heading, section, maxChars, used, intent));
      continue;
    }
    const intro = section.slice(0, h3[0].index ?? 0);
    chunks.push(...splitLong(source, heading, heading, intro, maxChars, used, intent));
    for (let j = 0; j < h3.length; j++) {
      const sub = h3[j][1].trim();
      const subStart = (h3[j].index ?? 0) + h3[j][0].length;
      const subEnd = j + 1 < h3.length ? (h3[j + 1].index ?? section.length) : section.length;
      const label = `${heading} / ${sub}`;
      chunks.push(
        ...splitLong(source, label, sub, section.slice(subStart, subEnd), maxChars, used, intent),
      );
    }
  }
  return chunks;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectDecisionChunks(cwd: string): ContextChunk[] {
  const dir = join(cwd, ".context", "decisions");
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const abs = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".json") &&
        !entry.name.endsWith(".applied.json")
      ) {
        files.push(abs);
      }
    }
  };
  walk(dir);
  const recent = files
    .map((abs) => ({ abs, mtime: statSync(abs).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, DECISION_CHUNK_LIMIT);

  const used = new Set<string>();
  const chunks: ContextChunk[] = [];
  for (const { abs } of recent) {
    let value: unknown;
    try {
      value = JSON.parse(readFileSync(abs, "utf-8"));
    } catch {
      continue;
    }
    if (!isRecord(value)) continue;
    const id = typeof value.id === "string" ? value.id : fileStem(abs);
    const destination = typeof value.destination === "string" ? value.destination : "";
    const choice = typeof value.choice === "string" ? value.choice : "";
    const toolGate = typeof value.tool_gate === "string" ? value.tool_gate : "";
    const state =
      typeof value.state === "string" ? value.state : JSON.stringify(value.state ?? "");
    const lines = [
      `Decision ${id}`,
      destination ? `destination=${destination}` : "",
      choice ? `choice=${choice}` : "",
      toolGate ? `tool_gate=${toolGate}` : "",
      state ? `state=${state.slice(0, 240)}` : "",
    ].filter(Boolean);
    const source = abs.startsWith(cwd) ? abs.slice(cwd.length).replace(/^[\\/]/, "") : abs;
    const posix = source.split(/[\\/]/g).join("/");
    const label = `decisions / ${id}`;
    chunks.push({
      id: uniqueId(`${posix} ${label}`, used),
      label,
      source: posix,
      heading: id,
      text: lines.join("\n"),
      intent: "relevant",
    });
  }
  return chunks;
}

export function collectContextChunks(cwd: string): ContextChunk[] {
  const chunks: ContextChunk[] = [];
  for (const name of CONTEXT_FILES) {
    const abs = join(cwd, ".context", name);
    if (!existsSync(abs)) continue;
    chunks.push(...splitMarkdown(`.context/${name}`, readFileSync(abs, "utf-8"), "relevant"));
  }
  chunks.push(...collectDecisionChunks(cwd));
  return chunks;
}

export function collectGotchaPacks(cwd: string): ContextChunk[] {
  const dir = join(cwd, ".context", "gotchas");
  if (!existsSync(dir)) return [];
  const names = readdirSync(dir)
    .filter((name) => name.endsWith(".md") && name.toLowerCase() !== "readme.md")
    .sort();
  const chunks: ContextChunk[] = [];
  for (const name of names) {
    const source = `.context/gotchas/${name}`;
    chunks.push(...splitMarkdown(source, readFileSync(join(dir, name), "utf-8"), "load"));
  }
  return chunks;
}

export function queryFromFocus(content: string): string {
  const match = content.match(/## Current Focus\s*\n+(.+)/);
  if (!match?.[1]) return "";
  const plain = match[1].replace(/\*\*/g, "").trim();
  if (!plain || plain.startsWith("_") || plain.includes("No active tasks")) return "";
  return plain;
}

function scoreChunk(query: string, chunk: ContextChunk, threshold: number): ScoredChunk {
  const stub = stubRelevance(query, `${chunk.label}\n${chunk.text}`);
  return {
    ...chunk,
    noul: stub.noul,
    score: stub.score,
    kept: chunkKept(stub.noul, stub.score, threshold),
    rationale: stub.rationale,
  };
}

function questionsFor(query: string, batch: ContextChunk[]): Record<string, JevQuestion> {
  const questions: Record<string, JevQuestion> = {};
  batch.forEach((chunk, index) => {
    const excerpt = chunk.text.slice(0, 600);
    const lead =
      chunk.intent === "load"
        ? "Should this gotcha pack be loaded for the query?"
        : "Is this context chunk relevant to the query?";
    questions[`c${index}_relevant`] = {
      type: "noul",
      instructions: `Query: ${query}\n${lead}\nLabel: ${chunk.label}\n---\n${excerpt}`,
      criteria: {
        true: "The chunk should be included for this query.",
        false: "The chunk is unrelated to the query.",
      },
    };
    questions[`c${index}_relevance`] = {
      type: "score",
      min: SCORE_MIN,
      max: SCORE_MAX,
      instructions: `Query: ${query}\nScore relevance of "${chunk.label}" from 0 to 1.\n---\n${excerpt}`,
      criteria: {
        low: "Unrelated to the query.",
        high: "Directly useful for the query.",
      },
    };
  });
  return questions;
}

export async function judgeChunks(options: {
  query: string;
  chunks: ContextChunk[];
  threshold: number;
  dryRun?: boolean;
  shadow?: boolean;
  apiKey?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<JudgeResult> {
  const dryRun = options.dryRun === true;
  const apiKey = dryRun
    ? undefined
    : options.apiKey === null
      ? undefined
      : options.apiKey ?? readTypesafeApiKey();
  const { useLive, mode } = resolveDecideMode({
    dryRun,
    shadow: options.shadow === true,
    apiKey,
  });
  const { semantics } = resolveSemantics(mode);
  const stubbed = () => options.chunks.map((chunk) => scoreChunk(options.query, chunk, options.threshold));

  if (!useLive || !apiKey) {
    return {
      chunks: stubbed(),
      source: "stub",
      mode,
      semantics,
      model: STUB_MODEL,
    };
  }

  try {
    const scored: ScoredChunk[] = [];
    let model = STUB_MODEL;
    const batchSize = 8;
    for (let offset = 0; offset < options.chunks.length; offset += batchSize) {
      const batch = options.chunks.slice(offset, offset + batchSize);
      const live = await askJev({
        apiKey,
        fetchImpl: options.fetchImpl,
        state: {
          query: options.query,
          threshold: options.threshold,
          chunks: batch.map((chunk) => ({
            id: chunk.id,
            label: chunk.label,
            source: chunk.source,
            intent: chunk.intent,
          })),
        },
        questions: questionsFor(options.query, batch),
      });
      model = live.model || model;
      batch.forEach((chunk, index) => {
        const noulAnswer = live.answers[`c${index}_relevant`];
        const scoreAnswer = live.answers[`c${index}_relevance`];
        const noul = noulAnswer && noulAnswer.type === "noul" ? noulAnswer.noul : 0;
        const score = scoreAnswer && scoreAnswer.type === "score" ? scoreAnswer.score : 0;
        scored.push({
          ...chunk,
          noul,
          score,
          kept: chunkKept(noul, score, options.threshold),
          rationale: `Jev noul=${noul.toFixed(2)} score=${score.toFixed(2)}.`,
        });
      });
    }
    return { chunks: scored, source: "jev", mode, semantics, model };
  } catch {
    return {
      chunks: stubbed(),
      source: "stub",
      mode,
      semantics,
      model: STUB_MODEL,
    };
  }
}

function preview(text: string): string {
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

function toReceipt(chunk: ScoredChunk): AttentionChunk {
  return {
    id: chunk.id,
    label: chunk.label,
    source: chunk.source,
    intent: chunk.intent,
    noul: chunk.noul,
    score: chunk.score,
    kept: chunk.kept,
    rationale: chunk.rationale,
    preview: preview(chunk.text),
  };
}

export function attentionReadme(): string {
  return `# Attention

Meta-attention receipts from \`tocket handoff --aware\` and \`tocket packs load\`.

Jev (or the stub) scores each chunk. Workers read the filtered handoff and \`.context/active/packs.md\`. This folder is the judge's receipt. Tocket does not run workers.

\`--dry-run\` or no \`TYPESAFE_API_KEY\`: stub. \`--shadow\` with a key: live Jev, \`semantics: log-only\`.
`;
}

function ensureAttentionDir(cwd: string): void {
  const dir = resolve(cwd, ATTENTION_DIR);
  if (!isInsideContext(cwd, dir)) {
    throw new AttentionError("attention writes only under .context/");
  }
  mkdirSync(dir, { recursive: true });
  const readmePath = join(dir, "README.md");
  if (!existsSync(readmePath)) {
    writeFileSync(readmePath, attentionReadme(), "utf-8");
  }
}

export function attentionOutputPath(cwd: string, generatedAt: string, id: string): string {
  const file = `${fileTimestamp(generatedAt)}-${slugId(id)}.json`;
  const outPath = resolve(cwd, ATTENTION_DIR, file);
  if (!isInsideContext(cwd, outPath)) {
    throw new AttentionError("attention writes only under .context/");
  }
  return outPath;
}

export function handoffOutputPath(cwd: string, generatedAt: string, id: string): string {
  const file = `${fileTimestamp(generatedAt)}-${slugId(id)}.md`;
  const outPath = resolve(cwd, HANDOFFS_DIR, file);
  if (!isInsideContext(cwd, outPath)) {
    throw new AttentionError("handoff writes only under .context/");
  }
  return outPath;
}

export function activePacksPath(cwd: string): string {
  const outPath = resolve(cwd, ACTIVE_PACKS_REL);
  if (!isInsideContext(cwd, outPath)) {
    throw new AttentionError("packs write only under .context/");
  }
  return outPath;
}

function keptBlocks(chunks: ScoredChunk[]): string[] {
  const lines: string[] = [];
  for (const chunk of chunks.filter((item) => item.kept)) {
    lines.push(`### ${chunk.label}`, "", chunk.text, "");
  }
  return lines;
}

export function buildAwareHandoffMarkdown(input: {
  projectName: string;
  query: string;
  focus: string;
  branch: string;
  recentCommits: string[];
  modifiedFiles: string[];
  context: ScoredChunk[];
  packs: ScoredChunk[];
  threshold: number;
  source: AttentionSource;
  mode: DecideMode;
  attentionRel: string;
}): string {
  const lines: string[] = [];
  const kept = input.context.filter((chunk) => chunk.kept);
  lines.push(`## Session Handoff — ${input.projectName}`);
  lines.push(`**Query:** ${input.query}`);
  if (input.focus) lines.push(`**Focus:** ${input.focus}`);
  if (input.branch) lines.push(`**Branch:** ${input.branch}`);
  lines.push(
    `**Aware:** kept ${kept.length}/${input.context.length} chunks (threshold ${input.threshold.toFixed(2)}, ${input.source}, ${input.mode})`,
  );
  lines.push("");

  if (input.recentCommits.length > 0) {
    lines.push(`### Recent Changes (last ${input.recentCommits.length} commits)`);
    for (const commit of input.recentCommits) lines.push(`- ${commit}`);
    lines.push("");
  }
  if (input.modifiedFiles.length > 0) {
    lines.push("### Modified Files (since last sync)");
    for (const file of input.modifiedFiles) lines.push(`- ${file}`);
    lines.push("");
  }

  if (kept.length === 0) {
    lines.push("_No context chunk passed the threshold._", "");
  } else {
    lines.push(...keptBlocks(input.context));
  }

  const omitted = input.context.filter((chunk) => !chunk.kept).map((chunk) => chunk.label);
  if (omitted.length > 0) {
    lines.push("### Omitted chunks", "");
    for (const label of omitted) lines.push(`- ${label}`);
    lines.push("");
  }

  if (input.packs.length > 0) {
    const keptPacks = input.packs.filter((chunk) => chunk.kept);
    lines.push("### Gotcha packs", "");
    if (keptPacks.length === 0) {
      lines.push("_No gotcha pack passed the threshold._", "");
    } else {
      for (const pack of keptPacks) {
        lines.push(`#### ${pack.label}`, "", pack.text, "");
      }
    }
    const omittedPacks = input.packs.filter((chunk) => !chunk.kept).map((chunk) => chunk.label);
    if (omittedPacks.length > 0) {
      lines.push("Omitted packs:");
      for (const label of omittedPacks) lines.push(`- ${label}`);
      lines.push("");
    }
    lines.push("Overlay: `tocket packs load --query` writes `.context/active/packs.md`.", "");
  }

  lines.push(`Receipt: \`${input.attentionRel}\``);
  lines.push("");
  return lines.join("\n");
}

export function buildPacksMarkdown(input: {
  query: string;
  packs: ScoredChunk[];
  threshold: number;
  source: AttentionSource;
  mode: DecideMode;
  attentionRel: string;
}): string {
  const kept = input.packs.filter((chunk) => chunk.kept);
  const lines: string[] = [];
  lines.push("# Active packs", "");
  lines.push(`**Query:** ${input.query}`);
  lines.push(
    `**Loaded:** ${kept.length} of ${input.packs.length} (threshold ${input.threshold.toFixed(2)}, ${input.source}, ${input.mode})`,
  );
  lines.push("");
  if (input.packs.length === 0) {
    lines.push(
      "No packs under `.context/gotchas/`. Add markdown files such as `frontend.md` or `path-src-api.md`.",
      "",
    );
  } else if (kept.length === 0) {
    lines.push("_No pack passed the threshold._", "");
  } else {
    for (const pack of kept) {
      lines.push(`## ${pack.label}`, "", pack.text, "");
    }
  }
  const omitted = input.packs.filter((chunk) => !chunk.kept).map((chunk) => chunk.label);
  if (omitted.length > 0) {
    lines.push("Omitted:");
    for (const label of omitted) lines.push(`- ${label}`);
    lines.push("");
  }
  lines.push(`Receipt: \`${input.attentionRel}\``, "");
  return lines.join("\n");
}

export function formatAwareSummary(
  record: AttentionRecord,
  handoffRel: string,
  attentionRel: string,
): string {
  const kept = record.chunks.filter((chunk) => chunk.kept).length;
  const packs = record.packs ?? [];
  const packBit = packs.length > 0 ? `  packs=${packs.filter((chunk) => chunk.kept).length}/${packs.length}` : "";
  return `handoff aware  kept=${kept}/${record.chunks.length}${packBit}  threshold=${record.threshold.toFixed(2)}  source=${record.source}  mode=${record.mode}  ${handoffRel}  ${attentionRel}`;
}

export function formatPacksSummary(record: AttentionRecord, packsRel: string): string {
  const kept = record.chunks.filter((chunk) => chunk.kept).length;
  return `packs load  kept=${kept}/${record.chunks.length}  threshold=${record.threshold.toFixed(2)}  source=${record.source}  mode=${record.mode}  ${packsRel}`;
}

function writeAttention(cwd: string, record: AttentionRecord, outPath: string): void {
  ensureAttentionDir(cwd);
  if (!isInsideContext(cwd, outPath)) {
    throw new AttentionError("attention writes only under .context/");
  }
  writeFileSync(outPath, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
}

export interface AwareHandoffInput {
  cwd: string;
  query?: string;
  focus?: string;
  projectName?: string;
  branch?: string;
  recentCommits?: string[];
  modifiedFiles?: string[];
  threshold?: number;
  dryRun?: boolean;
  shadow?: boolean;
  apiKey?: string | null;
  id?: string;
  now?: () => string;
  fetchImpl?: typeof fetch;
}

export async function runAwareHandoff(options: AwareHandoffInput): Promise<{
  markdown: string;
  record: AttentionRecord;
  attentionPath: string;
  handoffPath: string;
}> {
  const focus = options.focus?.trim() ?? "";
  const query = options.query?.trim() || focus;
  if (!query) {
    throw new AttentionError("Pass --query or set Current Focus in activeContext.md.");
  }
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const context = collectContextChunks(options.cwd);
  const packs = collectGotchaPacks(options.cwd);
  const judged = await judgeChunks({
    query,
    chunks: [...context, ...packs],
    threshold,
    dryRun: options.dryRun,
    shadow: options.shadow,
    apiKey: options.apiKey,
    fetchImpl: options.fetchImpl,
  });
  const contextIds = new Set(context.map((chunk) => chunk.id));
  const scoredContext = judged.chunks.filter((chunk) => contextIds.has(chunk.id));
  const scoredPacks = judged.chunks.filter((chunk) => !contextIds.has(chunk.id));
  const generatedAt = options.now ? options.now() : new Date().toISOString();
  const id = options.id ?? "handoff";
  const attentionPath = attentionOutputPath(options.cwd, generatedAt, id);
  const handoffPath = handoffOutputPath(options.cwd, generatedAt, id);
  const attentionRel = attentionPath.slice(options.cwd.length).replace(/^[\\/]/, "").split(/[\\/]/g).join("/");
  const record: AttentionRecord = {
    schema: ATTENTION_SCHEMA,
    id: slugId(id),
    generated_at: generatedAt,
    query,
    threshold,
    source: judged.source,
    mode: judged.mode,
    semantics: judged.semantics,
    model: judged.model,
    executes: false,
    kind: "handoff",
    chunks: scoredContext.map(toReceipt),
    packs: scoredPacks.map(toReceipt),
  };
  const markdown = buildAwareHandoffMarkdown({
    projectName: options.projectName?.trim() || "Project",
    query,
    focus,
    branch: options.branch ?? "",
    recentCommits: options.recentCommits ?? [],
    modifiedFiles: options.modifiedFiles ?? [],
    context: scoredContext,
    packs: scoredPacks,
    threshold,
    source: judged.source,
    mode: judged.mode,
    attentionRel,
  });
  writeAttention(options.cwd, record, attentionPath);
  mkdirSync(resolve(options.cwd, HANDOFFS_DIR), { recursive: true });
  if (!isInsideContext(options.cwd, handoffPath)) {
    throw new AttentionError("handoff writes only under .context/");
  }
  writeFileSync(handoffPath, markdown, "utf-8");
  return { markdown, record, attentionPath, handoffPath };
}

export async function runPacksLoad(options: {
  cwd: string;
  query?: string;
  focus?: string;
  threshold?: number;
  dryRun?: boolean;
  shadow?: boolean;
  apiKey?: string | null;
  id?: string;
  now?: () => string;
  fetchImpl?: typeof fetch;
}): Promise<{
  markdown: string;
  record: AttentionRecord;
  attentionPath: string;
  packsPath: string;
}> {
  const focus = options.focus?.trim() ?? "";
  const query = options.query?.trim() || focus;
  if (!query) {
    throw new AttentionError("Pass --query or set Current Focus in activeContext.md.");
  }
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const packs = collectGotchaPacks(options.cwd);
  const judged = await judgeChunks({
    query,
    chunks: packs,
    threshold,
    dryRun: options.dryRun,
    shadow: options.shadow,
    apiKey: options.apiKey,
    fetchImpl: options.fetchImpl,
  });
  const generatedAt = options.now ? options.now() : new Date().toISOString();
  const id = options.id ?? "packs";
  const attentionPath = attentionOutputPath(options.cwd, generatedAt, id);
  const packsPath = activePacksPath(options.cwd);
  const attentionRel = attentionPath.slice(options.cwd.length).replace(/^[\\/]/, "").split(/[\\/]/g).join("/");
  const record: AttentionRecord = {
    schema: ATTENTION_SCHEMA,
    id: slugId(id),
    generated_at: generatedAt,
    query,
    threshold,
    source: judged.source,
    mode: judged.mode,
    semantics: judged.semantics,
    model: judged.model,
    executes: false,
    kind: "packs",
    chunks: judged.chunks.map(toReceipt),
  };
  const markdown = buildPacksMarkdown({
    query,
    packs: judged.chunks,
    threshold,
    source: judged.source,
    mode: judged.mode,
    attentionRel,
  });
  writeAttention(options.cwd, record, attentionPath);
  mkdirSync(resolve(options.cwd, ".context", "active"), { recursive: true });
  writeFileSync(packsPath, markdown, "utf-8");
  return { markdown, record, attentionPath, packsPath };
}
