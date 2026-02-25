import type { Command } from "commander";
import { input } from "@inquirer/prompts";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { success, error as themeError, info } from "../utils/theme.js";

/**
 * Replaces the content under ## Current Focus with the new message.
 * Exported for testing.
 */
export function replaceFocusSection(
  content: string,
  newFocus: string,
): string {
  const regex = /(## Current Focus[ \t]*\n)[\s\S]*?(?=\n## |\n*$)/;
  if (!regex.test(content)) {
    return content.trimEnd() + "\n\n## Current Focus\n\n" + newFocus + "\n";
  }
  return content.replace(regex, `$1\n${newFocus}\n`);
}

export function registerFocusCommand(program: Command): void {
  program
    .command("focus")
    .description("Update the Current Focus in activeContext.md")
    .argument("[message...]", "Focus message (prompted if omitted)")
    .action(async (messageParts: string[]) => {
      const cwd = process.cwd();
      const contextDir = join(cwd, ".context");

      if (!existsSync(contextDir)) {
        console.error(
          themeError("No .context/ directory found. Run 'tocket init' first."),
        );
        process.exitCode = 1;
        return;
      }

      const filePath = join(contextDir, "activeContext.md");
      if (!existsSync(filePath)) {
        console.error(
          themeError("activeContext.md not found. Run 'tocket init' first."),
        );
        process.exitCode = 1;
        return;
      }

      let message = messageParts.join(" ").trim();

      if (!message) {
        message = await input({ message: "What is the current focus?" });
        message = message.trim();
      }

      if (!message) {
        console.error(themeError("Focus message cannot be empty."));
        process.exitCode = 1;
        return;
      }

      const content = await readFile(filePath, "utf-8");
      const updated = replaceFocusSection(content, message);
      await writeFile(filePath, updated, "utf-8");

      console.log(info("Focus updated in .context/activeContext.md"));
      console.log("  " + success(message));
    });
}
