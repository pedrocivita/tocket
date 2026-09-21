import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getExecutorFileName,
  getArchitectFileName,
  getExecutorDisplayName,
  getArchitectDisplayName,
  detectPreferredAgents,
  resolveInitAgents,
  envFlag,
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

describe("envFlag", () => {
  it("is case-insensitive and treats blank values as unset", () => {
    assert.equal(envFlag({ cursor_trace_id: "abc" }, "CURSOR_TRACE_ID"), true);
    assert.equal(envFlag({ CURSOR_TRACE_ID: "abc" }, "cursor_trace_id"), true);
    assert.equal(envFlag({ CURSOR_TRACE_ID: "" }, "CURSOR_TRACE_ID"), false);
    assert.equal(envFlag({ CURSOR_TRACE_ID: "  " }, "CURSOR_TRACE_ID"), false);
    assert.equal(envFlag({}, "CURSOR_TRACE_ID"), false);
  });
});

describe("detectPreferredAgents", () => {
  it("detects Cursor from .cursorrules and Claude from env", () => {
    const dir = mkdtempSync(join(tmpdir(), "tocket-detect-"));
    try {
      writeFileSync(join(dir, ".cursorrules"), "rules\n", "utf-8");
      const fromFile = detectPreferredAgents(dir, {});
      assert.equal(fromFile.executor, "Cursor");
      assert.equal(fromFile.executorSource, "file");

      const empty = mkdtempSync(join(tmpdir(), "tocket-detect-empty-"));
      try {
        const fromEnv = detectPreferredAgents(empty, { CURSOR_TRACE_ID: "abc" });
        assert.equal(fromEnv.executor, "Cursor");
        assert.equal(fromEnv.executorSource, "env");
        const fromEnvCasing = detectPreferredAgents(empty, { cursor_trace_id: "abc" });
        assert.equal(fromEnvCasing.executor, "Cursor");
        assert.equal(fromEnvCasing.executorSource, "env");
        const emptyCursor = detectPreferredAgents(empty, { CURSOR_TRACE_ID: "  " });
        assert.equal(emptyCursor.executor, undefined);
        const claude = detectPreferredAgents(empty, { CLAUDECODE: "1" });
        assert.equal(claude.executor, "Claude Code");
      } finally {
        rmSync(empty, { recursive: true, force: true });
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("detects Copilot and Gemini from files", () => {
    const dir = mkdtempSync(join(tmpdir(), "tocket-detect-copilot-"));
    try {
      mkdirSync(join(dir, ".github"), { recursive: true });
      writeFileSync(join(dir, ".github", "copilot-instructions.md"), "hi\n", "utf-8");
      writeFileSync(join(dir, "GEMINI.md"), "arch\n", "utf-8");
      const detected = detectPreferredAgents(dir, {});
      assert.equal(detected.executor, "Copilot");
      assert.equal(detected.architect, "Gemini");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("resolveInitAgents", () => {
  it("prefers flag, then config, then detected, then default", () => {
    const detected = {
      executor: "Cursor" as string | undefined,
      architect: "Gemini" as string | undefined,
      executorSource: "file" as const,
      architectSource: "file" as const,
    };
    assert.equal(
      resolveInitAgents({ executorFlag: "Copilot", detected }).executor,
      "Copilot",
    );
    assert.equal(
      resolveInitAgents({ configExecutor: "Windsurf", detected }).executor,
      "Windsurf",
    );
    assert.equal(resolveInitAgents({ detected }).executor, "Cursor");
    assert.equal(
      resolveInitAgents({
        detected: { executorSource: "none", architectSource: "none" },
      }).executor,
      DEFAULT_EXECUTOR,
    );
  });
});
