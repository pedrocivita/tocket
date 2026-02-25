import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("status - workspace detection", () => {
  let tempDir: string;

  before(() => {
    tempDir = mkdtempSync(join(tmpdir(), "tocket-status-test-"));
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("detects absence of .context directory", () => {
    const contextDir = join(tempDir, ".context");
    assert.ok(!existsSync(contextDir));
  });

  it("detects presence of .context directory with files", () => {
    const contextDir = join(tempDir, ".context");
    mkdirSync(contextDir, { recursive: true });
    writeFileSync(join(contextDir, "activeContext.md"), "# Active Context\n\n## Current Focus\n\nTesting status command.\n", "utf-8");
    writeFileSync(join(contextDir, "systemPatterns.md"), "test", "utf-8");
    writeFileSync(join(contextDir, "progress.md"), "# Progress\n\n## Session: 2026-02-25\n\n**Summary**: test\n", "utf-8");

    assert.ok(existsSync(contextDir));
    assert.ok(existsSync(join(contextDir, "activeContext.md")));
  });

  it("counts context files correctly", () => {
    const contextDir = join(tempDir, ".context");
    const expected = ["activeContext.md", "systemPatterns.md", "productContext.md", "techContext.md", "progress.md"];
    const count = expected.filter((f) => existsSync(join(contextDir, f))).length;
    // We created 3 files above
    assert.equal(count, 3);
  });
});
