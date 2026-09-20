import type { Command } from "commander";
import { isAbsolute, resolve } from "node:path";
import {
  DecideError,
  formatDecideSummary,
  parseConfidenceThreshold,
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
    .description("Cheap typed Choice into .context/decisions/; workers execute, Tocket does not")
    .addHelpText(
      "after",
      `
Tocket is the shared project notebook (.context/). decide writes the next move.
Workers (Cursor, Claude, GrokBot, CI) execute. Tocket does not.

5-minute setup:
  1. npx @pedrocivita/tocket init          # ensures .context/
  2. tocket decide --dry-run --state '{"goal":"docs"}' --choice next:research,write,review
  3. Tell any agent: before an expensive tool, run tocket decide or read .context/decisions/
  4. Optional TYPESAFE_API_KEY for live Jev; otherwise the stub

A future --backend laya (local Apple Silicon) is not implemented yet.
`,
    )
    .option("--state <json|text>", "Inline state (JSON object/array or plain text)")
    .option("--from <path.json>", "Load state from a JSON (or text) file")
    .option(
      "--choice <spec>",
      "Choice question as name:opt1,opt2,... (repeatable; batched in one request)",
      collect,
      [] as string[],
    )
    .option("--noul <name>", "Noul question name (repeatable; batched)", collect, [] as string[])
    .option("--score <spec>", "Optional Score name or name:min,max (repeatable; batched)", collect, [] as string[])
    .option("--fork <kind>", "Bounded fork: agent, model, tool, action, or human (default action)")
    .option("--dry-run", "Force the deterministic stub and mark mode=dry-run (log-only)")
    .option("--shadow", "Call Jev if TYPESAFE_API_KEY is set, but mark log-only (do not claim execution)")
    .option("--confidence-threshold <n>", "Route research/write only at or above this confidence (default 0.85)")
    .option("--id <id>", "Decision id used in the output filename")
    .action(
      async (options: {
        state?: string;
        from?: string;
        choice: string[];
        noul: string[];
        score: string[];
        fork?: string;
        dryRun?: boolean;
        shadow?: boolean;
        confidenceThreshold?: string;
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
            scores: options.score,
            fork: options.fork,
            dryRun: options.dryRun === true,
            shadow: options.shadow === true,
            confidenceThreshold: parseConfidenceThreshold(options.confidenceThreshold),
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
