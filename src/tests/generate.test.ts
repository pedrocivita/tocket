import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPayloadXml } from "../commands/generate.cmd.js";
import type { TaskInput } from "../commands/generate.cmd.js";

describe("buildPayloadXml", () => {
  const baseTask: TaskInput = {
    intent: "Add input validation",
    scope: "src/commands/sync.cmd.ts",
    priority: "medium",
    skills: "",
  };

  it("produces valid XML with version 2.0", () => {
    const xml = buildPayloadXml([baseTask]);
    assert.ok(xml.includes('<payload version="2.0">'));
    assert.ok(xml.includes("</payload>"));
  });

  it("includes intent, scope, and priority in meta", () => {
    const xml = buildPayloadXml([baseTask]);
    assert.ok(xml.includes("<intent>Add input validation</intent>"));
    assert.ok(xml.includes("<scope>src/commands/sync.cmd.ts</scope>"));
    assert.ok(xml.includes("<priority>medium</priority>"));
  });

  it("omits skills tag when skills is empty", () => {
    const xml = buildPayloadXml([baseTask]);
    assert.ok(!xml.includes("<skills>"));
  });

  it("includes skills tag when skills is provided", () => {
    const task: TaskInput = { ...baseTask, skills: "core,lsp" };
    const xml = buildPayloadXml([task]);
    assert.ok(xml.includes("<skills>core,lsp</skills>"));
  });

  it("generates correct task ids for multiple tasks", () => {
    const tasks: TaskInput[] = [
      { ...baseTask, intent: "Task one" },
      { ...baseTask, intent: "Task two" },
      { ...baseTask, intent: "Task three" },
    ];
    const xml = buildPayloadXml(tasks);
    assert.ok(xml.includes('task id="1"'));
    assert.ok(xml.includes('task id="2"'));
    assert.ok(xml.includes('task id="3"'));
  });

  it("includes action text from each task intent", () => {
    const tasks: TaskInput[] = [
      { ...baseTask, intent: "First action" },
      { ...baseTask, intent: "Second action" },
    ];
    const xml = buildPayloadXml(tasks);
    assert.ok(xml.includes("<action>First action</action>"));
    assert.ok(xml.includes("<action>Second action</action>"));
  });

  it("includes validate section", () => {
    const xml = buildPayloadXml([baseTask]);
    assert.ok(xml.includes("<validate>"));
    assert.ok(xml.includes("<check>"));
  });

  it("uses first task meta for the payload-level meta", () => {
    const tasks: TaskInput[] = [
      { intent: "Main goal", scope: "src/", priority: "high", skills: "api" },
      { intent: "Secondary", scope: "test/", priority: "low", skills: "" },
    ];
    const xml = buildPayloadXml(tasks);
    // Meta should come from first task
    assert.ok(xml.includes("<intent>Main goal</intent>"));
    assert.ok(xml.includes("<scope>src/</scope>"));
    assert.ok(xml.includes("<priority>high</priority>"));
  });
});
