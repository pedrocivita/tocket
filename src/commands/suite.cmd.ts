import type { Command } from "commander";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import {
  APPMAPS_DIR,
  APPMAPS_GOALS,
  APPMAPS_README,
  LAST_RUN_JSON,
  LAST_RUN_MD,
  LAST_RUN_SCHEMA,
  LastRunValidationError,
  appmapsGoalsStub,
  appmapsReadmeStub,
  emptyLastRun,
  parseLastRun,
  prettyLastRunJson,
  writeLastRunMd,
  type LastRun,
} from "../utils/appmaps.js";
import { TRIAGE_SCHEMA, runTriage, type TriageReport } from "../utils/triage.js";
import {
  dim,
  error as themeError,
  heading,
  info,
  success,
  warn,
} from "../utils/theme.js";

function appmapsDir(cwd: string): string {
  return join(cwd, APPMAPS_DIR);
}

function lastRunJsonPath(cwd: string): string {
  return join(appmapsDir(cwd), LAST_RUN_JSON);
}

function lastRunMdPath(cwd: string): string {
  return join(appmapsDir(cwd), LAST_RUN_MD);
}

function resolveFromPath(cwd: string, from: string): string {
  return isAbsolute(from) ? from : resolve(cwd, from);
}

function ensureAppmapsDir(cwd: string): string {
  const dir = appmapsDir(cwd);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function ensureReadmeStub(dir: string): void {
  const readmePath = join(dir, APPMAPS_README);
  if (!existsSync(readmePath)) {
    writeFileSync(readmePath, appmapsReadmeStub(), "utf-8");
  }
}

function writeLastRunFiles(cwd: string, raw: unknown, run: LastRun): void {
  const dir = ensureAppmapsDir(cwd);
  ensureReadmeStub(dir);
  writeFileSync(lastRunJsonPath(cwd), prettyLastRunJson(raw), "utf-8");
  writeFileSync(lastRunMdPath(cwd), writeLastRunMd(run), "utf-8");
}

function printStatus(run: LastRun): void {
  const verdict = run.all_ok ? success : warn;
  console.log(heading("\n  AppMap last run\n"));
  console.log("  " + info(`app: ${run.app || "(empty)"}`));
  console.log("  " + info(`map: ${run.map || "(empty)"}`));
  console.log("  " + dim(`  runner: ${run.runner || "-"}  model: ${run.model || "-"}  mode: ${run.mode || "-"}`));
  console.log("  " + dim(`  finished: ${run.finished_at || "-"}`));
  console.log("  " + verdict(`result: ${run.passed}/${run.total} passed`));
  console.log("  " + verdict(`all_ok: ${run.all_ok}`));
  console.log();

  if (run.results.length === 0) {
    console.log("  " + dim("  (no results)"));
    console.log();
    return;
  }

  console.log("  " + dim("  id  name  ok  ms  error"));
  for (const result of run.results) {
    const line = `${result.id}  ${result.name}  ${result.ok ? "pass" : "fail"}  ${result.ms}ms${
      result.error ? `  ${result.error}` : ""
    }`;
    console.log("  " + (result.ok ? success(line) : themeError(line)));
  }
  console.log();
}

function runStatus(cwd: string): void {
  const path = lastRunJsonPath(cwd);
  if (!existsSync(path)) {
    console.error(
      themeError(
        `No AppMap last-run found at ${APPMAPS_DIR}/${LAST_RUN_JSON}. Run 'tocket suite sync --from <path.json>' or 'tocket suite init'.`,
      ),
    );
    process.exitCode = 2;
    return;
  }

  let run: LastRun;
  try {
    run = parseLastRun(readFileSync(path, "utf-8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(themeError(`Invalid ${APPMAPS_DIR}/${LAST_RUN_JSON}: ${message}`));
    process.exitCode = 1;
    return;
  }

  printStatus(run);

  if (!run.all_ok) {
    process.exitCode = 1;
  }
}

function runSync(cwd: string, from: string): void {
  const sourcePath = resolveFromPath(cwd, from);
  if (!existsSync(sourcePath)) {
    console.error(themeError(`Incoming last-run.json not found: ${from}`));
    process.exitCode = 1;
    return;
  }

  let raw: unknown;
  let run: LastRun;
  try {
    const text = readFileSync(sourcePath, "utf-8");
    raw = JSON.parse(text);
    run = parseLastRun(text);
  } catch (err) {
    if (err instanceof LastRunValidationError || err instanceof SyntaxError) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(themeError(`Invalid last-run.json: ${message}`));
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  writeLastRunFiles(cwd, raw, run);

  console.log(heading("\n  AppMap last-run synced\n"));
  console.log(success(`Wrote ${APPMAPS_DIR}/${LAST_RUN_JSON}`));
  console.log(success(`Wrote ${APPMAPS_DIR}/${LAST_RUN_MD}`));
  console.log(info(`schema: ${LAST_RUN_SCHEMA}`));
  console.log(info(`result: ${run.passed}/${run.total} passed  all_ok: ${run.all_ok}\n`));
}

function writeIfMissing(path: string, contents: string): boolean {
  if (existsSync(path)) return false;
  writeFileSync(path, contents, "utf-8");
  return true;
}

function runInit(cwd: string): void {
  const dir = ensureAppmapsDir(cwd);
  const empty = emptyLastRun();

  const created: string[] = [];
  const skipped: string[] = [];

  const files: Array<[string, string]> = [
    [join(dir, APPMAPS_README), appmapsReadmeStub()],
    [join(dir, APPMAPS_GOALS), appmapsGoalsStub()],
    [join(dir, LAST_RUN_JSON), prettyLastRunJson(empty)],
    [join(dir, LAST_RUN_MD), writeLastRunMd(empty)],
  ];

  // ensureAppmapsDir may have already created the README stub
  for (const [path, contents] of files) {
    const relative = `${APPMAPS_DIR}/${path.slice(dir.length + 1)}`;
    if (writeIfMissing(path, contents)) {
      created.push(relative);
    } else {
      skipped.push(relative);
    }
  }

  console.log(heading("\n  AppMap Memory Bank\n"));
  if (created.length === 0) {
    console.log(info("Already initialized. Existing files were left unchanged.\n"));
    return;
  }

  for (const file of created) {
    console.log(success(`Created ${file}`));
  }
  for (const file of skipped) {
    console.log(dim(`  skipped ${file} (exists)`));
  }
  console.log();
}

function defaultLastRunPath(cwd: string): string {
  return lastRunJsonPath(cwd);
}

function printTriage(report: TriageReport, outPath: string, cwd: string): void {
  const rel = outPath.startsWith(cwd) ? relative(cwd, outPath) : outPath;
  console.log(heading("\n  AppMap triage\n"));
  console.log("  " + info(`app: ${report.app || "(empty)"}`));
  console.log("  " + info(`mode: ${report.mode}  model: ${report.model}`));
  console.log("  " + dim(`  schema: ${TRIAGE_SCHEMA}`));
  console.log("  " + dim(`  source: ${report.source}`));
  console.log("  " + success(`wrote ${rel}`));
  console.log();

  if (report.cases.length === 0) {
    console.log("  " + dim("  (no failed or low-confidence goals)"));
    console.log();
    return;
  }

  for (const item of report.cases) {
    const line = `${item.id}  ${item.name}  ${item.choice}  conf=${item.confidence.toFixed(2)}  loc=${item.locator_drift.toFixed(2)}`;
    const paint =
      item.choice === "escalate"
        ? themeError
        : item.choice === "rewrite-locator"
          ? warn
          : item.choice === "retry"
            ? info
            : success;
    console.log("  " + paint(line));
    console.log("  " + dim(`    ${item.rationale}`));
  }
  console.log();
}

async function runTriageCommand(
  cwd: string,
  options: {
    from?: string;
    map?: string;
    notes?: string;
    includeLowConfidence?: boolean;
    dryRun?: boolean;
    out?: string;
  },
): Promise<void> {
  const fromPath = options.from
    ? resolveFromPath(cwd, options.from)
    : defaultLastRunPath(cwd);

  if (!existsSync(fromPath)) {
    console.error(
      themeError(
        `last-run.json not found: ${options.from ?? `${APPMAPS_DIR}/${LAST_RUN_JSON}`}. Pass --from <path.json>.`,
      ),
    );
    process.exitCode = 2;
    return;
  }

  try {
    const { report, outPath } = await runTriage({
      fromPath,
      cwd,
      mapPath: options.map ? resolveFromPath(cwd, options.map) : undefined,
      notes: options.notes,
      includeLowConfidence: options.includeLowConfidence === true,
      dryRun: options.dryRun === true,
      outPath: options.out ? resolveFromPath(cwd, options.out) : undefined,
    });
    printTriage(report, outPath, cwd);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(themeError(`Triage failed: ${message}`));
    process.exitCode = 1;
  }
}

export function registerSuiteCommand(program: Command): void {
  const suite = program
    .command("suite")
    .description("AppMap Memory Bank — file-first run history (does not execute maps)");

  suite
    .command("status")
    .description("Print the last AppMap run from .context/appmaps/last-run.json")
    .action(() => {
      runStatus(process.cwd());
    });

  suite
    .command("sync")
    .description("Copy a last-run.json into .context/appmaps/ and regenerate last-run.md")
    .requiredOption("--from <path.json>", "Incoming last-run.json to validate and copy")
    .action((options: { from: string }) => {
      runSync(process.cwd(), options.from);
    });

  suite
    .command("init")
    .description("Scaffold empty .context/appmaps/ index templates")
    .action(() => {
      runInit(process.cwd());
    });

  suite
    .command("triage")
    .description("Triage failed AppMap goals (Jev Choice, or heuristic without TYPESAFE_API_KEY)")
    .option("--from <path.json>", "last-run.json to triage (default .context/appmaps/last-run.json)")
    .option("--map <path>", "Optional map file excerpt included in the Jev state")
    .option("--notes <text>", "Optional failure notes included in the judge state")
    .option("--include-low-confidence", "Also triage passing goals with jev_confidence < 0.6")
    .option("--dry-run", "Force the deterministic heuristic stub and still write output")
    .option("--out <path.json>", "Override output path (default .context/appmaps/<app>.triage.json)")
    .action(
      async (options: {
        from?: string;
        map?: string;
        notes?: string;
        includeLowConfidence?: boolean;
        dryRun?: boolean;
        out?: string;
      }) => {
        await runTriageCommand(process.cwd(), options);
      },
    );
}
