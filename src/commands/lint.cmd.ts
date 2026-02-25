import type { Command } from "commander";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { success as themePass, warn as themeWarn, error as themeFail, heading, dim, info as themeInfo } from "../utils/theme.js";
import { isGitRepo } from "../utils/git.js";
import { STALENESS_THRESHOLD_DAYS } from "../utils/context.js";

export interface LintResult {
  severity: "pass" | "warn" | "info" | "fail";
  message: string;
  file?: string;
  suggestion?: string;
}

export function lintActiveContext(content: string): LintResult[] {
  const results: LintResult[] = [];

  // Check required sections exist
  const requiredSections = ["## Current Focus", "## Recent Changes", "## Open Decisions"];
  for (const section of requiredSections) {
    if (content.includes(section)) {
      results.push({ severity: "pass", message: `Has ${section} section` });
    } else {
      results.push({
        severity: "fail",
        message: `Missing ${section} section`,
        suggestion: `Add a "${section}" heading to activeContext.md`,
      });
    }
  }

  // Check Current Focus is populated
  const focusMatch = content.match(/## Current Focus\s*\n+([\s\S]*?)(?=\n##|\n*$)/);
  const focusBody = focusMatch?.[1]?.trim() ?? "";
  if (!focusBody || focusBody.startsWith("_") || focusBody.includes("No active tasks")) {
    results.push({
      severity: "warn",
      message: "Current Focus is empty or placeholder",
      suggestion: "Run tocket focus \"your current task\" to set it",
    });
  } else {
    results.push({ severity: "pass", message: "Current Focus is populated" });
  }

  // Check Open Decisions section
  const decisionsMatch = content.match(/## Open Decisions\s*\n+([\s\S]*?)(?=\n##|\n*$)/);
  const decisionsBody = decisionsMatch?.[1]?.trim() ?? "";
  if (!decisionsBody || decisionsBody.startsWith("_")) {
    results.push({
      severity: "info",
      message: "Open Decisions section is empty",
      suggestion: "List any unresolved decisions or write \"None\" if all resolved",
    });
  }

  return results;
}

export function lintSystemPatterns(content: string): LintResult[] {
  const results: LintResult[] = [];

  const hasConvention = content.includes("- ") || content.includes("| ");
  if (hasConvention) {
    results.push({ severity: "pass", message: "Has documented conventions" });
  } else {
    results.push({
      severity: "warn",
      message: "No conventions documented",
      suggestion: "Add bullet points or a table with your project's coding conventions",
    });
  }

  // Check for key decisions table
  if (content.includes("Key Decisions") || content.includes("key decisions")) {
    const hasDecisionRows = content.match(/\|[^|]+\|[^|]+\|[^|]+\|/g);
    const hasDataRows = hasDecisionRows && hasDecisionRows.length > 2; // header + separator + at least 1 row
    if (hasDataRows) {
      results.push({ severity: "pass", message: "Has key decisions recorded" });
    } else {
      results.push({
        severity: "info",
        message: "Key Decisions table is empty",
        suggestion: "Record architectural decisions with rationale and date",
      });
    }
  }

  return results;
}

export function lintProtocolSpec(content: string): LintResult[] {
  const results: LintResult[] = [];

  if (content.includes("payload") || content.includes("Payload")) {
    results.push({ severity: "pass", message: "References payload format" });
  } else {
    results.push({
      severity: "warn",
      message: "Does not reference payload format",
      suggestion: "TOCKET.md should describe the payload XML handoff format",
    });
  }

  if (content.includes("Memory Bank") || content.includes(".context/")) {
    results.push({ severity: "pass", message: "References Memory Bank" });
  } else {
    results.push({
      severity: "warn",
      message: "Does not reference Memory Bank",
      suggestion: "TOCKET.md should describe the .context/ directory",
    });
  }

  return results;
}

export function lintAgentConfig(name: string, content: string): LintResult[] {
  const results: LintResult[] = [];

  if (content.includes(".context/") || content.includes(".context\\")) {
    results.push({ severity: "pass", message: `References .context/` });
  } else {
    results.push({
      severity: "warn",
      message: `Does not reference .context/`,
      suggestion: `Add instructions to read .context/ before acting`,
    });
  }

  return results;
}

function severityIcon(severity: LintResult["severity"]): string {
  switch (severity) {
    case "pass": return themePass("");
    case "warn": return themeWarn("");
    case "info": return themeInfo("");
    case "fail": return themeFail("");
  }
}

export function registerLintCommand(program: Command): void {
  program
    .command("lint")
    .description("Audit .context/ content quality and suggest improvements")
    .action(() => {
      const cwd = process.cwd();
      let passCount = 0;
      let warnCount = 0;
      let infoCount = 0;
      let failCount = 0;

      console.log(heading("\nTocket Lint\n"));

      // Check TOCKET.md exists
      const tocketPath = join(cwd, "TOCKET.md");
      if (!existsSync(tocketPath)) {
        console.log(themeFail("  TOCKET.md not found. Run tocket init first."));
        process.exitCode = 1;
        return;
      }

      // Lint activeContext.md
      const acPath = join(cwd, ".context", "activeContext.md");
      if (existsSync(acPath)) {
        console.log(dim("  .context/activeContext.md"));
        const content = readFileSync(acPath, "utf-8");
        const results = lintActiveContext(content);
        for (const r of results) {
          printResult(r);
          countResult(r.severity);
        }

        // Staleness check
        const stats = statSync(acPath);
        const daysSince = Math.floor((Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24));
        if (daysSince > STALENESS_THRESHOLD_DAYS) {
          const r: LintResult = {
            severity: "warn",
            message: `Last modified ${daysSince} days ago`,
            suggestion: "Update activeContext.md with current state",
          };
          printResult(r);
          countResult(r.severity);
        }
        console.log();
      } else {
        console.log(dim("  .context/activeContext.md"));
        console.log(`    ${severityIcon("fail")} File missing (required)`);
        failCount++;
        console.log();
      }

      // Lint systemPatterns.md
      const spPath = join(cwd, ".context", "systemPatterns.md");
      if (existsSync(spPath)) {
        console.log(dim("  .context/systemPatterns.md"));
        const content = readFileSync(spPath, "utf-8");
        const results = lintSystemPatterns(content);
        for (const r of results) {
          printResult(r);
          countResult(r.severity);
        }
        console.log();
      }

      // Lint TOCKET.md
      console.log(dim("  TOCKET.md"));
      const tocketContent = readFileSync(tocketPath, "utf-8");
      const tocketResults = lintProtocolSpec(tocketContent);
      for (const r of tocketResults) {
        printResult(r);
        countResult(r.severity);
      }
      console.log();

      // Lint agent configs
      const agentFiles = ["CLAUDE.md", "GEMINI.md"];
      for (const af of agentFiles) {
        const afPath = join(cwd, af);
        if (existsSync(afPath)) {
          console.log(dim(`  ${af}`));
          const content = readFileSync(afPath, "utf-8");
          const results = lintAgentConfig(af, content);
          for (const r of results) {
            printResult(r);
            countResult(r.severity);
          }
          console.log();
        }
      }

      // Uncommitted context check
      if (isGitRepo(cwd)) {
        try {
          const output = execSync("git status --porcelain .context/", {
            cwd,
            encoding: "utf-8",
          }).trim();
          if (output) {
            const count = output.split("\n").length;
            console.log(dim("  git"));
            const r: LintResult = {
              severity: "info",
              message: `${count} uncommitted change(s) in .context/`,
              suggestion: "Commit .context/ changes to preserve shared memory",
            };
            printResult(r);
            countResult(r.severity);
            console.log();
          }
        } catch {
          // git error — skip
        }
      }

      // Summary
      const total = passCount + warnCount + infoCount + failCount;
      console.log(dim(`  ${passCount} passed, ${warnCount} warnings, ${infoCount} info, ${failCount} failures (${total} checks)`));
      console.log();

      if (failCount > 0) {
        console.log(themeFail("Context has issues that need attention."));
        process.exitCode = 1;
      } else if (warnCount > 0) {
        console.log(themeWarn("Context is functional but could be improved."));
      } else {
        console.log(themePass("Context is in great shape."));
      }

      function printResult(r: LintResult): void {
        const icon = severityIcon(r.severity);
        console.log(`    ${icon} ${r.message}`);
        if (r.suggestion) {
          console.log(`      ${dim(r.suggestion)}`);
        }
      }

      function countResult(severity: LintResult["severity"]): void {
        switch (severity) {
          case "pass": passCount++; break;
          case "warn": warnCount++; break;
          case "info": infoCount++; break;
          case "fail": failCount++; break;
        }
      }
    });
}
