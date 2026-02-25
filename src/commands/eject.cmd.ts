import type { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { success, warn, info, dim } from "../utils/theme.js";

/** Files created by `tocket init` that eject should remove. */
export const EJECT_FILES = [
  "TOCKET.md",
  "CLAUDE.md",
  "GEMINI.md",
  ".cursorrules",
] as const;

/** Directories created by `tocket init` that eject should remove. */
export const EJECT_DIRS = [".context"] as const;

export function registerEjectCommand(program: Command): void {
  program
    .command("eject")
    .description("Remove all Tocket files from the current workspace")
    .option("-f, --force", "Skip confirmation prompt")
    .action(async (options: { force?: boolean }) => {
      const cwd = process.cwd();
      const contextDir = join(cwd, ".context");

      if (!existsSync(contextDir)) {
        console.log(warn("No Tocket workspace found in this directory."));
        return;
      }

      if (!options.force) {
        const ok = await confirm({
          message:
            "This will permanently remove .context/, CLAUDE.md, GEMINI.md, TOCKET.md, and .cursorrules. Continue?",
          default: false,
        });
        if (!ok) {
          console.log(dim("\n  Cancelled.\n"));
          return;
        }
      }

      let removedCount = 0;

      for (const dir of EJECT_DIRS) {
        const fullPath = join(cwd, dir);
        if (existsSync(fullPath)) {
          await rm(fullPath, { recursive: true, force: true });
          console.log(info(`Removed ${dir}/`));
          removedCount++;
        }
      }

      for (const file of EJECT_FILES) {
        const fullPath = join(cwd, file);
        if (existsSync(fullPath)) {
          await rm(fullPath, { force: true });
          console.log(info(`Removed ${file}`));
          removedCount++;
        }
      }

      if (removedCount === 0) {
        console.log(warn("Nothing to remove."));
      } else {
        console.log(
          "\n" +
            success("Tocket workspace ejected.") +
            " " +
            dim("Global config (~/.tocketrc.json) was not touched.") +
            "\n",
        );
      }
    });
}
