/** Reference worker: read a decide Choice and stamp a notebook receipt. Never calls Jev. */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import {
  DECISIONS_DIR,
  DecideError,
  QUEUE_DESTINATIONS,
  isInsideContext,
  parseDecideRecord,
  prettyDecideJson,
  resolveRecordToolGate,
  toRepoRelative,
  toolGateRefusesApply,
  type DecideMode,
  type DecideRecord,
  type DecideSemantics,
  type QueueDestination,
  type ToolGate,
} from "./decide.js";

export const WORK_APPLIED_SCHEMA = "tocket.work.applied/v0";

export class WorkError extends Error {
  readonly exitCode: 1 | 2;

  constructor(message: string, exitCode: 1 | 2 = 1) {
    super(message);
    this.name = "WorkError";
    this.exitCode = exitCode;
  }
}

export interface WorkAppliedRecord {
  schema: typeof WORK_APPLIED_SCHEMA;
  id: string;
  decision_id: string;
  decision_path: string;
  applied_at: string;
  choice: string | null;
  destination: QueueDestination;
  confidence: number;
  gated: boolean;
  tool_gate: ToolGate | null;
  semantics: DecideSemantics;
  mode: DecideMode;
  applied_from_shadow: boolean;
  forced: boolean;
}

export interface RunWorkOptions {
  cwd: string;
  fromPath?: string;
  apply?: boolean;
  force?: boolean;
  now?: () => string;
}

export interface WorkPlan {
  record: DecideRecord;
  decisionPath: string;
  shadow: boolean;
  toolGate: ToolGate | null;
  wouldRefuse: boolean;
}

export interface RunWorkResult {
  plan: WorkPlan;
  applied: boolean;
  receipt?: WorkAppliedRecord;
  receiptPath?: string;
  progressPath?: string;
  summary: string;
}

/**
 * Shadow / log-only / dry-run records are advice, not silent apply.
 * `executes: false` is the decide-record invariant (Tocket never executes)
 * and is not a refuse signal on its own.
 */
export function isShadowDecision(record: DecideRecord): boolean {
  return (
    record.semantics === "log-only" ||
    record.mode === "shadow" ||
    record.mode === "dry-run" ||
    record.status === "logged"
  );
}

export function isAppliedReceiptName(name: string): boolean {
  return name.endsWith(".applied.json");
}

export function appliedReceiptPath(decisionPath: string): string {
  if (isAppliedReceiptName(decisionPath)) {
    throw new WorkError("Refusing to apply a receipt file. Pass the decision JSON.", 1);
  }
  if (!decisionPath.endsWith(".json")) {
    throw new WorkError("Decision path must be a .json file.", 1);
  }
  return decisionPath.replace(/\.json$/, ".applied.json");
}

export function findLatestQueueDecision(cwd: string): string | null {
  const files: { path: string; mtimeMs: number; name: string }[] = [];
  for (const destination of QUEUE_DESTINATIONS) {
    const dir = resolve(cwd, DECISIONS_DIR, destination);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".json") || isAppliedReceiptName(name)) continue;
      const full = resolve(dir, name);
      if (!isInsideContext(cwd, full)) continue;
      files.push({ path: full, mtimeMs: statSync(full).mtimeMs, name });
    }
  }
  if (files.length === 0) return null;
  files.sort((a, b) => {
    if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs;
    return b.name.localeCompare(a.name);
  });
  return files[0].path;
}

function resolveDecisionPath(cwd: string, fromPath?: string): string {
  if (fromPath) {
    return isAbsolute(fromPath) ? fromPath : resolve(cwd, fromPath);
  }
  const latest = findLatestQueueDecision(cwd);
  if (!latest) {
    throw new WorkError(
      "No decision found. Pass --from <decision.json> or run tocket decide first.",
      1,
    );
  }
  return latest;
}

export function loadDecision(
  cwd: string,
  fromPath?: string,
): { record: DecideRecord; path: string } {
  const path = resolveDecisionPath(cwd, fromPath);
  if (!existsSync(path)) {
    throw new WorkError(`Decision file not found: ${path}`, 1);
  }
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new WorkError(`Cannot read decision file: ${message}`, 1);
  }
  try {
    return { record: parseDecideRecord(raw), path };
  } catch (err) {
    if (err instanceof DecideError) {
      throw new WorkError(err.message, 1);
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new WorkError(`Invalid decision JSON: ${message}`, 1);
  }
}

export function planWork(options: RunWorkOptions): WorkPlan {
  const { record, path } = loadDecision(options.cwd, options.fromPath);
  const shadow = isShadowDecision(record);
  const toolGate = resolveRecordToolGate(record);
  const gateRefuse = toolGateRefusesApply(toolGate);
  return {
    record,
    decisionPath: path,
    shadow,
    toolGate,
    wouldRefuse: (shadow || gateRefuse) && options.force !== true,
  };
}

export function formatRefuseApply(plan: WorkPlan): string {
  const gateRefuse = toolGateRefusesApply(plan.toolGate);
  if (!gateRefuse && plan.shadow) {
    return "Refuse apply: shadow/log-only decision. Dry-run is always OK. Pass --force to stamp applied_from_shadow.";
  }
  if (plan.toolGate === "block") {
    const shadow = plan.shadow ? " Shadow/log-only decision." : "";
    return `Refuse apply: tool_gate=block.${shadow} Dry-run is always OK. Pass --force to override the gate.`;
  }
  if (plan.toolGate === "ask") {
    const shadow = plan.shadow ? " Shadow/log-only decision." : "";
    return `Refuse apply: tool_gate=ask. Escalate to a human before irreversible tools.${shadow} Dry-run is always OK. Pass --force to override the gate.`;
  }
  return "Refuse apply: decision is not applyable. Dry-run is always OK. Pass --force to override.";
}

export function formatWorkProgressLine(record: DecideRecord): string {
  const choice = record.choice ?? record.narrow ?? record.id;
  const gate = record.gated ? " gated" : "";
  const toolGate = record.tool_gate ? ` tool_gate=${record.tool_gate}` : "";
  return `- worker applied: next=${choice} dest=${record.destination} confidence=${record.confidence.toFixed(2)}${gate}${toolGate}`;
}

function formatApplyHint(plan: WorkPlan): string {
  if (!plan.wouldRefuse) {
    return "apply=ok  (pass --apply to write receipt)";
  }
  if (plan.toolGate === "block") {
    return "apply=refuse  (tool_gate=block; pass --apply --force to override)";
  }
  if (plan.toolGate === "ask") {
    return "apply=refuse  (tool_gate=ask; escalate/human; pass --apply --force to override)";
  }
  return "apply=refuse  (shadow/log-only; pass --apply --force to stamp applied_from_shadow)";
}

export function formatWorkPlan(plan: WorkPlan, cwd: string): string {
  const { record } = plan;
  const gate = record.gated ? "gated" : "route";
  const from = toRepoRelative(cwd, plan.decisionPath);
  const toolGate = plan.toolGate ?? "none";
  return [
    `work plan  choice=${record.choice ?? "null"}  dest=${record.destination}  confidence=${record.confidence.toFixed(2)}  ${gate}  tool_gate=${toolGate}  semantics=${record.semantics}  mode=${record.mode}`,
    `  from=${from}`,
    `  next=${record.choice ?? record.narrow ?? record.id}`,
    `  ${formatApplyHint(plan)}`,
  ].join("\n");
}

export function formatWorkApplied(
  receipt: WorkAppliedRecord,
  receiptPath: string,
  cwd: string,
): string {
  const rel = toRepoRelative(cwd, receiptPath);
  const shadow = receipt.applied_from_shadow ? "  applied_from_shadow" : "";
  return `work applied  choice=${receipt.choice ?? "null"}  dest=${receipt.destination}  confidence=${receipt.confidence.toFixed(2)}  ${rel}${shadow}`;
}

export function appendWorkProgress(cwd: string, line: string): string {
  const contextDir = resolve(cwd, ".context");
  const progressPath = resolve(contextDir, "progress.md");
  if (!isInsideContext(cwd, progressPath)) {
    throw new WorkError("work writes only under .context/", 1);
  }
  mkdirSync(contextDir, { recursive: true });
  if (!existsSync(progressPath)) {
    writeFileSync(progressPath, `# Progress Log\n\n${line}\n`, "utf-8");
    return progressPath;
  }
  const current = readFileSync(progressPath, "utf-8");
  const suffix = current.endsWith("\n") ? `${line}\n` : `\n${line}\n`;
  writeFileSync(progressPath, current + suffix, "utf-8");
  return progressPath;
}

export function applyWork(options: RunWorkOptions): {
  plan: WorkPlan;
  receipt: WorkAppliedRecord;
  receiptPath: string;
  progressPath: string;
} {
  const plan = planWork(options);
  if (plan.wouldRefuse) {
    throw new WorkError(formatRefuseApply(plan), 2);
  }

  const receiptPath = appliedReceiptPath(plan.decisionPath);
  const contextRoot = resolve(options.cwd, ".context");
  if (plan.decisionPath.startsWith(contextRoot) && !isInsideContext(options.cwd, receiptPath)) {
    throw new WorkError("work writes only under .context/", 1);
  }

  const appliedAt = options.now ? options.now() : new Date().toISOString();
  const receipt: WorkAppliedRecord = {
    schema: WORK_APPLIED_SCHEMA,
    id: plan.record.id,
    decision_id: plan.record.id,
    decision_path: toRepoRelative(options.cwd, plan.decisionPath),
    applied_at: appliedAt,
    choice: plan.record.choice,
    destination: plan.record.destination,
    confidence: plan.record.confidence,
    gated: plan.record.gated,
    tool_gate: plan.toolGate,
    semantics: plan.record.semantics,
    mode: plan.record.mode,
    applied_from_shadow: plan.shadow,
    forced: options.force === true,
  };

  writeFileSync(receiptPath, prettyDecideJson(receipt), "utf-8");
  const progressPath = appendWorkProgress(options.cwd, formatWorkProgressLine(plan.record));
  return { plan, receipt, receiptPath, progressPath };
}

/** Plan by default. `--apply` stamps a receipt. Never calls TypeSafe / Jev. */
export function runWork(options: RunWorkOptions): RunWorkResult {
  if (options.apply === true) {
    const { plan, receipt, receiptPath, progressPath } = applyWork(options);
    return {
      plan,
      applied: true,
      receipt,
      receiptPath,
      progressPath,
      summary: formatWorkApplied(receipt, receiptPath, options.cwd),
    };
  }
  const plan = planWork(options);
  return {
    plan,
    applied: false,
    summary: formatWorkPlan(plan, options.cwd),
  };
}
