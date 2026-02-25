import type { Command } from "commander";
import { input } from "@inquirer/prompts";
import { existsSync } from "node:fs";
import { appendFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { success, error as themeError } from "../utils/theme.js";
import { getRecentCommitsRaw } from "../utils/git.js";
import { getConfig } from "../utils/config.js";

export function registerSyncCommand(program: Command): void {
  program
    .command("sync")
    .description("Update Memory Bank from git history and session artifacts")
    .action(async () => {
      const progressPath = join(process.cwd(), ".context", "progress.md");
      const contextDir = join(process.cwd(), ".context");

      if (!existsSync(contextDir)) {
        console.error(themeError("Memory Bank not found. Run 'tocket init' first."));
        process.exitCode = 1;
        return;
      }

      const config = await getConfig();

      const summary = await input({
        message: "What did you accomplish in this session?",
      });

      const commits = getRecentCommitsRaw();
      const date = new Date().toISOString().split("T")[0];

      const authorTag = config.author ? ` (${config.author})` : "";
      const block = `## Session: ${date}${authorTag}

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

      console.log("\n" + success("Memory Bank synchronized!"));
    });
}
