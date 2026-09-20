import type { Command } from "commander";
import { isAbsolute, resolve } from "node:path";
import { error as themeError, success } from "../utils/theme.js";
import { WorkError, runWork } from "../utils/work.js";

function resolveFromPath(cwd: string, from: string): string {
  return isAbsolute(from) ? from : resolve(cwd, from);
}

export function registerWorkCommand(program: Command): void {
  program
    .command("work")
    .description("Read a Choice from .context/decisions/ and plan or apply it. Never calls Jev.")
    .addHelpText(
      "after",
      `
tocket decide writes the next move. tocket work is the first-party reference worker:
it reads that Choice and stamps a notebook receipt. It does not re-decide, call
TypeSafe/Jev, open a browser, or edit application code.

Default is dry-run / plan (exit 0): print choice, destination, confidence, gated.
  --apply        write <id>.applied.json next to the decision and a progress line
  --from <json>  decision file (default: newest under .context/decisions/{research,write,review}/)
  --force        required to --apply a shadow / log-only / dry-run decision

Exit codes: 0 ok, 1 missing/invalid decision, 2 refuse (shadow apply without --force).
`,
    )
    .option("--from <decision.json>", "Decision JSON (default: newest queue decision)")
    .option("--apply", "Stamp an execution receipt and a progress line (default is dry-run/plan)")
    .option("--force", "Allow --apply on shadow/log-only decisions (stamps applied_from_shadow)")
    .action(
      async (options: {
        from?: string;
        apply?: boolean;
        force?: boolean;
      }) => {
        const cwd = process.cwd();
        try {
          const result = runWork({
            cwd,
            fromPath: options.from ? resolveFromPath(cwd, options.from) : undefined,
            apply: options.apply === true,
            force: options.force === true,
          });
          console.log(success(result.summary));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(themeError(message));
          process.exitCode = err instanceof WorkError ? err.exitCode : 1;
        }
      },
    );
}
