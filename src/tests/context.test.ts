import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractFocus, STALENESS_THRESHOLD_DAYS } from "../utils/context.js";

describe("extractFocus", () => {
  it("extracts the first line after ## Current Focus", () => {
    const content = "# Active Context\n\n## Current Focus\n\nWorking on feature X.\n\n## Recent Changes\n";
    assert.equal(extractFocus(content), "Working on feature X.");
  });

  it("returns empty string when no focus section exists", () => {
    const content = "# Active Context\n\nSome other content.\n";
    assert.equal(extractFocus(content), "");
  });

  it("returns empty string for placeholder focus starting with underscore", () => {
    const content = "## Current Focus\n\n_Describe what you're working on._\n";
    assert.equal(extractFocus(content), "");
  });

  it("returns empty string when focus says No active tasks", () => {
    const content = "## Current Focus\n\nNo active tasks right now.\n";
    assert.equal(extractFocus(content), "");
  });

  it("truncates focus longer than 80 characters", () => {
    const longLine = "A".repeat(100);
    const content = `## Current Focus\n\n${longLine}\n`;
    const result = extractFocus(content);
    assert.equal(result.length, 80);
    assert.ok(result.endsWith("..."));
  });

  it("returns full line when exactly 80 characters", () => {
    const exactLine = "B".repeat(80);
    const content = `## Current Focus\n\n${exactLine}\n`;
    assert.equal(extractFocus(content), exactLine);
  });
});

describe("STALENESS_THRESHOLD_DAYS", () => {
  it("is a positive number", () => {
    assert.ok(STALENESS_THRESHOLD_DAYS > 0);
  });

  it("equals 7", () => {
    assert.equal(STALENESS_THRESHOLD_DAYS, 7);
  });
});
