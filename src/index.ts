#!/usr/bin/env node

import { Command } from "commander";
import { registerInitCommand } from "./commands/init.cmd.js";
import { registerGenerateCommand } from "./commands/generate.cmd.js";
import { registerSyncCommand } from "./commands/sync.cmd.js";
import { registerValidateCommand } from "./commands/validate.cmd.js";

const program = new Command();

program
  .name("tocket")
  .description("The Context Engineering Framework for Multi-Agent Workspaces")
  .version("1.2.0");

registerInitCommand(program);
registerGenerateCommand(program);
registerSyncCommand(program);
registerValidateCommand(program);

program.parse();
