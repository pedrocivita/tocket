import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildHandoffMarkdown,
  extractOpenDecisions,
} from "../commands/handoff.cmd.js";
import type { HandoffData } from "../commands/handoff.cmd.js";

describe("extractOpenDecisions", () => {
  it("extracts open decisions section", () => {
    const content =
      "## Current Focus\n\nDoing stuff\n\n## Open Decisions\n\n- Use Y or Z?\n- Consider X\n\n## Next\n";
    const result = extractOpenDecisions(content);
    assert.equal(result, "- Use Y or Z?\n- Consider X");
  });

  it("returns empty for placeholder text", () => {
    const content =
      "## Open Decisions\n\n_List anything unresolved or pending decision._\n";
    assert.equal(extractOpenDecisions(content), "");
  });

  it("returns empty for 'No open decisions' text", () => {
    const content = "## Open Decisions\n\nNo open decisions at this time.\n";
    assert.equal(extractOpenDecisions(content), "");
  });

  it("returns empty when section is missing", () => {
    const content = "## Current Focus\n\nSome focus here.\n";
    assert.equal(extractOpenDecisions(content), "");
  });

  it("handles section at end of file", () => {
    const content = "## Open Decisions\n\n- Decide on API format\n";
    const result = extractOpenDecisions(content);
    assert.equal(result, "- Decide on API format");
  });
});

describe("buildHandoffMarkdown", () => {
  const fullData: HandoffData = {
    focus: "Implementing diff command",
    branch: "feat/v2.5-diff",
    recentCommits: [
      "abc1234 Add diff command",
      "def5678 Update generate to save payload",
    ],
    modifiedFiles: ["src/commands/diff.cmd.ts", "src/commands/generate.cmd.ts"],
    openDecisions: "- How to handle missing validate section",
    projectName: "Tocket",
  };

  it("includes project name in heading", () => {
    const md = buildHandoffMarkdown(fullData);
    assert.ok(md.includes("## Session Handoff — Tocket"));
  });

  it("includes focus", () => {
    const md = buildHandoffMarkdown(fullData);
    assert.ok(md.includes("**Focus:** Implementing diff command"));
  });

  it("includes branch", () => {
    const md = buildHandoffMarkdown(fullData);
    assert.ok(md.includes("**Branch:** feat/v2.5-diff"));
  });

  it("includes recent commits", () => {
    const md = buildHandoffMarkdown(fullData);
    assert.ok(md.includes("### Recent Changes (last 2 commits)"));
    assert.ok(md.includes("- abc1234 Add diff command"));
    assert.ok(md.includes("- def5678 Update generate to save payload"));
  });

  it("includes modified files", () => {
    const md = buildHandoffMarkdown(fullData);
    assert.ok(md.includes("### Modified Files (since last sync)"));
    assert.ok(md.includes("- src/commands/diff.cmd.ts"));
  });

  it("includes open decisions", () => {
    const md = buildHandoffMarkdown(fullData);
    assert.ok(md.includes("### Open Decisions"));
    assert.ok(md.includes("- How to handle missing validate section"));
  });

  it("omits empty sections", () => {
    const emptyData: HandoffData = {
      focus: "",
      branch: "",
      recentCommits: [],
      modifiedFiles: [],
      openDecisions: "",
      projectName: "Test",
    };
    const md = buildHandoffMarkdown(emptyData);
    assert.ok(!md.includes("**Focus:**"));
    assert.ok(!md.includes("**Branch:**"));
    assert.ok(!md.includes("### Recent Changes"));
    assert.ok(!md.includes("### Modified Files"));
    assert.ok(!md.includes("### Open Decisions"));
  });

  it("always includes project name heading", () => {
    const emptyData: HandoffData = {
      focus: "",
      branch: "",
      recentCommits: [],
      modifiedFiles: [],
      openDecisions: "",
      projectName: "MyProject",
    };
    const md = buildHandoffMarkdown(emptyData);
    assert.ok(md.includes("## Session Handoff — MyProject"));
  });
});
