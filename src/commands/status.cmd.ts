import type { Command } from "commander";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { success, warn, info, dim, heading, purple, bold } from "../utils/theme.js";
import { getCurrentBranch, isGitRepo } from "../utils/git.js";
import { extractFocus, STALENESS_THRESHOLD_DAYS } from "../utils/context.js";

function daysSince(filePath: string): number {
  const stats = statSync(filePath);
  return Math.floor((Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24));
}

function countContextFiles(contextDir: string): number {
  const expected = [
    "activeContext.md",
    "systemPatterns.md",
    "productContext.md",
    "techContext.md",
    "progress.md",
  ];
  return expected.filter((f) => existsSync(join(contextDir, f))).length;
}

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show a quick overview of the current workspace")
    .action(() => {
      const cwd = process.cwd();
      const contextDir = join(cwd, ".context");
      const hasWorkspace = existsSync(contextDir);

      console.log(heading("\n  Tocket Status\n"));

      // Workspace
      if (!hasWorkspace) {
        console.log("  " + warn("No Tocket workspace in this directory."));
        console.log("  " + dim("Run 'tocket init' to get started.\n"));
        return;
      }

      const fileCount = countContextFiles(contextDir);
      console.log("  " + success(`Workspace: ${fileCount}/5 context files`));

      // Focus
      const activeContextPath = join(contextDir, "activeContext.md");
      if (existsSync(activeContextPath)) {
        const content = readFileSync(activeContextPath, "utf-8");
        const focus = extractFocus(content);
        if (focus) {
          console.log("  " + info(`Focus: ${focus}`));
        } else {
          console.log("  " + dim("  Focus: (none set)"));
        }

        const days = daysSince(activeContextPath);
        if (days > STALENESS_THRESHOLD_DAYS) {
          console.log("  " + warn(`Context last updated ${days} days ago`));
        }
      }

      // Git
      if (isGitRepo(cwd)) {
        const branch = getCurrentBranch(cwd);
        if (branch) {
          console.log("  " + info(`Branch: ${branch}`));
        }
      }

      // Agent configs
      const agents = ["CLAUDE.md", "GEMINI.md", ".cursorrules"].filter((f) =>
        existsSync(join(cwd, f)),
      );
      if (agents.length > 0) {
        console.log("  " + info(`Agents: ${agents.join(", ")}`));
      }

      // Last sync
      const progressPath = join(contextDir, "progress.md");
      if (existsSync(progressPath)) {
        const progressContent = readFileSync(progressPath, "utf-8");
        const sessionMatch = progressContent.match(/## Session: (\d{4}-\d{2}-\d{2})/g);
        if (sessionMatch && sessionMatch.length > 0) {
          const lastSession = sessionMatch[sessionMatch.length - 1].replace("## Session: ", "");
          console.log("  " + dim(`  Last sync: ${lastSession}`));
        }
      }

      console.log();
    });
}
