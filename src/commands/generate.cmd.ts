import type { Command } from "commander";
import { input, select } from "@inquirer/prompts";
import clipboard from "clipboardy";

function buildPayloadXml(opts: {
  intent: string;
  scope: string;
  priority: string;
  skills: string;
}): string {
  const skillsAttr = opts.skills.trim()
    ? `\n    <skills>${opts.skills.trim()}</skills>`
    : "";

  return `<payload version="2.0">
  <meta>
    <intent>${opts.intent}</intent>
    <scope>${opts.scope}</scope>${skillsAttr}
    <priority>${opts.priority}</priority>
  </meta>

  <context>
    <summary><!-- Background and reasoning --></summary>
  </context>

  <tasks>
    <task id="1" type="create | edit | delete">
      <target><!-- file/path --></target>
      <action><!-- What to do --></action>
      <spec><!-- Detailed specification --></spec>
      <done><!-- Definition of done --></done>
    </task>
  </tasks>

  <validate>
    <check><!-- How to verify success --></check>
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
        message: "Skills/plugins (comma-separated, optional):",
      });

      const xml = buildPayloadXml({ intent, scope, priority, skills });

      clipboard.writeSync(xml);

      console.log(
        "\n\x1b[32m\u2713\x1b[0m Payload XML (v2.0) copied to clipboard! Paste it into your Architect to continue."
      );
    });
}
