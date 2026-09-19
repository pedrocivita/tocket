import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  LAST_RUN_SCHEMA,
  emptyLastRun,
  parseLastRun,
  validateLastRun,
  writeLastRunMd,
  type LastRun,
} from "../utils/appmaps.js";

const cliPath = join(import.meta.dirname, "..", "index.js");

const passingLastRun: LastRun = {
  schema: LAST_RUN_SCHEMA,
  app: "demo-app",
  map: "smoke",
  runner: "lab",
  model: "fixture",
  mode: "replay",
  finished_at: "2026-09-18T11:00:00.000Z",
  all_ok: true,
  passed: 2,
  total: 2,
  results: [
    {
      id: "login",
      name: "Sign in",
      ok: true,
      ms: 800,
      jev_choice: "pass",
      jev_confidence: 0.91,
      evidence: "landed on /home",
      error: null,
    },
    {
      id: "logout",
      name: "Sign out",
      ok: true,
      ms: 400,
      jev_choice: "pass",
      jev_confidence: 0.88,
      evidence: "session cleared",
      error: null,
    },
  ],
};

const failingLastRun: LastRun = {
  ...passingLastRun,
  all_ok: false,
  passed: 1,
  total: 2,
  results: [
    passingLastRun.results[0],
    {
      id: "checkout",
      name: "Checkout",
      ok: false,
      ms: 1200,
      jev_choice: "fail",
      jev_confidence: 0.4,
      evidence: "stuck on /cart",
      error: "timeout",
    },
  ],
};

function fixtureJson(run: LastRun): string {
  return `${JSON.stringify(run, null, 2)}\n`;
}

function runCli(
  args: string[],
  cwd: string,
): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync(process.execPath, [cliPath, ...args], {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
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

function writeWorkspaceLastRun(cwd: string, run: LastRun): void {
  const destDir = join(cwd, ".context", "appmaps");
  mkdirSync(destDir, { recursive: true });
  writeFileSync(join(destDir, "last-run.json"), fixtureJson(run), "utf-8");
}

describe("parseLastRun / writeLastRunMd", () => {
  it("parses a valid v0 last-run fixture", () => {
    const run = parseLastRun(fixtureJson(passingLastRun));
    assert.equal(run.schema, LAST_RUN_SCHEMA);
    assert.equal(run.app, "demo-app");
    assert.equal(run.map, "smoke");
    assert.equal(run.all_ok, true);
    assert.equal(run.passed, 2);
    assert.equal(run.total, 2);
    assert.equal(run.results.length, 2);
    assert.equal(run.results[0].id, "login");
  });

  it("rejects an unknown schema", () => {
    assert.throws(
      () => validateLastRun({ schema: "other/v1" }),
      /schema must be/,
    );
  });

  it("renders a human table with pass/fail rows", () => {
    const md = writeLastRunMd(failingLastRun);
    assert.match(md, /# Last AppMap run/);
    assert.match(md, /1\/2 passed/);
    assert.match(md, /All OK \| no/);
    assert.match(md, /\| login \| Sign in \| pass \|/);
    assert.match(md, /\| checkout \| Checkout \| fail \|/);
    assert.match(md, /timeout/);
  });

  it("renders an empty init template", () => {
    const md = writeLastRunMd(emptyLastRun());
    assert.match(md, /0\/0 passed/);
    assert.match(md, /_none_/);
  });
});

describe("tocket suite status", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-suite-status-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("prints a pass summary from last-run.json and exits 0", () => {
    writeWorkspaceLastRun(tempDir, passingLastRun);

    const result = runCli(["suite", "status"], tempDir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /demo-app/);
    assert.match(result.stdout, /smoke/);
    assert.match(result.stdout, /2\/2 passed/);
    assert.match(result.stdout, /all_ok: true/);
    assert.match(result.stdout, /Sign in/);
    assert.match(result.stdout, /Sign out/);
  });

  it("exits 1 when all_ok is false", () => {
    const failDir = join(tempDir, "fail");
    writeWorkspaceLastRun(failDir, failingLastRun);

    const result = runCli(["suite", "status"], failDir);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /1\/2 passed/);
    assert.match(result.stdout, /all_ok: false/);
    assert.match(result.stdout, /Checkout/);
  });

  it("exits 2 when last-run.json is missing", () => {
    const missingDir = join(tempDir, "missing");
    mkdirSync(missingDir, { recursive: true });

    const result = runCli(["suite", "status"], missingDir);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /No AppMap last-run found/);
  });
});

describe("tocket suite sync", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-suite-sync-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("copies a valid last-run.json and regenerates last-run.md", () => {
    const incoming = join(tempDir, "incoming.json");
    writeFileSync(incoming, fixtureJson(passingLastRun), "utf-8");

    const result = runCli(["suite", "sync", "--from", incoming], tempDir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /AppMap last-run synced/);

    const jsonPath = join(tempDir, ".context", "appmaps", "last-run.json");
    const mdPath = join(tempDir, ".context", "appmaps", "last-run.md");
    const readmePath = join(tempDir, ".context", "appmaps", "README.md");

    assert.ok(existsSync(jsonPath));
    assert.ok(existsSync(mdPath));
    assert.ok(existsSync(readmePath));

    const copied = parseLastRun(readFileSync(jsonPath, "utf-8"));
    assert.equal(copied.app, "demo-app");
    assert.equal(copied.map, "smoke");
    assert.equal(copied.all_ok, true);

    const md = readFileSync(mdPath, "utf-8");
    assert.match(md, /demo-app/);
    assert.match(md, /Sign in/);
    assert.match(md, /2\/2 passed/);

    const readme = readFileSync(readmePath, "utf-8");
    assert.match(readme, /file-first/);
  });
});

describe("tocket suite init", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-suite-init-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("scaffolds empty AppMap Memory Bank templates", () => {
    const result = runCli(["suite", "init"], tempDir);
    assert.equal(result.status, 0, result.stderr);

    const dir = join(tempDir, ".context", "appmaps");
    assert.ok(existsSync(join(dir, "README.md")));
    assert.ok(existsSync(join(dir, "goals.md")));
    assert.ok(existsSync(join(dir, "last-run.json")));
    assert.ok(existsSync(join(dir, "last-run.md")));

    const run = parseLastRun(readFileSync(join(dir, "last-run.json"), "utf-8"));
    assert.equal(run.schema, LAST_RUN_SCHEMA);
    assert.equal(run.total, 0);
    assert.equal(run.results.length, 0);
  });
});
