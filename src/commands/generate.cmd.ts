import type { Command } from "commander";
import { input, select, number } from "@inquirer/prompts";
import clipboard from "clipboardy";

function inferMode(score: number): string {
  if (score <= 6) return "solo";
  if (score <= 10) return "team-small";
  return "team-full";
}

function buildPayloadXml(opts: {
  intent: string;
  scope: string;
  priority: string;
  skills: string;
  model: string;
  complexity: number;
}): string {
  const mode = inferMode(opts.complexity);
  const skillLines = opts.skills
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `      <skill>${s}</skill>`)
    .join("\n");

  return `<payload version="3.0">
  <meta>
    <intent>${opts.intent}</intent>
    <scope>${opts.scope}</scope>
    <priority>${opts.priority}</priority>
    <complexity score="${opts.complexity}" mode="${mode}" />
    <model>${opts.model}</model>
  </meta>

  <skills>
${skillLines || "      <!-- Add skills here -->"}
  </skills>

  <context>
    <!-- Provide relevant context for the Architect -->
  </context>

  <tasks>
    <!-- The Architect will populate tasks based on the intent -->
  </tasks>

  <validate>
    <!-- Define acceptance criteria -->
  </validate>
</payload>`;
}

export function registerGenerateCommand(program: Command): void {
  program
    .command("generate")
    .description("Build payload XMLs interactively for Architect-Executor handoff")
    .action(async () => {
      const intent = await input({ message: "Intent (goal in one line):" });

      const scope = await input({ message: "Scope (files/folders affected):" });

      const priority = await select({
        message: "Priority:",
        choices: [
          { value: "high", name: "high" },
          { value: "medium", name: "medium" },
          { value: "low", name: "low" },
        ],
      });

      const skills = await input({
        message: "Skills/plugins (comma-separated):",
      });

      const model = await select({
        message: "Architect model:",
        choices: [
          {
            value: "gemini-3.1-pro-preview-customtools",
            name: "gemini-3.1-pro-preview-customtools (default)",
          },
          { value: "gemini-2.5-pro", name: "gemini-2.5-pro" },
        ],
      });

      const complexity = await number({
        message: "Complexity score (0-15):",
        min: 0,
        max: 15,
        required: true,
      });

      const xml = buildPayloadXml({
        intent,
        scope,
        priority,
        skills,
        model,
        complexity: complexity ?? 0,
      });

      clipboard.writeSync(xml);

      console.log(
        "\n\x1b[32m✓\x1b[0m Payload XML (v3.0) copied to clipboard! Paste it into your Architect to continue."
      );
    });
}
