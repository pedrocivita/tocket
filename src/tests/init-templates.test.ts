import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import {
  interpolateTemplate,
  readGlobalTemplate,
  getGlobalTemplatesPath,
} from "../utils/templates.js";
import type { TemplateVars } from "../utils/templates.js";

const vars: TemplateVars = {
  projectName: "MyProject",
  description: "A test project",
  date: "2026-02-25",
};

// ─── interpolateTemplate ────────────────────────────────────────────

describe("interpolateTemplate", () => {
  it("replaces {{projectName}}", () => {
    const result = interpolateTemplate("Hello {{projectName}}", vars);
    assert.equal(result, "Hello MyProject");
  });

  it("replaces {{description}}", () => {
    const result = interpolateTemplate("Desc: {{description}}", vars);
    assert.equal(result, "Desc: A test project");
  });

  it("replaces {{date}}", () => {
    const result = interpolateTemplate("Date: {{date}}", vars);
    assert.equal(result, "Date: 2026-02-25");
  });

  it("replaces all variables in a single string", () => {
    const tpl = "# {{projectName}}\n> {{description}}\nCreated: {{date}}";
    const result = interpolateTemplate(tpl, vars);
    assert.ok(result.includes("# MyProject"));
    assert.ok(result.includes("> A test project"));
    assert.ok(result.includes("Created: 2026-02-25"));
  });

  it("replaces multiple occurrences of the same variable", () => {
    const tpl = "{{projectName}} and {{projectName}} again";
    const result = interpolateTemplate(tpl, vars);
    assert.equal(result, "MyProject and MyProject again");
  });

  it("leaves unknown placeholders untouched", () => {
    const result = interpolateTemplate("{{unknown}} stays", vars);
    assert.equal(result, "{{unknown}} stays");
  });

  it("handles empty description", () => {
    const emptyVars: TemplateVars = { ...vars, description: "" };
    const result = interpolateTemplate("Desc: {{description}}.", emptyVars);
    assert.equal(result, "Desc: .");
  });

  it("returns content unchanged when no placeholders exist", () => {
    const raw = "No placeholders here.";
    const result = interpolateTemplate(raw, vars);
    assert.equal(result, raw);
  });
});

// ─── getGlobalTemplatesPath ─────────────────────────────────────────

describe("getGlobalTemplatesPath", () => {
  it("returns a path containing .tocket/templates", () => {
    const p = getGlobalTemplatesPath();
    assert.ok(p.includes(".tocket"));
    assert.ok(p.includes("templates"));
  });

  it("respects baseDir override", () => {
    const base = join(tmpdir(), "custom-base");
    const p = getGlobalTemplatesPath(base);
    assert.ok(p.startsWith(base));
    assert.ok(p.includes(".tocket"));
    assert.ok(p.includes("templates"));
  });
});

// ─── readGlobalTemplate - fallback ──────────────────────────────────

describe("readGlobalTemplate - fallback", () => {
  it("returns null when templates directory does not exist", async () => {
    const result = await readGlobalTemplate("CLAUDE.md", vars, "/nonexistent/path");
    assert.equal(result, null);
  });

  it("returns null when specific file does not exist in templates dir", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "tocket-tpl-fallback-"));
    try {
      const result = await readGlobalTemplate("CLAUDE.md", vars, tempDir);
      assert.equal(result, null);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

// ─── readGlobalTemplate - override ──────────────────────────────────

describe("readGlobalTemplate - override", () => {
  let tempDir: string;

  before(() => {
    tempDir = mkdtempSync(join(tmpdir(), "tocket-tpl-override-"));
    mkdirSync(join(tempDir, ".context"), { recursive: true });
    writeFileSync(
      join(tempDir, "CLAUDE.md"),
      "# Custom CLAUDE for {{projectName}}\n> {{description}}\n",
      "utf-8",
    );
    writeFileSync(
      join(tempDir, ".context", "activeContext.md"),
      "# Active Context - {{projectName}}\nDate: {{date}}\n",
      "utf-8",
    );
    writeFileSync(
      join(tempDir, "TOCKET.md"),
      "Static content without any variables.\n",
      "utf-8",
    );
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("reads and interpolates a flat file override", async () => {
    const result = await readGlobalTemplate("CLAUDE.md", vars, tempDir);
    assert.ok(result !== null);
    assert.ok(result.includes("# Custom CLAUDE for MyProject"));
    assert.ok(result.includes("> A test project"));
  });

  it("reads and interpolates a subdirectory file override", async () => {
    const filePath = join(".context", "activeContext.md");
    const result = await readGlobalTemplate(filePath, vars, tempDir);
    assert.ok(result !== null);
    assert.ok(result.includes("# Active Context - MyProject"));
    assert.ok(result.includes("Date: 2026-02-25"));
  });

  it("returns content as-is when template has no placeholders", async () => {
    const result = await readGlobalTemplate("TOCKET.md", vars, tempDir);
    assert.equal(result, "Static content without any variables.\n");
  });

  it("returns null for a file not in the override directory", async () => {
    const result = await readGlobalTemplate("GEMINI.md", vars, tempDir);
    assert.equal(result, null);
  });
});

// ─── init integration - built-in fallback ───────────────────────────

describe("init - built-in fallback (integration)", () => {
  let tempDir: string;
  const cliPath = join(import.meta.dirname, "..", "index.js");

  before(() => {
    tempDir = mkdtempSync(join(tmpdir(), "tocket-tpl-init-"));
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates files with built-in content when no global templates exist", () => {
    execSync(
      `node "${cliPath}" init --minimal --name TestFallback --description "Fallback test" --force`,
      { cwd: tempDir, encoding: "utf-8" },
    );
    assert.ok(existsSync(join(tempDir, "TOCKET.md")));
    assert.ok(existsSync(join(tempDir, ".context", "activeContext.md")));
    assert.ok(existsSync(join(tempDir, ".context", "systemPatterns.md")));

    const tocket = readFileSync(join(tempDir, "TOCKET.md"), "utf-8");
    assert.ok(tocket.includes("TestFallback"));

    const active = readFileSync(join(tempDir, ".context", "activeContext.md"), "utf-8");
    assert.ok(active.includes("TestFallback"));
  });
});
