import type { Command } from "commander";
import { input, select, confirm } from "@inquirer/prompts";
import {
  getConfig,
  saveConfig,
  resetConfig,
  getConfigPath,
} from "../utils/config.js";
import { DEFAULT_ARCHITECT, DEFAULT_EXECUTOR } from "../utils/agents.js";
import { success, heading, dim } from "../utils/theme.js";

export function registerConfigCommand(program: Command): void {
  program
    .command("config")
    .description("Manage global Tocket configuration (~/.tocketrc.json)")
    .option("--author <name>", "Set default author name")
    .option("--agent <name>", "Set default agent name (deprecated, use --architect/--executor)")
    .option("--architect <name>", "Set architect agent (e.g. Gemini, ChatGPT)")
    .option("--executor <name>", "Set executor agent (e.g. \"Claude Code\", Cursor, Windsurf)")
    .option("--priority <level>", "Set default priority (high|medium|low)")
    .option("--skills <list>", "Set default skills (comma-separated)")
    .option("--show", "Display current configuration")
    .option("--path", "Show config file path")
    .option("--reset", "Reset configuration to defaults")
    .action(
      async (options: {
        author?: string;
        agent?: string;
        architect?: string;
        executor?: string;
        priority?: string;
        skills?: string;
        show?: boolean;
        path?: boolean;
        reset?: boolean;
      }) => {
        // --path: print and exit
        if (options.path) {
          console.log(getConfigPath());
          return;
        }

        // --show: display current config
        if (options.show) {
          const config = await getConfig();
          console.log(heading("\n  Current Configuration\n"));
          console.log(
            JSON.stringify(config, null, 2)
              .split("\n")
              .map((l) => "  " + l)
              .join("\n"),
          );
          console.log(dim(`\n  Path: ${getConfigPath()}\n`));
          return;
        }

        // --reset: clear config
        if (options.reset) {
          const ok = await confirm({
            message: "Reset all configuration to defaults?",
            default: false,
          });
          if (ok) {
            await resetConfig();
            console.log(success("Configuration reset."));
          }
          return;
        }

        // Non-interactive: handle individual flags
        const hasFlags =
          options.author || options.agent || options.architect ||
          options.executor || options.priority || options.skills;

        if (hasFlags) {
          const config = await getConfig();
          if (options.author) config.author = options.author;
          if (options.agent) config.defaultAgent = options.agent;
          if (options.architect) {
            if (!config.agents) config.agents = {};
            config.agents.architect = options.architect;
          }
          if (options.executor) {
            if (!config.agents) config.agents = {};
            config.agents.executor = options.executor;
          }
          if (options.priority) {
            if (!config.defaults) config.defaults = {};
            config.defaults.priority = options.priority as
              | "high"
              | "medium"
              | "low";
          }
          if (options.skills) {
            if (!config.defaults) config.defaults = {};
            config.defaults.skills = options.skills;
          }
          await saveConfig(config);
          console.log(success("Configuration updated."));
          return;
        }

        // Interactive TUI mode
        const current = await getConfig();

        console.log(heading("\n  Tocket Configuration\n"));

        // ── Identity ──
        console.log(dim("  ── Identity ──\n"));

        const author = await input({
          message: "Author name:",
          default: current.author || undefined,
        });

        // ── Agent Roles ──
        console.log(dim("\n  ── Agent Roles ──\n"));

        const architect = await input({
          message: "Architect (planner):",
          default: current.agents?.architect || DEFAULT_ARCHITECT,
        });

        const executor = await input({
          message: "Executor (implementer):",
          default: current.agents?.executor || DEFAULT_EXECUTOR,
        });

        // ── Payload Defaults ──
        console.log(dim("\n  ── Payload Defaults ──\n"));

        const priority = await select({
          message: "Default priority:",
          choices: [
            { value: "high" as const, name: "high" },
            { value: "medium" as const, name: "medium" },
            { value: "low" as const, name: "low" },
          ],
          default: current.defaults?.priority ?? "medium",
        });

        const skills = await input({
          message: "Default skills (comma-separated):",
          default: current.defaults?.skills || undefined,
        });

        await saveConfig({
          ...current,
          author: author || undefined,
          agents: {
            architect: architect || undefined,
            executor: executor || undefined,
          },
          defaults: {
            priority: priority as "high" | "medium" | "low",
            skills: skills || undefined,
          },
        });

        console.log("\n" + success("Configuration saved."));
        console.log(dim(`  Path: ${getConfigPath()}\n`));
      },
    );
}
