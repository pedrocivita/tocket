import type { Command } from "commander";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { toRepoRelative } from "../utils/context.js";
import { error as themeError, success } from "../utils/theme.js";
import {
  AttentionError,
  formatPacksSummary,
  parseThreshold,
  queryFromFocus,
  runPacksLoad,
} from "../utils/attention.js";

export function registerPacksCommand(program: Command): void {
  const packs = program
    .command("packs")
    .description("Conditional gotcha packs (.context/gotchas/) judged by Noul, written as an overlay");

  packs
    .command("load")
    .description("Ask whether to load each pack, then write .context/active/packs.md")
    .option("--query <text>", "Query or task the packs should match")
    .option("--threshold <n>", "Keep a pack when noul or score is at or above this (default 0.5)")
    .option("--dry-run", "Force the deterministic stub (log-only)")
    .option("--shadow", "Call Jev if TYPESAFE_API_KEY is set, but mark the receipt log-only")
    .option("--id <id>", "Attention receipt id", "packs")
    .option("--to <target>", "Also send packs.md to stdout or a file path")
    .action(
      async (options: {
        query?: string;
        threshold?: string;
        dryRun?: boolean;
        shadow?: boolean;
        id?: string;
        to?: string;
      }) => {
        const cwd = process.cwd();
        const contextDir = join(cwd, ".context");
        if (!existsSync(contextDir)) {
          console.error(themeError("No .context/ directory found. Run 'tocket init' first."));
          process.exitCode = 1;
          return;
        }

        let focus = "";
        const activeContextPath = join(contextDir, "activeContext.md");
        if (existsSync(activeContextPath)) {
          focus = queryFromFocus(readFileSync(activeContextPath, "utf-8"));
        }

        try {
          const loaded = await runPacksLoad({
            cwd,
            query: options.query,
            focus,
            threshold: parseThreshold(options.threshold),
            dryRun: options.dryRun === true,
            shadow: options.shadow === true,
            id: options.id,
          });
          const summary = formatPacksSummary(loaded.record, toRepoRelative(cwd, loaded.packsPath));
          if (options.to === "stdout") {
            console.log(loaded.markdown);
          } else if (options.to && options.to !== "clipboard") {
            writeFileSync(options.to, loaded.markdown, "utf-8");
          }
          console.log(success(summary));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(themeError(message));
          process.exitCode = err instanceof AttentionError ? 2 : 1;
        }
      },
    );
}
