import type { Command } from "commander";
import { input } from "@inquirer/prompts";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import type { StackInfo } from "../templates/memory-bank.js";
import {
  claudeMd,
  geminiMd,
  tocketMd,
  activeContextMd,
  systemPatternsMd,
  productContextMd,
  techContextMd,
  progressMd,
  cursorrulesMd,
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

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Scaffold an agentic workspace with Memory Bank and triangulation config")
    .action(async () => {
      const cwd = process.cwd();
      const { stack, detectedName, detectedDescription } = await detectStack(cwd);

      const hasDetection = Boolean(stack.language);
      if (hasDetection) {
        console.log("\n  Auto-detected stack from package.json:");
        if (stack.language) console.log(`    Language:  ${stack.language}`);
        if (stack.runtime) console.log(`    Runtime:   ${stack.runtime}`);
        if (stack.build) console.log(`    Build:     ${stack.build}`);
        if (stack.framework) console.log(`    Framework: ${stack.framework}`);
        if (stack.extras.length)
          console.log(`    Extras:    ${stack.extras.join(", ")}`);
        console.log();
      }

      const projectName = await input({
        message: "Project Name:",
        default: detectedName || undefined,
      });
      const description = await input({
        message: "Short Description:",
        default: detectedDescription || undefined,
      });

      const contextDir = join(cwd, ".context");
      await mkdir(contextDir, { recursive: true });

      const files: Array<[string, string]> = [
        ["TOCKET.md", tocketMd(projectName)],
        ["CLAUDE.md", claudeMd(projectName, description)],
        ["GEMINI.md", geminiMd(projectName, description)],
        [".cursorrules", cursorrulesMd(projectName, description)],
        [join(".context", "activeContext.md"), activeContextMd(projectName)],
        [join(".context", "systemPatterns.md"), systemPatternsMd(projectName)],
        [
          join(".context", "productContext.md"),
          productContextMd(projectName, description),
        ],
        [
          join(".context", "techContext.md"),
          techContextMd(projectName, hasDetection ? stack : undefined),
        ],
        [join(".context", "progress.md"), progressMd(projectName)],
      ];

      for (const [filePath, content] of files) {
        const fullPath = join(cwd, filePath);
        await writeFile(fullPath, content, "utf-8");
        console.log(`  created ${filePath}`);
      }

      console.log(
        `\nAgentic workspace initialized for ${projectName}!${hasDetection ? " Stack pre-populated from package.json." : ""} Ready to launch.`
      );
    });
}
