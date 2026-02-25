import type { Command } from "commander";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { success as themePass, warn as themeWarn, error as themeFail, heading, dim } from "../utils/theme.js";
import { isGitRepo } from "../utils/git.js";

const PASS = themePass("");
const WARN = themeWarn("");
const FAIL = themeFail("");

export interface DiagResult {
  icon: string;
  message: string;
}

export function checkContentHealth(basePath: string): DiagResult[] {
  const results: DiagResult[] = [];

  // activeContext.md: non-empty Current Focus
  const acPath = join(basePath, ".context", "activeContext.md");
  if (existsSync(acPath)) {
    const content = readFileSync(acPath, "utf-8");
    const focusMatch = content.match(/## Current Focus\s*\n+([\s\S]*?)(?=\n##|\n*$)/);
    const focusBody = focusMatch?.[1]?.trim() ?? "";
    if (!focusBody || focusBody.startsWith("_") || focusBody.includes("No active tasks")) {
      results.push({ icon: WARN, message: "activeContext.md has no meaningful Current Focus" });
    } else {
      results.push({ icon: PASS, message: "activeContext.md has an active focus" });
    }
  }

  // systemPatterns.md: has at least one convention
  const spPath = join(basePath, ".context", "systemPatterns.md");
  if (existsSync(spPath)) {
    const content = readFileSync(spPath, "utf-8");
    const hasConvention = content.includes("- ") || content.includes("| ");
    if (hasConvention) {
      results.push({ icon: PASS, message: "systemPatterns.md has documented conventions" });
    } else {
      results.push({ icon: WARN, message: "systemPatterns.md has no conventions documented" });
    }
  }

  // TOCKET.md: contains payload or version keyword
  const tocketPath = join(basePath, "TOCKET.md");
  if (existsSync(tocketPath)) {
    const content = readFileSync(tocketPath, "utf-8");
    if (content.includes("payload") || content.includes("version")) {
      results.push({ icon: PASS, message: "TOCKET.md contains protocol keywords" });
    } else {
      results.push({ icon: WARN, message: "TOCKET.md may not be a valid protocol spec" });
    }
  }

  // Agent configs reference .context/
  const agentFiles = ["CLAUDE.md", "GEMINI.md"];
  for (const af of agentFiles) {
    const afPath = join(basePath, af);
    if (existsSync(afPath)) {
      const content = readFileSync(afPath, "utf-8");
      if (content.includes(".context/") || content.includes(".context\\")) {
        results.push({ icon: PASS, message: `${af} references .context/` });
      } else {
        results.push({ icon: WARN, message: `${af} does not reference .context/` });
      }
    }
  }

  return results;
}

export function checkGitTracking(cwd: string): DiagResult[] {
  const results: DiagResult[] = [];

  if (!isGitRepo(cwd)) {
    results.push({ icon: WARN, message: "Not a git repository" });
    return results;
  }

  // Check if .context/ is in .gitignore
  try {
    const output = execSync("git check-ignore .context/", {
      cwd,
      encoding: "utf-8",
    }).trim();
    if (output) {
      results.push({ icon: FAIL, message: ".context/ is in .gitignore (should be tracked)" });
    }
  } catch {
    // exit code 1 = not ignored (good)
    results.push({ icon: PASS, message: ".context/ is not gitignored" });
  }

  // Check for uncommitted .context/ changes
  try {
    const output = execSync("git status --porcelain .context/", {
      cwd,
      encoding: "utf-8",
    }).trim();
    if (output) {
      const count = output.split("\n").length;
      results.push({ icon: WARN, message: `${count} uncommitted change(s) in .context/` });
    } else {
      results.push({ icon: PASS, message: ".context/ files are committed" });
    }
  } catch {
    // git error — skip
  }

  return results;
}

export function checkStaleness(basePath: string): DiagResult | null {
  const acPath = join(basePath, ".context", "activeContext.md");
  if (!existsSync(acPath)) return null;

  const stats = statSync(acPath);
  const daysSinceModified = Math.floor(
    (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceModified > 7) {
    return {
      icon: WARN,
      message: `activeContext.md last modified ${daysSinceModified} days ago (may be stale)`,
    };
  }
  return null;
}

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Deep diagnostic of a Tocket workspace")
    .action(() => {
      const cwd = process.cwd();
      const results: DiagResult[] = [];
      let passCount = 0;
      let warnCount = 0;
      let failCount = 0;

      console.log(heading("\nTocket Doctor\n"));

      // 1. File existence (same as validate)
      const contextDir = join(cwd, ".context");
      if (!existsSync(contextDir)) {
        results.push({ icon: FAIL, message: ".context/ directory missing" });
      } else {
        results.push({ icon: PASS, message: ".context/ directory found" });

        const requiredFiles = ["activeContext.md", "systemPatterns.md"];
        const optionalFiles = ["techContext.md", "productContext.md", "progress.md"];

        for (const f of requiredFiles) {
          if (existsSync(join(contextDir, f))) {
            results.push({ icon: PASS, message: `.context/${f} found` });
          } else {
            results.push({ icon: FAIL, message: `.context/${f} missing (required)` });
          }
        }

        for (const f of optionalFiles) {
          if (existsSync(join(contextDir, f))) {
            results.push({ icon: PASS, message: `.context/${f} found` });
          } else {
            results.push({ icon: WARN, message: `.context/${f} missing (optional)` });
          }
        }
      }

      if (existsSync(join(cwd, "TOCKET.md"))) {
        results.push({ icon: PASS, message: "TOCKET.md found" });
      } else {
        results.push({ icon: FAIL, message: "TOCKET.md missing (required)" });
      }

      // 2. Content health
      results.push(...checkContentHealth(cwd));

      // 3. Staleness
      const stale = checkStaleness(cwd);
      if (stale) results.push(stale);

      // 4. Git tracking
      results.push(...checkGitTracking(cwd));

      // Print results
      for (const r of results) {
        console.log(`  ${r.icon} ${r.message}`);
        if (r.icon === PASS) passCount++;
        else if (r.icon === WARN) warnCount++;
        else failCount++;
      }

      console.log("");
      console.log(dim(`  ${passCount} passed, ${warnCount} warnings, ${failCount} failures`));
      console.log("");

      if (failCount > 0) {
        console.log(themeFail("Workspace has issues.") + " Run tocket init to scaffold missing files.");
        process.exitCode = 1;
      } else if (warnCount > 0) {
        console.log(themeWarn("Workspace is functional but has warnings."));
      } else {
        console.log(themePass("Workspace is in great shape."));
      }
    });
}
