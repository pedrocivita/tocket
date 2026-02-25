import type { Command } from "commander";
import { input, select, confirm } from "@inquirer/prompts";
import { writeFileSync } from "node:fs";
import { success, heading, dim, banner } from "../utils/theme.js";
import { getConfig } from "../utils/config.js";
import { getStagedFiles, getModifiedFiles, getLastCommitMessage } from "../utils/git.js";

export interface TaskInput {
  intent: string;
  scope: string;
  priority: string;
  skills: string;
}

export function buildPayloadXml(tasks: TaskInput[]): string {
  const first = tasks[0];
  const skillsAttr = first.skills.trim()
    ? `\n    <skills>${first.skills.trim()}</skills>`
    : "";

  const taskBlocks = tasks
    .map(
      (t, i) => `    <task id="${i + 1}" type="create | edit | delete">
      <target><!-- file/path --></target>
      <action>${t.intent}</action>
      <spec><!-- Detailed specification --></spec>
      <done><!-- Definition of done --></done>
    </task>`,
    )
    .join("\n");

  return `<payload version="2.0">
  <meta>
    <intent>${first.intent}</intent>
    <scope>${first.scope}</scope>${skillsAttr}
    <priority>${first.priority}</priority>
  </meta>

  <context>
    <summary><!-- Background and reasoning --></summary>
  </context>

  <tasks>
${taskBlocks}
  </tasks>

  <validate>
    <check><!-- How to verify success --></check>
  </validate>
</payload>`;
}

export function suggestScope(): string {
  const staged = getStagedFiles();
  const modified = getModifiedFiles();
  const all = [...new Set([...staged, ...modified])];
  return all.join(", ");
}

export function registerGenerateCommand(program: Command): void {
  program
    .command("generate")
    .description("Build payload XMLs interactively for Architect-Executor handoff")
    .option("--no-preview", "Skip payload preview before copying")
    .option("--to <target>", "Output target: clipboard (default), stdout, or file path")
    .action(async (options: { preview?: boolean; to?: string }) => {
      const config = await getConfig();

      if (!config.theme?.disableBanner) {
        console.log(banner());
      }

      const tasks: TaskInput[] = [];
      const suggestedScope = suggestScope();
      const defaultPriority = config.defaults?.priority ?? "medium";
      const defaultSkills = config.defaults?.skills ?? "";

      let addMore = true;
      while (addMore) {
        const taskNum = tasks.length + 1;
        if (taskNum > 1) {
          console.log(heading(`\n  Task ${taskNum}\n`));
        }

        const lastCommit = getLastCommitMessage();
        const intent = await input({
          message: "Intent (goal in one line):",
          default: lastCommit || undefined,
        });

        const scope = await input({
          message: "Scope (files/folders affected):",
          default: taskNum === 1 && suggestedScope ? suggestedScope : undefined,
        });

        const priority = await select({
          message: "Priority:",
          choices: [
            { value: "high" as const, name: "high" },
            { value: "medium" as const, name: "medium" },
            { value: "low" as const, name: "low" },
          ],
          default: defaultPriority,
        });

        const skills = await input({
          message: "Skills/plugins (comma-separated, optional):",
          default: taskNum === 1 && defaultSkills ? defaultSkills : undefined,
        });

        tasks.push({ intent, scope, priority, skills });

        addMore = await confirm({
          message: "Add another task?",
          default: false,
        });
      }

      const xml = buildPayloadXml(tasks);

      // Preview
      if (options.preview !== false) {
        console.log(dim("\n--- Payload Preview ---"));
        const lines = xml.split("\n");
        const preview = lines.length > 20
          ? lines.slice(0, 20).join("\n") + dim("\n  ... (" + (lines.length - 20) + " more lines)")
          : lines.join("\n");
        console.log(dim(preview));
        console.log(dim("--- End Preview ---\n"));
      }

      const target = options.to ?? "clipboard";
      if (target === "stdout") {
        console.log(xml);
      } else if (target === "clipboard") {
        const { default: clipboard } = await import("clipboardy");
        clipboard.writeSync(xml);
        console.log(
          success(`Payload XML (v2.0) copied to clipboard!`) +
          dim(` ${tasks.length} task(s).`) +
          "\n" +
          dim("  Paste it into your Architect to continue.\n"),
        );
      } else {
        writeFileSync(target, xml, "utf-8");
        console.log(
          success(`Payload XML (v2.0) written to ${target}!`) +
          dim(` ${tasks.length} task(s).\n`),
        );
      }
    });
}
