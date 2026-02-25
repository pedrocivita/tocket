import type { Command } from "commander";
import { select } from "@inquirer/prompts";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { banner, heading, success, dim, warn } from "../utils/theme.js";
import { getConfig } from "../utils/config.js";

type Action = "init" | "generate" | "sync" | "validate" | "config" | "focus" | "eject" | "exit";

function extractFocus(content: string): string {
  const match = content.match(/## Current Focus\s*\n+(.+)/);
  if (!match?.[1]) return "";
  const line = match[1].trim();
  if (line.startsWith("_") || line.includes("No active tasks")) return "";
  return line.length > 80 ? line.substring(0, 77) + "..." : line;
}

export async function showDashboard(program: Command): Promise<void> {
  const config = await getConfig();
  const cwd = process.cwd();
  const hasWorkspace = existsSync(join(cwd, ".context"));

  if (!config.theme?.disableBanner) {
    console.log(banner());
  }

  console.log(heading("  Dashboard\n"));

  if (hasWorkspace) {
    console.log("  " + success("Workspace detected"));

    try {
      const ctx = await readFile(
        join(cwd, ".context", "activeContext.md"),
        "utf-8",
      );
      const focus = extractFocus(ctx);
      if (focus) {
        console.log("  " + dim(`Focus: ${focus}`));
      }
    } catch {
      // activeContext.md missing or unreadable — ignore
    }
  } else {
    console.log("  " + warn("No workspace in this directory"));
    console.log(
      "  " + dim("Run init to scaffold a Tocket workspace here.\n"),
    );
  }

  console.log();

  const choices: Array<{ value: Action; name: string }> = hasWorkspace
    ? [
        { value: "generate", name: "Generate payload" },
        { value: "sync", name: "Sync progress" },
        { value: "validate", name: "Validate workspace" },
        { value: "focus", name: "Update focus" },
        { value: "config", name: "Configure settings" },
        { value: "eject", name: "Eject workspace" },
        { value: "exit", name: "Exit" },
      ]
    : [
        { value: "init", name: "Initialize workspace" },
        { value: "config", name: "Configure settings" },
        { value: "exit", name: "Exit" },
      ];

  const action = await select({
    message: "What would you like to do?",
    choices,
  });

  if (action === "exit") {
    console.log(dim("\n  Goodbye!\n"));
    return;
  }

  console.log();
  await program.parseAsync(["node", "tocket", action]);
}
