import type { Command } from "commander";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { execSync } from "node:child_process";
import { success as themePass, warn as themeWarn, error as themeFail, heading, dim } from "../utils/theme.js";
import { isGitRepo, isContextIgnored } from "../utils/git.js";
import { STALENESS_THRESHOLD_DAYS } from "../utils/context.js";
import { APPMAPS_DIR } from "../utils/appmaps.js";
import { DECISIONS_DIR } from "../utils/decide.js";
import { readTypesafeApiKey } from "../utils/jev.js";

const PASS = themePass("");
const WARN = themeWarn("");
const FAIL = themeFail("");

export interface DiagResult {
  icon: string;
  message: string;
}

export function checkContentHealth(basePath: string): DiagResult[] {
  const results: DiagResult[] = [];

  // activeContext.md: non-empty Current Focus
  const acPath = join(basePath, ".context", "activeContext.md");
  if (existsSync(acPath)) {
    const content = readFileSync(acPath, "utf-8");
    const focusMatch = content.match(/## Current Focus\s*\n+([\s\S]*?)(?=\n##|\n*$)/);
    const focusBody = focusMatch?.[1]?.trim() ?? "";
    if (!focusBody || focusBody.startsWith("_") || focusBody.includes("No active tasks")) {
      results.push({ icon: WARN, message: "activeContext.md has no meaningful Current Focus" });
    } else {
      results.push({ icon: PASS, message: "activeContext.md has an active focus" });
    }
  }

  // systemPatterns.md: has at least one convention
  const spPath = join(basePath, ".context", "systemPatterns.md");
  if (existsSync(spPath)) {
    const content = readFileSync(spPath, "utf-8");
    const hasConvention = content.includes("- ") || content.includes("| ");
    if (hasConvention) {
      results.push({ icon: PASS, message: "systemPatterns.md has documented conventions" });
    } else {
      results.push({ icon: WARN, message: "systemPatterns.md has no conventions documented" });
    }
  }

  // TOCKET.md: contains payload or version keyword
  const tocketPath = join(basePath, "TOCKET.md");
  if (existsSync(tocketPath)) {
    const content = readFileSync(tocketPath, "utf-8");
    if (content.includes("payload") || content.includes("version")) {
      results.push({ icon: PASS, message: "TOCKET.md contains protocol keywords" });
    } else {
      results.push({ icon: WARN, message: "TOCKET.md may not be a valid protocol spec" });
    }
  }

  // Agent configs reference .context/
  const agentFiles = ["CLAUDE.md", "GEMINI.md"];
  for (const af of agentFiles) {
    const afPath = join(basePath, af);
    if (existsSync(afPath)) {
      const content = readFileSync(afPath, "utf-8");
      if (content.includes(".context/") || content.includes(".context\\")) {
        results.push({ icon: PASS, message: `${af} references .context/` });
      } else {
        results.push({ icon: WARN, message: `${af} does not reference .context/` });
      }
    }
  }

  return results;
}

export function checkGitTracking(cwd: string): DiagResult[] {
  const results: DiagResult[] = [];

  if (!isGitRepo(cwd)) {
    results.push({ icon: WARN, message: "Not a git repository" });
    return results;
  }

  // Check if .context/ is in .gitignore
  if (isContextIgnored(cwd)) {
    results.push({ icon: FAIL, message: ".context/ is in .gitignore (should be tracked)" });
  } else {
    results.push({ icon: PASS, message: ".context/ is not gitignored" });
  }

  // Check for uncommitted .context/ changes
  try {
    const output = execSync("git status --porcelain .context/", {
      cwd,
      encoding: "utf-8",
    }).trim();
    if (output) {
      const count = output.split("\n").length;
      results.push({ icon: WARN, message: `${count} uncommitted change(s) in .context/` });
    } else {
      results.push({ icon: PASS, message: ".context/ files are committed" });
    }
  } catch {
    // git error — skip
  }

  return results;
}

export function formatAge(mtimeMs: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - mtimeMs) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function walkJsonFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkJsonFiles(full, acc);
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      acc.push(full);
    }
  }
  return acc;
}

export function findLatestDecision(
  cwd: string,
): { path: string; rel: string; mtimeMs: number } | null {
  const files = walkJsonFiles(join(cwd, DECISIONS_DIR));
  if (files.length === 0) return null;
  let latest = files[0];
  let mtimeMs = statSync(latest).mtimeMs;
  for (const file of files.slice(1)) {
    const next = statSync(file).mtimeMs;
    if (next > mtimeMs) {
      latest = file;
      mtimeMs = next;
    }
  }
  return { path: latest, rel: relative(cwd, latest), mtimeMs };
}

export function checkTypesafeKeyPresent(env: NodeJS.ProcessEnv = process.env): DiagResult {
  if (readTypesafeApiKey(env)) {
    return { icon: PASS, message: "TYPESAFE_API_KEY: yes" };
  }
  return { icon: WARN, message: "TYPESAFE_API_KEY: no (decide uses stub)" };
}

export function checkNpmBin(): DiagResult {
  try {
    execSync("npm --version", { stdio: ["ignore", "pipe", "ignore"] });
    return { icon: PASS, message: "npm/bin ok" };
  } catch {
    return { icon: WARN, message: "npm not found on PATH" };
  }
}

/** Light notebook checks. Missing `.context/` is the only hard fail. */
export function checkNotebookLight(cwd: string, env: NodeJS.ProcessEnv = process.env): {
  results: DiagResult[];
  hardFail: boolean;
} {
  const results: DiagResult[] = [];
  const contextDir = join(cwd, ".context");
  if (!existsSync(contextDir)) {
    results.push({ icon: FAIL, message: ".context/ missing. Run tocket init" });
    results.push(checkTypesafeKeyPresent(env));
    results.push(checkNpmBin());
    return { results, hardFail: true };
  }

  results.push({ icon: PASS, message: ".context/ found" });

  const decisionsDir = join(cwd, DECISIONS_DIR);
  if (existsSync(decisionsDir)) {
    results.push({ icon: PASS, message: `${DECISIONS_DIR}/ found` });
  } else {
    results.push({ icon: WARN, message: `${DECISIONS_DIR}/ missing (run tocket decide)` });
  }

  const appmapsDir = join(cwd, APPMAPS_DIR);
  if (existsSync(appmapsDir)) {
    results.push({ icon: PASS, message: `${APPMAPS_DIR}/ found` });
  } else {
    results.push({ icon: WARN, message: `${APPMAPS_DIR}/ missing (optional)` });
  }

  results.push(checkTypesafeKeyPresent(env));

  const latest = findLatestDecision(cwd);
  if (latest) {
    results.push({
      icon: PASS,
      message: `last decision ${latest.rel} (${formatAge(latest.mtimeMs)})`,
    });
  } else {
    results.push({ icon: WARN, message: "no decision file yet (run tocket decide)" });
  }

  results.push(checkNpmBin());
  return { results, hardFail: false };
}

export function checkStaleness(basePath: string): DiagResult | null {
  const acPath = join(basePath, ".context", "activeContext.md");
  if (!existsSync(acPath)) return null;

  const stats = statSync(acPath);
  const daysSinceModified = Math.floor(
    (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceModified > STALENESS_THRESHOLD_DAYS) {
    return {
      icon: WARN,
      message: `activeContext.md last modified ${daysSinceModified} days ago (may be stale)`,
    };
  }
  return null;
}

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Light notebook checks plus workspace diagnostics")
    .action(() => {
      const cwd = process.cwd();
      const results: DiagResult[] = [];
      let passCount = 0;
      let warnCount = 0;
      let failCount = 0;

      console.log(heading("\nTocket Doctor\n"));

      const light = checkNotebookLight(cwd);
      results.push(...light.results);

      // Deep file list (skip duplicate .context/ row; light already reported it)
      const contextDir = join(cwd, ".context");
      if (existsSync(contextDir)) {
        const requiredFiles = ["activeContext.md", "systemPatterns.md"];
        const optionalFiles = ["techContext.md", "productContext.md", "progress.md"];

        for (const f of requiredFiles) {
          if (existsSync(join(contextDir, f))) {
            results.push({ icon: PASS, message: `.context/${f} found` });
          } else {
            results.push({ icon: FAIL, message: `.context/${f} missing (required)` });
          }
        }

        for (const f of optionalFiles) {
          if (existsSync(join(contextDir, f))) {
            results.push({ icon: PASS, message: `.context/${f} found` });
          } else {
            results.push({ icon: WARN, message: `.context/${f} missing (optional)` });
          }
        }
      }

      if (existsSync(join(cwd, "TOCKET.md"))) {
        results.push({ icon: PASS, message: "TOCKET.md found" });
      } else {
        results.push({ icon: FAIL, message: "TOCKET.md missing (required)" });
      }

      // 2. Content health
      results.push(...checkContentHealth(cwd));

      // 3. Staleness
      const stale = checkStaleness(cwd);
      if (stale) results.push(stale);

      // 4. Git tracking
      results.push(...checkGitTracking(cwd));

      // 5. Last payload check
      const lastPayloadPath = join(cwd, ".tocket", "last-payload.xml");
      if (existsSync(lastPayloadPath)) {
        const payloadStats = statSync(lastPayloadPath);
        const daysSince = Math.floor(
          (Date.now() - payloadStats.mtimeMs) / (1000 * 60 * 60 * 24),
        );
        if (daysSince > STALENESS_THRESHOLD_DAYS) {
          results.push({
            icon: WARN,
            message: `Last payload is ${daysSince} days old`,
          });
        } else {
          results.push({
            icon: PASS,
            message: "Last payload found (.tocket/last-payload.xml)",
          });
        }
      } else {
        results.push({
          icon: WARN,
          message:
            "No last payload found — run tocket generate",
        });
      }

      // Print results
      for (const r of results) {
        console.log(`  ${r.icon} ${r.message}`);
        if (r.icon === PASS) passCount++;
        else if (r.icon === WARN) warnCount++;
        else failCount++;
      }

      console.log("");
      console.log(dim(`  ${passCount} passed, ${warnCount} warnings, ${failCount} failures`));
      console.log("");

      if (light.hardFail) {
        console.log(themeFail("Not a Tocket project.") + " Run tocket init.");
        process.exitCode = 1;
      } else if (failCount > 0) {
        console.log(themeFail("Workspace has issues.") + " Run tocket init to scaffold missing files.");
      } else if (warnCount > 0) {
        console.log(themeWarn("Workspace is functional but has warnings."));
      } else {
        console.log(themePass("Workspace is in great shape."));
      }
    });
}
