import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkFile, checkStale, checkAgentFile } from "../commands/validate.cmd.js";

describe("checkFile", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-validate-test-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns pass icon when required file exists", () => {
    writeFileSync(join(tempDir, "exists.md"), "content", "utf-8");
    const result = checkFile(tempDir, "exists.md", true);
    assert.ok(result.message.includes("found"));
  });

  it("returns fail icon when required file is missing", () => {
    const result = checkFile(tempDir, "missing.md", true);
    assert.ok(result.message.includes("missing (required)"));
  });

  it("returns warn icon when optional file is missing", () => {
    const result = checkFile(tempDir, "optional.md", false);
    assert.ok(result.message.includes("missing (optional)"));
  });

  it("returns pass icon when optional file exists", () => {
    writeFileSync(join(tempDir, "opt-exists.md"), "content", "utf-8");
    const result = checkFile(tempDir, "opt-exists.md", false);
    assert.ok(result.message.includes("found"));
  });
});

describe("checkStale", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-stale-test-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns null when file does not exist", () => {
    const result = checkStale(tempDir, "nonexistent.md");
    assert.equal(result, null);
  });

  it("returns null when file is fresh (< 7 days)", () => {
    writeFileSync(join(tempDir, "fresh.md"), "content", "utf-8");
    const result = checkStale(tempDir, "fresh.md");
    assert.equal(result, null);
  });

  it("returns warn result when file is stale (> 7 days)", () => {
    const filePath = join(tempDir, "stale.md");
    writeFileSync(filePath, "content", "utf-8");
    // Set mtime to 10 days ago
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    utimesSync(filePath, tenDaysAgo, tenDaysAgo);
    const result = checkStale(tempDir, "stale.md");
    assert.ok(result !== null);
    assert.ok(result!.message.includes("days ago"));
  });
});

describe("checkAgentFile", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-agent-test-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns pass when CLAUDE.md exists", () => {
    const dir = join(tempDir, "with-claude");
    mkdirSync(dir);
    writeFileSync(join(dir, "CLAUDE.md"), "# Claude", "utf-8");
    const result = checkAgentFile(dir);
    assert.ok(result.message.includes("Agent config found"));
    assert.ok(result.message.includes("CLAUDE.md"));
  });

  it("returns pass when .cursorrules exists", () => {
    const dir = join(tempDir, "with-cursor");
    mkdirSync(dir);
    writeFileSync(join(dir, ".cursorrules"), "rules", "utf-8");
    const result = checkAgentFile(dir);
    assert.ok(result.message.includes("Agent config found"));
    assert.ok(result.message.includes(".cursorrules"));
  });

  it("returns warn when no agent files exist", () => {
    const dir = join(tempDir, "empty");
    mkdirSync(dir);
    const result = checkAgentFile(dir);
    assert.ok(result.message.includes("No agent config file found"));
  });

  it("lists multiple agent files when present", () => {
    const dir = join(tempDir, "multi");
    mkdirSync(dir);
    writeFileSync(join(dir, "CLAUDE.md"), "# Claude", "utf-8");
    writeFileSync(join(dir, "GEMINI.md"), "# Gemini", "utf-8");
    const result = checkAgentFile(dir);
    assert.ok(result.message.includes("CLAUDE.md"));
    assert.ok(result.message.includes("GEMINI.md"));
  });
});
