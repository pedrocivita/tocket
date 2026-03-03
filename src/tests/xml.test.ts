import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePayloadXml } from "../utils/xml.js";

const sampleXml = `<payload version="2.0">
  <meta>
    <intent>Add input validation</intent>
    <scope>src/commands/sync.cmd.ts</scope>
    <skills>core,lsp</skills>
    <priority>medium</priority>
  </meta>

  <context>
    <summary>Adding validation to sync command</summary>
  </context>

  <tasks>
    <task id="1" type="edit">
      <target>src/commands/sync.cmd.ts</target>
      <action>Add input validation</action>
      <spec>Validate summary is non-empty</spec>
      <done>Summary validation works</done>
    </task>
    <task id="2" type="create">
      <target>src/utils/validation.ts</target>
      <action>Create validation utility</action>
      <spec>Reusable validators</spec>
      <done>Utility is importable</done>
    </task>
  </tasks>

  <validate>
    <check>npm test passes</check>
    <check>sync command rejects empty summary</check>
  </validate>
</payload>`;

describe("parsePayloadXml", () => {
  it("extracts version", () => {
    const result = parsePayloadXml(sampleXml);
    assert.equal(result.version, "2.0");
  });

  it("extracts meta fields", () => {
    const result = parsePayloadXml(sampleXml);
    assert.equal(result.meta.intent, "Add input validation");
    assert.equal(result.meta.scope, "src/commands/sync.cmd.ts");
    assert.equal(result.meta.skills, "core,lsp");
    assert.equal(result.meta.priority, "medium");
  });

  it("extracts tasks with correct ids and types", () => {
    const result = parsePayloadXml(sampleXml);
    assert.equal(result.tasks.length, 2);
    assert.equal(result.tasks[0].id, "1");
    assert.equal(result.tasks[0].type, "edit");
    assert.equal(result.tasks[1].id, "2");
    assert.equal(result.tasks[1].type, "create");
  });

  it("extracts task targets", () => {
    const result = parsePayloadXml(sampleXml);
    assert.equal(result.tasks[0].target, "src/commands/sync.cmd.ts");
    assert.equal(result.tasks[1].target, "src/utils/validation.ts");
  });

  it("extracts task actions", () => {
    const result = parsePayloadXml(sampleXml);
    assert.equal(result.tasks[0].action, "Add input validation");
    assert.equal(result.tasks[1].action, "Create validation utility");
  });

  it("extracts done criteria", () => {
    const result = parsePayloadXml(sampleXml);
    assert.equal(result.tasks[0].done, "Summary validation works");
    assert.equal(result.tasks[1].done, "Utility is importable");
  });

  it("extracts validation checks", () => {
    const result = parsePayloadXml(sampleXml);
    assert.equal(result.checks.length, 2);
    assert.equal(result.checks[0], "npm test passes");
    assert.equal(result.checks[1], "sync command rejects empty summary");
  });

  it("strips placeholder comments from values", () => {
    const xml = `<payload version="2.0">
  <meta>
    <intent>Test</intent>
    <scope>src/</scope>
    <skills></skills>
    <priority>low</priority>
  </meta>
  <tasks>
    <task id="1" type="create | edit | delete">
      <target><!-- file/path --></target>
      <action>Do something</action>
      <spec><!-- Detailed specification --></spec>
      <done><!-- Definition of done --></done>
    </task>
  </tasks>
  <validate>
    <check><!-- How to verify success --></check>
  </validate>
</payload>`;
    const result = parsePayloadXml(xml);
    assert.equal(result.tasks[0].target, "");
    assert.equal(result.tasks[0].done, "");
    assert.equal(result.checks.length, 0);
  });

  it("handles payload without skills tag", () => {
    const xml = `<payload version="2.0">
  <meta>
    <intent>Test</intent>
    <scope>src/</scope>
    <priority>low</priority>
  </meta>
  <tasks></tasks>
  <validate></validate>
</payload>`;
    const result = parsePayloadXml(xml);
    assert.equal(result.meta.skills, "");
    assert.equal(result.tasks.length, 0);
    assert.equal(result.checks.length, 0);
  });

  it("handles task with skill attribute", () => {
    const xml = `<payload version="2.0">
  <meta>
    <intent>Test</intent>
    <scope>src/</scope>
    <priority>low</priority>
  </meta>
  <tasks>
    <task id="1" type="edit" skill="core">
      <target>src/foo.ts</target>
      <action>Edit foo</action>
      <spec>Details</spec>
      <done>Foo edited</done>
    </task>
  </tasks>
  <validate></validate>
</payload>`;
    const result = parsePayloadXml(xml);
    assert.equal(result.tasks.length, 1);
    assert.equal(result.tasks[0].target, "src/foo.ts");
  });
});
