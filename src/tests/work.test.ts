import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  copyFileSync,
  utimesSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { DECIDE_SCHEMA } from "../utils/decide.js";
import {
  WORK_APPLIED_SCHEMA,
  WorkError,
  appliedReceiptPath,
  findLatestQueueDecision,
  formatWorkProgressLine,
  isShadowDecision,
  loadDecision,
  runWork,
} from "../utils/work.js";
import { parseDecideRecord } from "../utils/decide.js";

const cliPath = join(import.meta.dirname, "..", "index.js");
const fixturesDir = join(import.meta.dirname, "..", "..", "fixtures", "work");
const handoffFixture = join(fixturesDir, "handoff.json");
const shadowFixture = join(fixturesDir, "shadow.json");

function runCli(
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync(process.execPath, [cliPath, ...args], {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, TYPESAFE_API_KEY: "", ...env },
    });
    return { stdout, stderr: "", status: 0 };
  } catch (err) {
    const failed = err as { stdout?: string; stderr?: string; status?: number | null };
    return {
      stdout: failed.stdout ?? "",
      stderr: failed.stderr ?? "",
      status: failed.status ?? 1,
    };
  }
}

describe("work helpers", () => {
  it("treats log-only / shadow / dry-run as shadow, not executes=false alone", () => {
    const handoff = parseDecideRecord(readFileSync(handoffFixture, "utf-8"));
    const shadow = parseDecideRecord(readFileSync(shadowFixture, "utf-8"));
    assert.equal(handoff.executes, false);
    assert.equal(isShadowDecision(handoff), false);
    assert.equal(isShadowDecision(shadow), true);
    assert.equal(isShadowDecision({ ...handoff, mode: "dry-run", semantics: "log-only" }), true);
    assert.equal(appliedReceiptPath("/tmp/20260920T150130Z-next.json"), "/tmp/20260920T150130Z-next.applied.json");
    assert.throws(() => appliedReceiptPath("/tmp/x.applied.json"), /receipt file/);
  });

  it("formats the progress line from the choice", () => {
    const record = parseDecideRecord(readFileSync(handoffFixture, "utf-8"));
    assert.equal(
      formatWorkProgressLine(record),
      "- worker applied: next=write dest=write confidence=0.91",
    );
    const shadow = parseDecideRecord(readFileSync(shadowFixture, "utf-8"));
    assert.match(formatWorkProgressLine(shadow), /next=write dest=review confidence=0.78 gated/);
  });
});

describe("tocket work help", () => {
  it("frames the reference worker and never-Jev rule", () => {
    const result = runCli(["work", "--help"], process.cwd());
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Never calls Jev/i);
    assert.match(result.stdout, /TypeSafe/);
    assert.match(result.stdout, /--apply/);
    assert.match(result.stdout, /--force/);
    assert.match(result.stdout, /exit 2/i);
    assert.match(result.stdout, /does not re-decide/i);
  });
});

describe("tocket work", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-work-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("dry-runs a fixture without writing or calling Jev", () => {
    const cwd = join(tempDir, "dry");
    mkdirSync(cwd, { recursive: true });
    const result = runWork({
      cwd,
      fromPath: handoffFixture,
      apply: false,
    });
    assert.equal(result.applied, false);
    assert.equal(result.plan.record.schema, DECIDE_SCHEMA);
    assert.equal(result.plan.record.choice, "write");
    assert.equal(result.plan.record.destination, "write");
    assert.equal(result.plan.shadow, false);
    assert.match(result.summary, /work plan/);
    assert.match(result.summary, /choice=write/);
    assert.match(result.summary, /dest=write/);
    assert.match(result.summary, /confidence=0.91/);
    assert.match(result.summary, /semantics=handoff/);
    assert.equal(existsSync(appliedReceiptPath(handoffFixture)), false);
    assert.equal(existsSync(join(cwd, ".context", "progress.md")), false);

    const cli = runCli(["work", "--from", handoffFixture], cwd, {
      TYPESAFE_API_KEY: "must-not-be-used",
    });
    assert.equal(cli.status, 0, cli.stderr);
    assert.match(cli.stdout, /work plan/);
    assert.match(cli.stdout, /choice=write/);
    assert.match(cli.stdout, /dest=write/);
    assert.equal(existsSync(appliedReceiptPath(handoffFixture)), false);
  });

  it("applies a non-shadow fixture into a notebook receipt and progress line", () => {
    const cwd = join(tempDir, "apply");
    const destDir = join(cwd, ".context", "decisions", "write");
    mkdirSync(destDir, { recursive: true });
    const decision = join(destDir, "20260920T150130Z-next.json");
    copyFileSync(handoffFixture, decision);

    const result = runWork({
      cwd,
      fromPath: decision,
      apply: true,
      now: () => "2026-09-20T16:00:00.000Z",
    });
    assert.equal(result.applied, true);
    assert.ok(result.receipt);
    assert.equal(result.receipt!.schema, WORK_APPLIED_SCHEMA);
    assert.equal(result.receipt!.choice, "write");
    assert.equal(result.receipt!.destination, "write");
    assert.equal(result.receipt!.applied_from_shadow, false);
    assert.equal(result.receipt!.applied_at, "2026-09-20T16:00:00.000Z");
    assert.ok(result.receiptPath?.endsWith("20260920T150130Z-next.applied.json"));
    assert.ok(existsSync(result.receiptPath!));
    const progress = readFileSync(join(cwd, ".context", "progress.md"), "utf-8");
    assert.match(progress, /worker applied: next=write dest=write confidence=0.91/);

    const cliCwd = join(tempDir, "apply-cli");
    mkdirSync(join(cliCwd, ".context", "decisions", "write"), { recursive: true });
    const cliDecision = join(cliCwd, ".context", "decisions", "write", "20260920T150130Z-next.json");
    copyFileSync(handoffFixture, cliDecision);
    const cliResult = runCli(["work", "--from", cliDecision, "--apply"], cliCwd);
    assert.equal(cliResult.status, 0, cliResult.stderr);
    assert.match(cliResult.stdout, /work applied/);
    assert.ok(existsSync(appliedReceiptPath(cliDecision)));
    assert.match(
      readFileSync(join(cliCwd, ".context", "progress.md"), "utf-8"),
      /worker applied: next=write/,
    );
  });

  it("dry-runs shadow and refuses apply without --force (exit 2)", () => {
    const cwd = join(tempDir, "shadow");
    mkdirSync(cwd, { recursive: true });
    const plan = runWork({ cwd, fromPath: shadowFixture });
    assert.equal(plan.applied, false);
    assert.equal(plan.plan.shadow, true);
    assert.equal(plan.plan.wouldRefuse, true);
    assert.match(plan.summary, /apply=refuse/);

    const refused = runCli(["work", "--from", shadowFixture, "--apply"], cwd);
    assert.equal(refused.status, 2);
    assert.match(refused.stderr, /shadow\/log-only/);
    assert.equal(existsSync(appliedReceiptPath(shadowFixture)), false);
    assert.equal(existsSync(join(cwd, ".context", "progress.md")), false);

    assert.throws(
      () => runWork({ cwd, fromPath: shadowFixture, apply: true }),
      (err: unknown) => err instanceof WorkError && err.exitCode === 2,
    );
  });

  it("applies shadow only with --force and stamps applied_from_shadow", () => {
    const cwd = join(tempDir, "shadow-force");
    const destDir = join(cwd, ".context", "decisions", "review");
    mkdirSync(destDir, { recursive: true });
    const decision = join(destDir, "20260920T150000Z-next.json");
    copyFileSync(shadowFixture, decision);

    const result = runWork({
      cwd,
      fromPath: decision,
      apply: true,
      force: true,
      now: () => "2026-09-20T16:05:00.000Z",
    });
    assert.equal(result.applied, true);
    assert.equal(result.receipt!.applied_from_shadow, true);
    assert.equal(result.receipt!.forced, true);
    assert.match(result.summary, /applied_from_shadow/);
    const receipt = JSON.parse(readFileSync(result.receiptPath!, "utf-8")) as { applied_from_shadow: boolean };
    assert.equal(receipt.applied_from_shadow, true);
  });

  it("defaults to the newest queue decision and skips receipts", () => {
    const cwd = join(tempDir, "latest");
    const writeDir = join(cwd, ".context", "decisions", "write");
    const reviewDir = join(cwd, ".context", "decisions", "review");
    mkdirSync(writeDir, { recursive: true });
    mkdirSync(reviewDir, { recursive: true });
    const older = join(reviewDir, "20260920T140000Z-next.json");
    const newer = join(writeDir, "20260920T150130Z-next.json");
    const receipt = join(writeDir, "20260920T160000Z-next.applied.json");
    copyFileSync(shadowFixture, older);
    copyFileSync(handoffFixture, newer);
    writeFileSync(receipt, "{\"schema\":\"tocket.work.applied/v0\"}\n", "utf-8");
    const past = new Date("2026-09-20T14:00:00Z");
    const later = new Date("2026-09-20T15:01:30Z");
    const newestReceipt = new Date("2026-09-20T16:00:00Z");
    utimesSync(older, past, past);
    utimesSync(newer, later, later);
    utimesSync(receipt, newestReceipt, newestReceipt);

    assert.equal(findLatestQueueDecision(cwd), newer);
    const loaded = loadDecision(cwd);
    assert.equal(loaded.path, newer);
    assert.equal(loaded.record.choice, "write");
    assert.equal(loaded.record.semantics, "handoff");

    const cli = runCli(["work"], cwd);
    assert.equal(cli.status, 0, cli.stderr);
    assert.match(cli.stdout, /from=.*write\/20260920T150130Z-next\.json/);
  });

  it("exits 1 for a missing or invalid decision", () => {
    const cwd = join(tempDir, "errors");
    mkdirSync(cwd, { recursive: true });
    const missing = runCli(["work"], cwd);
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /No decision found|--from/);

    const gone = runCli(["work", "--from", join(cwd, "missing.json")], cwd);
    assert.equal(gone.status, 1);
    assert.match(gone.stderr, /not found/);

    const bad = join(cwd, "bad.json");
    writeFileSync(bad, "{\"no\":\"schema\"}\n", "utf-8");
    const invalid = runCli(["work", "--from", bad], cwd);
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /Invalid decision record/);
  });
});
