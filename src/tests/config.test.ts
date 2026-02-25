import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getConfig,
  saveConfig,
  updateConfig,
  resetConfig,
} from "../utils/config.js";
import type { TocketConfig } from "../utils/config.js";

describe("config - read and write", () => {
  let tempDir: string;
  let configPath: string;

  before(() => {
    tempDir = mkdtempSync(join(tmpdir(), "tocket-config-test-"));
    configPath = join(tempDir, ".tocketrc.json");
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("getConfig returns empty object when file does not exist", async () => {
    const config = await getConfig(configPath);
    assert.deepEqual(config, {});
  });

  it("saveConfig writes a valid config", async () => {
    const data: TocketConfig = { author: "Test User" };
    await saveConfig(data, configPath);
    const config = await getConfig(configPath);
    assert.equal(config.author, "Test User");
  });

  it("saveConfig preserves all fields", async () => {
    const data: TocketConfig = {
      author: "Alice",
      defaultAgent: "Claude",
      defaults: { priority: "high", skills: "core,lsp" },
      theme: { disableBanner: true },
    };
    await saveConfig(data, configPath);
    const config = await getConfig(configPath);
    assert.equal(config.author, "Alice");
    assert.equal(config.defaultAgent, "Claude");
    assert.equal(config.defaults?.priority, "high");
    assert.equal(config.defaults?.skills, "core,lsp");
    assert.equal(config.theme?.disableBanner, true);
  });

  it("updateConfig merges without overwriting", async () => {
    await saveConfig({ author: "Bob", defaultAgent: "Gemini" }, configPath);
    await updateConfig({ author: "Charlie" }, configPath);
    const config = await getConfig(configPath);
    assert.equal(config.author, "Charlie");
    assert.equal(config.defaultAgent, "Gemini");
  });

  it("updateConfig merges nested defaults", async () => {
    await saveConfig(
      { defaults: { priority: "low", skills: "a,b" } },
      configPath,
    );
    await updateConfig({ defaults: { priority: "high" } }, configPath);
    const config = await getConfig(configPath);
    assert.equal(config.defaults?.priority, "high");
    assert.equal(config.defaults?.skills, "a,b");
  });

  it("resetConfig clears all data", async () => {
    await saveConfig({ author: "Remove Me" }, configPath);
    await resetConfig(configPath);
    const config = await getConfig(configPath);
    assert.deepEqual(config, {});
  });
});

describe("config - error handling", () => {
  it("getConfig returns empty object for non-existent path", async () => {
    const config = await getConfig("/nonexistent/path/.tocketrc.json");
    assert.deepEqual(config, {});
  });
});
