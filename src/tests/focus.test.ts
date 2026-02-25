import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { replaceFocusSection } from "../commands/focus.cmd.js";

describe("replaceFocusSection", () => {
  it("replaces single-line focus content", () => {
    const input = `# Active Context

## Current Focus

Old focus text here.

## Recent Changes

Some changes.
`;
    const result = replaceFocusSection(input, "New focus message");
    assert.ok(result.includes("New focus message"));
    assert.ok(!result.includes("Old focus text here"));
    assert.ok(result.includes("## Recent Changes"));
  });

  it("replaces multi-line focus content", () => {
    const input = `# Active Context

## Current Focus

**v2.0.0 — UX Overhaul.** Added purple theme, dashboard,
config command, smart generate, and 29 new tests.
All decisions resolved.

## Recent Changes

| Date | Change |
`;
    const result = replaceFocusSection(input, "Working on v2.1.0 features");
    assert.ok(result.includes("Working on v2.1.0 features"));
    assert.ok(!result.includes("v2.0.0"));
    assert.ok(result.includes("## Recent Changes"));
  });

  it("preserves sections before and after Current Focus", () => {
    const input = `# Active Context

<!-- comment -->

## Current Focus

Old stuff.

## Recent Changes

Data here.

## Open Decisions

Decisions here.
`;
    const result = replaceFocusSection(input, "Brand new focus");
    assert.ok(result.includes("# Active Context"));
    assert.ok(result.includes("<!-- comment -->"));
    assert.ok(result.includes("## Recent Changes"));
    assert.ok(result.includes("Data here."));
    assert.ok(result.includes("## Open Decisions"));
    assert.ok(result.includes("Decisions here."));
  });

  it("appends section when ## Current Focus is missing", () => {
    const input = `# Active Context

## Recent Changes

Some data.
`;
    const result = replaceFocusSection(input, "New focus");
    assert.ok(result.includes("## Current Focus"));
    assert.ok(result.includes("New focus"));
    assert.ok(result.includes("## Recent Changes"));
  });

  it("handles Current Focus at end of file (no following section)", () => {
    const input = `# Active Context

## Current Focus

Last section, nothing after this.
`;
    const result = replaceFocusSection(input, "Updated final section");
    assert.ok(result.includes("Updated final section"));
    assert.ok(!result.includes("Last section"));
  });

  it("handles empty content between heading and next section", () => {
    const input = `## Current Focus

## Recent Changes
`;
    const result = replaceFocusSection(input, "Fill the gap");
    assert.ok(result.includes("Fill the gap"));
    assert.ok(result.includes("## Recent Changes"));
  });
});

describe("focus - file integration", () => {
  let tempDir: string;

  before(() => {
    tempDir = mkdtempSync(join(tmpdir(), "tocket-focus-test-"));
    mkdirSync(join(tempDir, ".context"), { recursive: true });
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("correctly round-trips through file read/write", () => {
    const filePath = join(tempDir, ".context", "activeContext.md");
    const original = `# Active Context - Test

## Current Focus

Old focus.

## Recent Changes

Nothing yet.
`;
    writeFileSync(filePath, original, "utf-8");
    const content = readFileSync(filePath, "utf-8");
    const updated = replaceFocusSection(content, "Round-tripped focus");
    writeFileSync(filePath, updated, "utf-8");
    const final = readFileSync(filePath, "utf-8");
    assert.ok(final.includes("Round-tripped focus"));
    assert.ok(!final.includes("Old focus"));
    assert.ok(final.includes("## Recent Changes"));
  });
});
