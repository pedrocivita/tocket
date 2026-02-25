import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Check whether `.context/` is ignored by git in the given working directory.
 * Returns true if `.context/` is in .gitignore, false otherwise.
 * Returns false for non-git directories.
 */
export function isContextIgnored(cwd: string = process.cwd()): boolean {
  if (!isGitRepo(cwd)) return false;
  try {
    const output = execSync("git check-ignore .context/", {
      cwd,
      encoding: "utf-8",
    }).trim();
    return output.length > 0;
  } catch {
    // exit code 1 = not ignored
    return false;
  }
}

export function isGitRepo(cwd: string = process.cwd()): boolean {
  return existsSync(join(cwd, ".git"));
}

export function getStagedFiles(cwd: string = process.cwd()): string[] {
  if (!isGitRepo(cwd)) return [];
  try {
    const output = execSync("git diff --name-only --cached", {
      cwd,
      encoding: "utf-8",
    }).trim();
    return output ? output.split("\n") : [];
  } catch {
    return [];
  }
}

export function getModifiedFiles(cwd: string = process.cwd()): string[] {
  if (!isGitRepo(cwd)) return [];
  try {
    const output = execSync("git status --porcelain", {
      cwd,
      encoding: "utf-8",
    }).trim();
    if (!output) return [];
    return output
      .split("\n")
      .filter((line) => line.length > 3)
      .map((line) => line.substring(3).trim());
  } catch {
    return [];
  }
}

export function getRecentCommits(
  n: number = 5,
  cwd: string = process.cwd(),
): string[] {
  if (!isGitRepo(cwd)) return [];
  try {
    const output = execSync(`git log --oneline -${n}`, {
      cwd,
      encoding: "utf-8",
    }).trim();
    return output ? output.split("\n") : [];
  } catch {
    return [];
  }
}

export function getRecentCommitsRaw(
  n: number = 5,
  cwd: string = process.cwd(),
): string {
  if (!isGitRepo(cwd)) return "_No commits found or not a git repository._";
  try {
    return execSync(`git log --oneline -${n}`, {
      cwd,
      encoding: "utf-8",
    }).trim();
  } catch {
    return "_No commits found or not a git repository._";
  }
}

export function getLastCommitMessage(cwd: string = process.cwd()): string {
  if (!isGitRepo(cwd)) return "";
  try {
    return execSync("git log -1 --pretty=%B", {
      cwd,
      encoding: "utf-8",
    }).trim();
  } catch {
    return "";
  }
}

export function getCurrentBranch(cwd: string = process.cwd()): string {
  if (!isGitRepo(cwd)) return "";
  try {
    return execSync("git branch --show-current", {
      cwd,
      encoding: "utf-8",
    }).trim();
  } catch {
    return "";
  }
}
