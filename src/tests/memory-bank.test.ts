import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  executorMd,
  claudeMd,
  architectMd,
  geminiMd,
  tocketMd,
  activeContextMd,
  systemPatternsMd,
  productContextMd,
  techContextMd,
  progressMd,
  cursorrulesMd,
} from "../templates/memory-bank.js";
import type { StackInfo } from "../templates/memory-bank.js";

describe("executorMd (claudeMd)", () => {
  const output = executorMd("TestProject", "A test project");

  it("includes the project name in the title", () => {
    assert.ok(output.includes("TestProject"));
    assert.ok(output.includes("Executor Instructions"));
  });

  it("includes the description as a blockquote", () => {
    assert.ok(output.includes("> A test project"));
  });

  it("defines the Executor role with default agent name", () => {
    assert.ok(output.includes("**Executor** (Claude Code)"));
  });

  it("references the Memory Bank files", () => {
    assert.ok(output.includes(".context/activeContext.md"));
    assert.ok(output.includes(".context/systemPatterns.md"));
  });

  it("references the architect file", () => {
    assert.ok(output.includes("GEMINI.md"));
  });

  it("handles empty description gracefully", () => {
    const noDesc = executorMd("Foo", "");
    assert.ok(noDesc.includes("Foo"));
    assert.ok(!noDesc.includes("> \n"));
  });

  it("accepts custom agent names", () => {
    const custom = executorMd("Proj", "desc", "Cursor", "ARCHITECT.md");
    assert.ok(custom.includes("**Executor** (Cursor)"));
    assert.ok(custom.includes("ARCHITECT.md"));
  });

  it("backward compat: claudeMd alias works", () => {
    const output = claudeMd("Test", "desc");
    assert.ok(output.includes("**Executor**"));
  });
});

describe("architectMd (geminiMd)", () => {
  const output = architectMd("TestProject", "A test project");

  it("includes the project name in the title", () => {
    assert.ok(output.includes("TestProject"));
    assert.ok(output.includes("Architect Instructions"));
  });

  it("defines the Architect role with default agent name", () => {
    assert.ok(output.includes("**Architect** (Gemini)"));
  });

  it("references the executor file", () => {
    assert.ok(output.includes("CLAUDE.md"));
  });

  it("references payload v2.0 format", () => {
    assert.ok(output.includes('<payload version="2.0">'));
  });

  it("does not reference the deprecated mission-brief format", () => {
    assert.ok(!output.includes("<mission-brief"));
  });

  it("accepts custom agent names", () => {
    const custom = architectMd("Proj", "desc", "ChatGPT", "Cursor", ".cursorrules");
    assert.ok(custom.includes("**Architect** (ChatGPT)"));
    assert.ok(custom.includes("Executor (Cursor)"));
    assert.ok(custom.includes(".cursorrules"));
  });

  it("backward compat: geminiMd alias works", () => {
    const output = geminiMd("Test", "desc");
    assert.ok(output.includes("**Architect**"));
  });
});

describe("tocketMd", () => {
  const output = tocketMd("TestProject");

  it("includes the protocol title", () => {
    assert.ok(output.includes("# Tocket Protocol Specification"));
  });

  it("includes the project name", () => {
    assert.ok(output.includes("**TestProject**"));
  });

  it("declares agent-agnostic stance", () => {
    assert.ok(output.includes("agent-agnostic"));
  });

  it("documents all 5 Memory Bank files", () => {
    assert.ok(output.includes("activeContext.md"));
    assert.ok(output.includes("systemPatterns.md"));
    assert.ok(output.includes("techContext.md"));
    assert.ok(output.includes("productContext.md"));
    assert.ok(output.includes("progress.md"));
  });

  it("documents the Triangulation pattern", () => {
    assert.ok(output.includes("ARCHITECT"));
    assert.ok(output.includes("EXECUTOR"));
  });

  it("includes a payload example with v2.0", () => {
    assert.ok(output.includes('<payload version="2.0">'));
  });

  it("references default executor and architect files in Quick Start", () => {
    assert.ok(output.includes("CLAUDE.md"));
    assert.ok(output.includes("GEMINI.md"));
  });

  it("accepts custom file names in Quick Start", () => {
    const custom = tocketMd("Proj", ".cursorrules", "ARCHITECT.md");
    assert.ok(custom.includes(".cursorrules"));
    assert.ok(custom.includes("ARCHITECT.md"));
  });
});

describe("activeContextMd", () => {
  const output = activeContextMd("TestProject");

  it("includes the project name", () => {
    assert.ok(output.includes("# Active Context - TestProject"));
  });

  it("has the required sections", () => {
    assert.ok(output.includes("## Current Focus"));
    assert.ok(output.includes("## Recent Changes"));
    assert.ok(output.includes("## Open Decisions"));
  });

  it("includes a date in the recent changes table", () => {
    assert.match(output, /\d{4}-\d{2}-\d{2}/);
  });
});

describe("systemPatternsMd", () => {
  const output = systemPatternsMd("TestProject");

  it("includes the project name", () => {
    assert.ok(output.includes("# System Patterns - TestProject"));
  });

  it("has the required sections", () => {
    assert.ok(output.includes("## Tech Stack"));
    assert.ok(output.includes("## Conventions"));
    assert.ok(output.includes("## Key Decisions"));
  });

  it("includes default agent names in conventions", () => {
    assert.ok(output.includes("Gemini (Architect)"));
    assert.ok(output.includes("Claude Code (Executor)"));
  });

  it("accepts custom agent names", () => {
    const custom = systemPatternsMd("Proj", "ChatGPT", "Cursor");
    assert.ok(custom.includes("ChatGPT (Architect)"));
    assert.ok(custom.includes("Cursor (Executor)"));
  });
});

describe("productContextMd", () => {
  it("includes the project name and description", () => {
    const output = productContextMd("TestProject", "A cool tool");
    assert.ok(output.includes("# Product Context - TestProject"));
    assert.ok(output.includes("A cool tool"));
  });

  it("shows placeholder when description is empty", () => {
    const output = productContextMd("TestProject", "");
    assert.ok(output.includes("_Describe your product here._"));
  });

  it("has the required sections", () => {
    const output = productContextMd("TestProject", "desc");
    assert.ok(output.includes("## Problem"));
    assert.ok(output.includes("## Solution"));
    assert.ok(output.includes("## Target Users"));
  });
});

describe("techContextMd", () => {
  it("includes the project name", () => {
    const output = techContextMd("TestProject");
    assert.ok(output.includes("# Tech Context - TestProject"));
  });

  it("has a stack table", () => {
    const output = techContextMd("TestProject");
    assert.ok(output.includes("| Language |"));
    assert.ok(output.includes("| Runtime |"));
  });

  it("includes project structure with project name", () => {
    const output = techContextMd("TestProject");
    assert.ok(output.includes("TestProject/"));
  });

  it("renders empty rows when no stack provided", () => {
    const output = techContextMd("TestProject");
    // Should have empty cells (no "Auto-detected")
    assert.ok(!output.includes("Auto-detected"));
  });

  it("renders detected stack when StackInfo is provided", () => {
    const stack: StackInfo = {
      language: "TypeScript",
      runtime: "Node.js",
      build: "Vite",
      framework: "React",
      extras: ["tailwindcss", "prisma"],
    };
    const output = techContextMd("TestProject", stack);
    assert.ok(output.includes("TypeScript"));
    assert.ok(output.includes("Node.js"));
    assert.ok(output.includes("Vite"));
    assert.ok(output.includes("React"));
    assert.ok(output.includes("Auto-detected by Tocket"));
  });

  it("renders notable dependencies when extras are present", () => {
    const stack: StackInfo = {
      language: "TypeScript",
      runtime: "Node.js",
      build: "tsc",
      framework: "",
      extras: ["tailwindcss", "zod"],
    };
    const output = techContextMd("TestProject", stack);
    assert.ok(output.includes("### Notable Dependencies"));
    assert.ok(output.includes("`tailwindcss`"));
    assert.ok(output.includes("`zod`"));
  });

  it("omits notable dependencies section when extras are empty", () => {
    const stack: StackInfo = {
      language: "TypeScript",
      runtime: "Node.js",
      build: "tsc",
      framework: "",
      extras: [],
    };
    const output = techContextMd("TestProject", stack);
    assert.ok(!output.includes("### Notable Dependencies"));
  });
});

describe("progressMd", () => {
  const output = progressMd("TestProject");

  it("includes the project name", () => {
    assert.ok(output.includes("# Progress Log - TestProject"));
  });

  it("has an initialization milestone marked complete", () => {
    assert.ok(output.includes("**Status**: Complete"));
  });

  it("has a Next Up section", () => {
    assert.ok(output.includes("## Next Up"));
  });
});

describe("cursorrulesMd", () => {
  const output = cursorrulesMd("TestProject", "A cool CLI tool");

  it("includes the project name", () => {
    assert.ok(output.includes("# .cursorrules - TestProject"));
  });

  it("includes the description as a blockquote", () => {
    assert.ok(output.includes("> A cool CLI tool"));
  });

  it("defines the Executor role", () => {
    assert.ok(output.includes("**Executor**"));
  });

  it("references Memory Bank files", () => {
    assert.ok(output.includes(".context/activeContext.md"));
    assert.ok(output.includes(".context/systemPatterns.md"));
  });

  it("handles empty description gracefully", () => {
    const noDesc = cursorrulesMd("Foo", "");
    assert.ok(noDesc.includes("# .cursorrules - Foo"));
    assert.ok(!noDesc.includes("> \n"));
  });
});
