/** Generic Choice/Noul decisions. File-first; writes only under `.context/decisions/`. */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import {
  JEV_MODEL,
  askJev,
  readTypesafeApiKey,
  type JevAnswer,
  type JevQuestion,
} from "./jev.js";

export const DECIDE_SCHEMA = "tocket.decide/v0";
export const DECISIONS_DIR = ".context/decisions";
export const DECISIONS_README = "README.md";
export const STUB_MODEL = "stub-v0";

export type DecideMode = "active" | "shadow" | "dry-run";
export type DecideSource = "jev" | "stub";

export interface DecideChoiceSpec {
  name: string;
  options: string[];
}

export interface DecideNoulSpec {
  name: string;
}

export interface DecideChoiceAnswer {
  type: "choice";
  choice: string;
  confidence: number;
  rationale: string;
  probabilities?: Record<string, number>;
}

export interface DecideNoulAnswer {
  type: "noul";
  noul: number;
  confidence: number;
  rationale: string;
}

export type DecideAnswer = DecideChoiceAnswer | DecideNoulAnswer;

export interface DecideRecord {
  schema: typeof DECIDE_SCHEMA;
  id: string;
  generated_at: string;
  mode: DecideMode;
  source: DecideSource;
  model: string;
  state_summary: string;
  state: unknown;
  questions: Record<string, JevQuestion>;
  answers: Record<string, DecideAnswer>;
}

export interface RunDecideOptions {
  cwd: string;
  state?: string;
  fromPath?: string;
  choices?: string[];
  nouls?: string[];
  dryRun?: boolean;
  shadow?: boolean;
  id?: string;
  apiKey?: string | null;
  now?: () => string;
  fetchImpl?: typeof fetch;
}

export class DecideError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecideError";
  }
}

function isRecord(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseChoiceSpec(spec: string): DecideChoiceSpec {
  const trimmed = spec.trim();
  const colon = trimmed.indexOf(":");
  if (colon <= 0 || colon === trimmed.length - 1) {
    throw new DecideError(`Invalid --choice spec "${spec}". Use name:opt1,opt2.`);
  }
  const name = slugId(trimmed.slice(0, colon));
  const options = trimmed
    .slice(colon + 1)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (options.length < 2) {
    throw new DecideError(`--choice ${name} needs at least two options.`);
  }
  return { name, options };
}

export function parseNoulSpec(spec: string): DecideNoulSpec {
  const name = slugId(spec);
  if (!name || name === "decision") {
    throw new DecideError(`Invalid --noul name "${spec}".`);
  }
  return { name };
}

export function slugId(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "decision";
}

export function fileTimestamp(iso: string): string {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function summarizeState(state: unknown): string {
  if (typeof state === "string") {
    return state.length > 160 ? `${state.slice(0, 157)}...` : state;
  }
  try {
    const raw = JSON.stringify(state);
    return raw.length > 160 ? `${raw.slice(0, 157)}...` : raw;
  } catch {
    return "[unserializable state]";
  }
}

export function stateBlob(state: unknown): string {
  if (typeof state === "string") return state.toLowerCase();
  try {
    return JSON.stringify(state).toLowerCase();
  } catch {
    return String(state).toLowerCase();
  }
}

function simpleHash(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function parseStateInput(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new DecideError("State is empty. Pass --state or --from.");
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed) as unknown;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new DecideError(`Invalid JSON state: ${message}`);
    }
  }
  return trimmed;
}

export function loadState(options: { state?: string; fromPath?: string }): unknown {
  if (options.fromPath && options.state) {
    throw new DecideError("Pass either --state or --from, not both.");
  }
  if (options.fromPath) {
    try {
      return parseStateInput(readFileSync(options.fromPath, "utf-8"));
    } catch (err) {
      if (err instanceof DecideError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new DecideError(`Cannot read state file: ${message}`);
    }
  }
  if (options.state !== undefined) {
    return parseStateInput(options.state);
  }
  throw new DecideError("Pass --state '<json>' or --from <path.json>.");
}

export function buildQuestions(
  choices: DecideChoiceSpec[],
  nouls: DecideNoulSpec[],
): Record<string, JevQuestion> {
  if (choices.length === 0 && nouls.length === 0) {
    throw new DecideError("Pass --choice and/or --noul.");
  }

  const questions: Record<string, JevQuestion> = {};
  for (const choice of choices) {
    if (questions[choice.name]) {
      throw new DecideError(`Duplicate question name "${choice.name}".`);
    }
    questions[choice.name] = {
      type: "choice",
      instructions: `Pick one value for "${choice.name}".`,
      criteria: Object.fromEntries(
        choice.options.map((option) => [
          option,
          `Prefer ${option} when the state indicates ${option}.`,
        ]),
      ),
    };
  }
  for (const noul of nouls) {
    if (questions[noul.name]) {
      throw new DecideError(`Duplicate question name "${noul.name}".`);
    }
    questions[noul.name] = {
      type: "noul",
      instructions: `How true is "${noul.name}"? 0 = false, 1 = true.`,
      criteria: {
        true: `The statement ${noul.name} is true given the state.`,
        false: `The statement ${noul.name} is false given the state.`,
      },
    };
  }
  return questions;
}

const REVIEW_RE = /\b(review|human|risk|uncertain|unknown|blocked|escalate|fail|error|warn)\b/i;
const CLEAR_RE = /\b(ok|pass|clear|ready|done|safe|ignore)\b/i;

export function stubChoice(
  name: string,
  options: string[],
  state: unknown,
): DecideChoiceAnswer {
  const text = stateBlob(state);
  const hits = options.filter((option) => text.includes(option.toLowerCase()));
  if (hits.length === 1) {
    return {
      type: "choice",
      choice: hits[0],
      confidence: 0.78,
      rationale: `State mentions "${hits[0]}".`,
    };
  }
  if (hits.length > 1) {
    const best = hits.reduce((a, b) => (a.length >= b.length ? a : b));
    return {
      type: "choice",
      choice: best,
      confidence: 0.7,
      rationale: `State mentions multiple options; picked "${best}".`,
    };
  }
  const index = simpleHash(`${text}\0${name}`) % options.length;
  return {
    type: "choice",
    choice: options[index],
    confidence: 0.55,
    rationale: "No option keyword in state; deterministic stub pick.",
  };
}

export function stubNoul(_name: string, state: unknown): DecideNoulAnswer {
  const text = stateBlob(state);
  const high = REVIEW_RE.test(text);
  const low = CLEAR_RE.test(text);
  if (high && !low) {
    return {
      type: "noul",
      noul: 0.82,
      confidence: 0.76,
      rationale: "State has review/risk language.",
    };
  }
  if (low && !high) {
    return {
      type: "noul",
      noul: 0.18,
      confidence: 0.74,
      rationale: "State looks clear/ok.",
    };
  }
  if (high && low) {
    return {
      type: "noul",
      noul: 0.5,
      confidence: 0.6,
      rationale: "Mixed signals.",
    };
  }
  return {
    type: "noul",
    noul: 0.45,
    confidence: 0.52,
    rationale: "Neutral stub noul.",
  };
}

export function stubAnswers(
  questions: Record<string, JevQuestion>,
  state: unknown,
): Record<string, DecideAnswer> {
  const answers: Record<string, DecideAnswer> = {};
  for (const [name, question] of Object.entries(questions)) {
    if (question.type === "choice") {
      answers[name] = stubChoice(name, Object.keys(question.criteria), state);
    } else {
      answers[name] = stubNoul(name, state);
    }
  }
  return answers;
}

function fromJevAnswers(raw: Record<string, JevAnswer>): Record<string, DecideAnswer> {
  const answers: Record<string, DecideAnswer> = {};
  for (const [name, answer] of Object.entries(raw)) {
    if (answer.type === "choice") {
      answers[name] = {
        type: "choice",
        choice: answer.choice,
        confidence: answer.confidence,
        rationale: `Jev Choice=${answer.choice}.`,
        probabilities: answer.probabilities,
      };
    } else {
      answers[name] = {
        type: "noul",
        noul: answer.noul,
        confidence: answer.confidence,
        rationale: `Jev noul=${answer.noul.toFixed(2)}.`,
      };
    }
  }
  return answers;
}

export function isInsideContext(cwd: string, targetPath: string): boolean {
  const root = resolve(cwd, ".context");
  const resolved = resolve(targetPath);
  return resolved === root || resolved.startsWith(root + sep);
}

export function decisionOutputPath(cwd: string, generatedAt: string, id: string): string {
  const file = `${fileTimestamp(generatedAt)}-${slugId(id)}.json`;
  const outPath = resolve(cwd, DECISIONS_DIR, file);
  if (!isInsideContext(cwd, outPath)) {
    throw new DecideError("decide writes only under .context/");
  }
  return outPath;
}

export function defaultDecisionId(choices: DecideChoiceSpec[], nouls: DecideNoulSpec[]): string {
  return choices[0]?.name ?? nouls[0]?.name ?? "decision";
}

export function resolveDecideMode(options: {
  dryRun?: boolean;
  shadow?: boolean;
  apiKey?: string;
}): { useLive: boolean; mode: DecideMode } {
  if (options.dryRun) {
    return { useLive: false, mode: "dry-run" };
  }
  if (options.shadow) {
    return { useLive: Boolean(options.apiKey), mode: "shadow" };
  }
  if (options.apiKey) {
    return { useLive: true, mode: "active" };
  }
  return { useLive: false, mode: "shadow" };
}

export function prettyDecideJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function decisionsReadmeStub(): string {
  return `# Decisions

Generic Choice/Noul records from \`tocket decide\`.

\`decide\` is generic (any state). \`tocket suite triage\` is suite-specific
(last-run failures). Suite loop still calls triage, not decide.

Writes stay under \`.context/decisions/\`. No app hooks, no runtime pollution.

| File | Purpose |
| --- | --- |
| \`<timestamp>-<id>.json\` | Decision record (\`schema\`: \`${DECIDE_SCHEMA}\`) |

\`--dry-run\` uses the deterministic stub. \`--shadow\` may call Jev when
\`TYPESAFE_API_KEY\` is set but marks \`mode: shadow\` (does not claim execution).
`;
}

export function parseDecideRecord(raw: string): DecideRecord {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || (value as { schema?: unknown }).schema !== DECIDE_SCHEMA) {
    throw new DecideError(`Invalid decision record (expected ${DECIDE_SCHEMA})`);
  }
  return value as DecideRecord;
}

export function formatDecideSummary(record: DecideRecord, relPath: string): string {
  const bits: string[] = [];
  for (const [name, answer] of Object.entries(record.answers)) {
    if (answer.type === "choice") {
      bits.push(`${name}=${answer.choice} (${answer.confidence.toFixed(2)})`);
    } else {
      bits.push(`${name}=${answer.noul.toFixed(2)}`);
    }
  }
  return `decide ${bits.join("  ")}  source=${record.source}  mode=${record.mode}  ${relPath}`;
}

function ensureDecisionsDir(cwd: string): string {
  const dir = resolve(cwd, DECISIONS_DIR);
  if (!isInsideContext(cwd, dir)) {
    throw new DecideError("decide writes only under .context/");
  }
  mkdirSync(dir, { recursive: true });
  const readmePath = resolve(dir, DECISIONS_README);
  if (!existsSync(readmePath)) {
    writeFileSync(readmePath, decisionsReadmeStub(), "utf-8");
  }
  return dir;
}

export async function runDecide(options: RunDecideOptions): Promise<{
  record: DecideRecord;
  outPath: string;
}> {
  const choices = (options.choices ?? []).map(parseChoiceSpec);
  const nouls = (options.nouls ?? []).map(parseNoulSpec);
  const questions = buildQuestions(choices, nouls);
  const state = loadState({ state: options.state, fromPath: options.fromPath });
  const generatedAt = options.now ? options.now() : new Date().toISOString();
  const id = slugId(options.id ?? defaultDecisionId(choices, nouls));
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

  let source: DecideSource = "stub";
  let model = STUB_MODEL;
  let answers = stubAnswers(questions, state);

  if (useLive && apiKey) {
    try {
      const live = await askJev({
        apiKey,
        state,
        questions,
        fetchImpl: options.fetchImpl,
      });
      answers = fromJevAnswers(live.answers);
      source = "jev";
      model = live.model || JEV_MODEL;
    } catch {
      answers = stubAnswers(questions, state);
      source = "stub";
      model = STUB_MODEL;
    }
  }

  const record: DecideRecord = {
    schema: DECIDE_SCHEMA,
    id,
    generated_at: generatedAt,
    mode,
    source,
    model,
    state_summary: summarizeState(state),
    state,
    questions,
    answers,
  };

  const outPath = decisionOutputPath(options.cwd, generatedAt, id);
  ensureDecisionsDir(options.cwd);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, prettyDecideJson(record), "utf-8");
  return { record, outPath };
}

export function toRepoRelative(cwd: string, outPath: string): string {
  if (isAbsolute(outPath) && outPath.startsWith(cwd)) {
    return relative(cwd, outPath) || outPath;
  }
  return outPath.startsWith(cwd) ? relative(cwd, outPath) : outPath;
}
