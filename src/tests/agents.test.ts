import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getExecutorFileName,
  getArchitectFileName,
  getExecutorDisplayName,
  getArchitectDisplayName,
  DEFAULT_EXECUTOR,
  DEFAULT_ARCHITECT,
  EXECUTOR_FILE_MAP,
  ARCHITECT_FILE_MAP,
} from "../utils/agents.js";

// ─── getExecutorFileName ────────────────────────────────────────────

describe("getExecutorFileName", () => {
  it("returns CLAUDE.md for 'Claude Code'", () => {
    assert.equal(getExecutorFileName("Claude Code"), "CLAUDE.md");
  });

  it("returns CLAUDE.md for 'Claude'", () => {
    assert.equal(getExecutorFileName("Claude"), "CLAUDE.md");
  });

  it("returns .cursorrules for 'Cursor'", () => {
    assert.equal(getExecutorFileName("Cursor"), ".cursorrules");
  });

  it("returns .windsurfrules for 'Windsurf'", () => {
    assert.equal(getExecutorFileName("Windsurf"), ".windsurfrules");
  });

  it("returns .github/copilot-instructions.md for 'Copilot'", () => {
    assert.equal(getExecutorFileName("Copilot"), ".github/copilot-instructions.md");
  });

  it("is case-insensitive", () => {
    assert.equal(getExecutorFileName("CLAUDE CODE"), "CLAUDE.md");
    assert.equal(getExecutorFileName("cursor"), ".cursorrules");
    assert.equal(getExecutorFileName("WINDSURF"), ".windsurfrules");
  });

  it("returns EXECUTOR.md for unknown agents", () => {
    assert.equal(getExecutorFileName("DeepSeek"), "EXECUTOR.md");
    assert.equal(getExecutorFileName("GPT-4o"), "EXECUTOR.md");
    assert.equal(getExecutorFileName("Cline"), "EXECUTOR.md");
  });

  it("returns CLAUDE.md when undefined", () => {
    assert.equal(getExecutorFileName(undefined), "CLAUDE.md");
  });

  it("returns CLAUDE.md when no argument provided", () => {
    assert.equal(getExecutorFileName(), "CLAUDE.md");
  });
});

// ─── getArchitectFileName ───────────────────────────────────────────

describe("getArchitectFileName", () => {
  it("returns GEMINI.md for 'Gemini'", () => {
    assert.equal(getArchitectFileName("Gemini"), "GEMINI.md");
  });

  it("is case-insensitive", () => {
    assert.equal(getArchitectFileName("GEMINI"), "GEMINI.md");
    assert.equal(getArchitectFileName("gemini"), "GEMINI.md");
  });

  it("returns ARCHITECT.md for unknown agents", () => {
    assert.equal(getArchitectFileName("ChatGPT"), "ARCHITECT.md");
    assert.equal(getArchitectFileName("Claude"), "ARCHITECT.md");
    assert.equal(getArchitectFileName("o1"), "ARCHITECT.md");
  });

  it("returns GEMINI.md when undefined", () => {
    assert.equal(getArchitectFileName(undefined), "GEMINI.md");
  });

  it("returns GEMINI.md when no argument provided", () => {
    assert.equal(getArchitectFileName(), "GEMINI.md");
  });
});

// ─── getExecutorDisplayName ─────────────────────────────────────────

describe("getExecutorDisplayName", () => {
  it("returns the given name when provided", () => {
    assert.equal(getExecutorDisplayName("Cursor"), "Cursor");
  });

  it("returns DEFAULT_EXECUTOR when undefined", () => {
    assert.equal(getExecutorDisplayName(undefined), DEFAULT_EXECUTOR);
  });

  it("returns DEFAULT_EXECUTOR when empty string", () => {
    assert.equal(getExecutorDisplayName(""), DEFAULT_EXECUTOR);
  });
});

// ─── getArchitectDisplayName ────────────────────────────────────────

describe("getArchitectDisplayName", () => {
  it("returns the given name when provided", () => {
    assert.equal(getArchitectDisplayName("ChatGPT"), "ChatGPT");
  });

  it("returns DEFAULT_ARCHITECT when undefined", () => {
    assert.equal(getArchitectDisplayName(undefined), DEFAULT_ARCHITECT);
  });

  it("returns DEFAULT_ARCHITECT when empty string", () => {
    assert.equal(getArchitectDisplayName(""), DEFAULT_ARCHITECT);
  });
});

// ─── Constants ──────────────────────────────────────────────────────

describe("agent constants", () => {
  it("DEFAULT_EXECUTOR is Claude Code", () => {
    assert.equal(DEFAULT_EXECUTOR, "Claude Code");
  });

  it("DEFAULT_ARCHITECT is Gemini", () => {
    assert.equal(DEFAULT_ARCHITECT, "Gemini");
  });

  it("EXECUTOR_FILE_MAP has expected entries", () => {
    assert.ok("claude code" in EXECUTOR_FILE_MAP);
    assert.ok("claude" in EXECUTOR_FILE_MAP);
    assert.ok("cursor" in EXECUTOR_FILE_MAP);
    assert.ok("windsurf" in EXECUTOR_FILE_MAP);
    assert.ok("copilot" in EXECUTOR_FILE_MAP);
  });

  it("ARCHITECT_FILE_MAP has expected entries", () => {
    assert.ok("gemini" in ARCHITECT_FILE_MAP);
  });
});
