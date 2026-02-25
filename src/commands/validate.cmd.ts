import type { Command } from "commander";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { success as themePass, warn as themeWarn, error as themeFail, heading } from "../utils/theme.js";

const PASS = themePass("");
const WARN = themeWarn("");
const FAIL = themeFail("");

export interface CheckResult {
  icon: string;
  message: string;
}

export function checkFile(
  basePath: string,
  relativePath: string,
  required: boolean
): CheckResult {
  const fullPath = join(basePath, relativePath);
  if (existsSync(fullPath)) {
    return { icon: PASS, message: `${relativePath} found` };
  }
  if (required) {
    return { icon: FAIL, message: `${relativePath} missing (required)` };
  }
  return { icon: WARN, message: `${relativePath} missing (optional)` };
}

export function checkStale(basePath: string, relativePath: string): CheckResult | null {
  const fullPath = join(basePath, relativePath);
  if (!existsSync(fullPath)) return null;

  const stats = statSync(fullPath);
  const daysSinceModified = Math.floor(
    (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceModified > 7) {
    return {
      icon: WARN,
      message: `${relativePath} last modified ${daysSinceModified} days ago (may be stale)`,
    };
  }
  return null;
}

export function checkAgentFile(basePath: string): CheckResult {
  const agentFiles = [
    "CLAUDE.md",
    "GEMINI.md",
    "EXECUTOR.md",
    "ARCHITECT.md",
    ".cursorrules",
  ];
  const found = agentFiles.filter((f) => existsSync(join(basePath, f)));

  if (found.length > 0) {
    return {
      icon: PASS,
      message: `Agent config found: ${found.join(", ")}`,
    };
  }
  return {
    icon: WARN,
    message: "No agent config file found (CLAUDE.md, GEMINI.md, etc.)",
  };
}

export function registerValidateCommand(program: Command): void {
  program
    .command("validate")
    .description("Check the health of a Tocket workspace")
    .action(() => {
      const cwd = process.cwd();
      const results: CheckResult[] = [];
      let hasFailure = false;

      console.log(heading("\nValidating Tocket workspace...\n"));

      // Required files
      results.push(checkFile(cwd, join(".context"), true));
      results.push(
        checkFile(cwd, join(".context", "activeContext.md"), true)
      );
      results.push(
        checkFile(cwd, join(".context", "systemPatterns.md"), true)
      );
      results.push(checkFile(cwd, "TOCKET.md", true));

      // Optional files
      results.push(
        checkFile(cwd, join(".context", "techContext.md"), false)
      );
      results.push(
        checkFile(cwd, join(".context", "productContext.md"), false)
      );
      results.push(
        checkFile(cwd, join(".context", "progress.md"), false)
      );

      // Agent config
      results.push(checkAgentFile(cwd));

      // Staleness check
      const staleCheck = checkStale(
        cwd,
        join(".context", "activeContext.md")
      );
      if (staleCheck) {
        results.push(staleCheck);
      }

      // Print results
      for (const r of results) {
        console.log(`  ${r.icon} ${r.message}`);
        if (r.icon === FAIL) hasFailure = true;
      }

      console.log("");

      if (hasFailure) {
        console.log(themeFail("Workspace has issues.") + " Run tocket init to scaffold missing files.");
        process.exitCode = 1;
      } else {
        console.log(themePass("Workspace is healthy."));
      }
    });
}
