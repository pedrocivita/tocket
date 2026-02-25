import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkContentHealth, checkGitTracking, checkStaleness } from "../commands/doctor.cmd.js";

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
