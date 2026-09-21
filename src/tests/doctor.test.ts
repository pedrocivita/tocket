import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  checkContentHealth,
  checkGitTracking,
  checkNotebookLight,
  checkStaleness,
  checkTypesafeKeyPresent,
  findLatestDecision,
  formatAge,
} from "../commands/doctor.cmd.js";
import { includesPath } from "./helpers.js";

const cliPath = join(import.meta.dirname, "..", "index.js");

describe("checkContentHealth", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-doctor-content-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("detects active focus in activeContext.md", () => {
    mkdirSync(join(tempDir, ".context"), { recursive: true });
    writeFileSync(
      join(tempDir, ".context", "activeContext.md"),
      "# Active Context\n\n## Current Focus\n\nWorking on feature X.\n\n## Recent Changes\n",
      "utf-8",
    );
    const results = checkContentHealth(tempDir);
    const focusResult = results.find((r) => r.message.includes("active focus"));
    assert.ok(focusResult);
    assert.ok(focusResult!.message.includes("active focus"));
  });

  it("warns when Current Focus is placeholder", () => {
    const dir = join(tempDir, "placeholder");
    mkdirSync(join(dir, ".context"), { recursive: true });
    writeFileSync(
      join(dir, ".context", "activeContext.md"),
      "# Active Context\n\n## Current Focus\n\n_Describe what you're working on._\n",
      "utf-8",
    );
    const results = checkContentHealth(dir);
    const focusResult = results.find((r) => r.message.includes("no meaningful"));
    assert.ok(focusResult);
  });

  it("detects conventions in systemPatterns.md", () => {
    writeFileSync(
      join(tempDir, ".context", "systemPatterns.md"),
      "# Patterns\n\n## Conventions\n\n- Code in English\n- ESM only\n",
      "utf-8",
    );
    const results = checkContentHealth(tempDir);
    const patternResult = results.find((r) => r.message.includes("documented conventions"));
    assert.ok(patternResult);
  });

  it("warns when systemPatterns.md has no conventions", () => {
    const dir = join(tempDir, "empty-patterns");
    mkdirSync(join(dir, ".context"), { recursive: true });
    writeFileSync(
      join(dir, ".context", "systemPatterns.md"),
      "# Patterns\n\nNothing here yet.\n",
      "utf-8",
    );
    const results = checkContentHealth(dir);
    const patternResult = results.find((r) => r.message.includes("no conventions"));
    assert.ok(patternResult);
  });

  it("validates TOCKET.md contains protocol keywords", () => {
    writeFileSync(
      join(tempDir, "TOCKET.md"),
      "# Tocket Protocol\n\nThe payload version is 2.0.\n",
      "utf-8",
    );
    const results = checkContentHealth(tempDir);
    const tocketResult = results.find((r) => r.message.includes("protocol keywords"));
    assert.ok(tocketResult);
  });

  it("checks agent config references .context/", () => {
    writeFileSync(
      join(tempDir, "CLAUDE.md"),
      "# Claude\n\nRead `.context/` before acting.\n",
      "utf-8",
    );
    const results = checkContentHealth(tempDir);
    const agentResult = results.find((r) => r.message.includes("CLAUDE.md references"));
    assert.ok(agentResult);
  });

  it("warns when agent config does not reference .context/", () => {
    const dir = join(tempDir, "no-ref");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "CLAUDE.md"),
      "# Claude\n\nJust some instructions.\n",
      "utf-8",
    );
    const results = checkContentHealth(dir);
    const agentResult = results.find((r) => r.message.includes("does not reference"));
    assert.ok(agentResult);
  });
});

describe("checkGitTracking", () => {
  // Use the Tocket repo itself for git tests
  const tocketRoot = join(import.meta.dirname, "..", "..");

  it("returns results in a git repository", () => {
    const results = checkGitTracking(tocketRoot);
    assert.ok(results.length > 0);
  });

  it("detects .context/ is not gitignored", () => {
    const results = checkGitTracking(tocketRoot);
    const ignoreResult = results.find((r) => r.message.includes("gitignore"));
    assert.ok(ignoreResult);
    assert.ok(ignoreResult!.message.includes("not gitignored"));
  });

  it("returns warn for non-git directory", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "tocket-doctor-git-"));
    try {
      const results = checkGitTracking(tempDir);
      assert.ok(results.some((r) => r.message.includes("Not a git repository")));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("checkNotebookLight", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-doctor-light-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("hard-fails when .context/ is missing and suggests init", () => {
    const empty = join(tempDir, "empty");
    mkdirSync(empty, { recursive: true });
    const { results, hardFail } = checkNotebookLight(empty, { TYPESAFE_API_KEY: "" });
    assert.equal(hardFail, true);
    assert.ok(results.some((r) => r.message.includes(".context/ missing")));
    assert.ok(results.some((r) => r.message.includes("tocket init")));
  });

  it("reports dirs, stub key, and latest decision without printing the key", () => {
    const cwd = join(tempDir, "bank");
    mkdirSync(join(cwd, ".context", "decisions", "review"), { recursive: true });
    mkdirSync(join(cwd, ".context", "appmaps"), { recursive: true });
    const decision = join(cwd, ".context", "decisions", "review", "20260920T150000Z-next.json");
    writeFileSync(decision, "{\"schema\":\"tocket.decide/v0\"}\n", "utf-8");

    const { results, hardFail } = checkNotebookLight(cwd, { TYPESAFE_API_KEY: "" });
    assert.equal(hardFail, false);
    assert.ok(results.some((r) => r.message.includes(".context/decisions/ found")));
    assert.ok(results.some((r) => r.message.includes(".context/appmaps/ found")));
    assert.ok(results.some((r) => r.message.includes("TYPESAFE_API_KEY: no")));
    assert.ok(results.some((r) => r.message.includes(".agents/skills/tocket/SKILL.md missing")));
    assert.ok(results.some((r) => r.message.includes("npx skills add pedrocivita/tocket --skill tocket")));
    assert.ok(!results.some((r) => /sk-|typesafe_[A-Za-z0-9]{8,}/.test(r.message)));
    const latest = findLatestDecision(cwd);
    assert.ok(latest);
    assert.ok(includesPath(latest!.rel, ".context/decisions/review/20260920T150000Z-next.json"));
    assert.match(formatAge(Date.now() - 90_000, Date.now()), /1m ago|2m ago/);
  });

  it("reports the official skill when it exists on disk", () => {
    const cwd = join(tempDir, "with-skill");
    mkdirSync(join(cwd, ".context", "decisions"), { recursive: true });
    mkdirSync(join(cwd, ".agents", "skills", "tocket"), { recursive: true });
    writeFileSync(join(cwd, ".agents", "skills", "tocket", "SKILL.md"), "---\nname: tocket\n---\n", "utf-8");
    const { results, hardFail } = checkNotebookLight(cwd, { TYPESAFE_API_KEY: "" });
    assert.equal(hardFail, false);
    assert.ok(results.some((r) => r.message.includes(".agents/skills/tocket/SKILL.md found")));
  });

  it("says yes when a key is present without echoing it", () => {
    const result = checkTypesafeKeyPresent({ TYPESAFE_API_KEY: "super-secret-key-value" });
    assert.equal(result.message, "TYPESAFE_API_KEY: yes");
    assert.ok(!result.message.includes("super-secret"));
  });
});

describe("tocket doctor CLI", () => {
  it("exits non-zero only when .context/ is missing", () => {
    const empty = mkdtempSync(join(tmpdir(), "tocket-doctor-cli-"));
    try {
      execFileSync(process.execPath, [cliPath, "doctor"], {
        cwd: empty,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      assert.fail("expected doctor to exit non-zero");
    } catch (err) {
      const failed = err as { status?: number | null; stdout?: string };
      assert.equal(failed.status, 1);
      assert.match(failed.stdout ?? "", /Not a Tocket project/);
      assert.match(failed.stdout ?? "", /npx skills add pedrocivita\/tocket --skill tocket/);
      assert.match(failed.stdout ?? "", /Before expensive tools: tocket decide --dry-run/);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe("checkStaleness", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-doctor-stale-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns null when .context/activeContext.md does not exist", () => {
    const result = checkStaleness(tempDir);
    assert.equal(result, null);
  });

  it("returns null when file is fresh", () => {
    mkdirSync(join(tempDir, ".context"), { recursive: true });
    writeFileSync(join(tempDir, ".context", "activeContext.md"), "fresh", "utf-8");
    const result = checkStaleness(tempDir);
    assert.equal(result, null);
  });
});
