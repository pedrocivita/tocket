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
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  DECIDE_SCHEMA,
  DECISIONS_DIR,
  STUB_MODEL,
  decisionOutputPath,
  isInsideContext,
  parseChoiceSpec,
  parseDecideRecord,
  parseConfidenceThreshold,
  parseFork,
  parseScoreSpec,
  resolveDecideMode,
  resolveDestination,
  runDecide,
  stubChoice,
  stubNoul,
  stubScore,
} from "../utils/decide.js";
import { askJev, buildTriageQuestions } from "../utils/jev.js";
import { evaluateDecideStub } from "../eval/decide-eval.js";

const cliPath = join(import.meta.dirname, "..", "index.js");
const fixturesDir = join(import.meta.dirname, "..", "..", "fixtures");
const stateFixture = join(fixturesDir, "decide", "state.json");
const expectedFixture = join(fixturesDir, "decide-expected.json");

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

describe("decide parsers", () => {
  it("parses --choice name:opt1,opt2", () => {
    assert.deepEqual(parseChoiceSpec("next:research,write,review"), {
      name: "next",
      options: ["research", "write", "review"],
    });
  });

  it("rejects a choice with one option", () => {
    assert.throws(() => parseChoiceSpec("next:only"), /at least two options/);
  });

  it("keeps writes under .context/", () => {
    const cwd = "/tmp/tocket-decide-root";
    const inside = decisionOutputPath(cwd, "2026-09-20T14:52:00.000Z", "next", "write");
    assert.equal(isInsideContext(cwd, inside), true);
    assert.match(inside, /\.context\/decisions\/write\/20260920T145200Z-next\.json$/);
    assert.equal(isInsideContext(cwd, join(cwd, "tmp", "out.json")), false);
  });

  it("gates research/write below the Codila 0.85 threshold to review", () => {
    assert.deepEqual(resolveDestination("write", 0.78), { destination: "review", gated: true });
    assert.deepEqual(resolveDestination("research", 0.9), { destination: "research", gated: false });
    assert.deepEqual(resolveDestination("write", 0.85), { destination: "write", gated: false });
    assert.deepEqual(resolveDestination("review", 0.99), { destination: "review", gated: false });
    assert.deepEqual(resolveDestination("retry", 0.99), { destination: "review", gated: false });
    assert.deepEqual(resolveDestination("write", 0.99, 0.85, "human"), {
      destination: "review",
      gated: true,
    });
    assert.equal(parseFork(), "action");
    assert.equal(parseFork("human"), "human");
    assert.throws(() => parseFork("graph"), /agent, model, tool, action, human/);
    assert.deepEqual(parseScoreSpec("relevance"), { name: "relevance", min: 0, max: 1 });
    assert.deepEqual(parseScoreSpec("relevance:0,10"), { name: "relevance", min: 0, max: 10 });
    assert.equal(parseConfidenceThreshold(), 0.85);
    assert.equal(parseConfidenceThreshold("0.7"), 0.7);
    assert.throws(() => parseConfidenceThreshold("2"), /0 and 1/);
  });
});

describe("decide stub", () => {
  it("picks a choice keyword from state and a low noul for clear/ready", () => {
    const state = { task: "write the handoff docs", status: "ready", notes: "draft is clear" };
    assert.equal(stubChoice("next", ["research", "write", "review"], state).choice, "write");
    assert.ok(stubNoul("needs_human_review", state).noul <= 0.4);
    assert.ok(stubScore("relevance", 0, 1, state).score <= 0.4);
  });

  it("is deterministic across two calls", () => {
    const state = { note: "no matching option keywords here" };
    const first = stubChoice("next", ["research", "write", "review"], state);
    const second = stubChoice("next", ["research", "write", "review"], state);
    assert.equal(first.choice, second.choice);
    assert.equal(first.confidence, second.confidence);
  });
});

describe("resolveDecideMode", () => {
  it("dry-run always stubs; shadow calls Jev only with a key", () => {
    assert.deepEqual(resolveDecideMode({ dryRun: true, apiKey: "k" }), {
      useLive: false,
      mode: "dry-run",
    });
    assert.deepEqual(resolveDecideMode({ shadow: true, apiKey: "k" }), {
      useLive: true,
      mode: "shadow",
    });
    assert.deepEqual(resolveDecideMode({ shadow: true }), {
      useLive: false,
      mode: "shadow",
    });
    assert.deepEqual(resolveDecideMode({ apiKey: "k" }), { useLive: true, mode: "active" });
    assert.deepEqual(resolveDecideMode({}), { useLive: false, mode: "shadow" });
  });
});

describe("askJev generic Choice + Noul", () => {
  it("parses arbitrary questions from a System One-shaped response", async () => {
    const result = await askJev({
      apiKey: "test-key",
      state: { task: "write" },
      questions: {
        next: {
          type: "choice",
          criteria: { research: "r", write: "w", review: "v" },
        },
        needs_human_review: {
          type: "noul",
          criteria: { true: "yes", false: "no" },
        },
        relevance: {
          type: "score",
          min: 0,
          max: 1,
        },
      },
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            model: "jev-1.13.0",
            answers: {
              next: { type: "choice", choice: "write", confidence: 0.8 },
              needs_human_review: { type: "noul", noul: 0.2, confidence: 0.7 },
              relevance: { type: "score", score: 0.4, confidence: 0.6 },
            },
          }),
          { status: 200 },
        ),
    });
    assert.equal(result.model, "jev-1.13.0");
    assert.equal(result.answers.next.type, "choice");
    if (result.answers.next.type === "choice") {
      assert.equal(result.answers.next.choice, "write");
    }
    assert.equal(result.answers.relevance.type, "score");
    if (result.answers.relevance.type === "score") {
      assert.equal(result.answers.relevance.score, 0.4);
    }
    assert.ok(buildTriageQuestions().action);
  });
});

describe("tocket decide", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-decide-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("dry-run writes .context/decisions/ with source=stub", () => {
    const incoming = join(tempDir, "state.json");
    copyFileSync(stateFixture, incoming);

    const result = runCli(
      [
        "decide",
        "--from",
        incoming,
        "--choice",
        "next:research,write,review",
        "--noul",
        "needs_human_review",
        "--dry-run",
        "--id",
        "next",
      ],
      tempDir,
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /decide next=write/);
    assert.match(result.stdout, /dest=review/);
    assert.match(result.stdout, /gated/);
    assert.match(result.stdout, /source=stub/);
    assert.match(result.stdout, /mode=dry-run/);
    assert.match(result.stdout, /\.context\/decisions\/review\/.+\-next\.json/);

    const dir = join(tempDir, ".context", "decisions", "review");
    assert.ok(existsSync(dir));
    const files = readdirSync(dir).filter((name) => name.endsWith(".json"));
    assert.equal(files.length, 1);
    const record = parseDecideRecord(readFileSync(join(dir, files[0]), "utf-8"));
    assert.equal(record.schema, DECIDE_SCHEMA);
    assert.equal(record.source, "stub");
    assert.equal(record.mode, "dry-run");
    assert.equal(record.model, STUB_MODEL);
    assert.equal(record.choice, "write");
    assert.equal(record.destination, "review");
    assert.equal(record.gated, true);
    assert.equal(record.semantics, "log-only");
    assert.equal(record.status, "logged");
    assert.equal(record.executes, false);
    assert.equal(record.loop, "state-questions-action-verify");
    assert.equal(record.fork, "action");
    assert.equal(record.batched, true);
    assert.equal(record.rank_wide, false);
    assert.equal(record.narrow, "write");
    assert.ok(record.primitives.includes("choice"));
    assert.ok(record.state && typeof record.state === "object");
    assert.equal(record.answers.next.type, "choice");
    if (record.answers.next.type === "choice") {
      assert.equal(record.answers.next.choice, "write");
    }
    assert.ok(!files[0].includes(".."));
    assert.ok(isInsideContext(tempDir, join(dir, files[0])));
    assert.ok(!existsSync(join(tempDir, "tmp", "decision.json")));
  });

  it("shadow without a key stays stub and does not claim execution", async () => {
    const cwd = join(tempDir, "shadow");
    mkdirSync(cwd, { recursive: true });
    const incoming = join(cwd, "state.json");
    copyFileSync(stateFixture, incoming);

    const { record, outPath } = await runDecide({
      cwd,
      fromPath: incoming,
      choices: ["next:research,write,review"],
      nouls: ["needs_human_review"],
      shadow: true,
      apiKey: null,
      now: () => "2026-09-20T15:00:00.000Z",
      id: "next",
    });
    assert.equal(record.source, "stub");
    assert.equal(record.mode, "shadow");
    assert.equal(record.semantics, "log-only");
    assert.equal(record.destination, "review");
    assert.equal(record.gated, true);
    assert.ok(outPath.includes(`${DECISIONS_DIR}/review`));
    assert.ok(isInsideContext(cwd, outPath));
  });

  it("shadow with a key calls Jev and marks mode=shadow", async () => {
    const cwd = join(tempDir, "shadow-live");
    mkdirSync(cwd, { recursive: true });
    let called = false;
    const { record } = await runDecide({
      cwd,
      state: '{"goal":"review the map"}',
      choices: ["next:research,write,review"],
      shadow: true,
      apiKey: "test-key",
      now: () => "2026-09-20T15:01:00.000Z",
      id: "next",
      fetchImpl: async () => {
        called = true;
        return new Response(
          JSON.stringify({
            model: "jev-latest",
            answers: {
              next: { type: "choice", choice: "review", confidence: 0.91 },
            },
          }),
          { status: 200 },
        );
      },
    });
    assert.equal(called, true);
    assert.equal(record.source, "jev");
    assert.equal(record.mode, "shadow");
    assert.equal(record.semantics, "log-only");
    assert.equal(record.model, "jev-latest");
    assert.equal(record.choice, "review");
    assert.equal(record.destination, "review");
    if (record.answers.next.type === "choice") {
      assert.equal(record.answers.next.choice, "review");
    }
  });

  it("high-confidence write routes to the write handoff folder", async () => {
    const cwd = join(tempDir, "high-conf-write");
    mkdirSync(cwd, { recursive: true });
    const { record, outPath } = await runDecide({
      cwd,
      state: '{"task":"write docs"}',
      choices: ["next:research,write,review"],
      apiKey: "test-key",
      now: () => "2026-09-20T15:01:30.000Z",
      id: "next",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            model: "jev-1.13.0",
            answers: {
              next: { type: "choice", choice: "write", confidence: 0.91 },
            },
          }),
          { status: 200 },
        ),
    });
    assert.equal(record.mode, "active");
    assert.equal(record.semantics, "handoff");
    assert.equal(record.status, "queued");
    assert.equal(record.choice, "write");
    assert.equal(record.confidence, 0.91);
    assert.equal(record.destination, "write");
    assert.equal(record.gated, false);
    assert.ok(outPath.includes(`${DECISIONS_DIR}/write`));
    assert.ok(isInsideContext(cwd, outPath));
  });

  it("confidence-threshold override can ungate a stub write", async () => {
    const cwd = join(tempDir, "threshold");
    mkdirSync(cwd, { recursive: true });
    const { record, outPath } = await runDecide({
      cwd,
      fromPath: stateFixture,
      choices: ["next:research,write,review"],
      dryRun: true,
      confidenceThreshold: 0.7,
      now: () => "2026-09-20T15:03:00.000Z",
      id: "next",
    });
    assert.equal(record.choice, "write");
    assert.ok(record.confidence >= 0.7);
    assert.equal(record.destination, "write");
    assert.equal(record.gated, false);
    assert.ok(outPath.includes(`${DECISIONS_DIR}/write`));
  });

  it("dry-run ignores TYPESAFE_API_KEY and does not call Jev", async () => {
    const cwd = join(tempDir, "dry-ignores-key");
    mkdirSync(cwd, { recursive: true });
    let called = false;
    const { record } = await runDecide({
      cwd,
      state: '{"task":"write docs"}',
      choices: ["next:research,write,review"],
      dryRun: true,
      apiKey: "should-not-be-used",
      now: () => "2026-09-20T15:02:00.000Z",
      id: "next",
      fetchImpl: async () => {
        called = true;
        throw new Error("Jev should not be called in dry-run");
      },
    });
    assert.equal(called, false);
    assert.equal(record.source, "stub");
    assert.equal(record.mode, "dry-run");
  });

  it("requires state and at least one question", () => {
    const cwd = join(tempDir, "errors");
    mkdirSync(cwd, { recursive: true });
    const missingState = runCli(["decide", "--choice", "next:research,write", "--dry-run"], cwd);
    assert.equal(missingState.status, 2);
    assert.match(missingState.stderr, /--state|--from/);

    writeFileSync(join(cwd, "state.json"), "{\"ok\":true}\n", "utf-8");
    const missingQ = runCli(["decide", "--from", join(cwd, "state.json"), "--dry-run"], cwd);
    assert.equal(missingQ.status, 2);
    assert.match(missingQ.stderr, /--choice|--noul|--score/);
  });

  it("batches Choice + Noul + Score and marks executes=false", async () => {
    const cwd = join(tempDir, "batch");
    mkdirSync(cwd, { recursive: true });
    const { record } = await runDecide({
      cwd,
      state: '{"task":"write docs","status":"ready"}',
      choices: ["next:research,write,review"],
      nouls: ["needs_human_review"],
      scores: ["relevance"],
      dryRun: true,
      now: () => "2026-09-20T15:04:00.000Z",
      id: "next",
    });
    assert.equal(record.batched, true);
    assert.deepEqual(record.primitives.slice().sort(), ["choice", "noul", "score"]);
    assert.equal(record.executes, false);
    assert.equal(record.answers.relevance.type, "score");
  });

  it("human fork always queues review (escalate)", async () => {
    const cwd = join(tempDir, "human-fork");
    mkdirSync(cwd, { recursive: true });
    const { record, outPath } = await runDecide({
      cwd,
      state: '{"task":"write docs"}',
      choices: ["next:research,write,review"],
      fork: "human",
      dryRun: true,
      confidenceThreshold: 0.5,
      now: () => "2026-09-20T15:05:00.000Z",
      id: "next",
    });
    assert.equal(record.fork, "human");
    assert.equal(record.destination, "review");
    assert.equal(record.gated, true);
    assert.ok(outPath.includes("/review/"));
  });

  it("marks rank_wide when Choice lists many options", async () => {
    const cwd = join(tempDir, "rank-wide");
    mkdirSync(cwd, { recursive: true });
    const { record } = await runDecide({
      cwd,
      state: '{"task":"alpha"}',
      choices: ["next:alpha,bravo,charlie,delta,echo"],
      dryRun: true,
      now: () => "2026-09-20T15:06:00.000Z",
      id: "next",
    });
    assert.equal(record.rank_wide, true);
    assert.equal(record.narrow, "alpha");
    assert.equal(record.executes, false);
  });
});

describe("decide fixture eval", () => {
  it("optional stub eval agrees with the fixture label", () => {
    const result = evaluateDecideStub(stateFixture, expectedFixture);
    assert.equal(result.ok, true, `${result.choice} vs ${result.expectedChoice}; noul=${result.noul}`);
    assert.equal(result.choice, "write");
    assert.ok(result.noul <= result.expectedMax);
  });
});
