import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  ATTENTION_SCHEMA,
  chunkKept,
  collectContextChunks,
  collectGotchaPacks,
  parseThreshold,
  runAwareHandoff,
  runPacksLoad,
  splitMarkdown,
  stubRelevance,
} from "../utils/attention.js";
import { includesPath } from "./helpers.js";

const cliPath = join(import.meta.dirname, "..", "index.js");
const NOW = "2026-09-21T18:00:00.000Z";

function runCli(
  args: string[],
  cwd: string,
): { stdout: string; stderr: string; status: number } {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, TYPESAFE_API_KEY: "" },
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? 1,
  };
}

function writeContext(cwd: string): void {
  mkdirSync(join(cwd, ".context", "decisions"), { recursive: true });
  mkdirSync(join(cwd, ".context", "gotchas"), { recursive: true });
  writeFileSync(
    join(cwd, ".context", "activeContext.md"),
    [
      "# Active Context - Demo",
      "",
      "## Current Focus",
      "",
      "Fix auth midflight token refresh.",
      "",
      "## Open Decisions",
      "",
      "- Windows posix path separators for the CLI.",
      "",
    ].join("\n"),
    "utf-8",
  );
  writeFileSync(
    join(cwd, ".context", "systemPatterns.md"),
    [
      "# Patterns",
      "",
      "## Auth session",
      "",
      "The auth midflight refresh must retry once.",
      "",
      "### Retry budget",
      "",
      "Allow one auth midflight retry.",
      "",
      "## Unrelated billing",
      "",
      "Invoice export and tax tables for billing.",
      "",
    ].join("\n"),
    "utf-8",
  );
  writeFileSync(
    join(cwd, ".context", "gotchas", "auth.md"),
    "# Auth\n\nRetry the auth midflight refresh when the token expires.\n",
    "utf-8",
  );
  writeFileSync(
    join(cwd, ".context", "gotchas", "frontend.md"),
    "# Frontend\n\nValidate the frontend form before submit.\n",
    "utf-8",
  );
  writeFileSync(
    join(cwd, ".context", "gotchas", "path-src-api.md"),
    "# API paths\n\nRoute handlers under src/api.\n",
    "utf-8",
  );
  writeFileSync(
    join(cwd, ".context", "gotchas", "areas.md"),
    [
      "# Areas",
      "",
      "## Frontend forms",
      "",
      "Frontend form labels and client validation.",
      "",
      "## Database",
      "",
      "Migration order for tables.",
      "",
    ].join("\n"),
    "utf-8",
  );
  writeFileSync(
    join(cwd, ".context", "decisions", "auth.json"),
    JSON.stringify({
      schema: "tocket.decide/v0",
      id: "auth-refresh",
      destination: "write",
      choice: "write",
      state: "fix auth midflight token refresh",
    }),
    "utf-8",
  );
}

describe("attention chunks", () => {
  it("splits headings and keeps subsections small", () => {
    const chunks = splitMarkdown(
      ".context/systemPatterns.md",
      [
        "# Patterns",
        "",
        "## Architecture",
        "",
        "Intro paragraph.",
        "",
        "### Command Registration",
        "",
        "One file per command.",
        "",
        "## Billing",
        "",
        "Invoice export.",
        "",
      ].join("\n"),
    );
    const labels = chunks.map((chunk) => chunk.label);
    assert.deepEqual(labels, ["Architecture", "Architecture / Command Registration", "Billing"]);
    assert.ok(chunks.every((chunk) => chunk.text.length <= 700));
    assert.ok(!chunks.some((chunk) => chunk.text.includes("# Patterns")));
  });

  it("splits a long section into parts", () => {
    const para = "alpha ".repeat(80).trim();
    const chunks = splitMarkdown(
      ".context/progress.md",
      `## Milestone\n\n${para}\n\n${para}\n`,
      "relevant",
      200,
    );
    assert.ok(chunks.length >= 2);
    assert.ok(chunks.every((chunk) => chunk.text.length <= 200));
    assert.ok(chunks[0].label.includes("(1)"));
  });

  it("scores overlap and omits unrelated text", () => {
    const high = stubRelevance("fix auth midflight", "Fix auth midflight token refresh.");
    const low = stubRelevance("fix auth midflight", "Windows posix path separators.");
    assert.ok(high.noul >= 0.5);
    assert.ok(low.noul < 0.5);
    assert.equal(chunkKept(0.2, 0.8, 0.5), true);
    assert.equal(chunkKept(0.8, 0.2, 0.5), true);
    assert.equal(chunkKept(0.2, 0.2, 0.5), false);
    assert.equal(chunkKept(0.55, 0.55, 0.6), false);
    assert.equal(parseThreshold(), 0.5);
    assert.throws(() => parseThreshold("2"), /between 0 and 1/);
  });
});

describe("aware handoff", () => {
  it("writes a filtered handoff and omits low-relevance chunks (stub, no network)", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "tocket-aware-"));
    writeContext(cwd);
    let called = 0;
    const fetchImpl = (() => {
      called += 1;
      throw new Error("network");
    }) as unknown as typeof fetch;

    const result = await runAwareHandoff({
      cwd,
      query: "fix auth midflight",
      projectName: "Demo",
      dryRun: true,
      now: () => NOW,
      fetchImpl,
      id: "handoff",
    });

    assert.equal(called, 0);
    assert.equal(result.record.schema, ATTENTION_SCHEMA);
    assert.equal(result.record.source, "stub");
    assert.equal(result.record.mode, "dry-run");
    assert.equal(result.record.executes, false);
    assert.equal(result.record.semantics, "log-only");
    assert.match(result.markdown, /token refresh/);
    assert.match(result.markdown, /retry once/);
    assert.match(result.markdown, /auth midflight retry/);
    assert.doesNotMatch(result.markdown, /Invoice export/);
    assert.doesNotMatch(result.markdown, /posix path separators/);
    assert.match(result.markdown, /### Omitted chunks/);
    assert.match(result.markdown, /Unrelated billing/);
    assert.match(result.markdown, /auth midflight refresh when the token expires/);
    assert.doesNotMatch(result.markdown, /Validate the frontend form/);
    assert.doesNotMatch(result.markdown, /Route handlers under src\/api/);
    assert.ok(includesPath(result.attentionPath, ".context/attention/20260921T180000Z-handoff.json"));
    assert.ok(includesPath(result.handoffPath, ".context/handoffs/20260921T180000Z-handoff.md"));
    const onDisk = readFileSync(result.handoffPath, "utf-8");
    assert.equal(onDisk, result.markdown);
    assert.doesNotMatch(onDisk, /Invoice export/);
    const receipt = JSON.parse(readFileSync(result.attentionPath, "utf-8")) as {
      schema: string;
      chunks: { kept: boolean; label: string }[];
    };
    assert.equal(receipt.schema, ATTENTION_SCHEMA);
    assert.ok(receipt.chunks.some((chunk) => chunk.kept && chunk.label === "Current Focus"));
    assert.ok(receipt.chunks.some((chunk) => !chunk.kept && chunk.label === "Unrelated billing"));
    rmSync(cwd, { recursive: true, force: true });
  });

  it("uses one batched Jev call and keeps only high scores", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "tocket-aware-live-"));
    mkdirSync(join(cwd, ".context"), { recursive: true });
    writeFileSync(
      join(cwd, ".context", "activeContext.md"),
      "## Current Focus\n\nAuth work.\n\n## Billing\n\nInvoices.\n",
      "utf-8",
    );
    const chunks = collectContextChunks(cwd);
    assert.equal(chunks.length, 2);
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({
          model: "jev-test",
          answers: {
            c0_relevant: { noul: 0.91, confidence: 0.8 },
            c0_relevance: { score: 0.2, confidence: 0.8 },
            c1_relevant: { noul: 0.1, confidence: 0.8 },
            c1_relevance: { score: 0.15, confidence: 0.8 },
          },
        }),
      };
    }) as unknown as typeof fetch;

    const result = await runAwareHandoff({
      cwd,
      query: "auth",
      dryRun: false,
      shadow: true,
      apiKey: "test-key",
      fetchImpl,
      now: () => NOW,
    });
    assert.equal(calls, 1);
    assert.equal(result.record.source, "jev");
    assert.equal(result.record.mode, "shadow");
    assert.equal(result.record.semantics, "log-only");
    assert.match(result.markdown, /Auth work/);
    assert.doesNotMatch(result.markdown, /Invoices/);
    rmSync(cwd, { recursive: true, force: true });
  });

  it("prints a filtered handoff from the CLI without a key", () => {
    const cwd = mkdtempSync(join(tmpdir(), "tocket-aware-cli-"));
    writeContext(cwd);
    const result = runCli(
      [
        "handoff",
        "--aware",
        "--dry-run",
        "--query",
        "fix auth midflight",
        "--threshold",
        "0.6",
        "--to",
        "stdout",
      ],
      cwd,
    );
    assert.equal(result.status, 0);
    assert.match(result.stdout, /token refresh/);
    assert.doesNotMatch(result.stdout, /Invoice export/);
    assert.doesNotMatch(result.stdout, /posix path separators/);
    assert.match(result.stderr, /handoff aware/);
    assert.match(result.stderr, /source=stub/);
    assert.match(result.stderr, /mode=dry-run/);
    rmSync(cwd, { recursive: true, force: true });
  });
});

describe("packs load", () => {
  it("loads only relevant gotcha packs into .context/active/packs.md", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "tocket-packs-"));
    writeContext(cwd);
    const packs = collectGotchaPacks(cwd);
    assert.ok(packs.some((pack) => pack.label === "frontend"));
    assert.ok(packs.some((pack) => pack.label === "Frontend forms"));
    assert.ok(packs.some((pack) => pack.label === "path-src-api"));

    const result = await runPacksLoad({
      cwd,
      query: "frontend form",
      dryRun: true,
      now: () => NOW,
      id: "packs",
    });
    assert.equal(result.record.kind, "packs");
    assert.equal(result.record.source, "stub");
    assert.match(result.markdown, /Validate the frontend form/);
    assert.match(result.markdown, /Frontend form labels/);
    assert.doesNotMatch(result.markdown, /Route handlers under src\/api/);
    assert.doesNotMatch(result.markdown, /Migration order/);
    const onDisk = readFileSync(result.packsPath, "utf-8");
    assert.equal(onDisk, result.markdown);
    assert.ok(includesPath(result.packsPath, ".context/active/packs.md"));
    assert.ok(includesPath(result.attentionPath, ".context/attention/20260921T180000Z-packs.json"));
    rmSync(cwd, { recursive: true, force: true });
  });

  it("CLI packs load --dry-run omits the unrelated pack", () => {
    const cwd = mkdtempSync(join(tmpdir(), "tocket-packs-cli-"));
    writeContext(cwd);
    const result = runCli(
      ["packs", "load", "--query", "frontend form", "--dry-run", "--to", "stdout"],
      cwd,
    );
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Validate the frontend form/);
    assert.doesNotMatch(result.stdout, /Route handlers under src\/api/);
    assert.match(result.stdout, /packs load/);
    rmSync(cwd, { recursive: true, force: true });
  });
});
