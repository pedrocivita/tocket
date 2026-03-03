import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDiffReport, formatDiffReport } from "../commands/diff.cmd.js";
import type { ParsedPayload } from "../utils/xml.js";

const baseParsed: ParsedPayload = {
  version: "2.0",
  meta: {
    intent: "Add validation",
    scope: "src/",
    skills: "",
    priority: "medium",
  },
  tasks: [
    {
      id: "1",
      type: "edit",
      target: "src/a.ts",
      action: "Edit A",
      spec: "",
      done: "A works",
    },
    {
      id: "2",
      type: "create",
      target: "src/b.ts",
      action: "Create B",
      spec: "",
      done: "B exists",
    },
  ],
  checks: ["npm test passes"],
};

describe("buildDiffReport", () => {
  it("identifies matched files", () => {
    const report = buildDiffReport(baseParsed, ["src/a.ts", "src/b.ts"]);
    assert.deepEqual(report.matchedFiles, ["src/a.ts", "src/b.ts"]);
    assert.deepEqual(report.missingFiles, []);
    assert.deepEqual(report.extraFiles, []);
  });

  it("identifies missing files", () => {
    const report = buildDiffReport(baseParsed, ["src/a.ts"]);
    assert.deepEqual(report.matchedFiles, ["src/a.ts"]);
    assert.deepEqual(report.missingFiles, ["src/b.ts"]);
  });

  it("identifies extra files", () => {
    const report = buildDiffReport(baseParsed, [
      "src/a.ts",
      "src/b.ts",
      "src/c.ts",
    ]);
    assert.deepEqual(report.extraFiles, ["src/c.ts"]);
  });

  it("extracts done criteria from tasks", () => {
    const report = buildDiffReport(baseParsed, []);
    assert.deepEqual(report.doneCriteria, ["A works", "B exists"]);
  });

  it("includes validation checks", () => {
    const report = buildDiffReport(baseParsed, []);
    assert.deepEqual(report.checks, ["npm test passes"]);
  });

  it("handles empty target tasks", () => {
    const payload: ParsedPayload = {
      ...baseParsed,
      tasks: [
        {
          id: "1",
          type: "create",
          target: "",
          action: "Do something",
          spec: "",
          done: "Done",
        },
      ],
    };
    const report = buildDiffReport(payload, ["src/a.ts"]);
    assert.equal(report.expectedFiles.length, 0);
    assert.equal(report.extraFiles.length, 1);
  });

  it("handles no actual changes", () => {
    const report = buildDiffReport(baseParsed, []);
    assert.equal(report.matchedFiles.length, 0);
    assert.equal(report.missingFiles.length, 2);
    assert.equal(report.extraFiles.length, 0);
  });

  it("handles all files matching", () => {
    const report = buildDiffReport(baseParsed, ["src/a.ts", "src/b.ts"]);
    assert.equal(report.matchedFiles.length, 2);
    assert.equal(report.missingFiles.length, 0);
  });
});

describe("formatDiffReport", () => {
  it("returns a string", () => {
    const report = buildDiffReport(baseParsed, ["src/a.ts"]);
    const output = formatDiffReport(report);
    assert.ok(typeof output === "string");
    assert.ok(output.length > 0);
  });

  it("includes payload intent in output", () => {
    const report = buildDiffReport(baseParsed, ["src/a.ts"]);
    const output = formatDiffReport(report);
    assert.ok(output.includes("Add validation"));
  });

  it("includes file coverage summary", () => {
    const report = buildDiffReport(baseParsed, ["src/a.ts"]);
    const output = formatDiffReport(report);
    assert.ok(output.includes("1/2 expected files changed"));
  });

  it("includes done criteria as checklist", () => {
    const report = buildDiffReport(baseParsed, []);
    const output = formatDiffReport(report);
    assert.ok(output.includes("[ ] A works"));
    assert.ok(output.includes("[ ] B exists"));
  });

  it("includes validation checks as checklist", () => {
    const report = buildDiffReport(baseParsed, []);
    const output = formatDiffReport(report);
    assert.ok(output.includes("[ ] npm test passes"));
  });
});
