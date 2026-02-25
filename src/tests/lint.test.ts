import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  lintActiveContext,
  lintSystemPatterns,
  lintProtocolSpec,
  lintAgentConfig,
} from "../commands/lint.cmd.js";

describe("lintActiveContext", () => {
  const wellFormed = `# Active Context

## Current Focus

Working on feature X.

## Recent Changes

| Date | Change | Agent |
|------|--------|-------|
| 2026-02-25 | Added X | Claude |

## Open Decisions

- Should we use Y or Z?
`;

  it("passes all checks on well-formed content", () => {
    const results = lintActiveContext(wellFormed);
    const fails = results.filter((r) => r.severity === "fail");
    assert.equal(fails.length, 0);
  });

  it("detects all three required sections", () => {
    const results = lintActiveContext(wellFormed);
    const sectionPasses = results.filter(
      (r) => r.severity === "pass" && r.message.includes("Has ##"),
    );
    assert.equal(sectionPasses.length, 3);
  });

  it("detects populated focus", () => {
    const results = lintActiveContext(wellFormed);
    const focusPass = results.find((r) => r.message.includes("Focus is populated"));
    assert.ok(focusPass);
  });

  it("warns on placeholder focus", () => {
    const placeholder = wellFormed.replace(
      "Working on feature X.",
      "_Describe what you're working on._",
    );
    const results = lintActiveContext(placeholder);
    const focusWarn = results.find((r) => r.severity === "warn" && r.message.includes("Focus"));
    assert.ok(focusWarn);
    assert.ok(focusWarn!.suggestion);
  });

  it("fails when Current Focus section is missing", () => {
    const noFocus = "# Active Context\n\n## Recent Changes\n\n## Open Decisions\n";
    const results = lintActiveContext(noFocus);
    const fail = results.find(
      (r) => r.severity === "fail" && r.message.includes("Current Focus"),
    );
    assert.ok(fail);
  });

  it("fails when Recent Changes section is missing", () => {
    const noRecent = "# Active Context\n\n## Current Focus\n\nDoing X.\n\n## Open Decisions\n";
    const results = lintActiveContext(noRecent);
    const fail = results.find(
      (r) => r.severity === "fail" && r.message.includes("Recent Changes"),
    );
    assert.ok(fail);
  });

  it("reports info when Open Decisions is empty", () => {
    const emptyDecisions = wellFormed.replace(
      "- Should we use Y or Z?",
      "_List anything unresolved._",
    );
    const results = lintActiveContext(emptyDecisions);
    const info = results.find(
      (r) => r.severity === "info" && r.message.includes("Open Decisions"),
    );
    assert.ok(info);
  });
});

describe("lintSystemPatterns", () => {
  it("passes when conventions are documented with bullet points", () => {
    const content = "# Patterns\n\n- Code in English\n- ESM only\n";
    const results = lintSystemPatterns(content);
    const pass = results.find((r) => r.message.includes("documented conventions"));
    assert.ok(pass);
    assert.equal(pass!.severity, "pass");
  });

  it("passes when conventions are documented with table rows", () => {
    const content = "# Patterns\n\n| Convention | Detail |\n|---|---|\n| Language | English |\n";
    const results = lintSystemPatterns(content);
    const pass = results.find((r) => r.message.includes("documented conventions"));
    assert.ok(pass);
  });

  it("warns when no conventions exist", () => {
    const content = "# Patterns\n\nNothing here yet.\n";
    const results = lintSystemPatterns(content);
    const warn = results.find((r) => r.severity === "warn");
    assert.ok(warn);
    assert.ok(warn!.suggestion);
  });
});

describe("lintProtocolSpec", () => {
  it("passes when payload and Memory Bank are referenced", () => {
    const content = "# Protocol\n\nThe payload format...\n\nMemory Bank in .context/\n";
    const results = lintProtocolSpec(content);
    const passes = results.filter((r) => r.severity === "pass");
    assert.equal(passes.length, 2);
  });

  it("warns when payload is not referenced", () => {
    const content = "# Protocol\n\nMemory Bank in .context/\n";
    const results = lintProtocolSpec(content);
    const warn = results.find((r) => r.message.includes("payload"));
    assert.ok(warn);
    assert.equal(warn!.severity, "warn");
  });

  it("warns when Memory Bank is not referenced", () => {
    const content = "# Protocol\n\nPayload format is XML.\n";
    const results = lintProtocolSpec(content);
    const warn = results.find((r) => r.message.includes("Memory Bank"));
    assert.ok(warn);
    assert.equal(warn!.severity, "warn");
  });
});

describe("lintAgentConfig", () => {
  it("passes when .context/ is referenced", () => {
    const content = "# Claude\n\nRead .context/ before acting.\n";
    const results = lintAgentConfig("CLAUDE.md", content);
    assert.equal(results.length, 1);
    assert.equal(results[0].severity, "pass");
  });

  it("warns when .context/ is not referenced", () => {
    const content = "# Claude\n\nJust some instructions.\n";
    const results = lintAgentConfig("CLAUDE.md", content);
    assert.equal(results.length, 1);
    assert.equal(results[0].severity, "warn");
    assert.ok(results[0].suggestion);
  });
});
