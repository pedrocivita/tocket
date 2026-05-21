import type { Command } from "commander";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { success, error as themeError, heading, info, warn, dim } from "../utils/theme.js";

// Convert kebab-case to PascalCase
function toPascalCase(kebab: string): string {
  return kebab
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

// Check if a command name already exists
function commandExists(cwd: string, name: string): boolean {
  const cmdPath = join(cwd, "src", "commands", `${name}.cmd.ts`);
  return existsSync(cmdPath);
}

export function registerScaffoldCommand(program: Command): void {
  program
    .command("scaffold command <name>")
    .description("Generate boilerplate for a new Tocket CLI command")
    .action((name: string) => {
      const cwd = process.cwd();

      // Validate command name
      if (!name || name.length === 0) {
        console.error(themeError("Command name is required"));
        process.exitCode = 1;
        return;
      }

      // Check if command already exists
      if (commandExists(cwd, name)) {
        console.error(themeError(`Command '${name}' already exists at src/commands/${name}.cmd.ts`));
        process.exitCode = 1;
        return;
      }

      const pascalName = toPascalCase(name);
      const cmdDir = join(cwd, "src", "commands");
      const testDir = join(cwd, "src", "tests");
      const cmdPath = join(cmdDir, `${name}.cmd.ts`);
      const testPath = join(testDir, `${name}.test.ts`);

      // Create command boilerplate
      const cmdContent = `import type { Command } from "commander";
import { success, error as themeError, heading, info } from "../utils/theme.js";

export function register${pascalName}Command(program: Command): void {
  program
    .command("${name}")
    .description("TODO: Add description")
    .action(async () => {
      try {
        // TODO: Implement command logic
        console.log(info("${pascalName} command executed"));
        console.log(success("${pascalName} completed successfully!\\n"));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(themeError(\`Failed to execute ${name}: \${message}\`));
        process.exitCode = 1;
      }
    });
}
`;

      // Create test boilerplate
      const testContent = `import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

// Path to the built CLI
const cliPath = join(import.meta.dirname, "..", "index.js");

describe("${name} command", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-${name}-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("executes ${name} command successfully", () => {
    const output = execSync(
      \`node "\${cliPath}" ${name}\`,
      { cwd: tempDir, encoding: "utf-8" },
    );

    assert.ok(output.includes("${pascalName} command executed"));
  });
});
`;

      try {
        // Ensure directories exist
        if (!existsSync(cmdDir)) {
          mkdirSync(cmdDir, { recursive: true });
        }
        if (!existsSync(testDir)) {
          mkdirSync(testDir, { recursive: true });
        }

        // Write files
        writeFileSync(cmdPath, cmdContent, "utf-8");
        writeFileSync(testPath, testContent, "utf-8");

        // Success output
        console.log(heading("\n  Scaffold created\n"));
        console.log(success(`Created: src/commands/${name}.cmd.ts`));
        console.log(success(`Created: src/tests/${name}.test.ts`));

        // Registration instructions
        console.log(info("\nNext steps:"));
        console.log(dim(`  1. Update the command logic in src/commands/${name}.cmd.ts`));
        console.log(dim(`  2. Update the tests in src/tests/${name}.test.ts`));
        console.log(
          dim(`  3. Register the command in src/index.ts by adding:`),
        );
        console.log(dim(`\n     import { register${pascalName}Command } from "./commands/${name}.cmd.js";\n`));
        console.log(dim(`     register${pascalName}Command(program);\n`));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(themeError(`Failed to scaffold command: ${message}`));
        process.exitCode = 1;
      }
    });
}
