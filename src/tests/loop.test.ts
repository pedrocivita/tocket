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
  LAST_RUN_SCHEMA,
  appmapBankRel,
  discoverAppmapJson,
  parseLastRun,
} from "../utils/appmaps.js";
import { parseTriageReport } from "../utils/triage.js";

const cliPath = join(import.meta.dirname, "..", "index.js");
const fixturesDir = join(import.meta.dirname, "..", "..", "fixtures", "loop");
const mapFixture = join(fixturesDir, "tempestivita.appmap.json");
const lastRunFixture = join(fixturesDir, "last-run.json");

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

function bankFiles(cwd: string): string[] {
  const dir = join(cwd, ".context", "appmaps");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort();
}

describe("discoverAppmapJson", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-loop-discover-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("picks the only *.appmap.json", () => {
    const dir = join(tempDir, "one");
    mkdirSync(dir, { recursive: true });
    copyFileSync(mapFixture, join(dir, "other.appmap.json"));
    assert.equal(discoverAppmapJson(dir, "tempestivita"), join(dir, "other.appmap.json"));
  });

  it("prefers <app>.appmap.json when several maps exist", () => {
    const dir = join(tempDir, "many");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "alpha.appmap.json"), "{}\n", "utf-8");
    copyFileSync(mapFixture, join(dir, "tempestivita.appmap.json"));
    assert.equal(
      discoverAppmapJson(dir, "tempestivita"),
      join(dir, "tempestivita.appmap.json"),
    );
  });

  it("errors when several maps exist and none match --app", () => {
    const dir = join(tempDir, "ambiguous");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "a.appmap.json"), "{}\n", "utf-8");
    writeFileSync(join(dir, "b.appmap.json"), "{}\n", "utf-8");
    assert.throws(() => discoverAppmapJson(dir, "tempestivita"), /Multiple/);
  });
});

describe("tocket suite loop", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-suite-loop-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("writes map + last-run + triage; status can read the bank", () => {
    const incomingMap = join(tempDir, "tempestivita.appmap.json");
    const incomingRun = join(tempDir, "last-run.json");
    copyFileSync(mapFixture, incomingMap);
    copyFileSync(lastRunFixture, incomingRun);

    const loop = runCli(
      [
        "suite",
        "loop",
        "--app",
        "tempestivita",
        "--map",
        incomingMap,
        "--last-run",
        incomingRun,
        "--dry-run",
      ],
      tempDir,
    );
    assert.equal(loop.status, 0, loop.stderr);
    assert.match(loop.stdout, /AppMap loop/);
    assert.match(loop.stdout, /\.context\/appmaps\/tempestivita\.appmap\.json/);
    assert.match(loop.stdout, /\.context\/appmaps\/last-run\.json/);
    assert.match(loop.stdout, /\.context\/appmaps\/tempestivita\.triage\.json/);
    assert.match(loop.stdout, /1\/3 passed/);
    assert.match(loop.stdout, /triage: 2 cases/);

    const bank = join(tempDir, ".context", "appmaps");
    const mapPath = join(bank, "tempestivita.appmap.json");
    const jsonPath = join(bank, "last-run.json");
    const mdPath = join(bank, "last-run.md");
    const triagePath = join(bank, "tempestivita.triage.json");

    assert.ok(existsSync(mapPath));
    assert.ok(existsSync(jsonPath));
    assert.ok(existsSync(mdPath));
    assert.ok(existsSync(triagePath));
    assert.ok(existsSync(join(bank, "README.md")));

    const map = JSON.parse(readFileSync(mapPath, "utf-8")) as { app?: { id?: string } };
    assert.equal(map.app?.id, "tempestivita");

    const run = parseLastRun(readFileSync(jsonPath, "utf-8"));
    assert.equal(run.schema, LAST_RUN_SCHEMA);
    assert.equal(run.app, "tempestivita");
    assert.equal(run.map, appmapBankRel("tempestivita"));
    assert.equal(run.all_ok, false);
    assert.equal(run.passed, 1);
    assert.equal(run.total, 3);

    const report = parseTriageReport(readFileSync(triagePath, "utf-8"));
    assert.equal(report.schema, "tocket.appmaps.triage/v0");
    assert.equal(report.app, "tempestivita");
    assert.equal(report.mode, "dry-run");
    assert.equal(report.cases.length, 2);
    assert.ok(
      report.cases.some((item) => item.id === "P0-4" && item.choice === "rewrite-locator"),
    );
    assert.ok(report.cases.some((item) => item.id === "P1-8" && item.choice === "retry"));

    const status = runCli(["suite", "status"], tempDir);
    assert.equal(status.status, 1, status.stderr);
    assert.match(status.stdout, /tempestivita/);
    assert.match(status.stdout, /\.context\/appmaps\/tempestivita\.appmap\.json/);
    assert.match(status.stdout, /1\/3 passed/);
    assert.match(status.stdout, /all_ok: false/);
    assert.match(status.stdout, /Ligar Risco PREVOTS/);
    assert.match(status.stdout, /Limpar o mapa/);

    for (const name of bankFiles(tempDir)) {
      assert.ok(!name.includes(".."));
    }
    assert.ok(!existsSync(join(tempDir, "appmaps")));
  });

  it("discovers *.appmap.json from --mapper-out", () => {
    const cwd = join(tempDir, "discover");
    mkdirSync(cwd, { recursive: true });
    const outDir = join(cwd, "mapper-out");
    mkdirSync(outDir, { recursive: true });
    copyFileSync(mapFixture, join(outDir, "tempestivita.appmap.json"));
    writeFileSync(join(outDir, "eval.json"), "{}\n", "utf-8");

    const result = runCli(
      ["suite", "loop", "--app", "tempestivita", "--mapper-out", outDir, "--no-triage"],
      cwd,
    );
    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(join(cwd, ".context", "appmaps", "tempestivita.appmap.json")));
    assert.ok(!existsSync(join(cwd, ".context", "appmaps", "last-run.json")));
    assert.ok(!existsSync(join(cwd, ".context", "appmaps", "tempestivita.triage.json")));
    assert.match(result.stdout, /triage: skipped/);
  });

  it("exits 2 when neither --map nor --mapper-out is given", () => {
    const cwd = join(tempDir, "missing-map");
    mkdirSync(cwd, { recursive: true });
    const result = runCli(["suite", "loop"], cwd);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /--map/);
  });
});
