import type { Command } from "commander";
import { isAbsolute, resolve } from "node:path";
import {
  DecideError,
  formatDecideSummary,
  runDecide,
  toRepoRelative,
} from "../utils/decide.js";
import { error as themeError, success } from "../utils/theme.js";

function collect(value: string, previous: string[]): string[] {
  return previous.concat(value);
}

function resolveFromPath(cwd: string, from: string): string {
  return isAbsolute(from) ? from : resolve(cwd, from);
}

export function registerDecideCommand(program: Command): void {
  program
    .command("decide")
    .description("Generic Choice/Noul over state (writes .context/decisions/; no app hooks)")
    .option("--state <json|text>", "Inline state (JSON object/array or plain text)")
    .option("--from <path.json>", "Load state from a JSON (or text) file")
    .option(
      "--choice <spec>",
      "Choice question as name:opt1,opt2,... (repeatable)",
      collect,
      [] as string[],
    )
    .option("--noul <name>", "Noul question name (repeatable)", collect, [] as string[])
    .option("--dry-run", "Force the deterministic stub and mark mode=dry-run")
    .option("--shadow", "Call Jev if TYPESAFE_API_KEY is set, but mark mode=shadow")
    .option("--id <id>", "Decision id used in the output filename")
    .action(
      async (options: {
        state?: string;
        from?: string;
        choice: string[];
        noul: string[];
        dryRun?: boolean;
        shadow?: boolean;
        id?: string;
      }) => {
        const cwd = process.cwd();
        try {
          const { record, outPath } = await runDecide({
            cwd,
            state: options.state,
            fromPath: options.from ? resolveFromPath(cwd, options.from) : undefined,
            choices: options.choice,
            nouls: options.noul,
            dryRun: options.dryRun === true,
            shadow: options.shadow === true,
            id: options.id,
          });
          const rel = toRepoRelative(cwd, outPath);
          console.log(success(formatDecideSummary(record, rel)));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(themeError(message));
          process.exitCode = err instanceof DecideError ? 2 : 1;
        }
      },
    );
}
