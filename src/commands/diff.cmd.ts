import type { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  heading,
  success,
  warn,
  error as themeError,
  dim,
} from "../utils/theme.js";
import { parsePayloadXml } from "../utils/xml.js";
import type { ParsedPayload } from "../utils/xml.js";
import { getDiffFiles, isGitRepo } from "../utils/git.js";

export interface DiffReport {
  payload: ParsedPayload;
  expectedFiles: string[];
  actualFiles: string[];
  matchedFiles: string[];
  missingFiles: string[];
  extraFiles: string[];
  doneCriteria: string[];
  checks: string[];
}

export function buildDiffReport(
  payload: ParsedPayload,
  actualFiles: string[],
): DiffReport {
  const expectedFiles = payload.tasks
    .map((t) => t.target)
    .filter((t) => t.length > 0);

  const actualSet = new Set(actualFiles);
  const expectedSet = new Set(expectedFiles);

  const matchedFiles = expectedFiles.filter((f) => actualSet.has(f));
  const missingFiles = expectedFiles.filter((f) => !actualSet.has(f));
  const extraFiles = actualFiles.filter((f) => !expectedSet.has(f));

  const doneCriteria = payload.tasks
    .map((t) => t.done)
    .filter((d) => d.length > 0);

  return {
    payload,
    expectedFiles,
    actualFiles,
    matchedFiles,
    missingFiles,
    extraFiles,
    doneCriteria,
    checks: payload.checks,
  };
}

export function formatDiffReport(report: DiffReport): string {
  const lines: string[] = [];

  lines.push(heading("\n  Tocket Diff Report\n"));
  lines.push(
    dim(`  Payload v${report.payload.version} — "${report.payload.meta.intent}"`),
  );
  lines.push("");

  // File coverage
  lines.push(heading("  File Coverage"));
  for (const f of report.matchedFiles) {
    lines.push(`  ${success(f)}`);
  }
  for (const f of report.missingFiles) {
    lines.push(`  ${themeError(f)} ${dim("(expected but not changed)")}`);
  }
  for (const f of report.extraFiles) {
    lines.push(`  ${warn(f)} ${dim("(changed but not in payload)")}`);
  }
  if (report.expectedFiles.length === 0) {
    lines.push(dim("  No specific file targets in payload"));
  }
  lines.push("");

  // Summary line
  const total = report.expectedFiles.length;
  const matched = report.matchedFiles.length;
  lines.push(
    dim(
      `  ${matched}/${total} expected files changed, ${report.extraFiles.length} extra file(s)`,
    ),
  );
  lines.push("");

  // Done criteria checklist
  if (report.doneCriteria.length > 0) {
    lines.push(heading("  Done Criteria"));
    for (const d of report.doneCriteria) {
      lines.push(`  [ ] ${d}`);
    }
    lines.push("");
  }

  // Validate checks
  if (report.checks.length > 0) {
    lines.push(heading("  Validation Checks"));
    for (const c of report.checks) {
      lines.push(`  [ ] ${c}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function registerDiffCommand(program: Command): void {
  program
    .command("diff")
    .description("Compare payload targets against actual git changes")
    .argument(
      "[payload-path]",
      "Path to payload XML",
      ".tocket/last-payload.xml",
    )
    .option("--json", "Output as JSON instead of formatted terminal")
    .option("--since <ref>", "Git ref to diff against (default: HEAD)")
    .action(
      (payloadPath: string, options: { json?: boolean; since?: string }) => {
        const cwd = process.cwd();
        const fullPayloadPath = join(cwd, payloadPath);

        if (!existsSync(fullPayloadPath)) {
          console.error(
            themeError(`Payload not found at ${payloadPath}.`) +
              "\n" +
              dim(
                "  Run 'tocket generate' first, or provide a path: tocket diff <path>",
              ),
          );
          process.exitCode = 1;
          return;
        }

        if (!isGitRepo(cwd)) {
          console.error(
            themeError("Not a git repository. tocket diff requires git."),
          );
          process.exitCode = 1;
          return;
        }

        const xml = readFileSync(fullPayloadPath, "utf-8");
        const payload = parsePayloadXml(xml);
        const actualFiles = getDiffFiles(options.since, cwd);
        const report = buildDiffReport(payload, actualFiles);

        if (options.json) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          console.log(formatDiffReport(report));
        }
      },
    );
}
