import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  readFileSync,
  existsSync,
  copyFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { parseLastRun } from "../utils/appmaps.js";
import {
  heuristicJudge,
  naiveIfElseChoice,
  parseTriageReport,
  runTriage,
  selectResults,
} from "../utils/triage.js";
import { evaluateTriage } from "../eval/triage-eval.js";
import { askJevTriage, buildTriageQuestions } from "../utils/jev.js";

const cliPath = join(import.meta.dirname, "..", "index.js");
const fixturesDir = join(import.meta.dirname, "..", "..", "fixtures");
const lastRunFixture = join(fixturesDir, "triage", "last-run.json");
const passFixture = join(fixturesDir, "triage", "tempestivita-pass.last-run.json");
const expectedFixture = join(fixturesDir, "triage-expected.json");

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

describe("last-run evidence objects", () => {
  it("parses the real Tempestivita 8/8 pass snapshot", () => {
    const run = parseLastRun(readFileSync(passFixture, "utf-8"));
    assert.equal(run.app, "tempestivita");
    assert.equal(run.all_ok, true);
    assert.equal(run.results.length, 8);
    assert.equal(typeof run.results[0].evidence, "object");
    assert.equal(selectResults(run, false).length, 0);
    assert.equal(selectResults(run, true).length, 2);
  });
});

describe("heuristicJudge", () => {
  it("classifies timeout, locator, assertion, flake, and ignore flavors", () => {
    assert.equal(
      heuristicJudge({ id: "a", name: "nav", ok: false, error: "TimeoutError: Navigation timeout of 30000 ms exceeded" }).choice,
      "retry",
    );
    assert.equal(
      heuristicJudge({ id: "b", name: "loc", ok: false, error: "LocatorError: locator('[data-testid=x]') not found" }).choice,
      "rewrite-locator",
    );
    assert.equal(
      heuristicJudge({ id: "c", name: "wait", ok: false, error: "Timeout 5000ms exceeded while waiting for getByText('Hi')" }).choice,
      "rewrite-locator",
    );
    assert.equal(
      heuristicJudge({ id: "d", name: "assert", ok: false, error: "AssertionError: expected 'a' to be 'b'" }).choice,
      "escalate",
    );
    assert.equal(
      heuristicJudge({ id: "e", name: "vis", ok: false, error: "expect(locator('.sheet')).toBeVisible() failed" }).choice,
      "escalate",
    );
    assert.equal(
      heuristicJudge({ id: "f", name: "pass", ok: true, error: null, jev_confidence: 0.52 }).choice,
      "ignore",
    );
    assert.equal(
      heuristicJudge({ id: "g", name: "noise", ok: false, error: "console warning: ResizeObserver loop (benign)" }).choice,
      "ignore",
    );
  });

  it("is not keyed by fixture id", () => {
    const first = heuristicJudge({
      id: "never-seen-id",
      name: "x",
      ok: false,
      error: "No such element: Unable to locate element: //a",
    });
    const second = heuristicJudge({
      id: "also-new",
      name: "y",
      ok: false,
      error: "No such element: Unable to locate element: //a",
    });
    assert.equal(first.choice, "rewrite-locator");
    assert.equal(second.choice, first.choice);
  });

  it("beats naive if-else on locator failures", () => {
    const input = { id: "z", name: "z", ok: false, error: "stale locator" };
    assert.equal(naiveIfElseChoice(input), "escalate");
    assert.equal(heuristicJudge(input).choice, "rewrite-locator");
  });
});

describe("askJevTriage", () => {
  it("parses Choice + Noul from a System One-shaped response", async () => {
    const answers = await askJevTriage({
      apiKey: "test-key",
      state: { id: "T-1" },
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            model: "jev-latest",
            answers: {
              action: { type: "choice", choice: "retry", confidence: 0.81 },
              locator_drift: { type: "noul", noul: 0.12 },
            },
          }),
          { status: 200 },
        ),
    });
    assert.equal(answers.choice, "retry");
    assert.equal(answers.confidence, 0.81);
    assert.equal(answers.locatorDrift, 0.12);
    assert.ok(buildTriageQuestions().action);
  });
});

describe("tocket suite triage", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-suite-triage-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("dry-run writes <app>.triage.json without TYPESAFE_API_KEY", async () => {
    const incoming = join(tempDir, "last-run.json");
    copyFileSync(lastRunFixture, incoming);

    const result = runCli(
      ["suite", "triage", "--from", incoming, "--include-low-confidence", "--dry-run"],
      tempDir,
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /AppMap triage/);
    assert.match(result.stdout, /mode: dry-run/);

    const outPath = join(tempDir, ".context", "appmaps", "tempestivita.triage.json");
    assert.ok(existsSync(outPath));
    const report = parseTriageReport(readFileSync(outPath, "utf-8"));
    assert.equal(report.schema, "tocket.appmaps.triage/v0");
    assert.equal(report.app, "tempestivita");
    assert.equal(report.mode, "dry-run");
    assert.ok(report.cases.some((item) => item.id === "T-locator-missing" && item.choice === "rewrite-locator"));
    assert.ok(report.cases.some((item) => item.id === "T-lowconf-pass" && item.choice === "ignore"));
    assert.ok(!report.cases.some((item) => item.id === "T-highconf-pass"));
  });

  it("heuristic runTriage is stable across two calls", async () => {
    const cwd = join(tempDir, "stable");
    mkdirSync(cwd, { recursive: true });
    const incoming = join(cwd, "last-run.json");
    copyFileSync(lastRunFixture, incoming);

    const first = await runTriage({
      fromPath: incoming,
      cwd,
      includeLowConfidence: true,
      dryRun: true,
      now: () => "2026-09-19T00:00:00.000Z",
    });
    const second = await runTriage({
      fromPath: incoming,
      cwd,
      includeLowConfidence: true,
      dryRun: true,
      now: () => "2026-09-19T00:00:00.000Z",
    });
    assert.deepEqual(
      first.report.cases.map((item) => item.choice),
      second.report.cases.map((item) => item.choice),
    );
  });
});

describe("POC C eval", () => {
  it("reports agreement, naive baseline, and stability", () => {
    const result = evaluateTriage(lastRunFixture, expectedFixture);
    assert.equal(result.total, 15);
    assert.ok(result.agreement >= 0.8, `agreement ${result.agreement}`);
    assert.ok(result.agreement > result.naiveAgreement);
    assert.ok(result.agreement > result.chance);
    assert.ok(result.unstableRate < 0.3);
    assert.equal(result.verdict, "PASS");
  });
});
