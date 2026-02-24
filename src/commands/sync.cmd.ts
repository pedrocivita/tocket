import type { Command } from "commander";
import { input } from "@inquirer/prompts";
import { existsSync } from "node:fs";
import { appendFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { join } from "node:path";

function getRecentCommits(): string {
  try {
    return execSync("git log --oneline -5", { encoding: "utf-8" }).trim();
  } catch {
    return "_No commits found or not a git repository._";
  }
}

export function registerSyncCommand(program: Command): void {
  program
    .command("sync")
    .description("Update Memory Bank from git history and session artifacts")
    .action(async () => {
      const progressPath = join(process.cwd(), ".context", "progress.md");
      const contextDir = join(process.cwd(), ".context");

      if (!existsSync(contextDir)) {
        console.error(
          "\x1b[31mMemory Bank not found. Run 'tocket init' first.\x1b[0m"
        );
        process.exitCode = 1;
        return;
      }

      const summary = await input({
        message: "What did you accomplish in this session?",
      });

      const commits = getRecentCommits();
      const date = new Date().toISOString().split("T")[0];

      const block = `## Session: ${date}

**Summary**: ${summary}

**Recent Commits**:
\`\`\`
${commits}
\`\`\`

---

`;

      if (!existsSync(progressPath)) {
        await writeFile(
          progressPath,
          `# Progress Log\n\n<!-- Appended by tocket sync -->\n\n${block}`,
          "utf-8"
        );
      } else {
        await appendFile(progressPath, block, "utf-8");
      }

      console.log(
        "\n\x1b[32m✓\x1b[0m Memory Bank synchronized successfully!"
      );
    });
}
