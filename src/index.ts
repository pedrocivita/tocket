#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { registerInitCommand } from "./commands/init.cmd.js";
import { registerGenerateCommand } from "./commands/generate.cmd.js";
import { registerSyncCommand } from "./commands/sync.cmd.js";
import { registerValidateCommand } from "./commands/validate.cmd.js";

const pkg = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "package.json"), "utf-8"),
) as { version: string };

const program = new Command();

program
  .name("tocket")
  .description("The Context Engineering Framework for Multi-Agent Workspaces")
  .version(pkg.version);

registerInitCommand(program);
registerGenerateCommand(program);
registerSyncCommand(program);
registerValidateCommand(program);

program.parse();
