import type { Command } from "commander";
import { input, confirm, select } from "@inquirer/prompts";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { banner, heading, info, success, warn, dim } from "../utils/theme.js";
import { isContextIgnored } from "../utils/git.js";
import { getConfig, updateConfig } from "../utils/config.js";
import { readGlobalTemplate } from "../utils/templates.js";
import type { TemplateVars } from "../utils/templates.js";
import {
  getExecutorFileName,
  getArchitectFileName,
  getExecutorDisplayName,
  getArchitectDisplayName,
  detectPreferredAgents,
  resolveInitAgents,
  EXECUTOR_CHOICES,
  ARCHITECT_CHOICES,
} from "../utils/agents.js";
import type { StackInfo } from "../templates/memory-bank.js";
import {
  executorMd,
  architectMd,
  tocketMd,
  activeContextMd,
  systemPatternsMd,
  productContextMd,
  techContextMd,
  progressMd,
  cursorrulesMd,
  agentsMd,
  tocketSkillMd,
  TOCKET_SKILL_REL,
  tocketConventionsHint,
} from "../templates/memory-bank.js";

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

interface PackageJson {
  name?: string;
  description?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function detectFramework(deps: string[], devDeps: string[]): string {
  const all = [...deps, ...devDeps];
  if (all.includes("next")) return "Next.js";
  if (all.includes("nuxt")) return "Nuxt";
  if (all.includes("@sveltejs/kit")) return "SvelteKit";
  if (all.includes("remix") || all.includes("@remix-run/react")) return "Remix";
  if (all.includes("astro")) return "Astro";
  if (all.includes("react")) return "React";
  if (all.includes("vue")) return "Vue";
  if (all.includes("svelte")) return "Svelte";
  if (all.includes("angular") || all.includes("@angular/core")) return "Angular";
  if (all.includes("express")) return "Express";
  if (all.includes("fastify")) return "Fastify";
  if (all.includes("hono")) return "Hono";
  if (all.includes("commander") || all.includes("yargs")) return "CLI (Node.js)";
  return "";
}

function detectBuild(devDeps: string[]): string {
  if (devDeps.includes("vite")) return "Vite";
  if (devDeps.includes("webpack")) return "Webpack";
  if (devDeps.includes("esbuild")) return "esbuild";
  if (devDeps.includes("rollup")) return "Rollup";
  if (devDeps.includes("turbopack") || devDeps.includes("turbo")) return "Turbopack";
  if (devDeps.includes("typescript")) return "tsc";
  return "";
}

function pickExtras(deps: string[], devDeps: string[]): string[] {
  const notable = [
    "tailwindcss", "prisma", "@prisma/client",
    "drizzle-orm", "mongoose", "sequelize",
    "trpc", "@trpc/server", "graphql",
    "zod", "joi", "yup",
    "jest", "vitest", "mocha",
    "eslint", "prettier", "biome",
    "docker-compose", "firebase", "supabase",
    "stripe", "clerk", "@clerk/nextjs",
    "socket.io", "redis", "bullmq",
  ];
  const all = [...deps, ...devDeps];
  return notable.filter((n) => all.includes(n));
}

async function detectStack(cwd: string): Promise<{
  stack: StackInfo;
  detectedName: string;
  detectedDescription: string;
}> {
  const empty: StackInfo = {
    language: "",
    runtime: "",
    build: "",
    framework: "",
    extras: [],
  };

  const pkgPath = join(cwd, "package.json");
  if (!(await fileExists(pkgPath))) {
    return { stack: empty, detectedName: "", detectedDescription: "" };
  }

  let pkg: PackageJson;
  try {
    const raw = await readFile(pkgPath, "utf-8");
    pkg = JSON.parse(raw) as PackageJson;
  } catch {
    return { stack: empty, detectedName: "", detectedDescription: "" };
  }

  const deps = Object.keys(pkg.dependencies ?? {});
  const devDeps = Object.keys(pkg.devDependencies ?? {});

  const hasTsConfig = await fileExists(join(cwd, "tsconfig.json"));
  const hasTs = hasTsConfig || devDeps.includes("typescript");

  const stack: StackInfo = {
    language: hasTs ? "TypeScript" : "JavaScript",
    runtime: "Node.js",
    build: detectBuild(devDeps),
    framework: detectFramework(deps, devDeps),
    extras: pickExtras(deps, devDeps),
  };

  const rawName = pkg.name ?? "";
  const detectedName = rawName.startsWith("@")
    ? rawName.split("/").pop() ?? rawName
    : rawName;

  return {
    stack,
    detectedName,
    detectedDescription: pkg.description ?? "",
  };
}

export function checkGitignoreConflict(cwd: string): string | null {
  if (isContextIgnored(cwd)) {
    return ".context/ is listed in .gitignore — agents won't see committed context. Remove it from .gitignore to use Tocket.";
  }
  return null;
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Ensure the shared .context/ notebook (agents read and write files)")
    .option("-f, --force", "Overwrite existing files without prompting")
    .option("--minimal", "Scaffold only essential files (.context/ + TOCKET.md)")
    .option("--agents-md", "Write AGENTS.md (default on full init; kept for compatibility)")
    .option("--executor <name>", "Executor agent: Claude Code, Cursor, Windsurf, Copilot")
    .option("--architect <name>", "Architect agent: Gemini (or any name)")
    .option("--name <name>", "Project name (skip prompt)")
    .option("--description <desc>", "Project description (skip prompt)")
    .action(async (options: {
      force?: boolean;
      minimal?: boolean;
      agentsMd?: boolean;
      executor?: string;
      architect?: string;
      name?: string;
      description?: string;
    }) => {
      const force = options.force ?? false;
      const minimal = options.minimal ?? false;
      const cwd = process.cwd();
      const globalConfig = await getConfig();

      if (!globalConfig.theme?.disableBanner) {
        console.log(banner());
      }

      const { stack, detectedName, detectedDescription } = await detectStack(cwd);

      const hasDetection = Boolean(stack.language);
      if (hasDetection) {
        console.log(heading("  Auto-detected stack:\n"));
        if (stack.language) console.log(info(`Language:  ${stack.language}`));
        if (stack.runtime) console.log(info(`Runtime:   ${stack.runtime}`));
        if (stack.build) console.log(info(`Build:     ${stack.build}`));
        if (stack.framework) console.log(info(`Framework: ${stack.framework}`));
        if (stack.extras.length)
          console.log(info(`Extras:    ${stack.extras.join(", ")}`));
        console.log();
      }

      const projectName = options.name ?? await input({
        message: "Project Name:",
        default: detectedName || undefined,
      });
      const description = options.description ?? await input({
        message: "Short Description:",
        default: detectedDescription || undefined,
      });

      const contextDir = join(cwd, ".context");
      await mkdir(contextDir, { recursive: true });

      const detectedAgents = detectPreferredAgents(cwd);
      const interactiveAgents =
        process.stdin.isTTY === true &&
        !options.name &&
        !options.executor &&
        !options.architect &&
        !globalConfig.agents?.executor &&
        !detectedAgents.executor;

      let askedExecutor: string | undefined;
      let askedArchitect: string | undefined;
      if (interactiveAgents) {
        askedExecutor = await select({
          message: "Preferred executor agent (writes the matching instruction file):",
          choices: EXECUTOR_CHOICES.map((name) => ({ name, value: name })),
          default: EXECUTOR_CHOICES[0],
        });
        askedArchitect = await select({
          message: "Preferred architect agent:",
          choices: [
            ...ARCHITECT_CHOICES.map((name) => ({ name, value: name })),
            { name: "Other (generic ARCHITECT.md)", value: "Other" },
          ],
          default: ARCHITECT_CHOICES[0],
        });
        if (askedArchitect === "Other") askedArchitect = "Architect";
        await updateConfig({
          agents: {
            executor: askedExecutor,
            architect: askedArchitect,
          },
        });
      }

      const resolved = resolveInitAgents({
        executorFlag: options.executor ?? askedExecutor,
        architectFlag: options.architect ?? askedArchitect,
        configExecutor: globalConfig.agents?.executor,
        configArchitect: globalConfig.agents?.architect,
        detected: detectedAgents,
      });
      const executorName = getExecutorDisplayName(resolved.executor);
      const architectName = getArchitectDisplayName(resolved.architect);
      const executorFile = getExecutorFileName(resolved.executor);
      const architectFile = getArchitectFileName(resolved.architect);
      console.log(
        info(
          `Agents: executor=${executorName} (${executorFile}, ${resolved.executorSource})  architect=${architectName} (${architectFile}, ${resolved.architectSource})`,
        ),
      );

      const files: Array<[string, string]> = [
        ["TOCKET.md", tocketMd(projectName, executorFile, architectFile)],
        [executorFile, executorFile === ".cursorrules"
          ? cursorrulesMd(projectName, description, architectFile)
          : executorMd(projectName, description, executorName, architectFile)],
        [architectFile, architectMd(projectName, description, architectName, executorName, executorFile)],
        [join(".context", "activeContext.md"), activeContextMd(projectName)],
        [join(".context", "systemPatterns.md"), systemPatternsMd(projectName, architectName, executorName)],
        [
          join(".context", "productContext.md"),
          productContextMd(projectName, description),
        ],
        [
          join(".context", "techContext.md"),
          techContextMd(projectName, hasDetection ? stack : undefined),
        ],
        [join(".context", "progress.md"), progressMd(projectName)],
        [TOCKET_SKILL_REL, tocketSkillMd()],
      ];

      if (!minimal) {
        files.push(["AGENTS.md", agentsMd(projectName, description, executorName, architectName)]);
      }

      const minimalPaths = new Set([
        "TOCKET.md",
        join(".context", "activeContext.md"),
        join(".context", "systemPatterns.md"),
      ]);
      const filesToWrite = minimal
        ? files.filter(([path]) => minimalPaths.has(path))
        : files;

      const templateVars: TemplateVars = {
        projectName,
        description,
        date: new Date().toISOString().split("T")[0],
        architectName,
        executorName,
        architectFile,
        executorFile,
      };

      for (const [filePath, builtInContent] of filesToWrite) {
        const fullPath = join(cwd, filePath);
        const exists = await fileExists(fullPath);

        if (exists && !force) {
          const overwrite = await confirm({
            message: `${filePath} already exists. Overwrite?`,
            default: false,
          });
          if (!overwrite) {
            console.log("  " + dim(`skipped ${filePath}`));
            continue;
          }
        }

        await mkdir(dirname(fullPath), { recursive: true });

        const userContent = await readGlobalTemplate(filePath, templateVars);
        const content = userContent ?? builtInContent;

        await writeFile(fullPath, content, "utf-8");
        console.log("  " + success(`${exists ? "updated" : "created"} ${filePath}`));
      }

      const gitignoreWarning = checkGitignoreConflict(cwd);
      if (gitignoreWarning) {
        console.log("\n  " + warn(gitignoreWarning));
      }

      console.log(
        "\n" + success(`Workspace initialized for ${projectName}!`) +
        (hasDetection ? dim(" Stack pre-populated from package.json.") : "") +
        "\n" + dim("  Next: tocket decide --dry-run --state '{\"goal\":\"docs\"}' --choice next:research,write,review") +
        "\n" + dim("  Optional TYPESAFE_API_KEY for live Jev; else decide uses the stub.") +
        "\n" + dim("  Workers (Cursor, Claude, GrokBot, CI) execute. Tocket does not.\n") +
        tocketConventionsHint()
          .split("\n")
          .map((line) => dim(`  ${line}`))
          .join("\n") +
        "\n"
      );
    });
}
