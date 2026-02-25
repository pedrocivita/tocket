import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EJECT_FILES, EJECT_DIRS } from "../commands/eject.cmd.js";

describe("eject - constants", () => {
  it("EJECT_FILES contains all expected files", () => {
    assert.ok(EJECT_FILES.includes("TOCKET.md"));
    assert.ok(EJECT_FILES.includes("CLAUDE.md"));
    assert.ok(EJECT_FILES.includes("GEMINI.md"));
    assert.ok(EJECT_FILES.includes(".cursorrules"));
  });

  it("EJECT_DIRS contains .context", () => {
    assert.ok(EJECT_DIRS.includes(".context"));
  });
});

describe("eject - removal logic", () => {
  let tempDir: string;

  before(() => {
    tempDir = mkdtempSync(join(tmpdir(), "tocket-eject-test-"));
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("removes .context directory recursively", async () => {
    const contextDir = join(tempDir, ".context");
    mkdirSync(contextDir, { recursive: true });
    writeFileSync(join(contextDir, "activeContext.md"), "test", "utf-8");
    writeFileSync(join(contextDir, "systemPatterns.md"), "test", "utf-8");

    assert.ok(existsSync(contextDir));
    await rm(contextDir, { recursive: true, force: true });
    assert.ok(!existsSync(contextDir));
  });

  it("removes individual eject files", async () => {
    for (const file of EJECT_FILES) {
      const fullPath = join(tempDir, file);
      writeFileSync(fullPath, "test content", "utf-8");
      assert.ok(existsSync(fullPath));
      await rm(fullPath, { force: true });
      assert.ok(!existsSync(fullPath));
    }
  });

  it("does not error when files are already missing", async () => {
    for (const file of EJECT_FILES) {
      const fullPath = join(tempDir, file);
      assert.ok(!existsSync(fullPath));
      await rm(fullPath, { force: true });
    }
  });

  it("does not error when .context is already missing", async () => {
    const contextDir = join(tempDir, ".context");
    assert.ok(!existsSync(contextDir));
    await rm(contextDir, { recursive: true, force: true });
  });
});

describe("eject - partial workspace", () => {
  let tempDir: string;

  before(() => {
    tempDir = mkdtempSync(join(tmpdir(), "tocket-eject-partial-"));
    mkdirSync(join(tempDir, ".context"), { recursive: true });
    writeFileSync(join(tempDir, ".context", "activeContext.md"), "data", "utf-8");
    writeFileSync(join(tempDir, "TOCKET.md"), "data", "utf-8");
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("removes existing files and skips missing ones", async () => {
    assert.ok(existsSync(join(tempDir, ".context")));
    assert.ok(existsSync(join(tempDir, "TOCKET.md")));
    assert.ok(!existsSync(join(tempDir, "CLAUDE.md")));

    for (const dir of EJECT_DIRS) {
      const fullPath = join(tempDir, dir);
      if (existsSync(fullPath)) {
        await rm(fullPath, { recursive: true, force: true });
      }
    }
    for (const file of EJECT_FILES) {
      const fullPath = join(tempDir, file);
      if (existsSync(fullPath)) {
        await rm(fullPath, { force: true });
      }
    }

    assert.ok(!existsSync(join(tempDir, ".context")));
    assert.ok(!existsSync(join(tempDir, "TOCKET.md")));
  });
});
