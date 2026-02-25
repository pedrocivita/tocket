import type { Command } from "commander";
import { input, select, confirm } from "@inquirer/prompts";
import {
  getConfig,
  saveConfig,
  resetConfig,
  getConfigPath,
} from "../utils/config.js";
import { success, heading, dim } from "../utils/theme.js";

export function registerConfigCommand(program: Command): void {
  program
    .command("config")
    .description("Manage global Tocket configuration (~/.tocketrc.json)")
    .option("--author <name>", "Set default author name")
    .option("--agent <name>", "Set default agent name")
    .option("--priority <level>", "Set default priority (high|medium|low)")
    .option("--skills <list>", "Set default skills (comma-separated)")
    .option("--show", "Display current configuration")
    .option("--path", "Show config file path")
    .option("--reset", "Reset configuration to defaults")
    .action(
      async (options: {
        author?: string;
        agent?: string;
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
          options.author || options.agent || options.priority || options.skills;

        if (hasFlags) {
          const config = await getConfig();
          if (options.author) config.author = options.author;
          if (options.agent) config.defaultAgent = options.agent;
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

        const author = await input({
          message: "Author name:",
          default: current.author || undefined,
        });

        const agent = await input({
          message: "Default agent name:",
          default: current.defaultAgent || undefined,
        });

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
          defaultAgent: agent || undefined,
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
