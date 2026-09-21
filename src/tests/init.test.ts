import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, execSync } from "node:child_process";
import { checkGitignoreConflict } from "../commands/init.cmd.js";
import { lf } from "./helpers.js";

// Path to the built CLI
const cliPath = join(import.meta.dirname, "..", "index.js");

/** Isolate ~/.tocketrc.json (HOME/USERPROFILE) so global config cannot leak into init tests. */
function isolatedInitEnv(home: string, extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    CURSOR_TRACE_ID: "",
    CURSOR_AGENT: "",
    CURSOR: "",
    CLAUDECODE: "",
    CLAUDE_CODE: "",
    ...extra,
  };
}

function runInitCli(
  cwd: string,
  args: string[],
  extraEnv: NodeJS.ProcessEnv = {},
  home = join(cwd, "_tocket-home"),
): string {
  mkdirSync(home, { recursive: true });
  return execFileSync(process.execPath, [cliPath, "init", ...args], {
    cwd,
    encoding: "utf-8",
    env: isolatedInitEnv(home, extraEnv),
    stdio: ["ignore", "pipe", "pipe"],
  });
}

describe("init --minimal", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-init-minimal-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates only essential files with --minimal --name --description --force", () => {
    runInitCli(tempDir, ["--minimal", "--name", "testproject", "--description", "A test", "--force"]);

    // Essential files should exist
    assert.ok(existsSync(join(tempDir, ".context", "activeContext.md")));
    assert.ok(existsSync(join(tempDir, ".context", "systemPatterns.md")));
    assert.ok(existsSync(join(tempDir, "TOCKET.md")));

    // Non-essential files should NOT exist
    assert.ok(!existsSync(join(tempDir, "CLAUDE.md")));
    assert.ok(!existsSync(join(tempDir, "GEMINI.md")));
    assert.ok(!existsSync(join(tempDir, "AGENTS.md")));
    assert.ok(!existsSync(join(tempDir, ".cursorrules")));
    assert.ok(!existsSync(join(tempDir, ".context", "productContext.md")));
    assert.ok(!existsSync(join(tempDir, ".context", "techContext.md")));
    assert.ok(!existsSync(join(tempDir, ".context", "progress.md")));
  });
});

describe("init --name --description (non-interactive)", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-init-flags-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates full workspace without interactive prompts", () => {
    const stdout = runInitCli(tempDir, [
      "--name",
      "flagproject",
      "--description",
      "Flag desc",
      "--executor",
      "Claude Code",
      "--architect",
      "Gemini",
      "--force",
    ]);

    // All 8 files should exist (not minimal, no .cursorrules by default)
    assert.ok(existsSync(join(tempDir, ".context", "activeContext.md")));
    assert.ok(existsSync(join(tempDir, ".context", "systemPatterns.md")));
    assert.ok(existsSync(join(tempDir, ".context", "productContext.md")));
    assert.ok(existsSync(join(tempDir, ".context", "techContext.md")));
    assert.ok(existsSync(join(tempDir, ".context", "progress.md")));
    assert.ok(existsSync(join(tempDir, "TOCKET.md")));
    assert.ok(existsSync(join(tempDir, "CLAUDE.md")));
    assert.ok(existsSync(join(tempDir, "GEMINI.md")));
    const skill = lf(readFileSync(join(tempDir, ".agents", "skills", "tocket", "SKILL.md"), "utf-8"));
    assert.match(skill, /^---\nname: tocket\n/);
    assert.match(skill, /npx skills add pedrocivita\/tocket --skill tocket/);
    // .cursorrules is only generated when executor is Cursor
    assert.ok(!existsSync(join(tempDir, ".cursorrules")));
    assert.ok(existsSync(join(tempDir, "AGENTS.md")));
    assert.match(readFileSync(join(tempDir, "AGENTS.md"), "utf-8"), /tool_gate/);
    assert.match(readFileSync(join(tempDir, "AGENTS.md"), "utf-8"), /Do not call `tocket decide` again/);
    assert.match(stdout, /npx skills add pedrocivita\/tocket --skill tocket/);
    assert.match(stdout, /Agents: executor=Claude Code/);
    assert.match(stdout, /Before expensive tools: tocket decide --dry-run/);
    assert.match(stdout, /\.agents\/skills\/tocket\/SKILL\.md/);
  });
});

describe("init --minimal file count", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-init-count-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("minimal creates exactly 3 files + 1 directory", () => {
    runInitCli(tempDir, ["--minimal", "--name", "counttest", "--description", "test", "--force"]);

    // Count files in .context/
    const contextDir = join(tempDir, ".context");
    assert.ok(existsSync(contextDir));

    // Exactly 2 files in .context/
    const contextFiles = ["activeContext.md", "systemPatterns.md"];
    for (const f of contextFiles) {
      assert.ok(existsSync(join(contextDir, f)), `${f} should exist`);
    }

    // These should NOT be in .context/ with minimal
    const skippedContextFiles = ["productContext.md", "techContext.md", "progress.md"];
    for (const f of skippedContextFiles) {
      assert.ok(!existsSync(join(contextDir, f)), `${f} should not exist in minimal mode`);
    }
  });
});

describe("init --executor Cursor", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-init-cursor-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("detects Cursor from env and writes .cursorrules", () => {
    const envDir = join(tempDir, "from-env");
    mkdirSync(envDir, { recursive: true });
    const home = join(tempDir, "from-env-home");
    const stdout = runInitCli(
      envDir,
      ["--name", "envcursor", "--description", "From env", "--force"],
      { CURSOR_TRACE_ID: "test-trace", cursor_trace_id: "test-trace" },
      home,
    );
    assert.ok(existsSync(join(envDir, ".cursorrules")), stdout);
    assert.ok(existsSync(join(envDir, "AGENTS.md")));
    assert.ok(!existsSync(join(envDir, "CLAUDE.md")));
    assert.match(stdout, /executor=Cursor \(\.cursorrules, env\)/);
  });

  it("writes .cursorrules and AGENTS.md without a human tutorial", () => {
    const stdout = runInitCli(tempDir, [
      "--name",
      "cursorproj",
      "--description",
      "Cursor app",
      "--executor",
      "Cursor",
      "--architect",
      "Gemini",
      "--force",
    ]);
    assert.ok(existsSync(join(tempDir, ".cursorrules")));
    assert.ok(existsSync(join(tempDir, "AGENTS.md")));
    assert.ok(existsSync(join(tempDir, "GEMINI.md")));
    assert.ok(!existsSync(join(tempDir, "CLAUDE.md")));
    assert.match(readFileSync(join(tempDir, ".cursorrules"), "utf-8"), /tool_gate/);
    assert.match(stdout, /executor=Cursor \(\.cursorrules, flag\)/);
  });
});

describe("checkGitignoreConflict", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "tocket-gitignore-"));

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns null when .context/ is not ignored", () => {
    execSync("git init", { cwd: tempDir });
    const result = checkGitignoreConflict(tempDir);
    assert.equal(result, null);
  });

  it("returns warning when .context/ is in .gitignore", () => {
    writeFileSync(join(tempDir, ".gitignore"), ".context/\n", "utf-8");
    const result = checkGitignoreConflict(tempDir);
    assert.ok(result !== null);
    assert.ok(result!.includes(".gitignore"));
  });

  it("returns null for non-git directory", () => {
    const nonGitDir = mkdtempSync(join(tmpdir(), "tocket-nogit-"));
    try {
      const result = checkGitignoreConflict(nonGitDir);
      assert.equal(result, null);
    } finally {
      rmSync(nonGitDir, { recursive: true, force: true });
    }
  });
});
