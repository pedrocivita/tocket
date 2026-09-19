import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  APPMAPS_DIR,
  parseLastRun,
  prettyLastRunJson,
  type LastRun,
  type LastRunResult,
} from "./appmaps.js";
import {
  JEV_MODEL,
  askJevTriage,
  readTypesafeApiKey,
  type TriageChoice,
} from "./jev.js";

export const TRIAGE_SCHEMA = "tocket.appmaps.triage/v0";
export const LOW_CONFIDENCE_THRESHOLD = 0.6;
export const HEURISTIC_MODEL = "heuristic-v0";

export type { TriageChoice };

export type TriageMode = "heuristic" | "jev" | "dry-run";
export type TriageSource = "heuristic" | "jev";

export interface TriageCase {
  id: string;
  name: string;
  ok: boolean;
  error: string | null;
  jev_confidence: number | null;
  choice: TriageChoice;
  confidence: number;
  locator_drift: number;
  rationale: string;
  source: TriageSource;
}

export interface TriageReport {
  schema: typeof TRIAGE_SCHEMA;
  app: string;
  map: string;
  source: string;
  generated_at: string;
  mode: TriageMode;
  model: string;
  include_low_confidence: boolean;
  cases: TriageCase[];
}

export interface HeuristicJudgment {
  choice: TriageChoice;
  confidence: number;
  locatorDrift: number;
  rationale: string;
}

export interface TriageInput {
  id: string;
  name: string;
  ok: boolean;
  error?: string | null;
  evidence?: unknown;
  jev_confidence?: number | null;
  notes?: string;
}

export interface RunTriageOptions {
  fromPath: string;
  cwd: string;
  mapPath?: string;
  notes?: string;
  includeLowConfidence?: boolean;
  dryRun?: boolean;
  outPath?: string;
  apiKey?: string | null;
  now?: () => string;
  fetchImpl?: typeof fetch;
}

const LOCATOR_RE =
  /\b(locator|selector|getby(?:role|text|label|placeholder|testid|title|alttext)?|data-testid|no such element|not found|stale|detached|strict mode violation|unable to locate)\b/i;
const ASSERT_RE =
  /\b(assertion(?:error)?|expect(?:ed)?|tohave|tobe|toequal|received|expected\b)/i;
const TRANSIENT_RE =
  /\b(timeout|etimedout|timed out|flak(?:y|e)|econnreset|econnrefused|err_connection|net::err_|503|502|504|service unavailable|connection reset)\b/i;
const NOISE_RE =
  /\b(resizeobserver|benign|known warning|console warning|pixel diff|screenshot comparison)\b/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function evidenceText(evidence: unknown): string {
  if (evidence == null) return "";
  if (typeof evidence === "string") return evidence;
  try {
    return JSON.stringify(evidence);
  } catch {
    return String(evidence);
  }
}

function blob(input: TriageInput): string {
  return [input.error, evidenceText(input.evidence), input.notes]
    .filter((part) => part && part.trim())
    .join("\n")
    .toLowerCase();
}

/** Deterministic flavor classifier. Does not key off fixture ids. */
export function heuristicJudge(input: TriageInput): HeuristicJudgment {
  const text = blob(input);

  if (input.ok) {
    return {
      choice: "ignore",
      confidence: 0.86,
      locatorDrift: 0.08,
      rationale: "Goal passed; no maintainer action.",
    };
  }

  if (NOISE_RE.test(text)) {
    return {
      choice: "ignore",
      confidence: 0.8,
      locatorDrift: 0.1,
      rationale: "Failure looks like known benign noise.",
    };
  }

  if (ASSERT_RE.test(text)) {
    return {
      choice: "escalate",
      confidence: 0.88,
      locatorDrift: LOCATOR_RE.test(text) ? 0.35 : 0.12,
      rationale: "Assertion or expect mismatch; treat as a product failure.",
    };
  }

  if (LOCATOR_RE.test(text)) {
    return {
      choice: "rewrite-locator",
      confidence: 0.9,
      locatorDrift: 0.86,
      rationale: "Selector/locator signal (missing, stale, strict, or wait-for-locator).",
    };
  }

  if (TRANSIENT_RE.test(text)) {
    return {
      choice: "retry",
      confidence: 0.84,
      locatorDrift: 0.14,
      rationale: "Transient timeout, flake, or connectivity error.",
    };
  }

  return {
    choice: "escalate",
    confidence: 0.7,
    locatorDrift: 0.16,
    rationale: "Failed goal with empty or unknown error; escalate to a human.",
  };
}

/** Naive baseline used by the eval kill check: fail → escalate, pass → ignore. */
export function naiveIfElseChoice(input: Pick<TriageInput, "ok">): TriageChoice {
  return input.ok ? "ignore" : "escalate";
}

export function shouldTriage(
  result: LastRunResult,
  includeLowConfidence: boolean,
): boolean {
  if (!result.ok) return true;
  if (!includeLowConfidence) return false;
  const confidence = result.jev_confidence;
  return typeof confidence === "number" && confidence < LOW_CONFIDENCE_THRESHOLD;
}

export function selectResults(
  run: LastRun,
  includeLowConfidence: boolean,
): LastRunResult[] {
  return run.results.filter((result) => shouldTriage(result, includeLowConfidence));
}

function toInput(result: LastRunResult, notes?: string): TriageInput {
  return {
    id: result.id,
    name: result.name,
    ok: result.ok,
    error: result.error ?? null,
    evidence: result.evidence,
    jev_confidence: result.jev_confidence ?? null,
    notes,
  };
}

function fromHeuristic(result: LastRunResult, judgment: HeuristicJudgment): TriageCase {
  return {
    id: result.id,
    name: result.name,
    ok: result.ok,
    error: result.error ?? null,
    jev_confidence: result.jev_confidence ?? null,
    choice: judgment.choice,
    confidence: judgment.confidence,
    locator_drift: judgment.locatorDrift,
    rationale: judgment.rationale,
    source: "heuristic",
  };
}

export function heuristicCase(result: LastRunResult, notes?: string): TriageCase {
  return fromHeuristic(result, heuristicJudge(toInput(result, notes)));
}

export async function judgeResult(
  result: LastRunResult,
  options: {
    notes?: string;
    mapExcerpt?: string;
    apiKey?: string;
    fetchImpl?: typeof fetch;
  },
): Promise<TriageCase> {
  if (!options.apiKey) {
    return heuristicCase(result, options.notes);
  }

  try {
    const answers = await askJevTriage({
      apiKey: options.apiKey,
      fetchImpl: options.fetchImpl,
      state: {
        goal_id: result.id,
        goal_name: result.name,
        ok: result.ok,
        error: result.error ?? null,
        jev_confidence: result.jev_confidence ?? null,
        evidence: result.evidence ?? null,
        notes: options.notes ?? null,
        map_excerpt: options.mapExcerpt ?? null,
        actions: [
          "retry",
          "escalate",
          "ignore",
          "rewrite-locator",
        ],
      },
    });
    return {
      id: result.id,
      name: result.name,
      ok: result.ok,
      error: result.error ?? null,
      jev_confidence: result.jev_confidence ?? null,
      choice: answers.choice,
      confidence: answers.confidence,
      locator_drift: answers.locatorDrift,
      rationale: `Jev Choice=${answers.choice}; locator-drift noul=${answers.locatorDrift.toFixed(2)}.`,
      source: "jev",
    };
  } catch {
    const fallback = heuristicCase(result, options.notes);
    return {
      ...fallback,
      rationale: `${fallback.rationale} (Jev unavailable; heuristic fallback)`,
    };
  }
}

export function triageOutputPath(cwd: string, app: string, outPath?: string): string {
  if (outPath) return outPath;
  const slug = app.trim() ? app.trim().replace(/[^a-zA-Z0-9._-]+/g, "-") : "suite";
  return join(cwd, APPMAPS_DIR, `${slug}.triage.json`);
}

export function buildTriageReport(args: {
  run: LastRun;
  cases: TriageCase[];
  source: string;
  mode: TriageMode;
  model: string;
  includeLowConfidence: boolean;
  generatedAt: string;
}): TriageReport {
  return {
    schema: TRIAGE_SCHEMA,
    app: args.run.app,
    map: args.run.map,
    source: args.source,
    generated_at: args.generatedAt,
    mode: args.mode,
    model: args.model,
    include_low_confidence: args.includeLowConfidence,
    cases: args.cases,
  };
}

function readMapExcerpt(mapPath?: string): string | undefined {
  if (!mapPath) return undefined;
  try {
    const raw = readFileSync(mapPath, "utf-8");
    return raw.length > 4000 ? `${raw.slice(0, 4000)}\n…` : raw;
  } catch {
    return undefined;
  }
}

export async function runTriage(options: RunTriageOptions): Promise<{
  report: TriageReport;
  outPath: string;
}> {
  const includeLowConfidence = options.includeLowConfidence === true;
  const dryRun = options.dryRun === true;
  const apiKey = dryRun ? undefined : (options.apiKey === null ? undefined : options.apiKey ?? readTypesafeApiKey());
  const mode: TriageMode = dryRun ? "dry-run" : apiKey ? "jev" : "heuristic";
  const run = parseLastRun(readFileSync(options.fromPath, "utf-8"));
  const selected = selectResults(run, includeLowConfidence);
  const mapExcerpt = readMapExcerpt(options.mapPath);

  const cases: TriageCase[] = [];
  for (const result of selected) {
    cases.push(
      await judgeResult(result, {
        notes: options.notes,
        mapExcerpt,
        apiKey,
        fetchImpl: options.fetchImpl,
      }),
    );
  }

  const usedJev = cases.some((item) => item.source === "jev");
  const report = buildTriageReport({
    run,
    cases,
    source: options.fromPath,
    mode,
    model: usedJev ? JEV_MODEL : HEURISTIC_MODEL,
    includeLowConfidence,
    generatedAt: options.now ? options.now() : new Date().toISOString(),
  });

  const outPath = triageOutputPath(options.cwd, run.app, options.outPath);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, prettyLastRunJson(report), "utf-8");
  return { report, outPath };
}

export function parseTriageReport(raw: string): TriageReport {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || value.schema !== TRIAGE_SCHEMA || !Array.isArray(value.cases)) {
    throw new Error(`Invalid triage report (expected ${TRIAGE_SCHEMA})`);
  }
  return value as unknown as TriageReport;
}
