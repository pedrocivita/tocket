import type { Command } from "commander";
import { input } from "@inquirer/prompts";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  claudeMd,
  geminiMd,
  activeContextMd,
  systemPatternsMd,
} from "../templates/memory-bank.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Scaffold an agentic workspace with Memory Bank and triangulation config")
    .action(async () => {
      const projectName = await input({ message: "Project Name:" });
      const description = await input({ message: "Short Description:" });

      const contextDir = join(process.cwd(), ".context");
      await mkdir(contextDir, { recursive: true });

      const files: Array<[string, string]> = [
        ["CLAUDE.md", claudeMd(projectName, description)],
        ["GEMINI.md", geminiMd(projectName, description)],
        [join(".context", "activeContext.md"), activeContextMd(projectName)],
        [join(".context", "systemPatterns.md"), systemPatternsMd(projectName)],
      ];

      for (const [filePath, content] of files) {
        const fullPath = join(process.cwd(), filePath);
        await writeFile(fullPath, content, "utf-8");
        console.log(`  created ${filePath}`);
      }

      console.log(
        `\nAgentic workspace initialized for ${projectName}! Ready to launch.`
      );
    });
}
