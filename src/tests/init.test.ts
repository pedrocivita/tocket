import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

// Path to the built CLI
const cliPath = join(import.meta.dirname, "..", "index.js");

describe("init --minimal", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-init-minimal-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates only essential files with --minimal --name --description --force", () => {
    execSync(
      `node "${cliPath}" init --minimal --name testproject --description "A test" --force`,
      { cwd: tempDir, encoding: "utf-8" },
    );

    // Essential files should exist
    assert.ok(existsSync(join(tempDir, ".context", "activeContext.md")));
    assert.ok(existsSync(join(tempDir, ".context", "systemPatterns.md")));
    assert.ok(existsSync(join(tempDir, "TOCKET.md")));

    // Non-essential files should NOT exist
    assert.ok(!existsSync(join(tempDir, "CLAUDE.md")));
    assert.ok(!existsSync(join(tempDir, "GEMINI.md")));
    assert.ok(!existsSync(join(tempDir, ".cursorrules")));
    assert.ok(!existsSync(join(tempDir, ".context", "productContext.md")));
    assert.ok(!existsSync(join(tempDir, ".context", "techContext.md")));
    assert.ok(!existsSync(join(tempDir, ".context", "progress.md")));
  });
});

describe("init --name --description (non-interactive)", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-init-flags-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates full workspace without interactive prompts", () => {
    execSync(
      `node "${cliPath}" init --name flagproject --description "Flag desc" --force`,
      { cwd: tempDir, encoding: "utf-8" },
    );

    // All 9 files should exist (not minimal)
    assert.ok(existsSync(join(tempDir, ".context", "activeContext.md")));
    assert.ok(existsSync(join(tempDir, ".context", "systemPatterns.md")));
    assert.ok(existsSync(join(tempDir, ".context", "productContext.md")));
    assert.ok(existsSync(join(tempDir, ".context", "techContext.md")));
    assert.ok(existsSync(join(tempDir, ".context", "progress.md")));
    assert.ok(existsSync(join(tempDir, "TOCKET.md")));
    assert.ok(existsSync(join(tempDir, "CLAUDE.md")));
    assert.ok(existsSync(join(tempDir, "GEMINI.md")));
    assert.ok(existsSync(join(tempDir, ".cursorrules")));
  });
});

describe("init --minimal file count", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-init-count-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("minimal creates exactly 3 files + 1 directory", () => {
    execSync(
      `node "${cliPath}" init --minimal --name counttest --description "test" --force`,
      { cwd: tempDir, encoding: "utf-8" },
    );

    // Count files in .context/
    const contextDir = join(tempDir, ".context");
    assert.ok(existsSync(contextDir));

    // Exactly 2 files in .context/
    const contextFiles = ["activeContext.md", "systemPatterns.md"];
    for (const f of contextFiles) {
      assert.ok(existsSync(join(contextDir, f)), `${f} should exist`);
    }

    // These should NOT be in .context/ with minimal
    const skippedContextFiles = ["productContext.md", "techContext.md", "progress.md"];
    for (const f of skippedContextFiles) {
      assert.ok(!existsSync(join(contextDir, f)), `${f} should not exist in minimal mode`);
    }
  });
});
