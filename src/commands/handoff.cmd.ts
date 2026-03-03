import type { Command } from "commander";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { success, error as themeError, dim } from "../utils/theme.js";
import {
  getRecentCommits,
  getCurrentBranch,
  getRecentlyModifiedFiles,
  isGitRepo,
} from "../utils/git.js";
import { extractFocus } from "../utils/context.js";

export interface HandoffData {
  focus: string;
  branch: string;
  recentCommits: string[];
  modifiedFiles: string[];
  openDecisions: string;
  projectName: string;
}

/** Extract the "## Open Decisions" section body from activeContext.md. */
export function extractOpenDecisions(content: string): string {
  const match = content.match(
    /## Open Decisions\s*\n+([\s\S]*?)(?=\n## |\n*$)/,
  );
  const body = match?.[1]?.trim() ?? "";
  if (!body || body.startsWith("_") || body.includes("No open decisions"))
    return "";
  return body;
}

/** Extract project name from the first heading of activeContext.md. */
function extractProjectName(content: string): string {
  const match = content.match(/^# (.+)/m);
  if (!match?.[1]) return "Project";
  return (
    match[1]
      .replace("Active Context", "")
      .replace(/\s*[-—]\s*/, "")
      .trim() || "Project"
  );
}

/** Parse a duration string like "2h", "30m", "1d" into minutes. */
function parseSinceDuration(since: string): number {
  const match = since.match(/^(\d+)(h|m|d)$/);
  if (!match) return 120;
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case "h":
      return value * 60;
    case "m":
      return value;
    case "d":
      return value * 60 * 24;
    default:
      return 120;
  }
}

/** Build a condensed markdown summary for pasting into a new agent conversation. */
export function buildHandoffMarkdown(data: HandoffData): string {
  const lines: string[] = [];

  lines.push(`## Session Handoff — ${data.projectName}`);
  if (data.focus) {
    lines.push(`**Focus:** ${data.focus}`);
  }
  if (data.branch) {
    lines.push(`**Branch:** ${data.branch}`);
  }
  lines.push("");

  if (data.recentCommits.length > 0) {
    lines.push(
      `### Recent Changes (last ${data.recentCommits.length} commits)`,
    );
    for (const c of data.recentCommits) {
      lines.push(`- ${c}`);
    }
    lines.push("");
  }

  if (data.modifiedFiles.length > 0) {
    lines.push("### Modified Files (since last sync)");
    for (const f of data.modifiedFiles) {
      lines.push(`- ${f}`);
    }
    lines.push("");
  }

  if (data.openDecisions) {
    lines.push("### Open Decisions");
    lines.push(data.openDecisions);
    lines.push("");
  }

  return lines.join("\n");
}

export function registerHandoffCommand(program: Command): void {
  program
    .command("handoff")
    .description(
      "Generate a clipboard-ready context summary for a new agent conversation",
    )
    .option(
      "--to <target>",
      "Output target: clipboard (default), stdout, or file path",
    )
    .option("--commits <n>", "Number of recent commits to include", "5")
    .option(
      "--since <duration>",
      "Time window for modified files (e.g., 2h, 30m, 1d)",
      "2h",
    )
    .action(
      async (options: { to?: string; commits?: string; since?: string }) => {
        const cwd = process.cwd();
        const contextDir = join(cwd, ".context");

        if (!existsSync(contextDir)) {
          console.error(
            themeError(
              "No .context/ directory found. Run 'tocket init' first.",
            ),
          );
          process.exitCode = 1;
          return;
        }

        // Read activeContext.md
        const activeContextPath = join(contextDir, "activeContext.md");
        let focus = "";
        let openDecisions = "";
        let projectName = "Project";

        if (existsSync(activeContextPath)) {
          const content = readFileSync(activeContextPath, "utf-8");
          focus = extractFocus(content);
          openDecisions = extractOpenDecisions(content);
          projectName = extractProjectName(content);
        }

        const commitCount = parseInt(options.commits ?? "5", 10);
        const sinceMinutes = parseSinceDuration(options.since ?? "2h");

        const branch = isGitRepo(cwd) ? getCurrentBranch(cwd) : "";
        const recentCommits = getRecentCommits(commitCount, cwd);
        const modifiedFiles = getRecentlyModifiedFiles(sinceMinutes, cwd);

        const data: HandoffData = {
          focus,
          branch,
          recentCommits,
          modifiedFiles,
          openDecisions,
          projectName,
        };

        const markdown = buildHandoffMarkdown(data);

        const target = options.to ?? "clipboard";
        if (target === "stdout") {
          console.log(markdown);
        } else if (target === "clipboard") {
          const { default: clipboard } = await import("clipboardy");
          clipboard.writeSync(markdown);
          console.log(
            "\n" +
              success("Handoff summary copied to clipboard!") +
              "\n" +
              dim("  Paste it into your next agent conversation.\n"),
          );
        } else {
          writeFileSync(target, markdown, "utf-8");
          console.log(
            "\n" + success(`Handoff summary written to ${target}!`) + "\n",
          );
        }
      },
    );
}
