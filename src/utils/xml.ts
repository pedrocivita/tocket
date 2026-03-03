/** Lightweight parser for Tocket payload XML (self-generated, deterministic structure). */

export interface ParsedTask {
  id: string;
  type: string;
  target: string;
  action: string;
  spec: string;
  done: string;
}

export interface ParsedPayload {
  version: string;
  meta: {
    intent: string;
    scope: string;
    skills: string;
    priority: string;
  };
  tasks: ParsedTask[];
  checks: string[];
}

/** Strip XML comment placeholders like <!-- ... --> and trim. */
function clean(value: string | undefined): string {
  if (!value) return "";
  return value.replace(/<!--[\s\S]*?-->/g, "").trim();
}

/** Extract text content of a single XML tag from a block. */
function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const match = block.match(re);
  return clean(match?.[1]);
}

/** Parse a Tocket payload XML string into structured data. */
export function parsePayloadXml(xml: string): ParsedPayload {
  // Version
  const versionMatch = xml.match(/<payload\s+version="([^"]+)">/);
  const version = versionMatch?.[1] ?? "";

  // Meta
  const metaMatch = xml.match(/<meta>([\s\S]*?)<\/meta>/);
  const metaBlock = metaMatch?.[1] ?? "";

  const meta = {
    intent: extractTag(metaBlock, "intent"),
    scope: extractTag(metaBlock, "scope"),
    skills: extractTag(metaBlock, "skills"),
    priority: extractTag(metaBlock, "priority"),
  };

  // Tasks
  const tasks: ParsedTask[] = [];
  const taskRegex = /<task\s+id="([^"]*)"(?:\s+type="([^"]*)")?(?:\s+skill="[^"]*")?>([\s\S]*?)<\/task>/g;
  let taskMatch: RegExpExecArray | null;
  while ((taskMatch = taskRegex.exec(xml)) !== null) {
    const [, id, type, body] = taskMatch;
    tasks.push({
      id: id ?? "",
      type: clean(type),
      target: extractTag(body, "target"),
      action: extractTag(body, "action"),
      spec: extractTag(body, "spec"),
      done: extractTag(body, "done"),
    });
  }

  // Validation checks
  const checks: string[] = [];
  const checkRegex = /<check>([\s\S]*?)<\/check>/g;
  let checkMatch: RegExpExecArray | null;
  while ((checkMatch = checkRegex.exec(xml)) !== null) {
    const value = clean(checkMatch[1]);
    if (value) checks.push(value);
  }

  return { version, meta, tasks, checks };
}
