import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isGitRepo,
  isContextIgnored,
  getStagedFiles,
  getModifiedFiles,
  getRecentCommits,
  getRecentCommitsRaw,
  getCurrentBranch,
  getLastCommitMessage,
} from "../utils/git.js";
import { execSync } from "node:child_process";

// Use the Tocket repo itself for "in git" tests
const tocketRoot = join(import.meta.dirname, "..", "..");

describe("git - in a git repository", () => {
  it("isGitRepo returns true", () => {
    assert.equal(isGitRepo(tocketRoot), true);
  });

  it("getRecentCommits returns an array with items", () => {
    const commits = getRecentCommits(3, tocketRoot);
    assert.ok(Array.isArray(commits));
    assert.ok(commits.length > 0);
  });

  it("getRecentCommitsRaw returns a non-empty string", () => {
    const raw = getRecentCommitsRaw(3, tocketRoot);
    assert.ok(raw.length > 0);
    assert.ok(!raw.includes("No commits found"));
  });

  it("getCurrentBranch returns a non-empty string", () => {
    const branch = getCurrentBranch(tocketRoot);
    assert.ok(typeof branch === "string");
    assert.ok(branch.length > 0);
  });

  it("getStagedFiles returns an array", () => {
    const files = getStagedFiles(tocketRoot);
    assert.ok(Array.isArray(files));
  });

  it("getModifiedFiles returns an array", () => {
    const files = getModifiedFiles(tocketRoot);
    assert.ok(Array.isArray(files));
  });

  it("getLastCommitMessage returns a non-empty string", () => {
    const msg = getLastCommitMessage(tocketRoot);
    assert.ok(typeof msg === "string");
    assert.ok(msg.length > 0);
  });
});

describe("git - in a non-git directory", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-git-test-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("isGitRepo returns false", () => {
    assert.equal(isGitRepo(tempDir), false);
  });

  it("getStagedFiles returns empty array", () => {
    assert.deepEqual(getStagedFiles(tempDir), []);
  });

  it("getModifiedFiles returns empty array", () => {
    assert.deepEqual(getModifiedFiles(tempDir), []);
  });

  it("getRecentCommits returns empty array", () => {
    assert.deepEqual(getRecentCommits(5, tempDir), []);
  });

  it("getRecentCommitsRaw returns fallback message", () => {
    const raw = getRecentCommitsRaw(5, tempDir);
    assert.ok(raw.includes("No commits found"));
  });

  it("getCurrentBranch returns empty string", () => {
    assert.equal(getCurrentBranch(tempDir), "");
  });

  it("getLastCommitMessage returns empty string", () => {
    assert.equal(getLastCommitMessage(tempDir), "");
  });

  it("isContextIgnored returns false for non-git directory", () => {
    assert.equal(isContextIgnored(tempDir), false);
  });
});

describe("isContextIgnored", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-gitignore-test-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns false when .context/ is not ignored", () => {
    execSync("git init", { cwd: tempDir });
    assert.equal(isContextIgnored(tempDir), false);
  });

  it("returns true when .context/ is in .gitignore", () => {
    writeFileSync(join(tempDir, ".gitignore"), ".context/\n", "utf-8");
    assert.equal(isContextIgnored(tempDir), true);
  });
});
