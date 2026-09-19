/** AppMap Memory Bank convention — file-first index and last-run history. */

export const LAST_RUN_SCHEMA = "tocket.appmaps.last-run/v0";

export const APPMAPS_DIR = ".context/appmaps";
export const LAST_RUN_JSON = "last-run.json";
export const LAST_RUN_MD = "last-run.md";
export const APPMAPS_README = "README.md";
export const APPMAPS_GOALS = "goals.md";

export interface LastRunResult {
  id: string;
  name: string;
  ok: boolean;
  ms: number;
  jev_choice?: string | null;
  jev_confidence?: number | null;
  /** Real last-run snapshots use objects; older fixtures may use a string. */
  evidence?: unknown;
  error?: string | null;
}

export interface LastRun {
  schema: typeof LAST_RUN_SCHEMA;
  app: string;
  map: string;
  runner: string;
  model: string;
  mode: string;
  finished_at: string;
  all_ok: boolean;
  passed: number;
  total: number;
  results: LastRunResult[];
}

export class LastRunValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LastRunValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function expectString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new LastRunValidationError(`${field} must be a string`);
  }
  return value;
}

function expectBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new LastRunValidationError(`${field} must be a boolean`);
  }
  return value;
}

function expectNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new LastRunValidationError(`${field} must be a finite number`);
  }
  return value;
}

function optionalString(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new LastRunValidationError(`${field} must be a string or null`);
  }
  return value;
}

function optionalNumber(value: unknown, field: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new LastRunValidationError(`${field} must be a finite number or null`);
  }
  return value;
}

function parseResult(value: unknown, index: number): LastRunResult {
  if (!isRecord(value)) {
    throw new LastRunValidationError(`results[${index}] must be an object`);
  }

  const result: LastRunResult = {
    id: expectString(value.id, `results[${index}].id`),
    name: expectString(value.name, `results[${index}].name`),
    ok: expectBoolean(value.ok, `results[${index}].ok`),
    ms: expectNumber(value.ms, `results[${index}].ms`),
  };

  const jevChoice = optionalString(value.jev_choice, `results[${index}].jev_choice`);
  if (jevChoice !== undefined) result.jev_choice = jevChoice;

  const jevConfidence = optionalNumber(value.jev_confidence, `results[${index}].jev_confidence`);
  if (jevConfidence !== undefined) result.jev_confidence = jevConfidence;

  if (value.evidence !== undefined) result.evidence = value.evidence;

  const error = optionalString(value.error, `results[${index}].error`);
  if (error !== undefined) result.error = error;

  return result;
}

/** Validate and normalize a parsed last-run document. */
export function validateLastRun(value: unknown): LastRun {
  if (!isRecord(value)) {
    throw new LastRunValidationError("last-run.json must be a JSON object");
  }

  const schema = expectString(value.schema, "schema");
  if (schema !== LAST_RUN_SCHEMA) {
    throw new LastRunValidationError(`schema must be "${LAST_RUN_SCHEMA}"`);
  }

  if (!Array.isArray(value.results)) {
    throw new LastRunValidationError("results must be an array");
  }

  return {
    schema: LAST_RUN_SCHEMA,
    app: expectString(value.app, "app"),
    map: expectString(value.map, "map"),
    runner: expectString(value.runner, "runner"),
    model: expectString(value.model, "model"),
    mode: expectString(value.mode, "mode"),
    finished_at: expectString(value.finished_at, "finished_at"),
    all_ok: expectBoolean(value.all_ok, "all_ok"),
    passed: expectNumber(value.passed, "passed"),
    total: expectNumber(value.total, "total"),
    results: value.results.map((item, index) => parseResult(item, index)),
  };
}

/** Parse a last-run.json string and validate it against v0. */
export function parseLastRun(raw: string): LastRun {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LastRunValidationError("last-run.json is not valid JSON");
  }
  return validateLastRun(parsed);
}

function mdCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function formatOk(ok: boolean): string {
  return ok ? "pass" : "fail";
}

/** Empty but schema-valid last-run document used by `tocket suite init`. */
export function emptyLastRun(): LastRun {
  return {
    schema: LAST_RUN_SCHEMA,
    app: "",
    map: "",
    runner: "",
    model: "",
    mode: "",
    finished_at: "",
    all_ok: true,
    passed: 0,
    total: 0,
    results: [],
  };
}

/** Human table for `.context/appmaps/last-run.md`. */
export function writeLastRunMd(run: LastRun): string {
  const resultRows = run.results.length
    ? run.results
        .map(
          (result) =>
            `| ${mdCell(result.id)} | ${mdCell(result.name)} | ${formatOk(result.ok)} | ${mdCell(result.ms)} | ${mdCell(result.jev_choice)} | ${mdCell(result.jev_confidence)} | ${mdCell(result.evidence)} | ${mdCell(result.error)} |`,
        )
        .join("\n")
    : "| _none_ | | | | | | | |";

  return `# Last AppMap run

| Field | Value |
| --- | --- |
| Schema | ${mdCell(run.schema)} |
| App | ${mdCell(run.app)} |
| Map | ${mdCell(run.map)} |
| Runner | ${mdCell(run.runner)} |
| Model | ${mdCell(run.model)} |
| Mode | ${mdCell(run.mode)} |
| Finished | ${mdCell(run.finished_at)} |
| Result | ${run.passed}/${run.total} passed |
| All OK | ${run.all_ok ? "yes" : "no"} |

## Results

| ID | Name | OK | ms | Jev | Confidence | Evidence | Error |
| --- | --- | --- | --- | --- | --- | --- | --- |
${resultRows}
`;
}

/** Minimal README stub written when `.context/appmaps/` is created. */
export function appmapsReadmeStub(): string {
  return `# AppMaps

Index and last-run history for AppMap suites.

Executable maps live outside this directory (for example \`appmaps/*.json\`).
\`.context/appmaps/\` is file-first: \`tocket suite\` reads and writes these files and does not execute maps.

| File | Purpose |
| --- | --- |
| \`goals.md\` | Suite goals and coverage intent |
| \`last-run.json\` | Last run (\`schema\`: \`${LAST_RUN_SCHEMA}\`) |
| \`last-run.md\` | Human-readable last-run table |
| \`<app>.triage.json\` | Optional Jev/heuristic triage (\`tocket.appmaps.triage/v0\`) |
`;
}

export function appmapsGoalsStub(): string {
  return `# AppMap goals

Record suite goals and coverage intent here.

Executable maps stay outside \`.context/appmaps/\`. This file is the Memory Bank index, not a runner.
`;
}

export function prettyLastRunJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
