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
/** Codila chief.py default: only route research/write at or above this confidence. */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.85;
export const QUEUE_DESTINATIONS = ["research", "write", "review"] as const;
export const HIGH_CONFIDENCE_ROUTES = ["research", "write"] as const;
export const BOUNDED_FORKS = ["agent", "model", "tool", "action", "human"] as const;
export const DECIDE_LOOP = "state-questions-action-verify";
export const RANK_WIDE_MIN = 5;

export type QueueDestination = (typeof QUEUE_DESTINATIONS)[number];
export type BoundedFork = (typeof BOUNDED_FORKS)[number];
export type DecideMode = "active" | "shadow" | "dry-run";
export type DecideSource = "jev" | "stub";
export type DecideSemantics = "handoff" | "log-only";
export type DecideHandoffStatus = "queued" | "logged";
export type DecidePrimitive = "choice" | "noul" | "score";

export interface DecideChoiceSpec {
  name: string;
  options: string[];
}

export interface DecideNoulSpec {
  name: string;
}

export interface DecideScoreSpec {
  name: string;
  min: number;
  max: number;
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

export interface DecideScoreAnswer {
  type: "score";
  score: number;
  confidence: number;
  rationale: string;
}

export type DecideAnswer = DecideChoiceAnswer | DecideNoulAnswer | DecideScoreAnswer;

export interface DecideRecord {
  schema: typeof DECIDE_SCHEMA;
  id: string;
  generated_at: string;
  mode: DecideMode;
  source: DecideSource;
  model: string;
  /** Codila-style router: selected option (first Choice). */
  choice: string | null;
  confidence: number;
  /** Queue hint: research | write | review. Low-confidence research/write becomes review. */
  destination: QueueDestination;
  gated: boolean;
  confidence_threshold: number;
  /** handoff = workers may consume; log-only = shadow/dry-run (Tocket does not run workers). */
  semantics: DecideSemantics;
  status: DecideHandoffStatus;
  /** Always false: Jev decides; LLMs create; agents act. This CLI only writes a file. */
  executes: false;
  loop: typeof DECIDE_LOOP;
  fork: BoundedFork;
  primitives: DecidePrimitive[];
  batched: boolean;
  rank_wide: boolean;
  narrow: string | null;
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
  scores?: string[];
  fork?: string;
  dryRun?: boolean;
  shadow?: boolean;
  id?: string;
  confidenceThreshold?: number;
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

export function parseScoreSpec(spec: string): DecideScoreSpec {
  const trimmed = spec.trim();
  const colon = trimmed.indexOf(":");
  if (colon === -1) {
    const name = slugId(trimmed);
    if (!name || name === "decision") {
      throw new DecideError(`Invalid --score name "${spec}".`);
    }
    return { name, min: 0, max: 1 };
  }
  const name = slugId(trimmed.slice(0, colon));
  const scale = trimmed
    .slice(colon + 1)
    .split(",")
    .map((item) => Number(item.trim()));
  if (name === "decision" || scale.length !== 2 || !scale.every(Number.isFinite) || scale[0] >= scale[1]) {
    throw new DecideError(`Invalid --score spec "${spec}". Use name or name:min,max.`);
  }
  return { name, min: scale[0], max: scale[1] };
}

export function parseFork(raw?: string): BoundedFork {
  const value = (raw ?? "action").trim().toLowerCase();
  if (!(BOUNDED_FORKS as readonly string[]).includes(value)) {
    throw new DecideError(`--fork must be one of ${BOUNDED_FORKS.join(", ")}.`);
  }
  return value as BoundedFork;
}

const CODILA_CRITERIA: Record<string, string> = {
  research: "Collect evidence still needed for the goal.",
  write: "Draft from sufficient evidence.",
  review: "Goal unclear, outside scope, or work complete.",
};

export function choiceCriterion(option: string): string {
  return CODILA_CRITERIA[option] ?? `Prefer ${option} when the state indicates ${option}.`;
}

export function isQueueDestination(value: string): value is QueueDestination {
  return (QUEUE_DESTINATIONS as readonly string[]).includes(value);
}

export function isHighConfidenceRoute(value: string): boolean {
  return (HIGH_CONFIDENCE_ROUTES as readonly string[]).includes(value);
}

export function parseConfidenceThreshold(raw?: string | number): number {
  if (raw === undefined || raw === "") return DEFAULT_CONFIDENCE_THRESHOLD;
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new DecideError("--confidence-threshold must be a number between 0 and 1.");
  }
  return value;
}

export function primaryChoice(answers: Record<string, DecideAnswer>): {
  choice: string | null;
  confidence: number;
} {
  for (const answer of Object.values(answers)) {
    if (answer.type === "choice") {
      return { choice: answer.choice, confidence: answer.confidence };
    }
  }
  for (const answer of Object.values(answers)) {
    if (answer.type === "noul") {
      return { choice: null, confidence: answer.confidence };
    }
  }
  return { choice: null, confidence: 0 };
}

/** Codila gate: research/write only when confidence >= threshold; otherwise review. */
export function resolveDestination(
  choice: string | null,
  confidence: number,
  threshold: number = DEFAULT_CONFIDENCE_THRESHOLD,
  fork: BoundedFork = "action",
): { destination: QueueDestination; gated: boolean } {
  if (fork === "human") {
    return { destination: "review", gated: true };
  }
  if (choice && isHighConfidenceRoute(choice) && confidence >= threshold) {
    return { destination: choice as QueueDestination, gated: false };
  }
  const gated = Boolean(choice && isHighConfidenceRoute(choice) && confidence < threshold);
  return { destination: "review", gated };
}

export function resolveSemantics(mode: DecideMode): {
  semantics: DecideSemantics;
  status: DecideHandoffStatus;
} {
  if (mode === "active") {
    return { semantics: "handoff", status: "queued" };
  }
  return { semantics: "log-only", status: "logged" };
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
  scores: DecideScoreSpec[] = [],
): Record<string, JevQuestion> {
  if (choices.length === 0 && nouls.length === 0 && scores.length === 0) {
    throw new DecideError("Pass --choice, --noul, and/or --score.");
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
        choice.options.map((option) => [option, choiceCriterion(option)]),
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
  for (const score of scores) {
    if (questions[score.name]) {
      throw new DecideError(`Duplicate question name "${score.name}".`);
    }
    questions[score.name] = {
      type: "score",
      instructions: `Score "${score.name}" from ${score.min} to ${score.max}.`,
      min: score.min,
      max: score.max,
      criteria: {
        low: `Low ${score.name} near ${score.min}.`,
        high: `High ${score.name} near ${score.max}.`,
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

export function stubScore(name: string, min: number, max: number, state: unknown): DecideScoreAnswer {
  const noul = stubNoul(name, state);
  const score = min + noul.noul * (max - min);
  return {
    type: "score",
    score: Number(score.toFixed(4)),
    confidence: noul.confidence,
    rationale: noul.rationale.replace("noul", "score").replace("Noul", "Score"),
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
    } else if (question.type === "noul") {
      answers[name] = stubNoul(name, state);
    } else {
      answers[name] = stubScore(name, question.min ?? 0, question.max ?? 1, state);
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
    } else if (answer.type === "noul") {
      answers[name] = {
        type: "noul",
        noul: answer.noul,
        confidence: answer.confidence,
        rationale: `Jev noul=${answer.noul.toFixed(2)}.`,
      };
    } else {
      answers[name] = {
        type: "score",
        score: answer.score,
        confidence: answer.confidence,
        rationale: `Jev score=${answer.score.toFixed(2)}.`,
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

export function decisionOutputPath(
  cwd: string,
  generatedAt: string,
  id: string,
  destination?: QueueDestination,
): string {
  const file = `${fileTimestamp(generatedAt)}-${slugId(id)}.json`;
  const outPath = destination
    ? resolve(cwd, DECISIONS_DIR, destination, file)
    : resolve(cwd, DECISIONS_DIR, file);
  if (!isInsideContext(cwd, outPath)) {
    throw new DecideError("decide writes only under .context/");
  }
  return outPath;
}

export function defaultDecisionId(
  choices: DecideChoiceSpec[],
  nouls: DecideNoulSpec[],
  scores: DecideScoreSpec[] = [],
): string {
  return choices[0]?.name ?? nouls[0]?.name ?? scores[0]?.name ?? "decision";
}

export function listPrimitives(questions: Record<string, JevQuestion>): DecidePrimitive[] {
  const seen = new Set<DecidePrimitive>();
  for (const question of Object.values(questions)) {
    seen.add(question.type);
  }
  return [...seen];
}

export function choiceOptionCount(questions: Record<string, JevQuestion>): number {
  for (const question of Object.values(questions)) {
    if (question.type === "choice") {
      return Object.keys(question.criteria).length;
    }
  }
  return 0;
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

Generic Choice/Noul (optional Score) handoff records from \`tocket decide\`.

This is Tocket's file-handoff cousin of Codila's \`chief.py\` queues
(https://x.com/0xCodila/status/2100984487802708306). LLMs create, agents act,
Jev decides the next move. The CLI writes a JSON the worker reads later.
Tocket does not run the workers, write prose, do math, or execute.

\`decide\` is generic (any state). \`tocket suite triage\` is suite-specific
(last-run failures). Suite loop still calls triage, not decide.

Writes stay under \`.context/decisions/\` (optional \`research|write|review\`
subfolder when the Choice maps cleanly). No app hooks, no runtime pollution.

| File | Purpose |
| --- | --- |
| \`<destination>/<timestamp>-<id>.json\` | Handoff record (\`schema\`: \`${DECIDE_SCHEMA}\`) |

Research/write route only when confidence >= ${DEFAULT_CONFIDENCE_THRESHOLD}
(configurable). Below that, \`destination\` is \`review\` (\`gated: true\`).

Bounded forks: \`--fork agent|model|tool|action|human\`. \`human\` always reviews.
Questions batch into one System One request. Loop: State → Questions → Action (this file) → Verify (consumer).

\`--dry-run\` uses the deterministic stub. \`--shadow\` may call Jev when
\`TYPESAFE_API_KEY\` is set but marks \`semantics: log-only\` (does not claim execution).
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
    } else if (answer.type === "noul") {
      bits.push(`${name}=${answer.noul.toFixed(2)}`);
    } else {
      bits.push(`${name}=${answer.score.toFixed(2)}`);
    }
  }
  const gate = record.gated ? "gated" : "route";
  return `decide ${bits.join("  ")}  dest=${record.destination}  ${gate}  source=${record.source}  mode=${record.mode}  ${relPath}`;
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
  const scores = (options.scores ?? []).map(parseScoreSpec);
  const fork = parseFork(options.fork);
  const questions = buildQuestions(choices, nouls, scores);
  const state = loadState({ state: options.state, fromPath: options.fromPath });
  const generatedAt = options.now ? options.now() : new Date().toISOString();
  const id = slugId(options.id ?? defaultDecisionId(choices, nouls, scores));
  const dryRun = options.dryRun === true;
  const threshold = parseConfidenceThreshold(options.confidenceThreshold);
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
  const { semantics, status } = resolveSemantics(mode);

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

  const primary = primaryChoice(answers);
  const { destination, gated } = resolveDestination(
    primary.choice,
    primary.confidence,
    threshold,
    fork,
  );
  const optionCount = choiceOptionCount(questions);

  const record: DecideRecord = {
    schema: DECIDE_SCHEMA,
    id,
    generated_at: generatedAt,
    mode,
    source,
    model,
    choice: primary.choice,
    confidence: primary.confidence,
    destination,
    gated,
    confidence_threshold: threshold,
    semantics,
    status,
    executes: false,
    loop: DECIDE_LOOP,
    fork,
    primitives: listPrimitives(questions),
    batched: Object.keys(questions).length > 1,
    rank_wide: optionCount >= RANK_WIDE_MIN,
    narrow: primary.choice,
    state_summary: summarizeState(state),
    state,
    questions,
    answers,
  };

  const outPath = decisionOutputPath(options.cwd, generatedAt, id, destination);
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
